package workflow

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"rebeka/storage"
)

type Scheduler struct {
	db       *storage.DB
	executor *Executor
	interval time.Duration
	stop     chan struct{}
	mu       sync.Mutex
	running  bool
}

func NewScheduler(db *storage.DB, executor *Executor) *Scheduler {
	return &Scheduler{
		db:       db,
		executor: executor,
		interval: 10 * time.Second,
		stop:     make(chan struct{}),
	}
}

func (s *Scheduler) Start() {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.mu.Unlock()
	go s.loop()
}

func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.running {
		return
	}
	close(s.stop)
	s.running = false
}

func (s *Scheduler) loop() {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
			s.tick()
		}
	}
}

func (s *Scheduler) tick() {
	schedules, err := s.db.ListJobSchedules()
	if err != nil {
		return
	}
	now := time.Now()
	for _, sch := range schedules {
		if !sch.Enabled {
			continue
		}
		var lastRun time.Time
		if sch.LastRunAt != "" {
			lastRun, _ = time.Parse(time.RFC3339, sch.LastRunAt)
		}
		if now.Sub(lastRun) < time.Duration(sch.IntervalSeconds)*time.Second {
			continue
		}
		wf, err := s.db.GetWorkflow(sch.WorkflowID)
		if err != nil {
			continue
		}
		_, envVars, _ := s.db.GetActiveEnvironment(wf.WorkspaceID)
		s.executor.Variables = envVars
		started := now.Format(time.RFC3339)
		result, err := s.executor.Run(context.Background(), sch.WorkflowID)
		finished := time.Now().Format(time.RFC3339)
		status := result.Status
		if err != nil {
			status = "failed"
		}
		details, _ := json.Marshal(result)
		_ = s.db.SaveJobRun(storage.JobRun{
			WorkflowID: sch.WorkflowID,
			Status:     status,
			Details:    string(details),
			StartedAt:  started,
			FinishedAt: finished,
		})
		_ = s.db.UpdateJobScheduleLastRun(sch.ID)
	}
}
