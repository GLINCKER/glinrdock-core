package jobs

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/GLINCKER/glinrdock/internal/metrics"
	"github.com/rs/zerolog/log"
)

// JobType represents the type of job
type JobType string

const (
	JobTypeBuild  JobType = "build"
	JobTypeDeploy JobType = "deploy"
)

// JobStatus represents the status of a job
type JobStatus string

const (
	JobStatusQueued  JobStatus = "queued"
	JobStatusRunning JobStatus = "running"
	JobStatusSuccess JobStatus = "success"
	JobStatusFailed  JobStatus = "failed"
)

// Job represents a background job
type Job struct {
	ID        string                 `json:"id"`
	Type      JobType                `json:"type"`
	Status    JobStatus              `json:"status"`
	Data      map[string]interface{} `json:"data"`
	Error     string                 `json:"error,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
	StartedAt *time.Time             `json:"started_at,omitempty"`
	FinishedAt *time.Time             `json:"finished_at,omitempty"`
	Progress  int                    `json:"progress"` // 0-100
}

// JobHandler is a function that processes a job
type JobHandler func(ctx context.Context, job *Job) error

// Queue manages background job processing
type Queue struct {
	jobs     map[string]*Job
	jobsChan chan *Job
	handlers map[JobType]JobHandler
	workers  int
	mu       sync.RWMutex
	ctx      context.Context
	cancel   context.CancelFunc
	wg       sync.WaitGroup
}

// NewQueue creates a new job queue
func NewQueue(workers int) *Queue {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &Queue{
		jobs:     make(map[string]*Job),
		jobsChan: make(chan *Job, 100), // Buffer for 100 jobs
		handlers: make(map[JobType]JobHandler),
		workers:  workers,
		ctx:      ctx,
		cancel:   cancel,
	}
}

// RegisterHandler registers a job handler for a specific job type
func (q *Queue) RegisterHandler(jobType JobType, handler JobHandler) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.handlers[jobType] = handler
}

// Start starts the job queue workers
func (q *Queue) Start() {
	log.Info().Int("workers", q.workers).Msg("starting job queue")
	
	for i := 0; i < q.workers; i++ {
		q.wg.Add(1)
		go q.worker(i)
	}
}

// Stop stops the job queue and waits for all workers to finish
func (q *Queue) Stop() {
	log.Info().Msg("stopping job queue")
	
	q.cancel()
	close(q.jobsChan)
	q.wg.Wait()
	
	log.Info().Msg("job queue stopped")
}

// Enqueue adds a new job to the queue
func (q *Queue) Enqueue(jobType JobType, data map[string]interface{}) *Job {
	job := &Job{
		ID:        generateJobID(),
		Type:      jobType,
		Status:    JobStatusQueued,
		Data:      data,
		CreatedAt: time.Now(),
		Progress:  0,
	}

	q.mu.Lock()
	q.jobs[job.ID] = job
	q.mu.Unlock()

	// Send to workers
	select {
	case q.jobsChan <- job:
		metrics.IncActiveJobs()
		log.Info().Str("job_id", job.ID).Str("job_type", string(jobType)).Msg("job enqueued")
	case <-q.ctx.Done():
		// Queue is shutting down
		q.mu.Lock()
		job.Status = JobStatusFailed
		job.Error = "queue is shutting down"
		q.mu.Unlock()
	}

	return job
}

// GetJob returns a job by ID
func (q *Queue) GetJob(id string) (*Job, bool) {
	q.mu.RLock()
	defer q.mu.RUnlock()
	
	job, exists := q.jobs[id]
	if !exists {
		return nil, false
	}
	
	// Return a copy to prevent race conditions
	jobCopy := *job
	return &jobCopy, true
}

// ListJobs returns all jobs, optionally filtered by status
func (q *Queue) ListJobs(status JobStatus) []*Job {
	q.mu.RLock()
	defer q.mu.RUnlock()
	
	var jobs []*Job
	for _, job := range q.jobs {
		if status == "" || job.Status == status {
			// Return a copy to prevent race conditions
			jobCopy := *job
			jobs = append(jobs, &jobCopy)
		}
	}
	
	return jobs
}

// UpdateJobProgress updates the progress of a job
func (q *Queue) UpdateJobProgress(jobID string, progress int) {
	q.mu.Lock()
	defer q.mu.Unlock()
	
	if job, exists := q.jobs[jobID]; exists && job.Status == JobStatusRunning {
		job.Progress = progress
	}
}

// worker processes jobs from the queue
func (q *Queue) worker(workerID int) {
	defer q.wg.Done()
	
	log.Info().Int("worker_id", workerID).Msg("worker started")
	defer log.Info().Int("worker_id", workerID).Msg("worker stopped")

	for {
		select {
		case job, ok := <-q.jobsChan:
			if !ok {
				// Channel closed, worker should exit
				return
			}
			q.processJob(workerID, job)
			
		case <-q.ctx.Done():
			return
		}
	}
}

// processJob processes a single job
func (q *Queue) processJob(workerID int, job *Job) {
	log.Info().
		Int("worker_id", workerID).
		Str("job_id", job.ID).
		Str("job_type", string(job.Type)).
		Msg("processing job")

	// Update job status
	q.mu.Lock()
	job.Status = JobStatusRunning
	now := time.Now()
	job.StartedAt = &now
	job.Progress = 0
	q.mu.Unlock()

	// Get handler
	q.mu.RLock()
	handler, exists := q.handlers[job.Type]
	q.mu.RUnlock()

	if !exists {
		q.finishJob(job, fmt.Errorf("no handler registered for job type: %s", job.Type))
		return
	}

	// Execute job with timeout
	ctx, cancel := context.WithTimeout(q.ctx, 30*time.Minute)
	defer cancel()

	err := handler(ctx, job)
	q.finishJob(job, err)
}

// finishJob marks a job as finished and updates its status
func (q *Queue) finishJob(job *Job, err error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	now := time.Now()
	job.FinishedAt = &now
	job.Progress = 100
	
	// Decrement active jobs counter
	metrics.DecActiveJobs()

	if err != nil {
		job.Status = JobStatusFailed
		job.Error = err.Error()
		log.Error().
			Err(err).
			Str("job_id", job.ID).
			Str("job_type", string(job.Type)).
			Msg("job failed")
	} else {
		job.Status = JobStatusSuccess
		log.Info().
			Str("job_id", job.ID).
			Str("job_type", string(job.Type)).
			Dur("duration", job.FinishedAt.Sub(*job.StartedAt)).
			Msg("job completed")
	}
}

// generateJobID generates a unique job ID
func generateJobID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}