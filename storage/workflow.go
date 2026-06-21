package storage

import (
	"database/sql"
	"time"
)

type Workflow struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspaceId"`
	HostID      string `json:"hostId"`
	Name        string `json:"name"`
	Graph       string `json:"graph"`
}

type JobSchedule struct {
	ID              string `json:"id"`
	WorkflowID      string `json:"workflowId"`
	IntervalSeconds int    `json:"intervalSeconds"`
	Enabled         bool   `json:"enabled"`
	LastRunAt       string `json:"lastRunAt,omitempty"`
}

type JobRun struct {
	ID         string `json:"id"`
	WorkflowID string `json:"workflowId"`
	Status     string `json:"status"`
	Details    string `json:"details"`
	StartedAt  string `json:"startedAt"`
	FinishedAt string `json:"finishedAt,omitempty"`
}

func (db *DB) ListWorkflowsByHost(hostID string) ([]Workflow, error) {
	rows, err := db.conn.Query(`SELECT id, workspace_id, host_id, name, graph FROM workflows WHERE host_id = ? ORDER BY name`, hostID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWorkflows(rows)
}

func (db *DB) ListWorkflows(workspaceID string) ([]Workflow, error) {
	rows, err := db.conn.Query(`SELECT id, workspace_id, host_id, name, graph FROM workflows WHERE workspace_id = ? ORDER BY name`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWorkflows(rows)
}

func scanWorkflows(rows *sql.Rows) ([]Workflow, error) {
	var list []Workflow
	for rows.Next() {
		var w Workflow
		var hostID sql.NullString
		if err := rows.Scan(&w.ID, &w.WorkspaceID, &hostID, &w.Name, &w.Graph); err != nil {
			return nil, err
		}
		if hostID.Valid {
			w.HostID = hostID.String
		}
		list = append(list, w)
	}
	return list, rows.Err()
}

func (db *DB) GetWorkflow(id string) (Workflow, error) {
	var w Workflow
	var hostID sql.NullString
	err := db.conn.QueryRow(`SELECT id, workspace_id, host_id, name, graph FROM workflows WHERE id = ?`, id).
		Scan(&w.ID, &w.WorkspaceID, &hostID, &w.Name, &w.Graph)
	if hostID.Valid {
		w.HostID = hostID.String
	}
	return w, err
}

func (db *DB) CreateWorkflow(workspaceID, hostID, name string) (Workflow, error) {
	w := Workflow{ID: NewID(), WorkspaceID: workspaceID, HostID: hostID, Name: name, Graph: `{"nodes":[],"edges":[]}`}
	_, err := db.conn.Exec(`INSERT INTO workflows(id, workspace_id, host_id, name, graph) VALUES(?,?,?,?,?)`, w.ID, w.WorkspaceID, w.HostID, w.Name, w.Graph)
	return w, err
}

func (db *DB) SaveWorkflowGraph(id, graph string) error {
	_, err := db.conn.Exec(`UPDATE workflows SET graph = ? WHERE id = ?`, graph, id)
	return err
}

func (db *DB) saveWorkflowTx(tx *sql.Tx, w Workflow) error {
	_, err := tx.Exec(
		`INSERT INTO workflows(id, workspace_id, host_id, name, graph) VALUES(?,?,?,?,?)
		 ON CONFLICT(id) DO UPDATE SET name=excluded.name, graph=excluded.graph, host_id=excluded.host_id`,
		w.ID, w.WorkspaceID, w.HostID, w.Name, w.Graph,
	)
	return err
}

func (db *DB) SaveJobSchedule(s JobSchedule) error {
	enabled := 0
	if s.Enabled {
		enabled = 1
	}
	if s.ID == "" {
		s.ID = NewID()
	}
	_, err := db.conn.Exec(`
		INSERT INTO job_schedules(id, workflow_id, interval_seconds, enabled) VALUES(?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET interval_seconds=excluded.interval_seconds, enabled=excluded.enabled`,
		s.ID, s.WorkflowID, s.IntervalSeconds, enabled,
	)
	return err
}

func (db *DB) ListJobSchedules() ([]JobSchedule, error) {
	rows, err := db.conn.Query(`SELECT id, workflow_id, interval_seconds, enabled, last_run_at FROM job_schedules WHERE enabled = 1`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []JobSchedule
	for rows.Next() {
		var s JobSchedule
		var enabled int
		var lastRun sql.NullTime
		if err := rows.Scan(&s.ID, &s.WorkflowID, &s.IntervalSeconds, &enabled, &lastRun); err != nil {
			return nil, err
		}
		s.Enabled = enabled == 1
		if lastRun.Valid {
			s.LastRunAt = lastRun.Time.Format(time.RFC3339)
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (db *DB) UpdateJobScheduleLastRun(id string) error {
	_, err := db.conn.Exec(`UPDATE job_schedules SET last_run_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
	return err
}

func (db *DB) SaveJobRun(run JobRun) error {
	if run.ID == "" {
		run.ID = NewID()
	}
	_, err := db.conn.Exec(`
		INSERT INTO job_runs(id, workflow_id, status, details, started_at, finished_at) VALUES(?,?,?,?,?,?)`,
		run.ID, run.WorkflowID, run.Status, run.Details, run.StartedAt, run.FinishedAt,
	)
	return err
}

func (db *DB) ListRecentJobRuns(limit int) ([]JobRun, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := db.conn.Query(`
		SELECT id, workflow_id, status, details, started_at, finished_at
		FROM job_runs ORDER BY started_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []JobRun
	for rows.Next() {
		var r JobRun
		var started, finished sql.NullTime
		if err := rows.Scan(&r.ID, &r.WorkflowID, &r.Status, &r.Details, &started, &finished); err != nil {
			return nil, err
		}
		if started.Valid {
			r.StartedAt = started.Time.Format(time.RFC3339)
		}
		if finished.Valid {
			r.FinishedAt = finished.Time.Format(time.RFC3339)
		}
		list = append(list, r)
	}
	return list, rows.Err()
}

func (db *DB) ListJobRuns(workflowID string) ([]JobRun, error) {
	rows, err := db.conn.Query(`
		SELECT id, workflow_id, status, details, started_at, finished_at
		FROM job_runs WHERE workflow_id = ? ORDER BY started_at DESC`, workflowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []JobRun
	for rows.Next() {
		var r JobRun
		var started, finished sql.NullTime
		if err := rows.Scan(&r.ID, &r.WorkflowID, &r.Status, &r.Details, &started, &finished); err != nil {
			return nil, err
		}
		if started.Valid {
			r.StartedAt = started.Time.Format(time.RFC3339)
		}
		if finished.Valid {
			r.FinishedAt = finished.Time.Format(time.RFC3339)
		}
		list = append(list, r)
	}
	return list, rows.Err()
}
