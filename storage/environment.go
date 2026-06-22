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
	Name        string        `json:"name"`
	BaseURL     string        `json:"baseUrl"`
	IsActive    bool          `json:"isActive"`
	HostID      string        `json:"hostId,omitempty"` // legado v1.1
	Variables   []EnvVariable `json:"variables,omitempty"`
}

type ActiveEnvironmentResult struct {
	Environment Environment     `json:"environment"`
	Variables   map[string]string `json:"variables"`
}

func (db *DB) ListEnvironmentsByHost(hostID string) ([]Environment, error) {
	rows, err := db.conn.Query(
		`SELECT id, workspace_id, host_id, name, base_url, is_active FROM environments WHERE host_id = ? ORDER BY name`,
		hostID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEnvironments(rows)
}

func (db *DB) ListEnvironments(workspaceID string) ([]Environment, error) {
	rows, err := db.conn.Query(
		`SELECT id, workspace_id, host_id, name, base_url, is_active FROM environments WHERE workspace_id = ? ORDER BY name`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEnvironments(rows)
}

func scanEnvironments(rows *sql.Rows) ([]Environment, error) {
	var list []Environment
	for rows.Next() {
		e, err := scanEnvironmentRow(rows)
		if err != nil {
			return nil, err
		}
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

func (db *DB) CreateEnvironment(workspaceID, name, baseURL string) (Environment, error) {
	e := Environment{ID: NewID(), WorkspaceID: workspaceID, Name: name, BaseURL: baseURL}
	_, err := db.conn.Exec(
		`INSERT INTO environments(id, workspace_id, name, base_url) VALUES(?,?,?,?)`,
		e.ID, e.WorkspaceID, e.Name, e.BaseURL,
	)
	return e, err
}

func (db *DB) UpdateEnvironment(id, name, baseURL string) error {
	_, err := db.conn.Exec(`UPDATE environments SET name = ?, base_url = ? WHERE id = ?`, name, baseURL, id)
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

func (db *DB) SetActiveEnvironmentByWorkspace(workspaceID, envID string) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE environments SET is_active = 0 WHERE workspace_id = ?`, workspaceID); err != nil {
		return err
	}
	if envID != "" {
		if _, err := tx.Exec(`UPDATE environments SET is_active = 1 WHERE id = ?`, envID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (db *DB) GetActiveEnvironment(workspaceID string) (Environment, map[string]string, error) {
	var e Environment
	var active int
	var hostID sql.NullString
	var baseURL sql.NullString
	err := db.conn.QueryRow(
		`SELECT id, workspace_id, host_id, name, base_url, is_active FROM environments WHERE workspace_id = ? AND is_active = 1 LIMIT 1`,
		workspaceID,
	).Scan(&e.ID, &e.WorkspaceID, &hostID, &e.Name, &baseURL, &active)
	if err == sql.ErrNoRows {
		return Environment{}, map[string]string{}, nil
	}
	if err != nil {
		return e, nil, err
	}
	if hostID.Valid {
		e.HostID = hostID.String
	}
	if baseURL.Valid {
		e.BaseURL = baseURL.String
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

func (db *DB) GetActiveEnvironmentInfo(workspaceID string) (ActiveEnvironmentResult, error) {
	env, vars, err := db.GetActiveEnvironment(workspaceID)
	if err != nil {
		return ActiveEnvironmentResult{}, err
	}
	return ActiveEnvironmentResult{Environment: env, Variables: vars}, nil
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
		`INSERT INTO environments(id, workspace_id, name, base_url, is_active) VALUES(?,?,?,?,?)
		 ON CONFLICT(id) DO UPDATE SET name=excluded.name, base_url=excluded.base_url, is_active=excluded.is_active`,
		e.ID, e.WorkspaceID, e.Name, e.BaseURL, active,
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
	Environment Environment   `json:"environment"`
	Variables   []EnvVariable `json:"variables"`
	EnvID       string        `json:"envId"`
}

func (db *DB) ManageEnvs(input ManageEnvsInput) (interface{}, error) {
	switch input.Action {
	case "list":
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
		baseURL := input.Environment.BaseURL
		if baseURL == "" {
			baseURL = "http://localhost:3000"
		}
		env, err := db.CreateEnvironment(input.WorkspaceID, input.Environment.Name, baseURL)
		if err != nil {
			return nil, err
		}
		envs, _ := db.ListEnvironments(input.WorkspaceID)
		if len(envs) == 1 {
			_ = db.SetActiveEnvironmentByWorkspace(input.WorkspaceID, env.ID)
			env.IsActive = true
		}
		return env, nil
	case "update":
		baseURL := input.Environment.BaseURL
		if baseURL == "" {
			baseURL = "http://localhost:3000"
		}
		if err := db.UpdateEnvironment(input.Environment.ID, input.Environment.Name, baseURL); err != nil {
			return nil, err
		}
		return input.Environment, nil
	case "delete":
		return nil, db.DeleteEnvironment(input.EnvID)
	case "setActive":
		return nil, db.SetActiveEnvironmentByWorkspace(input.WorkspaceID, input.EnvID)
	case "saveVariables":
		return nil, db.SaveEnvVariables(input.EnvID, input.Variables)
	default:
		return nil, nil
	}
}
