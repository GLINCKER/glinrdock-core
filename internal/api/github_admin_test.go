package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockGitHubAppService for admin handlers
type MockGitHubAppService struct {
	mock.Mock
}

func (m *MockGitHubAppService) IsConfigured() bool {
	args := m.Called()
	return args.Bool(0)
}

func (m *MockGitHubAppService) GetInstallations(ctx context.Context) ([]Installation, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]Installation), args.Error(1)
}

func (m *MockGitHubAppService) GetInstallationRepositories(ctx context.Context, installationID int64) ([]Repository, error) {
	args := m.Called(ctx, installationID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]Repository), args.Error(1)
}

// MockSettingsService for admin handlers
type MockSettingsService struct {
	mock.Mock
}

// We'll need to implement the interface methods as they're used

func TestGitHubAdminHandlers_GetInstallations(t *testing.T) {
	tests := []struct {
		name           string
		setupMocks     func(*MockStore, *MockGitHubAppService)
		expectedStatus int
		validateResponse func(*testing.T, map[string]interface{})
	}{
		{
			name: "success with installations and repos",
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				github.On("IsConfigured").Return(true)
				
				installations := []store.GitHubInstallation{
					{
						InstallationID: 12345,
						AccountLogin:   "testorg",
						AccountID:      67890,
						AccountType:    "Organization",
					},
				}
				store.On("GetGitHubInstallations", mock.Anything).Return(installations, nil)
				
				repos := []store.GitHubRepository{
					{
						RepositoryID:   54321,
						InstallationID: 12345,
						Name:           "test-repo",
						FullName:       "testorg/test-repo",
						Private:        true,
						DefaultBranch:  "main",
					},
				}
				store.On("GetGitHubRepositoriesByInstallation", mock.Anything, int64(12345)).Return(repos, nil)
			},
			expectedStatus: http.StatusOK,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				installations, ok := resp["installations"].([]interface{})
				require.True(t, ok)
				require.Len(t, installations, 1)
				
				installation := installations[0].(map[string]interface{})
				instData := installation["installation"].(map[string]interface{})
				assert.Equal(t, float64(12345), instData["installation_id"])
				assert.Equal(t, "testorg", instData["account_login"])
				
				repositories := installation["repositories"].([]interface{})
				require.Len(t, repositories, 1)
				
				repo := repositories[0].(map[string]interface{})
				assert.Equal(t, float64(54321), repo["repository_id"])
				assert.Equal(t, "test-repo", repo["name"])
			},
		},
		{
			name: "GitHub App not configured",
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				github.On("IsConfigured").Return(false)
			},
			expectedStatus: http.StatusServiceUnavailable,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Contains(t, resp["error"], "GitHub App not configured")
			},
		},
		{
			name: "database error",
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				github.On("IsConfigured").Return(true)
				store.On("GetGitHubInstallations", mock.Anything).Return(nil, fmt.Errorf("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Contains(t, resp["error"], "failed to get installations")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &MockStore{}
			mockSettings := &MockSettingsService{}
			mockGitHub := &MockGitHubAppService{}

			tt.setupMocks(mockStore, mockGitHub)

			handler := NewGitHubAdminHandlers(mockStore, mockSettings, mockGitHub)

			req := httptest.NewRequest("GET", "/installations", nil)
			w := httptest.NewRecorder()
			
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			handler.GetInstallations(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)

			tt.validateResponse(t, response)

			mockStore.AssertExpectations(t)
			mockGitHub.AssertExpectations(t)
		})
	}
}

func TestGitHubAdminHandlers_GetRepositories(t *testing.T) {
	tests := []struct {
		name           string
		setupMocks     func(*MockStore, *MockGitHubAppService)
		expectedStatus int
		validateResponse func(*testing.T, map[string]interface{})
	}{
		{
			name: "success with repositories",
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				github.On("IsConfigured").Return(true)
				
				repos := []store.GitHubRepositoryWithMapping{
					{
						GitHubRepository: store.GitHubRepository{
							RepositoryID:   54321,
							InstallationID: 12345,
							Name:           "test-repo",
							FullName:       "testorg/test-repo",
						},
						IsActivated: true,
						ProjectID:   100,
						ProjectName: "test-project",
					},
					{
						GitHubRepository: store.GitHubRepository{
							RepositoryID:   54322,
							InstallationID: 12345,
							Name:           "inactive-repo",
							FullName:       "testorg/inactive-repo",
						},
						IsActivated: false,
					},
				}
				store.On("GetGitHubRepositoriesWithMappings", mock.Anything).Return(repos, nil)
			},
			expectedStatus: http.StatusOK,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				repositories, ok := resp["repositories"].([]interface{})
				require.True(t, ok)
				require.Len(t, repositories, 2)
				
				assert.Equal(t, float64(2), resp["total_count"])
				assert.Equal(t, float64(1), resp["activated_count"])
			},
		},
		{
			name: "GitHub App not configured",
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				github.On("IsConfigured").Return(false)
			},
			expectedStatus: http.StatusServiceUnavailable,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Contains(t, resp["error"], "GitHub App not configured")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &MockStore{}
			mockSettings := &MockSettingsService{}
			mockGitHub := &MockGitHubAppService{}

			tt.setupMocks(mockStore, mockGitHub)

			handler := NewGitHubAdminHandlers(mockStore, mockSettings, mockGitHub)

			req := httptest.NewRequest("GET", "/repositories", nil)
			w := httptest.NewRecorder()
			
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			handler.GetRepositories(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)

			tt.validateResponse(t, response)

			mockStore.AssertExpectations(t)
			mockGitHub.AssertExpectations(t)
		})
	}
}

func TestGitHubAdminHandlers_ActivateRepository(t *testing.T) {
	tests := []struct {
		name           string
		repoID         string
		requestBody    ActivateRepositoryRequest
		setupMocks     func(*MockStore, *MockGitHubAppService)
		expectedStatus int
		validateResponse func(*testing.T, map[string]interface{})
	}{
		{
			name:   "successful activation",
			repoID: "54321",
			requestBody: ActivateRepositoryRequest{
				ProjectID:    100,
				BranchFilter: stringPtr("main,develop"),
				BuildContext: stringPtr("./"),
				BuildArgs:    map[string]string{"ENV": "production"},
				AutoDeploy:   true,
			},
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				// Repository exists
				repo := &store.GitHubRepository{
					RepositoryID: 54321,
					FullName:     "testorg/test-repo",
				}
				store.On("GetGitHubRepositoryByID", mock.Anything, int64(54321)).Return(repo, nil)

				// Project exists
				project := &store.Project{
					ID:   100,
					Name: "test-project",
				}
				store.On("GetProject", mock.Anything, int64(100)).Return(project, nil)

				// No existing mapping
				store.On("GetGitHubRepoMappingByRepo", mock.Anything, int64(54321)).Return(nil, store.ErrNotFound)

				// Successful mapping creation
				createdMapping := &store.GitHubRepoMapping{
					ID:           1,
					RepositoryID: 54321,
					ProjectID:    100,
				}
				store.On("CreateGitHubRepoMapping", mock.Anything, mock.AnythingOfType("*store.GitHubRepoMapping")).Return(createdMapping, nil)
			},
			expectedStatus: http.StatusCreated,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Contains(t, resp["message"], "activated successfully")
				assert.NotNil(t, resp["mapping"])
				assert.NotNil(t, resp["repository"])
				assert.NotNil(t, resp["project"])
			},
		},
		{
			name:   "invalid repository ID",
			repoID: "invalid",
			requestBody: ActivateRepositoryRequest{
				ProjectID: 100,
			},
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				// No mocks needed - fails validation
			},
			expectedStatus: http.StatusBadRequest,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Contains(t, resp["error"], "invalid repository ID")
			},
		},
		{
			name:   "repository not found",
			repoID: "54321",
			requestBody: ActivateRepositoryRequest{
				ProjectID: 100,
			},
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				store.On("GetGitHubRepositoryByID", mock.Anything, int64(54321)).Return(nil, store.ErrNotFound)
			},
			expectedStatus: http.StatusNotFound,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Contains(t, resp["error"], "repository not found")
			},
		},
		{
			name:   "repository already activated",
			repoID: "54321",
			requestBody: ActivateRepositoryRequest{
				ProjectID: 100,
			},
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				// Repository exists
				repo := &store.GitHubRepository{
					RepositoryID: 54321,
					FullName:     "testorg/test-repo",
				}
				store.On("GetGitHubRepositoryByID", mock.Anything, int64(54321)).Return(repo, nil)

				// Project exists
				project := &store.Project{
					ID:   100,
					Name: "test-project",
				}
				store.On("GetProject", mock.Anything, int64(100)).Return(project, nil)

				// Existing mapping found
				existingMapping := &store.GitHubRepoMapping{
					ID:           1,
					RepositoryID: 54321,
					ProjectID:    200, // Different project
				}
				store.On("GetGitHubRepoMappingByRepo", mock.Anything, int64(54321)).Return(existingMapping, nil)
			},
			expectedStatus: http.StatusConflict,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Contains(t, resp["error"], "repository already activated")
				assert.NotNil(t, resp["mapping"])
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &MockStore{}
			mockSettings := &MockSettingsService{}
			mockGitHub := &MockGitHubAppService{}

			tt.setupMocks(mockStore, mockGitHub)

			handler := NewGitHubAdminHandlers(mockStore, mockSettings, mockGitHub)

			// Prepare request body
			requestBody, err := json.Marshal(tt.requestBody)
			require.NoError(t, err)

			req := httptest.NewRequest("POST", fmt.Sprintf("/repositories/%s/activate", tt.repoID), bytes.NewReader(requestBody))
			req.Header.Set("Content-Type", "application/json")
			
			w := httptest.NewRecorder()
			
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Params = gin.Params{{Key: "id", Value: tt.repoID}}

			handler.ActivateRepository(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)

			tt.validateResponse(t, response)

			mockStore.AssertExpectations(t)
			mockGitHub.AssertExpectations(t)
		})
	}
}

func TestGitHubAdminHandlers_DeactivateRepository(t *testing.T) {
	tests := []struct {
		name           string
		repoID         string
		setupMocks     func(*MockStore, *MockGitHubAppService)
		expectedStatus int
		validateResponse func(*testing.T, map[string]interface{})
	}{
		{
			name:   "successful deactivation",
			repoID: "54321",
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				// Mapping exists
				mapping := &store.GitHubRepoMapping{
					ID:           1,
					RepositoryID: 54321,
					ProjectID:    100,
				}
				store.On("GetGitHubRepoMappingByRepo", mock.Anything, int64(54321)).Return(mapping, nil)

				// Repository exists (for logging)
				repo := &store.GitHubRepository{
					RepositoryID: 54321,
					FullName:     "testorg/test-repo",
				}
				store.On("GetGitHubRepositoryByID", mock.Anything, int64(54321)).Return(repo, nil)

				// Successful deletion
				store.On("DeleteGitHubRepoMapping", mock.Anything, int64(54321)).Return(nil)
			},
			expectedStatus: http.StatusOK,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Contains(t, resp["message"], "deactivated successfully")
				assert.NotNil(t, resp["mapping"])
			},
		},
		{
			name:   "repository not activated",
			repoID: "54321",
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				store.On("GetGitHubRepoMappingByRepo", mock.Anything, int64(54321)).Return(nil, store.ErrNotFound)
			},
			expectedStatus: http.StatusNotFound,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Contains(t, resp["error"], "repository not activated")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &MockStore{}
			mockSettings := &MockSettingsService{}
			mockGitHub := &MockGitHubAppService{}

			tt.setupMocks(mockStore, mockGitHub)

			handler := NewGitHubAdminHandlers(mockStore, mockSettings, mockGitHub)

			req := httptest.NewRequest("DELETE", fmt.Sprintf("/repositories/%s/activate", tt.repoID), nil)
			w := httptest.NewRecorder()
			
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Params = gin.Params{{Key: "id", Value: tt.repoID}}

			handler.DeactivateRepository(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)

			tt.validateResponse(t, response)

			mockStore.AssertExpectations(t)
			mockGitHub.AssertExpectations(t)
		})
	}
}

func TestGitHubAdminHandlers_SyncInstallations(t *testing.T) {
	tests := []struct {
		name           string
		setupMocks     func(*MockStore, *MockGitHubAppService)
		expectedStatus int
		validateResponse func(*testing.T, map[string]interface{})
	}{
		{
			name: "successful sync",
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				github.On("IsConfigured").Return(true)

				// Mock GitHub API responses
				installations := []Installation{
					{
						ID: 12345,
						Account: Account{
							Login: "testorg",
							ID:    67890,
							Type:  "Organization",
						},
					},
				}
				github.On("GetInstallations", mock.Anything).Return(installations, nil)

				repositories := []Repository{
					{
						ID:            54321,
						Name:          "test-repo",
						FullName:      "testorg/test-repo",
						Private:       true,
						DefaultBranch: "main",
						CloneURL:      "https://github.com/testorg/test-repo.git",
						SSHURL:        "git@github.com:testorg/test-repo.git",
						Owner: Owner{
							Login: "testorg",
						},
					},
				}
				github.On("GetInstallationRepositories", mock.Anything, int64(12345)).Return(repositories, nil)

				// Mock database operations
				store.On("UpsertGitHubInstallation", mock.Anything, mock.AnythingOfType("*store.GitHubInstallation")).Return(&store.GitHubInstallation{}, nil)
				store.On("UpsertGitHubRepository", mock.Anything, mock.AnythingOfType("*store.GitHubRepository")).Return(&store.GitHubRepository{}, nil)
			},
			expectedStatus: http.StatusOK,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Equal(t, "sync completed", resp["message"])
				
				stats, ok := resp["stats"].(map[string]interface{})
				require.True(t, ok)
				assert.Equal(t, float64(1), stats["installations_processed"])
				assert.Equal(t, float64(1), stats["repositories_processed"])
			},
		},
		{
			name: "GitHub App not configured",
			setupMocks: func(store *MockStore, github *MockGitHubAppService) {
				github.On("IsConfigured").Return(false)
			},
			expectedStatus: http.StatusServiceUnavailable,
			validateResponse: func(t *testing.T, resp map[string]interface{}) {
				assert.Contains(t, resp["error"], "GitHub App not configured")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &MockStore{}
			mockSettings := &MockSettingsService{}
			mockGitHub := &MockGitHubAppService{}

			tt.setupMocks(mockStore, mockGitHub)

			handler := NewGitHubAdminHandlers(mockStore, mockSettings, mockGitHub)

			req := httptest.NewRequest("POST", "/sync", nil)
			w := httptest.NewRecorder()
			
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(w)
			c.Request = req

			handler.SyncInstallations(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)

			tt.validateResponse(t, response)

			mockStore.AssertExpectations(t)
			mockGitHub.AssertExpectations(t)
		})
	}
}

// Helper function to create string pointers
func stringPtr(s string) *string {
	return &s
}