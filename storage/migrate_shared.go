package storage

import (
	"database/sql"
	"fmt"
)

func (db *DB) migrateSharedCollections() error {
	if db.isMigrationDone("migration_shared_collections") {
		return nil
	}

	if !db.hasColumn("environments", "base_url") {
		if _, err := db.conn.Exec(`ALTER TABLE environments ADD COLUMN base_url TEXT NOT NULL DEFAULT ''`); err != nil {
			return fmt.Errorf("add environments.base_url: %w", err)
		}
	}

	workspaces, err := db.ListWorkspaces()
	if err != nil {
		return err
	}

	for _, ws := range workspaces {
		if err := db.migrateWorkspaceToSharedCollections(ws.ID); err != nil {
			return err
		}
	}

	return db.markMigrationDone("migration_shared_collections")
}

func (db *DB) migrateWorkspaceToSharedCollections(workspaceID string) error {
	hosts, err := db.ListHosts(workspaceID)
	if err != nil {
		return err
	}

	if len(hosts) > 0 {
		activeHost, _ := db.GetActiveHost(workspaceID)
		activeHostID := activeHost.ID
		if activeHostID == "" && len(hosts) > 0 {
			activeHostID = hosts[0].ID
		}

		for _, h := range hosts {
			vars := []EnvVariable{}
			nestedEnvs, _ := db.ListEnvironmentsByHost(h.ID)
			for _, ne := range nestedEnvs {
				if ne.IsActive || len(vars) == 0 {
					v, _ := db.ListEnvVariables(ne.ID)
					if len(v) > 0 {
						vars = v
					}
				}
			}

			// Remove vars legadas dos perfis aninhados antes de recriar no ambiente.
			for _, ne := range nestedEnvs {
				if _, err := db.conn.Exec(`DELETE FROM env_variables WHERE environment_id = ?`, ne.ID); err != nil {
					return err
				}
			}

			active := 0
			if h.IsActive {
				active = 1
			}

			if _, err := db.conn.Exec(`
				INSERT INTO environments(id, workspace_id, host_id, name, base_url, is_active)
				VALUES(?,?,?,?,?,?)
				ON CONFLICT(id) DO UPDATE SET
					name=excluded.name,
					base_url=excluded.base_url,
					is_active=excluded.is_active,
					host_id=NULL`,
				h.ID, workspaceID, nil, h.Name, h.BaseURL, active,
			); err != nil {
				return err
			}

			cloned := make([]EnvVariable, len(vars))
			for i, v := range vars {
				cloned[i] = EnvVariable{
					ID:            NewID(),
					EnvironmentID: h.ID,
					Key:           v.Key,
					Value:         v.Value,
				}
			}
			if err := db.SaveEnvVariables(h.ID, cloned); err != nil {
				return err
			}

			for _, ne := range nestedEnvs {
				if ne.ID == h.ID {
					continue
				}
				if _, err := db.conn.Exec(`DELETE FROM environments WHERE id = ?`, ne.ID); err != nil {
					return err
				}
			}
		}

		if activeHostID != "" {
			if _, err := db.conn.Exec(`
				DELETE FROM requests WHERE id IN (
					SELECT id FROM tree_nodes WHERE workspace_id = ? AND host_id IS NOT NULL AND host_id != ''
					AND host_id != ?
				)`, workspaceID, activeHostID); err != nil {
				return err
			}
			if _, err := db.conn.Exec(`
				DELETE FROM tree_nodes WHERE workspace_id = ? AND host_id IS NOT NULL AND host_id != ''
				AND host_id != ?`, workspaceID, activeHostID); err != nil {
				return err
			}
		}

		if _, err := db.conn.Exec(`UPDATE tree_nodes SET host_id = NULL WHERE workspace_id = ?`, workspaceID); err != nil {
			return err
		}
		if _, err := db.conn.Exec(`UPDATE workflows SET host_id = NULL WHERE workspace_id = ?`, workspaceID); err != nil {
			return err
		}
		if _, err := db.conn.Exec(`DELETE FROM hosts WHERE workspace_id = ?`, workspaceID); err != nil {
			return err
		}
	}

	envs, err := db.ListEnvironments(workspaceID)
	if err != nil {
		return err
	}
	if len(envs) == 0 {
		env, err := db.CreateEnvironment(workspaceID, "Local", "http://localhost:3000")
		if err != nil {
			return err
		}
		_ = db.SetActiveEnvironmentByWorkspace(workspaceID, env.ID)
		if _, _, err := db.CreateTreeNode(workspaceID, nil, "Coleção", "folder"); err != nil {
			return err
		}
		return nil
	}

	hasActive := false
	for _, e := range envs {
		if e.IsActive {
			hasActive = true
			break
		}
	}
	if !hasActive {
		_ = db.SetActiveEnvironmentByWorkspace(workspaceID, envs[0].ID)
	}

	for i := range envs {
		if envs[i].BaseURL == "" {
			_, _ = db.conn.Exec(`UPDATE environments SET base_url = ? WHERE id = ?`, "http://localhost:3000", envs[i].ID)
		}
	}

	tree, _ := db.ListTreeNodes(workspaceID)
	if len(tree) == 0 {
		if _, _, err := db.CreateTreeNode(workspaceID, nil, "Coleção", "folder"); err != nil {
			return err
		}
	}

	return nil
}

func (db *DB) isMigrationDone(key string) bool {
	var val string
	err := db.conn.QueryRow(`SELECT value FROM app_state WHERE key = ?`, key).Scan(&val)
	return err == nil && val == "1"
}

func (db *DB) markMigrationDone(key string) error {
	_, err := db.conn.Exec(
		`INSERT INTO app_state(key, value) VALUES(?, '1')
		 ON CONFLICT(key) DO UPDATE SET value = '1'`,
		key,
	)
	return err
}

func (db *DB) migrateUIStateToEnvironment() {
	state, err := db.LoadUIState()
	if err != nil {
		return
	}
	if state.ActiveEnvironmentID == "" && state.ActiveHostID != "" {
		state.ActiveEnvironmentID = state.ActiveHostID
		_ = db.SaveUIState(state)
	}
}

func scanEnvironmentRow(rows *sql.Rows) (Environment, error) {
	var e Environment
	var active int
	var hostID sql.NullString
	var baseURL sql.NullString
	if err := rows.Scan(&e.ID, &e.WorkspaceID, &hostID, &e.Name, &baseURL, &active); err != nil {
		return e, err
	}
	if hostID.Valid {
		e.HostID = hostID.String
	}
	if baseURL.Valid {
		e.BaseURL = baseURL.String
	}
	e.IsActive = active == 1
	return e, nil
}
