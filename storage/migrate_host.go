package storage

import (
	"database/sql"
	"fmt"
)

type Host struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspaceId"`
	Name        string `json:"name"`
	BaseURL     string `json:"baseUrl"`
	IsActive    bool   `json:"isActive"`
}

func (db *DB) ListHosts(workspaceID string) ([]Host, error) {
	if !db.hasTable("hosts") {
		return nil, nil
	}
	rows, err := db.conn.Query(
		`SELECT id, workspace_id, name, base_url, is_active FROM hosts WHERE workspace_id = ? ORDER BY name`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Host
	for rows.Next() {
		var h Host
		var active int
		if err := rows.Scan(&h.ID, &h.WorkspaceID, &h.Name, &h.BaseURL, &active); err != nil {
			return nil, err
		}
		h.IsActive = active == 1
		list = append(list, h)
	}
	return list, rows.Err()
}

func (db *DB) GetActiveHost(workspaceID string) (Host, error) {
	if !db.hasTable("hosts") {
		return Host{}, nil
	}
	var h Host
	var active int
	err := db.conn.QueryRow(
		`SELECT id, workspace_id, name, base_url, is_active FROM hosts WHERE workspace_id = ? AND is_active = 1 LIMIT 1`,
		workspaceID,
	).Scan(&h.ID, &h.WorkspaceID, &h.Name, &h.BaseURL, &active)
	if err == sql.ErrNoRows {
		return Host{}, nil
	}
	if err != nil {
		return h, err
	}
	h.IsActive = active == 1
	return h, nil
}

func (db *DB) CreateHost(workspaceID, name, baseURL string) (Host, error) {
	h := Host{ID: NewID(), WorkspaceID: workspaceID, Name: name, BaseURL: baseURL}
	_, err := db.conn.Exec(
		`INSERT INTO hosts(id, workspace_id, name, base_url) VALUES(?,?,?,?)`,
		h.ID, h.WorkspaceID, h.Name, h.BaseURL,
	)
	return h, err
}

func (db *DB) hasTable(name string) bool {
	var n string
	err := db.conn.QueryRow(
		`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, name,
	).Scan(&n)
	return err == nil && n == name
}

func (db *DB) migrateHostSchema() error {
	_, _ = db.conn.Exec(`CREATE TABLE IF NOT EXISTS hosts (
		id TEXT PRIMARY KEY,
		workspace_id TEXT NOT NULL,
		name TEXT NOT NULL,
		base_url TEXT NOT NULL DEFAULT '',
		is_active INTEGER DEFAULT 0,
		FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
	)`)

	cols := []struct{ table, col, def string }{
		{"environments", "host_id", "TEXT"},
		{"tree_nodes", "host_id", "TEXT"},
		{"workflows", "host_id", "TEXT"},
	}
	for _, c := range cols {
		if !db.hasColumn(c.table, c.col) {
			if _, err := db.conn.Exec(fmt.Sprintf(`ALTER TABLE %s ADD COLUMN %s %s`, c.table, c.col, c.def)); err != nil {
				return fmt.Errorf("add column %s.%s: %w", c.table, c.col, err)
			}
		}
	}
	return db.migrateExistingDataToHosts()
}

func (db *DB) hasColumn(table, column string) bool {
	rows, err := db.conn.Query(fmt.Sprintf(`PRAGMA table_info(%s)`, table))
	if err != nil {
		return false
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return false
		}
		if name == column {
			return true
		}
	}
	return false
}

func (db *DB) migrateExistingDataToHosts() error {
	if db.isMigrationDone("migration_shared_collections") {
		return nil
	}
	workspaces, err := db.ListWorkspaces()
	if err != nil {
		return err
	}
	for _, ws := range workspaces {
		hosts, err := db.ListHosts(ws.ID)
		if err != nil {
			return err
		}
		if len(hosts) > 0 {
			continue
		}

		baseURL := "http://localhost:3000"
		envs, _ := db.ListEnvironments(ws.ID)
		for _, e := range envs {
			if e.BaseURL != "" {
				baseURL = e.BaseURL
				break
			}
			vars, _ := db.ListEnvVariables(e.ID)
			for _, v := range vars {
				if v.Key == "base_url" && v.Value != "" {
					baseURL = v.Value
					break
				}
			}
		}

		host, err := db.CreateHost(ws.ID, "Local", baseURL)
		if err != nil {
			return err
		}
		_, _ = db.conn.Exec(`UPDATE hosts SET is_active = 1 WHERE id = ?`, host.ID)

		if _, err := db.conn.Exec(`UPDATE environments SET host_id = ? WHERE workspace_id = ? AND (host_id IS NULL OR host_id = '')`, host.ID, ws.ID); err != nil {
			return err
		}
		if _, err := db.conn.Exec(`UPDATE tree_nodes SET host_id = ? WHERE workspace_id = ? AND (host_id IS NULL OR host_id = '')`, host.ID, ws.ID); err != nil {
			return err
		}
		if _, err := db.conn.Exec(`UPDATE workflows SET host_id = ? WHERE workspace_id = ? AND (host_id IS NULL OR host_id = '')`, host.ID, ws.ID); err != nil {
			return err
		}

		for _, e := range envs {
			vars, _ := db.ListEnvVariables(e.ID)
			filtered := make([]EnvVariable, 0, len(vars))
			for _, v := range vars {
				if v.Key == "base_url" {
					continue
				}
				filtered = append(filtered, v)
			}
			if len(filtered) != len(vars) {
				_ = db.SaveEnvVariables(e.ID, filtered)
			}
		}
	}
	return nil
}
