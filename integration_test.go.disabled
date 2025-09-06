package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/api"
	"github.com/GLINCKER/glinrdock/internal/dockerx"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealthEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	// Setup test server
	dockerClient := dockerx.NewMockClient()
	mockEngine := dockerx.NewMockEngine()
	handlers := api.NewHandlers(dockerClient, nil, nil, nil, nil, mockEngine, nil)
	
	r := gin.New()
	v1 := r.Group("/v1")
	{
		v1.GET("/health", handlers.Health)
		v1.GET("/system", handlers.System)
	}
	
	// Make request
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/health", nil)
	r.ServeHTTP(w, req)
	
	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Equal(t, true, response["ok"])
	assert.Contains(t, response, "version")
	assert.Contains(t, response, "uptime")
}

func TestSystemEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	// Setup test server
	dockerClient := dockerx.NewMockClient()
	mockEngine := dockerx.NewMockEngine()
	handlers := api.NewHandlers(dockerClient, nil, nil, nil, nil, mockEngine, nil)
	
	r := gin.New()
	v1 := r.Group("/v1")
	{
		v1.GET("/health", handlers.Health)
		v1.GET("/system", handlers.System)
	}
	
	// Make request
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/system", nil)
	r.ServeHTTP(w, req)
	
	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.Contains(t, response, "go_version")
	assert.Contains(t, response, "os")
	assert.Contains(t, response, "arch")
	assert.Contains(t, response, "docker_status")
}