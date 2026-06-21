package storage

import (
	"database/sql"
)

type EnvVariable struct {
	ID            string `json:"id"`
	EnvironmentID string `json:"environmentId"`
	Key           string `json:"key"`
	Value         string `json:"value"`
}

type Environment struct {
	ID          string        `json:"id"`
	WorkspaceID string        `json:"workspaceId"`
	HostID      string        `json:"hostId"`
	Name        string        `json:"name"`
	IsActive    bool          `json:"isActive"`
	Variables   []EnvVariable `json:"variables,omitempty"`
}

func (db *DB) ListEnvironmentsByHost(hostID string) ([]Environment, error) {
	rows, err := db.conn.Query(`SELECT id, workspace_id, host_id, name, is_active FROM environments WHERE host_id = ? ORDER BY name`, hostID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEnvironments(rows)
}

func (db *DB) ListEnvironments(workspaceID string) ([]Environment, error) {
	rows, err := db.conn.Query(`SELECT id, workspace_id, host_id, name, is_active FROM environments WHERE workspace_id = ? ORDER BY name`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEnvironments(rows)
}

func scanEnvironments(rows *sql.Rows) ([]Environment, error) {
	var list []Environment
	for rows.Next() {
		var e Environment
		var active int
		var hostID sql.NullString
		if err := rows.Scan(&e.ID, &e.WorkspaceID, &hostID, &e.Name, &active); err != nil {
			return nil, err
		}
		if hostID.Valid {
			e.HostID = hostID.String
		}
		e.IsActive = active == 1
		list = append(list, e)
	}
	return list, rows.Err()
}

func (db *DB) ListEnvVariables(envID string) ([]EnvVariable, error) {
	rows, err := db.conn.Query(`SELECT id, environment_id, key, value FROM env_variables WHERE environment_id = ? ORDER BY key`, envID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []EnvVariable
	for rows.Next() {
		var v EnvVariable
		if err := rows.Scan(&v.ID, &v.EnvironmentID, &v.Key, &v.Value); err != nil {
			return nil, err
		}
		list = append(list, v)
	}
	return list, rows.Err()
}

func (db *DB) CreateEnvironment(workspaceID, hostID, name string) (Environment, error) {
	e := Environment{ID: NewID(), WorkspaceID: workspaceID, HostID: hostID, Name: name}
	_, err := db.conn.Exec(`INSERT INTO environments(id, workspace_id, host_id, name) VALUES(?,?,?,?)`, e.ID, e.WorkspaceID, e.HostID, e.Name)
	return e, err
}

func (db *DB) UpdateEnvironment(id, name string) error {
	_, err := db.conn.Exec(`UPDATE environments SET name = ? WHERE id = ?`, name, id)
	return err
}

func (db *DB) DeleteEnvironment(id string) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM env_variables WHERE environment_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM environments WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (db *DB) SetActiveEnvironment(hostID, envID string) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE environments SET is_active = 0 WHERE host_id = ?`, hostID); err != nil {
		return err
	}
	if envID != "" {
		if _, err := tx.Exec(`UPDATE environments SET is_active = 1 WHERE id = ?`, envID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (db *DB) GetActiveEnvironmentByHost(hostID string) (Environment, map[string]string, error) {
	var e Environment
	var active int
	var hostIDCol sql.NullString
	err := db.conn.QueryRow(`SELECT id, workspace_id, host_id, name, is_active FROM environments WHERE host_id = ? AND is_active = 1 LIMIT 1`, hostID).
		Scan(&e.ID, &e.WorkspaceID, &hostIDCol, &e.Name, &active)
	if err == sql.ErrNoRows {
		return Environment{}, map[string]string{}, nil
	}
	if err != nil {
		return e, nil, err
	}
	if hostIDCol.Valid {
		e.HostID = hostIDCol.String
	}
	e.IsActive = active == 1
	vars, err := db.ListEnvVariables(e.ID)
	if err != nil {
		return e, nil, err
	}
	e.Variables = vars
	m := make(map[string]string)
	for _, v := range vars {
		m[v.Key] = v.Value
	}
	return e, m, nil
}

func (db *DB) GetActiveEnvironment(workspaceID string) (Environment, map[string]string, error) {
	host, err := db.GetActiveHost(workspaceID)
	if err != nil {
		return Environment{}, nil, err
	}
	if host.ID == "" {
		return Environment{}, map[string]string{}, nil
	}
	return db.GetActiveEnvironmentByHost(host.ID)
}

func (db *DB) SaveEnvVariables(envID string, vars []EnvVariable) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM env_variables WHERE environment_id = ?`, envID); err != nil {
		return err
	}
	for _, v := range vars {
		id := v.ID
		if id == "" {
			id = NewID()
		}
		if _, err := tx.Exec(`INSERT INTO env_variables(id, environment_id, key, value) VALUES(?,?,?,?)`, id, envID, v.Key, v.Value); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (db *DB) saveEnvironmentTx(tx *sql.Tx, e Environment) error {
	active := 0
	if e.IsActive {
		active = 1
	}
	if _, err := tx.Exec(
		`INSERT INTO environments(id, workspace_id, host_id, name, is_active) VALUES(?,?,?,?,?)
		 ON CONFLICT(id) DO UPDATE SET name=excluded.name, is_active=excluded.is_active, host_id=excluded.host_id`,
		e.ID, e.WorkspaceID, e.HostID, e.Name, active,
	); err != nil {
		return err
	}
	for _, v := range e.Variables {
		id := v.ID
		if id == "" {
			id = NewID()
		}
		if _, err := tx.Exec(
			`INSERT INTO env_variables(id, environment_id, key, value) VALUES(?,?,?,?)
			 ON CONFLICT(id) DO UPDATE SET key=excluded.key, value=excluded.value`,
			id, e.ID, v.Key, v.Value,
		); err != nil {
			return err
		}
	}
	return nil
}

type ManageEnvsInput struct {
	Action      string        `json:"action"`
	WorkspaceID string        `json:"workspaceId"`
	HostID      string        `json:"hostId"`
	Environment Environment   `json:"environment"`
	Variables   []EnvVariable `json:"variables"`
	EnvID       string        `json:"envId"`
}

func (db *DB) ManageEnvs(input ManageEnvsInput) (interface{}, error) {
	switch input.Action {
	case "list":
		if input.HostID != "" {
			envs, err := db.ListEnvironmentsByHost(input.HostID)
			if err != nil {
				return nil, err
			}
			for i := range envs {
				vars, err := db.ListEnvVariables(envs[i].ID)
				if err != nil {
					return nil, err
				}
				envs[i].Variables = vars
			}
			return envs, nil
		}
		envs, err := db.ListEnvironments(input.WorkspaceID)
		if err != nil {
			return nil, err
		}
		for i := range envs {
			vars, err := db.ListEnvVariables(envs[i].ID)
			if err != nil {
				return nil, err
			}
			envs[i].Variables = vars
		}
		return envs, nil
	case "create":
		hostID := input.HostID
		if hostID == "" {
			hostID = input.Environment.HostID
		}
		return db.CreateEnvironment(input.WorkspaceID, hostID, input.Environment.Name)
	case "update":
		if err := db.UpdateEnvironment(input.Environment.ID, input.Environment.Name); err != nil {
			return nil, err
		}
		return input.Environment, nil
	case "delete":
		return nil, db.DeleteEnvironment(input.EnvID)
	case "setActive":
		hostID := input.HostID
		if hostID == "" && input.EnvID != "" {
			var h sql.NullString
			_ = db.conn.QueryRow(`SELECT host_id FROM environments WHERE id = ?`, input.EnvID).Scan(&h)
			if h.Valid {
				hostID = h.String
			}
		}
		return nil, db.SetActiveEnvironment(hostID, input.EnvID)
	case "saveVariables":
		return nil, db.SaveEnvVariables(input.EnvID, input.Variables)
	default:
		return nil, nil
	}
}
