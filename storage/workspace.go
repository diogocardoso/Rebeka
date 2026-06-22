package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

type Workspace struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type TreeNode struct {
	ID          string  `json:"id"`
	WorkspaceID string  `json:"workspaceId"`
	ParentID    *string `json:"parentId"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	SortOrder   int     `json:"sortOrder"`
}

type RequestData struct {
	ID          string `json:"id"`
	Method      string `json:"method"`
	URL         string `json:"url"`
	URLMode     string `json:"urlMode"`
	QueryParams string `json:"queryParams"`
	Headers     string `json:"headers"`
	BodyType    string `json:"bodyType"`
	Body        string `json:"body"`
	AuthType    string `json:"authType"`
	AuthData    string `json:"authData"`
	PreScript   string `json:"preScript"`
	PostScript  string `json:"postScript"`
}

func normalizeRequestData(r *RequestData) {
	if r.URLMode == "" {
		r.URLMode = "host"
	}
}

func (db *DB) migrateRequestSchema() error {
	if !db.hasColumn("requests", "url_mode") {
		if _, err := db.conn.Exec(`ALTER TABLE requests ADD COLUMN url_mode TEXT NOT NULL DEFAULT 'host'`); err != nil {
			return fmt.Errorf("add requests.url_mode: %w", err)
		}
	}
	_, _ = db.conn.Exec(`
		UPDATE requests SET url_mode = 'absolute'
		WHERE (url LIKE 'http://%' OR url LIKE 'https://%')
		  AND url_mode = 'host'`)
	return nil
}

func NewID() string {
	return uuid.New().String()
}

func (db *DB) ListWorkspaces() ([]Workspace, error) {
	rows, err := db.conn.Query(`SELECT id, name FROM workspaces ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Workspace
	for rows.Next() {
		var w Workspace
		if err := rows.Scan(&w.ID, &w.Name); err != nil {
			return nil, err
		}
		list = append(list, w)
	}
	return list, rows.Err()
}

func (db *DB) CreateWorkspace(name string) (Workspace, error) {
	w := Workspace{ID: NewID(), Name: name}
	_, err := db.conn.Exec(`INSERT INTO workspaces(id, name) VALUES(?, ?)`, w.ID, w.Name)
	if err != nil {
		return w, err
	}
	if err := db.BootstrapWorkspace(w.ID); err != nil {
		return w, err
	}
	return w, nil
}

func (db *DB) BootstrapWorkspace(wsID string) error {
	env, err := db.CreateEnvironment(wsID, "Local", "http://localhost:3000")
	if err != nil {
		return err
	}
	if err := db.SetActiveEnvironmentByWorkspace(wsID, env.ID); err != nil {
		return err
	}
	_, _, err = db.CreateTreeNode(wsID, nil, "Coleção", "folder")
	return err
}

func (db *DB) UpdateWorkspace(id, name string) error {
	_, err := db.conn.Exec(`UPDATE workspaces SET name = ? WHERE id = ?`, name, id)
	return err
}

func (db *DB) DeleteWorkspace(id string) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM env_variables WHERE environment_id IN (SELECT id FROM environments WHERE workspace_id = ?)`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM environments WHERE workspace_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM requests WHERE id IN (SELECT id FROM tree_nodes WHERE workspace_id = ?)`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM tree_nodes WHERE workspace_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM workflows WHERE workspace_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM workspaces WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (db *DB) ListTreeNodes(workspaceID string) ([]TreeNode, error) {
	rows, err := db.conn.Query(
		`SELECT id, workspace_id, parent_id, name, type, sort_order FROM tree_nodes WHERE workspace_id = ? ORDER BY sort_order, name`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTreeNodes(rows)
}

func scanTreeNodes(rows *sql.Rows) ([]TreeNode, error) {
	var list []TreeNode
	for rows.Next() {
		var n TreeNode
		var parent sql.NullString
		if err := rows.Scan(&n.ID, &n.WorkspaceID, &parent, &n.Name, &n.Type, &n.SortOrder); err != nil {
			return nil, err
		}
		if parent.Valid {
			p := parent.String
			n.ParentID = &p
		}
		list = append(list, n)
	}
	return list, rows.Err()
}

func (db *DB) ListRequestsForWorkspace(workspaceID string) ([]RequestData, error) {
	rows, err := db.conn.Query(`
		SELECT r.id, r.method, r.url, r.url_mode, r.query_params, r.headers, r.body_type, r.body, r.auth_type, r.auth_data, r.pre_script, r.post_script
		FROM requests r
		JOIN tree_nodes t ON t.id = r.id
		WHERE t.workspace_id = ?`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRequests(rows)
}

func scanRequests(rows *sql.Rows) ([]RequestData, error) {
	var list []RequestData
	for rows.Next() {
		var r RequestData
		if err := rows.Scan(&r.ID, &r.Method, &r.URL, &r.URLMode, &r.QueryParams, &r.Headers, &r.BodyType, &r.Body, &r.AuthType, &r.AuthData, &r.PreScript, &r.PostScript); err != nil {
			return nil, err
		}
		normalizeRequestData(&r)
		list = append(list, r)
	}
	return list, rows.Err()
}

func (db *DB) GetRequest(id string) (RequestData, error) {
	var r RequestData
	err := db.conn.QueryRow(`
		SELECT id, method, url, url_mode, query_params, headers, body_type, body, auth_type, auth_data, pre_script, post_script
		FROM requests WHERE id = ?`, id).Scan(
		&r.ID, &r.Method, &r.URL, &r.URLMode, &r.QueryParams, &r.Headers, &r.BodyType, &r.Body, &r.AuthType, &r.AuthData, &r.PreScript, &r.PostScript,
	)
	if err == nil {
		normalizeRequestData(&r)
	}
	return r, err
}

func (db *DB) CreateTreeNode(workspaceID string, parentID *string, name, nodeType string) (TreeNode, RequestData, error) {
	n := TreeNode{
		ID:          NewID(),
		WorkspaceID: workspaceID,
		ParentID:    parentID,
		Name:        name,
		Type:        nodeType,
	}
	tx, err := db.conn.Begin()
	if err != nil {
		return n, RequestData{}, err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(
		`INSERT INTO tree_nodes(id, workspace_id, parent_id, name, type) VALUES(?,?,?,?,?)`,
		n.ID, n.WorkspaceID, parentID, n.Name, n.Type,
	); err != nil {
		return n, RequestData{}, err
	}
	req := RequestData{ID: n.ID, Method: "GET", QueryParams: "[]", Headers: "[]", AuthData: "{}"}
	if nodeType == "request" {
		if _, err := tx.Exec(
			`INSERT INTO requests(id) VALUES(?)`, n.ID,
		); err != nil {
			return n, RequestData{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return n, RequestData{}, err
	}
	return n, req, nil
}

func (db *DB) UpdateTreeNode(id, name string) error {
	_, err := db.conn.Exec(`UPDATE tree_nodes SET name = ? WHERE id = ?`, name, id)
	return err
}

func (db *DB) DeleteTreeNode(id string) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := db.deleteTreeNodeRecursive(tx, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (db *DB) deleteTreeNodeRecursive(tx *sql.Tx, id string) error {
	rows, err := tx.Query(`SELECT id FROM tree_nodes WHERE parent_id = ?`, id)
	if err != nil {
		return err
	}
	var childIDs []string
	for rows.Next() {
		var cid string
		if err := rows.Scan(&cid); err != nil {
			rows.Close()
			return err
		}
		childIDs = append(childIDs, cid)
	}
	rows.Close()
	for _, cid := range childIDs {
		if err := db.deleteTreeNodeRecursive(tx, cid); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(`DELETE FROM requests WHERE id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM tree_nodes WHERE id = ?`, id); err != nil {
		return err
	}
	return nil
}

func (db *DB) saveWorkspaceTx(tx *sql.Tx, w Workspace) error {
	_, err := tx.Exec(
		`INSERT INTO workspaces(id, name) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
		w.ID, w.Name,
	)
	return err
}

func (db *DB) replaceTreeTx(tx *sql.Tx, workspaceID string, nodes []TreeNode) error {
	for _, n := range nodes {
		var parent interface{}
		if n.ParentID != nil {
			parent = *n.ParentID
		}
		if _, err := tx.Exec(
			`INSERT INTO tree_nodes(id, workspace_id, parent_id, name, type, sort_order) VALUES(?,?,?,?,?,?)
			 ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id, name=excluded.name, type=excluded.type, sort_order=excluded.sort_order`,
			n.ID, workspaceID, parent, n.Name, n.Type, n.SortOrder,
		); err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) saveRequestTx(tx *sql.Tx, r RequestData) error {
	normalizeRequestData(&r)
	_, err := tx.Exec(`
		INSERT INTO requests(id, method, url, url_mode, query_params, headers, body_type, body, auth_type, auth_data, pre_script, post_script)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			method=excluded.method, url=excluded.url, url_mode=excluded.url_mode, query_params=excluded.query_params,
			headers=excluded.headers, body_type=excluded.body_type, body=excluded.body,
			auth_type=excluded.auth_type, auth_data=excluded.auth_data,
			pre_script=excluded.pre_script, post_script=excluded.post_script`,
		r.ID, r.Method, r.URL, r.URLMode, r.QueryParams, r.Headers, r.BodyType, r.Body, r.AuthType, r.AuthData, r.PreScript, r.PostScript,
	)
	return err
}

func (db *DB) SaveRequest(r RequestData) error {
	normalizeRequestData(&r)
	_, err := db.conn.Exec(`
		INSERT INTO requests(id, method, url, url_mode, query_params, headers, body_type, body, auth_type, auth_data, pre_script, post_script)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			method=excluded.method, url=excluded.url, url_mode=excluded.url_mode, query_params=excluded.query_params,
			headers=excluded.headers, body_type=excluded.body_type, body=excluded.body,
			auth_type=excluded.auth_type, auth_data=excluded.auth_data,
			pre_script=excluded.pre_script, post_script=excluded.post_script`,
		r.ID, r.Method, r.URL, r.URLMode, r.QueryParams, r.Headers, r.BodyType, r.Body, r.AuthType, r.AuthData, r.PreScript, r.PostScript,
	)
	return err
}

type WorkspaceExport struct {
	Version      string        `json:"version"`
	Workspace    Workspace     `json:"workspace"`
	Tree         []TreeNode    `json:"tree"`
	Requests     []RequestData `json:"requests"`
	Environments []Environment `json:"environments"`
	Workflows    []Workflow    `json:"workflows"`
	Hosts        []Host        `json:"hosts,omitempty"` // legado v1.1
}

func (db *DB) ExportWorkspace(workspaceID string) (WorkspaceExport, error) {
	ws, err := db.getWorkspace(workspaceID)
	if err != nil {
		return WorkspaceExport{}, err
	}
	hosts, _ := db.ListHosts(workspaceID)
	tree, err := db.ListTreeNodes(workspaceID)
	if err != nil {
		return WorkspaceExport{}, err
	}
	requests, err := db.ListRequestsForWorkspace(workspaceID)
	if err != nil {
		return WorkspaceExport{}, err
	}
	envs, err := db.ListEnvironments(workspaceID)
	if err != nil {
		return WorkspaceExport{}, err
	}
	for i := range envs {
		vars, err := db.ListEnvVariables(envs[i].ID)
		if err != nil {
			return WorkspaceExport{}, err
		}
		envs[i].Variables = vars
	}
	workflows, err := db.ListWorkflows(workspaceID)
	if err != nil {
		return WorkspaceExport{}, err
	}
	return WorkspaceExport{
		Version:      "1.2",
		Workspace:    ws,
		Hosts:        hosts,
		Tree:         tree,
		Requests:     requests,
		Environments: envs,
		Workflows:    workflows,
	}, nil
}

func (db *DB) ImportWorkspace(data WorkspaceExport) (Workspace, error) {
	newWS := Workspace{ID: NewID(), Name: data.Workspace.Name + " (importado)"}
	idMap := map[string]string{data.Workspace.ID: newWS.ID}
	envIDMap := map[string]string{}

	tx, err := db.conn.Begin()
	if err != nil {
		return newWS, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`INSERT INTO workspaces(id, name) VALUES(?, ?)`, newWS.ID, newWS.Name); err != nil {
		return newWS, err
	}

	// Importar hosts legados (v1.1) como environments
	for _, h := range data.Hosts {
		newEnvID := NewID()
		envIDMap[h.ID] = newEnvID
		active := 0
		if h.IsActive {
			active = 1
		}
		if _, err := tx.Exec(
			`INSERT INTO environments(id, workspace_id, name, base_url, is_active) VALUES(?,?,?,?,?)`,
			newEnvID, newWS.ID, h.Name, h.BaseURL, active,
		); err != nil {
		 return newWS, err
		}
	}

	if len(data.Hosts) == 0 {
		for _, e := range data.Environments {
			newEnvID := NewID()
			envIDMap[e.ID] = newEnvID
			baseURL := e.BaseURL
			if baseURL == "" {
				baseURL = "http://localhost:3000"
			}
			active := 0
			if e.IsActive {
				active = 1
			}
			if _, err := tx.Exec(
				`INSERT INTO environments(id, workspace_id, name, base_url, is_active) VALUES(?,?,?,?,?)`,
				newEnvID, newWS.ID, e.Name, baseURL, active,
			); err != nil {
				return newWS, err
			}
			for _, v := range e.Variables {
				if v.Key == "base_url" {
					continue
				}
				if _, err := tx.Exec(
					`INSERT INTO env_variables(id, environment_id, key, value) VALUES(?,?,?,?)`,
					NewID(), newEnvID, v.Key, v.Value,
				); err != nil {
					return newWS, err
				}
			}
		}
	}

	if len(data.Environments) == 0 && len(data.Hosts) == 0 {
		defaultEnvID := NewID()
		if _, err := tx.Exec(
			`INSERT INTO environments(id, workspace_id, name, base_url, is_active) VALUES(?,?,?,?,1)`,
			defaultEnvID, newWS.ID, "Local", "http://localhost:3000",
		); err != nil {
			return newWS, err
		}
	}

	for _, n := range data.Tree {
		newID := NewID()
		idMap[n.ID] = newID
	}

	for _, n := range data.Tree {
		newID := idMap[n.ID]
		var parent interface{}
		if n.ParentID != nil {
			if mapped, ok := idMap[*n.ParentID]; ok {
				parent = mapped
			}
		}
		if _, err := tx.Exec(
			`INSERT INTO tree_nodes(id, workspace_id, parent_id, name, type, sort_order) VALUES(?,?,?,?,?,?)`,
			newID, newWS.ID, parent, n.Name, n.Type, n.SortOrder,
		); err != nil {
			return newWS, err
		}
	}

	for _, r := range data.Requests {
		newID, ok := idMap[r.ID]
		if !ok {
			continue
		}
		if _, err := tx.Exec(`
			INSERT INTO requests(id, method, url, url_mode, query_params, headers, body_type, body, auth_type, auth_data, pre_script, post_script)
			VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
			newID, r.Method, r.URL, r.URLMode, r.QueryParams, r.Headers, r.BodyType, r.Body, r.AuthType, r.AuthData, r.PreScript, r.PostScript,
		); err != nil {
			return newWS, err
		}
	}

	for _, wf := range data.Workflows {
		graph := wf.Graph
		for oldID, newID := range idMap {
			graph = replaceAll(graph, oldID, newID)
		}
		if _, err := tx.Exec(
			`INSERT INTO workflows(id, workspace_id, name, graph) VALUES(?,?,?,?)`,
			NewID(), newWS.ID, wf.Name, graph,
		); err != nil {
			return newWS, err
		}
	}

	if err := tx.Commit(); err != nil {
		return newWS, err
	}
	return newWS, nil
}

func (db *DB) getWorkspace(id string) (Workspace, error) {
	var w Workspace
	err := db.conn.QueryRow(`SELECT id, name FROM workspaces WHERE id = ?`, id).Scan(&w.ID, &w.Name)
	return w, err
}

func replaceAll(s, old, new string) string {
	b, _ := json.Marshal(struct{ G string }{s})
	out := string(b)
	// simple string replace on graph JSON
	result := ""
	for i := 0; i < len(out); i++ {
		if i+len(old) <= len(out) && out[i:i+len(old)] == old {
			result += new
			i += len(old) - 1
		} else {
			result += string(out[i])
		}
	}
	var unwrapped string
	_ = json.Unmarshal([]byte(result), &unwrapped)
	return unwrapped
}

func (db *DB) EnsureDefaultWorkspace() (Workspace, error) {
	list, err := db.ListWorkspaces()
	if err != nil {
		return Workspace{}, err
	}
	if len(list) > 0 {
		return list[0], nil
	}
	ws, err := db.CreateWorkspace("Meu Workspace")
	if err != nil {
		return ws, err
	}
	return ws, nil
}
