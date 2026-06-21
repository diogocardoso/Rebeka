package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type DB struct {
	conn *sql.DB
	path string
}

func Open(dataDir string) (*DB, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	dbPath := filepath.Join(dataDir, "rebeka.db")
	conn, err := sql.Open("sqlite", dbPath+"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	db := &DB{conn: conn, path: dbPath}
	if err := db.migrate(); err != nil {
		conn.Close()
		return nil, err
	}
	return db, nil
}

func (db *DB) Close() error {
	if db.conn == nil {
		return nil
	}
	return db.conn.Close()
}

func (db *DB) Conn() *sql.DB {
	return db.conn
}

func (db *DB) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS app_state (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS workspaces (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS tree_nodes (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			parent_id TEXT,
			name TEXT NOT NULL,
			type TEXT NOT NULL CHECK(type IN ('folder','request')),
			sort_order INTEGER DEFAULT 0,
			FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS requests (
			id TEXT PRIMARY KEY,
			method TEXT DEFAULT 'GET',
			url TEXT DEFAULT '',
			query_params TEXT DEFAULT '[]',
			headers TEXT DEFAULT '[]',
			body_type TEXT DEFAULT 'none',
			body TEXT DEFAULT '',
			auth_type TEXT DEFAULT 'none',
			auth_data TEXT DEFAULT '{}',
			pre_script TEXT DEFAULT '',
			post_script TEXT DEFAULT '',
			FOREIGN KEY (id) REFERENCES tree_nodes(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS environments (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			name TEXT NOT NULL,
			is_active INTEGER DEFAULT 0,
			FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS env_variables (
			id TEXT PRIMARY KEY,
			environment_id TEXT NOT NULL,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS request_history (
			id TEXT PRIMARY KEY,
			request_id TEXT NOT NULL,
			status_code INTEGER,
			duration_ms INTEGER,
			size_bytes INTEGER,
			response_body TEXT,
			response_headers TEXT,
			test_results TEXT DEFAULT '[]',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS workflows (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			name TEXT NOT NULL,
			graph TEXT NOT NULL DEFAULT '{}',
			FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS job_schedules (
			id TEXT PRIMARY KEY,
			workflow_id TEXT NOT NULL,
			interval_seconds INTEGER NOT NULL,
			enabled INTEGER DEFAULT 1,
			last_run_at DATETIME,
			FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS job_runs (
			id TEXT PRIMARY KEY,
			workflow_id TEXT NOT NULL,
			status TEXT NOT NULL,
			details TEXT DEFAULT '{}',
			started_at DATETIME,
			finished_at DATETIME,
			FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
		)`,
	}
	for _, stmt := range stmts {
		if _, err := db.conn.Exec(stmt); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	if err := db.migrateHostSchema(); err != nil {
		return err
	}
	return db.migrateRequestSchema()
}
