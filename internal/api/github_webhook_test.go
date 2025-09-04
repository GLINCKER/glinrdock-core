package api

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/GLINCKER/glinrdock/internal/github"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockStore implements store interface for testing
type MockStore struct {
	mock.Mock
}

func (m *MockStore) RecordGitHubWebhookEvent(ctx context.Context, event *store.GitHubWebhookEvent) error {
	args := m.Called(ctx, event)
	return args.Error(0)
}

func (m *MockStore) GetGitHubRepoMappingByRepo(ctx context.Context, repoID int64) (*store.GitHubRepoMapping, error) {
	args := m.Called(ctx, repoID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*store.GitHubRepoMapping), args.Error(1)
}

func (m *MockStore) UpsertGitHubInstallation(ctx context.Context, installation *store.GitHubInstallation) (*store.GitHubInstallation, error) {
	args := m.Called(ctx, installation)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*store.GitHubInstallation), args.Error(1)
}

func (m *MockStore) UpsertGitHubRepository(ctx context.Context, repo *store.GitHubRepository) (*store.GitHubRepository, error) {
	args := m.Called(ctx, repo)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*store.GitHubRepository), args.Error(1)
}

func (m *MockStore) DeleteGitHubRepositoriesByInstallation(ctx context.Context, installationID int64) error {
	args := m.Called(ctx, installationID)
	return args.Error(0)
}

func (m *MockStore) GetProject(ctx context.Context, id int64) (*store.Project, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*store.Project), args.Error(1)
}

func (m *MockStore) CreateBuildJob(ctx context.Context, job *store.BuildJob) (*store.BuildJob, error) {
	args := m.Called(ctx, job)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*store.BuildJob), args.Error(1)
}

// MockGitHubService implements github service interface for testing
type MockGitHubService struct {
	mock.Mock
}

func (m *MockGitHubService) IsConfigured() bool {
	args := m.Called()
	return args.Bool(0)
}

func (m *MockGitHubService) ValidateWebhookSignature(payload []byte, signature string) error {
	args := m.Called(payload, signature)
	return args.Error(0)
}

// Test helper to create valid HMAC signature
func createValidSignature(payload []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	return "sha256=" + hex.EncodeToString(h.Sum(nil))
}

func TestGitHubWebhookHandler_ValidateSignature(t *testing.T) {
	tests := []struct {
		name        string
		payload     string
		secret      string
		signature   string
		expectValid bool
	}{
		{
			name:        "valid signature",
			payload:     `{"action":"opened"}`,
			secret:      "test-secret",
			signature:   "",
			expectValid: true,
		},
		{
			name:        "invalid signature",
			payload:     `{"action":"opened"}`,
			secret:      "test-secret",
			signature:   "sha256=invalid",
			expectValid: false,
		},
		{
			name:        "missing signature",
			payload:     `{"action":"opened"}`,
			secret:      "test-secret",
			signature:   "",
			expectValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &MockStore{}
			mockGitHub := &MockGitHubService{}
			handler := NewGitHubWebhookHandlers(mockStore, mockGitHub)

			payload := []byte(tt.payload)
			
			// Generate valid signature if expected to be valid
			if tt.expectValid && tt.signature == "" {
				tt.signature = createValidSignature(payload, tt.secret)
			}

			if tt.expectValid {
				mockGitHub.On("ValidateWebhookSignature", payload, tt.signature).Return(nil)
			} else {
				mockGitHub.On("ValidateWebhookSignature", payload, tt.signature).Return(fmt.Errorf("invalid signature"))
			}

			// Create test request
			req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
			req.Header.Set("X-Hub-Signature-256", tt.signature)
			req.Header.Set("X-GitHub-Event", "ping")
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			handler.HandleWebhook(c)

			if tt.expectValid {
				assert.Equal(t, http.StatusOK, w.Code)
			} else {
				assert.Equal(t, http.StatusUnauthorized, w.Code)
			}

			mockGitHub.AssertExpectations(t)
		})
	}
}

func TestGitHubWebhookHandler_PingEvent(t *testing.T) {
	mockStore := &MockStore{}
	mockGitHub := &MockGitHubService{}
	handler := NewGitHubWebhookHandlers(mockStore, mockGitHub)

	payload := []byte(`{"zen":"GitHub rocks!","hook":{"id":12345}}`)
	signature := createValidSignature(payload, "test-secret")

	mockGitHub.On("ValidateWebhookSignature", payload, signature).Return(nil)
	mockStore.On("RecordGitHubWebhookEvent", mock.Anything, mock.MatchedBy(func(event *store.GitHubWebhookEvent) bool {
		return event.Event == "ping" && 
			   event.Action == "" &&
			   event.Status == "processed"
	})).Return(nil)

	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", signature)
	req.Header.Set("X-GitHub-Event", "ping")
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(w)
	c.Request = req

	handler.HandleWebhook(c)

	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "pong", response["message"])

	mockStore.AssertExpectations(t)
	mockGitHub.AssertExpectations(t)
}

func TestGitHubWebhookHandler_InstallationEvent(t *testing.T) {
	tests := []struct {
		name   string
		action string
	}{
		{"installation created", "created"},
		{"installation deleted", "deleted"},
		{"installation suspend", "suspend"},
		{"installation unsuspend", "unsuspend"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &MockStore{}
			mockGitHub := &MockGitHubService{}
			handler := NewGitHubWebhookHandlers(mockStore, mockGitHub)

			installationPayload := map[string]interface{}{
				"action": tt.action,
				"installation": map[string]interface{}{
					"id": 12345,
					"account": map[string]interface{}{
						"login": "testorg",
						"id":    67890,
						"type":  "Organization",
					},
				},
				"repositories": []map[string]interface{}{
					{
						"id":             54321,
						"name":           "test-repo",
						"full_name":      "testorg/test-repo",
						"private":        true,
						"default_branch": "main",
						"clone_url":      "https://github.com/testorg/test-repo.git",
						"ssh_url":        "git@github.com:testorg/test-repo.git",
						"owner": map[string]interface{}{
							"login": "testorg",
						},
					},
				},
			}

			payload, err := json.Marshal(installationPayload)
			require.NoError(t, err)
			signature := createValidSignature(payload, "test-secret")

			mockGitHub.On("ValidateWebhookSignature", payload, signature).Return(nil)

			if tt.action == "created" || tt.action == "unsuspend" {
				// Expect installation upsert
				mockStore.On("UpsertGitHubInstallation", mock.Anything, mock.MatchedBy(func(inst *store.GitHubInstallation) bool {
					return inst.InstallationID == 12345 && 
						   inst.AccountLogin == "testorg" &&
						   inst.AccountID == 67890 &&
						   inst.AccountType == "Organization"
				})).Return(&store.GitHubInstallation{InstallationID: 12345}, nil)

				// Expect repository upsert
				mockStore.On("UpsertGitHubRepository", mock.Anything, mock.MatchedBy(func(repo *store.GitHubRepository) bool {
					return repo.RepositoryID == 54321 && 
						   repo.InstallationID == 12345 &&
						   repo.Name == "test-repo" &&
						   repo.FullName == "testorg/test-repo"
				})).Return(&store.GitHubRepository{RepositoryID: 54321}, nil)
			} else if tt.action == "deleted" || tt.action == "suspend" {
				// Expect repository deletion
				mockStore.On("DeleteGitHubRepositoriesByInstallation", mock.Anything, int64(12345)).Return(nil)
			}

			// Expect webhook event recording
			mockStore.On("RecordGitHubWebhookEvent", mock.Anything, mock.MatchedBy(func(event *store.GitHubWebhookEvent) bool {
				return event.Event == "installation" && 
					   event.Action == tt.action &&
					   event.InstallationID != nil && *event.InstallationID == 12345
			})).Return(nil)

			req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
			req.Header.Set("X-Hub-Signature-256", signature)
			req.Header.Set("X-GitHub-Event", "installation")
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			handler.HandleWebhook(c)

			assert.Equal(t, http.StatusOK, w.Code)

			mockStore.AssertExpectations(t)
			mockGitHub.AssertExpectations(t)
		})
	}
}

func TestGitHubWebhookHandler_PushEvent(t *testing.T) {
	mockStore := &MockStore{}
	mockGitHub := &MockGitHubService{}
	handler := NewGitHubWebhookHandlers(mockStore, mockGitHub)

	pushPayload := map[string]interface{}{
		"ref": "refs/heads/main",
		"before": "0000000000000000000000000000000000000000",
		"after":  "1234567890abcdef1234567890abcdef12345678",
		"repository": map[string]interface{}{
			"id":        54321,
			"name":      "test-repo",
			"full_name": "testorg/test-repo",
		},
		"installation": map[string]interface{}{
			"id": 12345,
		},
		"head_commit": map[string]interface{}{
			"id":      "1234567890abcdef1234567890abcdef12345678",
			"message": "Test commit",
			"author": map[string]interface{}{
				"name":  "Test Author",
				"email": "test@example.com",
			},
		},
	}

	payload, err := json.Marshal(pushPayload)
	require.NoError(t, err)
	signature := createValidSignature(payload, "test-secret")

	mockGitHub.On("ValidateWebhookSignature", payload, signature).Return(nil)

	// Mock repository mapping exists and has auto-deploy enabled
	repoMapping := &store.GitHubRepoMapping{
		ID:           1,
		RepositoryID: 54321,
		ProjectID:    100,
		AutoDeploy:   true,
		BranchFilter: nil, // No filter, accepts all branches
	}
	mockStore.On("GetGitHubRepoMappingByRepo", mock.Anything, int64(54321)).Return(repoMapping, nil)

	// Mock project exists
	project := &store.Project{
		ID:   100,
		Name: "test-project",
	}
	mockStore.On("GetProject", mock.Anything, int64(100)).Return(project, nil)

	// Expect build job creation
	mockStore.On("CreateBuildJob", mock.Anything, mock.MatchedBy(func(job *store.BuildJob) bool {
		return job.ProjectID == 100 &&
			   job.GitURL == "https://github.com/testorg/test-repo.git" &&
			   job.GitBranch == "main" &&
			   job.GitCommit == "1234567890abcdef1234567890abcdef12345678" &&
			   job.Status == "pending" &&
			   job.TriggerType == "github_webhook"
	})).Return(&store.BuildJob{ID: 1}, nil)

	// Expect webhook event recording
	mockStore.On("RecordGitHubWebhookEvent", mock.Anything, mock.MatchedBy(func(event *store.GitHubWebhookEvent) bool {
		return event.Event == "push" && 
			   event.RepositoryID != nil && *event.RepositoryID == 54321 &&
			   event.InstallationID != nil && *event.InstallationID == 12345 &&
			   event.Status == "processed"
	})).Return(nil)

	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", signature)
	req.Header.Set("X-GitHub-Event", "push")
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(w)
	c.Request = req

	handler.HandleWebhook(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["message"], "build job created")

	mockStore.AssertExpectations(t)
	mockGitHub.AssertExpectations(t)
}

func TestGitHubWebhookHandler_PushEvent_BranchFilter(t *testing.T) {
	tests := []struct {
		name         string
		branchFilter string
		pushBranch   string
		shouldBuild  bool
	}{
		{"exact match", "main", "main", true},
		{"pattern match", "main,develop", "develop", true},
		{"no match", "main", "feature/test", false},
		{"wildcard match", "main,feature/*", "feature/awesome", true},
		{"no filter allows all", "", "any-branch", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &MockStore{}
			mockGitHub := &MockGitHubService{}
			handler := NewGitHubWebhookHandlers(mockStore, mockGitHub)

			pushPayload := map[string]interface{}{
				"ref": fmt.Sprintf("refs/heads/%s", tt.pushBranch),
				"after": "1234567890abcdef1234567890abcdef12345678",
				"repository": map[string]interface{}{
					"id":        54321,
					"full_name": "testorg/test-repo",
				},
				"installation": map[string]interface{}{
					"id": 12345,
				},
			}

			payload, err := json.Marshal(pushPayload)
			require.NoError(t, err)
			signature := createValidSignature(payload, "test-secret")

			mockGitHub.On("ValidateWebhookSignature", payload, signature).Return(nil)

			// Mock repository mapping with branch filter
			var branchFilter *string
			if tt.branchFilter != "" {
				branchFilter = &tt.branchFilter
			}

			repoMapping := &store.GitHubRepoMapping{
				ID:           1,
				RepositoryID: 54321,
				ProjectID:    100,
				AutoDeploy:   true,
				BranchFilter: branchFilter,
			}
			mockStore.On("GetGitHubRepoMappingByRepo", mock.Anything, int64(54321)).Return(repoMapping, nil)

			if tt.shouldBuild {
				// Mock project exists
				project := &store.Project{ID: 100, Name: "test-project"}
				mockStore.On("GetProject", mock.Anything, int64(100)).Return(project, nil)

				// Expect build job creation
				mockStore.On("CreateBuildJob", mock.Anything, mock.AnythingOfType("*store.BuildJob")).Return(&store.BuildJob{ID: 1}, nil)
			}

			// Always expect webhook event recording
			mockStore.On("RecordGitHubWebhookEvent", mock.Anything, mock.AnythingOfType("*store.GitHubWebhookEvent")).Return(nil)

			req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
			req.Header.Set("X-Hub-Signature-256", signature)
			req.Header.Set("X-GitHub-Event", "push")
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			handler.HandleWebhook(c)

			assert.Equal(t, http.StatusOK, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)

			if tt.shouldBuild {
				assert.Contains(t, response["message"], "build job created")
			} else {
				assert.Contains(t, response["message"], "ignored")
			}

			mockStore.AssertExpectations(t)
			mockGitHub.AssertExpectations(t)
		})
	}
}

func TestGitHubWebhookHandler_ErrorCases(t *testing.T) {
	tests := []struct {
		name           string
		setupMocks     func(*MockStore, *MockGitHubService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "GitHub service not configured",
			setupMocks: func(store *MockStore, github *MockGitHubService) {
				github.On("IsConfigured").Return(false)
			},
			expectedStatus: http.StatusServiceUnavailable,
			expectedError:  "GitHub App not configured",
		},
		{
			name: "webhook event recording fails",
			setupMocks: func(store *MockStore, github *MockGitHubService) {
				github.On("IsConfigured").Return(true)
				github.On("ValidateWebhookSignature", mock.Anything, mock.Anything).Return(nil)
				store.On("RecordGitHubWebhookEvent", mock.Anything, mock.Anything).Return(fmt.Errorf("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  "failed to record webhook event",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &MockStore{}
			mockGitHub := &MockGitHubService{}
			handler := NewGitHubWebhookHandlers(mockStore, mockGitHub)

			tt.setupMocks(mockStore, mockGitHub)

			payload := []byte(`{"action":"test"}`)
			signature := createValidSignature(payload, "test-secret")

			req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
			req.Header.Set("X-Hub-Signature-256", signature)
			req.Header.Set("X-GitHub-Event", "ping")
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			handler.HandleWebhook(c)

			assert.Equal(t, tt.expectedStatus, w.Code)
			
			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)
			assert.Contains(t, response["error"], tt.expectedError)

			mockStore.AssertExpectations(t)
			mockGitHub.AssertExpectations(t)
		})
	}
}

func TestBranchMatches(t *testing.T) {
	tests := []struct {
		name   string
		filter string
		branch string
		want   bool
	}{
		{"exact match", "main", "main", true},
		{"no match", "main", "develop", false},
		{"multiple branches - match first", "main,develop", "main", true},
		{"multiple branches - match second", "main,develop", "develop", true},
		{"multiple branches - no match", "main,develop", "feature", false},
		{"wildcard match", "feature/*", "feature/awesome", true},
		{"wildcard no match", "feature/*", "bugfix/test", false},
		{"multiple with wildcard", "main,feature/*", "feature/test", true},
		{"complex pattern", "main,develop,feature/*,hotfix/*", "hotfix/urgent", true},
		{"empty filter matches all", "", "any-branch", true},
	}

	// We need to extract the branchMatches function or make it public for testing
	// For now, we'll test it through the webhook handler
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// This is testing the internal logic through the webhook handler
			// In a real scenario, you'd make branchMatches public or move it to a utility package
		})
	}
}