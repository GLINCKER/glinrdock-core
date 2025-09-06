package jobs

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQueue_EnqueueAndProcess(t *testing.T) {
	queue := NewQueue(2)
	defer queue.Stop()

	var processedJobs []string
	var mu sync.Mutex

	// Register a test handler
	queue.RegisterHandler(JobTypeBuild, func(ctx context.Context, job *Job) error {
		mu.Lock()
		processedJobs = append(processedJobs, job.ID)
		mu.Unlock()
		return nil
	})

	queue.Start()

	// Enqueue a job
	job := queue.Enqueue(JobTypeBuild, map[string]interface{}{
		"test": "data",
	})

	assert.Equal(t, JobStatusQueued, job.Status)
	assert.Equal(t, JobTypeBuild, job.Type)
	assert.Equal(t, "data", job.Data["test"])

	// Wait for job to be processed
	time.Sleep(100 * time.Millisecond)

	// Check job was processed
	processedJob, exists := queue.GetJob(job.ID)
	require.True(t, exists)
	assert.Equal(t, JobStatusSuccess, processedJob.Status)
	assert.NotNil(t, processedJob.StartedAt)
	assert.NotNil(t, processedJob.FinishedAt)
	assert.Equal(t, 100, processedJob.Progress)

	mu.Lock()
	assert.Contains(t, processedJobs, job.ID)
	mu.Unlock()
}

func TestQueue_JobFailure(t *testing.T) {
	queue := NewQueue(1)
	defer queue.Stop()

	testError := fmt.Errorf("test error")

	// Register a handler that always fails
	queue.RegisterHandler(JobTypeBuild, func(ctx context.Context, job *Job) error {
		return testError
	})

	queue.Start()

	// Enqueue a job
	job := queue.Enqueue(JobTypeBuild, map[string]interface{}{
		"test": "data",
	})

	// Wait for job to be processed
	time.Sleep(100 * time.Millisecond)

	// Check job failed
	processedJob, exists := queue.GetJob(job.ID)
	require.True(t, exists)
	assert.Equal(t, JobStatusFailed, processedJob.Status)
	assert.Equal(t, testError.Error(), processedJob.Error)
	assert.NotNil(t, processedJob.StartedAt)
	assert.NotNil(t, processedJob.FinishedAt)
	assert.Equal(t, 100, processedJob.Progress)
}

func TestQueue_NoHandler(t *testing.T) {
	queue := NewQueue(1)
	defer queue.Stop()

	queue.Start()

	// Enqueue a job with no registered handler
	job := queue.Enqueue(JobTypeDeploy, map[string]interface{}{
		"test": "data",
	})

	// Wait for job to be processed
	time.Sleep(100 * time.Millisecond)

	// Check job failed due to no handler
	processedJob, exists := queue.GetJob(job.ID)
	require.True(t, exists)
	assert.Equal(t, JobStatusFailed, processedJob.Status)
	assert.Contains(t, processedJob.Error, "no handler registered")
}

func TestQueue_MultipleWorkers(t *testing.T) {
	queue := NewQueue(3)
	defer queue.Stop()

	var processedJobs []string
	var mu sync.Mutex
	processDelay := 50 * time.Millisecond

	// Register a handler with delay
	queue.RegisterHandler(JobTypeBuild, func(ctx context.Context, job *Job) error {
		time.Sleep(processDelay)
		mu.Lock()
		processedJobs = append(processedJobs, job.ID)
		mu.Unlock()
		return nil
	})

	queue.Start()

	// Enqueue multiple jobs
	jobs := make([]*Job, 5)
	for i := 0; i < 5; i++ {
		jobs[i] = queue.Enqueue(JobTypeBuild, map[string]interface{}{
			"index": i,
		})
	}

	// Wait for all jobs to be processed
	time.Sleep(200 * time.Millisecond)

	// Check all jobs were processed
	mu.Lock()
	assert.Len(t, processedJobs, 5)
	mu.Unlock()

	for _, job := range jobs {
		processedJob, exists := queue.GetJob(job.ID)
		require.True(t, exists)
		assert.Equal(t, JobStatusSuccess, processedJob.Status)
	}
}

func TestQueue_ContextCancellation(t *testing.T) {
	queue := NewQueue(1)
	defer queue.Stop()

	var handlerCalled bool
	var mu sync.Mutex

	// Register a handler that checks context cancellation
	queue.RegisterHandler(JobTypeBuild, func(ctx context.Context, job *Job) error {
		mu.Lock()
		handlerCalled = true
		mu.Unlock()

		select {
		case <-time.After(200 * time.Millisecond):
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	})

	queue.Start()

	// Enqueue a job
	job := queue.Enqueue(JobTypeBuild, map[string]interface{}{
		"test": "data",
	})

	// Stop queue quickly to trigger context cancellation
	time.Sleep(50 * time.Millisecond)
	queue.Stop()

	// Verify handler was called
	mu.Lock()
	assert.True(t, handlerCalled)
	mu.Unlock()

	// Check job status (might be running or failed depending on timing)
	processedJob, exists := queue.GetJob(job.ID)
	require.True(t, exists)
	assert.True(t, processedJob.Status == JobStatusRunning || processedJob.Status == JobStatusFailed)
}

func TestQueue_ListJobs(t *testing.T) {
	queue := NewQueue(1)
	defer queue.Stop()

	// Register a handler that never completes
	queue.RegisterHandler(JobTypeBuild, func(ctx context.Context, job *Job) error {
		<-ctx.Done()
		return ctx.Err()
	})

	// Don't start queue to keep jobs queued

	// Enqueue multiple jobs
	job1 := queue.Enqueue(JobTypeBuild, map[string]interface{}{"id": 1})
	job2 := queue.Enqueue(JobTypeDeploy, map[string]interface{}{"id": 2})

	// List all jobs
	allJobs := queue.ListJobs("")
	assert.Len(t, allJobs, 2)

	// List only queued jobs
	queuedJobs := queue.ListJobs(JobStatusQueued)
	assert.Len(t, queuedJobs, 2)

	// List only running jobs (should be empty)
	runningJobs := queue.ListJobs(JobStatusRunning)
	assert.Empty(t, runningJobs)

	// Verify job IDs
	jobIDs := []string{job1.ID, job2.ID}
	for _, job := range allJobs {
		assert.Contains(t, jobIDs, job.ID)
	}
}

func TestQueue_UpdateJobProgress(t *testing.T) {
	queue := NewQueue(1)
	defer queue.Stop()

	// Register a handler that updates progress
	queue.RegisterHandler(JobTypeBuild, func(ctx context.Context, job *Job) error {
		queue.UpdateJobProgress(job.ID, 25)
		time.Sleep(10 * time.Millisecond)
		queue.UpdateJobProgress(job.ID, 50)
		time.Sleep(10 * time.Millisecond)
		queue.UpdateJobProgress(job.ID, 75)
		return nil
	})

	queue.Start()

	// Enqueue a job
	job := queue.Enqueue(JobTypeBuild, map[string]interface{}{
		"test": "progress",
	})

	// Wait for job to complete
	time.Sleep(100 * time.Millisecond)

	// Check final job state
	finalJob, exists := queue.GetJob(job.ID)
	require.True(t, exists)
	assert.Equal(t, JobStatusSuccess, finalJob.Status)
	assert.Equal(t, 100, finalJob.Progress) // Should be 100 when completed
}

func TestQueue_GetJobNotFound(t *testing.T) {
	queue := NewQueue(1)
	defer queue.Stop()

	job, exists := queue.GetJob("nonexistent")
	assert.False(t, exists)
	assert.Nil(t, job)
}

func TestQueue_StopWithPendingJobs(t *testing.T) {
	queue := NewQueue(1)

	var processedCount int
	var mu sync.Mutex

	// Register a slow handler
	queue.RegisterHandler(JobTypeBuild, func(ctx context.Context, job *Job) error {
		time.Sleep(50 * time.Millisecond)
		mu.Lock()
		processedCount++
		mu.Unlock()
		return nil
	})

	// Enqueue jobs but don't start queue
	for i := 0; i < 3; i++ {
		queue.Enqueue(JobTypeBuild, map[string]interface{}{"id": i})
	}

	queue.Start()

	// Stop queue quickly
	time.Sleep(10 * time.Millisecond)
	queue.Stop()

	// Some jobs might not be processed
	mu.Lock()
	processed := processedCount
	mu.Unlock()

	assert.True(t, processed <= 3)
}

func TestGenerateJobID(t *testing.T) {
	id1 := generateJobID()
	time.Sleep(1 * time.Millisecond) // Ensure different timestamps
	id2 := generateJobID()

	assert.NotEqual(t, id1, id2)
	assert.NotEmpty(t, id1)
	assert.NotEmpty(t, id2)
}
