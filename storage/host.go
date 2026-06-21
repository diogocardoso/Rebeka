package storage

import (
	"database/sql"
	"fmt"
	"strings"
)

type Host struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspaceId"`
	Name        string `json:"name"`
	BaseURL     string `json:"baseUrl"`
	IsActive    bool   `json:"isActive"`
}

type ManageHostsInput struct {
	Action      string `json:"action"`
	WorkspaceID string `json:"workspaceId"`
	Host        Host   `json:"host"`
	HostID      string `json:"hostId"`
}

type HostLoadData struct {
	Tree         []TreeNode    `json:"tree"`
	Requests     []RequestData `json:"requests"`
	Environments []Environment `json:"environments"`
	Workflows    []Workflow    `json:"workflows"`
}

type ActiveHostVarsResult struct {
	Host      Host              `json:"host"`
	Variables map[string]string `json:"variables"`
}

func (db *DB) ListHosts(workspaceID string) ([]Host, error) {
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

func (db *DB) GetHost(id string) (Host, error) {
	var h Host
	var active int
	err := db.conn.QueryRow(
		`SELECT id, workspace_id, name, base_url, is_active FROM hosts WHERE id = ?`, id,
	).Scan(&h.ID, &h.WorkspaceID, &h.Name, &h.BaseURL, &active)
	if err != nil {
		return h, err
	}
	h.IsActive = active == 1
	return h, nil
}

func (db *DB) GetActiveHost(workspaceID string) (Host, error) {
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

func (db *DB) UpdateHost(id, name, baseURL string) error {
	_, err := db.conn.Exec(`UPDATE hosts SET name = ?, base_url = ? WHERE id = ?`, name, baseURL, id)
	return err
}

func (db *DB) DeleteHost(id string) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM env_variables WHERE environment_id IN (SELECT id FROM environments WHERE host_id = ?)`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM environments WHERE host_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM requests WHERE id IN (SELECT id FROM tree_nodes WHERE host_id = ?)`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM tree_nodes WHERE host_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM workflows WHERE host_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM hosts WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (db *DB) SetActiveHost(workspaceID, hostID string) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE hosts SET is_active = 0 WHERE workspace_id = ?`, workspaceID); err != nil {
		return err
	}
	if hostID != "" {
		if _, err := tx.Exec(`UPDATE hosts SET is_active = 1 WHERE id = ?`, hostID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (db *DB) LoadHostData(hostID string) (HostLoadData, error) {
	result := HostLoadData{}
	var err error
	result.Tree, err = db.ListTreeNodesByHost(hostID)
	if err != nil {
		return result, err
	}
	result.Requests, err = db.ListRequestsForHost(hostID)
	if err != nil {
		return result, err
	}
	result.Environments, err = db.ListEnvironmentsByHost(hostID)
	if err != nil {
		return result, err
	}
	for i := range result.Environments {
		vars, err := db.ListEnvVariables(result.Environments[i].ID)
		if err != nil {
			return result, err
		}
		result.Environments[i].Variables = vars
	}
	result.Workflows, err = db.ListWorkflowsByHost(hostID)
	if err != nil {
		return result, err
	}
	return result, nil
}

func (db *DB) GetActiveHostVars(workspaceID string) (ActiveHostVarsResult, error) {
	host, err := db.GetActiveHost(workspaceID)
	if err != nil {
		return ActiveHostVarsResult{}, err
	}
	if host.ID == "" {
		return ActiveHostVarsResult{Variables: map[string]string{}}, nil
	}
	_, vars, err := db.GetActiveEnvironmentByHost(host.ID)
	if err != nil {
		return ActiveHostVarsResult{}, err
	}
	return ActiveHostVarsResult{Host: host, Variables: vars}, nil
}

func (db *DB) collectSubtree(all []TreeNode, rootID string) []TreeNode {
	byParent := map[string][]TreeNode{}
	for _, n := range all {
		pid := ""
		if n.ParentID != nil {
			pid = *n.ParentID
		}
		byParent[pid] = append(byParent[pid], n)
	}
	var out []TreeNode
	var walk func(id string)
	walk = func(id string) {
		for _, n := range all {
			if n.ID == id {
				out = append(out, n)
				break
			}
		}
		for _, child := range byParent[id] {
			walk(child.ID)
		}
	}
	walk(rootID)
	return out
}

func (db *DB) MirrorTreeBranch(sourceNodeID, targetHostID string) (int, error) {
	sourceNode, err := db.getTreeNode(sourceNodeID)
	if err != nil {
		return 0, err
	}
	allHostTree, err := db.ListTreeNodesByHost(sourceNode.HostID)
	if err != nil {
		return 0, err
	}
	subtree := db.collectSubtree(allHostTree, sourceNodeID)
	if len(subtree) == 0 {
		return 0, nil
	}

	targetHost, err := db.GetHost(targetHostID)
	if err != nil {
		return 0, err
	}

	idMap := map[string]string{}
	for _, n := range subtree {
		idMap[n.ID] = NewID()
	}

	tx, err := db.conn.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	count := 0
	for _, n := range subtree {
		newID := idMap[n.ID]
		var parent interface{}
		if n.ParentID != nil {
			if mapped, ok := idMap[*n.ParentID]; ok {
				parent = mapped
			}
		}
		if _, err := tx.Exec(
			`INSERT INTO tree_nodes(id, workspace_id, host_id, parent_id, name, type, sort_order) VALUES(?,?,?,?,?,?,?)`,
			newID, targetHost.WorkspaceID, targetHostID, parent, n.Name, n.Type, n.SortOrder,
		); err != nil {
			return 0, err
		}
		count++
		if n.Type == "request" {
			req, err := db.GetRequest(n.ID)
			if err != nil {
				return 0, err
			}
			if _, err := tx.Exec(`
				INSERT INTO requests(id, method, url, url_mode, query_params, headers, body_type, body, auth_type, auth_data, pre_script, post_script)
				VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
				newID, req.Method, req.URL, req.URLMode, req.QueryParams, req.Headers, req.BodyType, req.Body,
				req.AuthType, req.AuthData, req.PreScript, req.PostScript,
			); err != nil {
				return 0, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return count, nil
}

func (db *DB) getTreeNode(id string) (TreeNode, error) {
	var n TreeNode
	var parent, hostID sql.NullString
	err := db.conn.QueryRow(
		`SELECT id, workspace_id, host_id, parent_id, name, type, sort_order FROM tree_nodes WHERE id = ?`, id,
	).Scan(&n.ID, &n.WorkspaceID, &hostID, &parent, &n.Name, &n.Type, &n.SortOrder)
	if hostID.Valid {
		n.HostID = hostID.String
	}
	if parent.Valid {
		p := parent.String
		n.ParentID = &p
	}
	return n, err
}

func (db *DB) MirrorHostStructure(sourceHostID, targetHostID string) (int, error) {
	sourceTree, err := db.ListTreeNodesByHost(sourceHostID)
	if err != nil {
		return 0, err
	}
	if len(sourceTree) == 0 {
		return 0, nil
	}

	targetHost, err := db.GetHost(targetHostID)
	if err != nil {
		return 0, err
	}

	idMap := map[string]string{}
	for _, n := range sourceTree {
		idMap[n.ID] = NewID()
	}

	tx, err := db.conn.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	count := 0
	for _, n := range sourceTree {
		newID := idMap[n.ID]
		var parent interface{}
		if n.ParentID != nil {
			if mapped, ok := idMap[*n.ParentID]; ok {
				parent = mapped
			}
		}
		if _, err := tx.Exec(
			`INSERT INTO tree_nodes(id, workspace_id, host_id, parent_id, name, type, sort_order) VALUES(?,?,?,?,?,?,?)`,
			newID, targetHost.WorkspaceID, targetHostID, parent, n.Name, n.Type, n.SortOrder,
		); err != nil {
			return 0, err
		}
		count++
		if n.Type == "request" {
			req, err := db.GetRequest(n.ID)
			if err != nil {
				return 0, err
			}
			if _, err := tx.Exec(`
				INSERT INTO requests(id, method, url, url_mode, query_params, headers, body_type, body, auth_type, auth_data, pre_script, post_script)
				VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
				newID, req.Method, req.URL, req.URLMode, req.QueryParams, req.Headers, req.BodyType, req.Body,
				req.AuthType, req.AuthData, req.PreScript, req.PostScript,
			); err != nil {
				return 0, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return count, nil
}

func (db *DB) ManageHosts(input ManageHostsInput) (interface{}, error) {
	switch input.Action {
	case "list":
		return db.ListHosts(input.WorkspaceID)
	case "create":
		h, err := db.CreateHost(input.WorkspaceID, input.Host.Name, input.Host.BaseURL)
		if err != nil {
			return nil, err
		}
		env, err := db.CreateEnvironment(input.WorkspaceID, h.ID, "Padrão")
		if err != nil {
			return h, nil
		}
		_ = db.SetActiveEnvironment(h.ID, env.ID)
		return h, nil
	case "update":
		if err := db.UpdateHost(input.Host.ID, input.Host.Name, input.Host.BaseURL); err != nil {
			return nil, err
		}
		return input.Host, nil
	case "delete":
		return nil, db.DeleteHost(input.HostID)
	case "setActive":
		return nil, db.SetActiveHost(input.WorkspaceID, input.HostID)
	default:
		return nil, nil
	}
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
		_ = db.SetActiveHost(ws.ID, host.ID)

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

func JoinURL(base, path string) string {
	base = strings.TrimSpace(base)
	path = strings.TrimSpace(path)
	if path == "" {
		return strings.TrimRight(base, "/")
	}
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return path
	}
	if strings.HasPrefix(path, "?") {
		if base == "" {
			return path
		}
		return strings.TrimRight(base, "/") + path
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if base == "" {
		return path
	}
	return strings.TrimRight(base, "/") + path
}
