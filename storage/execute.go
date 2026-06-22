package storage

import (
	"encoding/json"
	"fmt"
	"strings"

	"rebeka/client"
)

type ExecuteScriptResult struct {
	StatusCode int               `json:"statusCode"`
	Body       string            `json:"body"`
	Headers    map[string]string `json:"headers"`
	DurationMs int64             `json:"durationMs"`
	Data       interface{}       `json:"data,omitempty"`
	Error      string            `json:"error,omitempty"`
}

type ResolvedRequestContext struct {
	WorkspaceID   string            `json:"workspaceId"`
	WorkspaceName string            `json:"workspaceName"`
	Request       RequestData       `json:"request"`
	BaseURL       string            `json:"baseUrl"`
	EnvVars       map[string]string `json:"envVars"`
}

func (db *DB) ResolveRequestByPath(path, workspaceRef string) (ResolvedRequestContext, error) {
	ws, err := db.FindWorkspaceByRef(workspaceRef)
	if err != nil {
		return ResolvedRequestContext{}, err
	}

	tree, err := db.ListTreeNodes(ws.ID)
	if err != nil {
		return ResolvedRequestContext{}, err
	}

	node, err := resolvePathInTree(tree, path)
	if err != nil {
		return ResolvedRequestContext{}, fmt.Errorf("%s (workspace %s)", err.Error(), ws.Name)
	}

	reqData, err := db.GetRequest(node.ID)
	if err != nil {
		return ResolvedRequestContext{}, fmt.Errorf("request não carregada: %s", node.Name)
	}

	env, vars, err := db.GetActiveEnvironment(ws.ID)
	if err != nil {
		return ResolvedRequestContext{}, err
	}

	baseURL := ""
	if reqData.URLMode != "absolute" {
		baseURL = env.BaseURL
	}

	return ResolvedRequestContext{
		WorkspaceID:   ws.ID,
		WorkspaceName: ws.Name,
		Request:       reqData,
		BaseURL:       baseURL,
		EnvVars:       vars,
	}, nil
}

func (db *DB) FindWorkspaceByRef(ref string) (Workspace, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return Workspace{}, fmt.Errorf("workspace não informado")
	}

	var w Workspace
	err := db.conn.QueryRow(`SELECT id, name FROM workspaces WHERE id = ?`, ref).Scan(&w.ID, &w.Name)
	if err == nil {
		return w, nil
	}

	rows, err := db.conn.Query(`SELECT id, name FROM workspaces WHERE LOWER(name) = LOWER(?) ORDER BY created_at`, ref)
	if err != nil {
		return Workspace{}, err
	}
	defer rows.Close()

	var matches []Workspace
	for rows.Next() {
		var item Workspace
		if err := rows.Scan(&item.ID, &item.Name); err != nil {
			return Workspace{}, err
		}
		matches = append(matches, item)
	}
	if err := rows.Err(); err != nil {
		return Workspace{}, err
	}
	switch len(matches) {
	case 0:
		return Workspace{}, fmt.Errorf("workspace não encontrado: %s", ref)
	case 1:
		return matches[0], nil
	default:
		return Workspace{}, fmt.Errorf("workspace ambíguo: %s (%d correspondências)", ref, len(matches))
	}
}

func resolvePathInTree(nodes []TreeNode, path string) (*TreeNode, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, fmt.Errorf("caminho da request vazio")
	}

	segments := strings.Split(path, ".")
	for i, s := range segments {
		segments[i] = strings.TrimSpace(s)
		if segments[i] == "" {
			return nil, fmt.Errorf("caminho inválido: %s", path)
		}
	}

	requestName := segments[len(segments)-1]
	folderNames := segments[:len(segments)-1]

	var parentID *string
	for _, folderName := range folderNames {
		node := findTreeChild(nodes, parentID, folderName, "folder")
		if node == nil {
			return nil, fmt.Errorf("pasta não encontrada: %s", folderName)
		}
		parentID = &node.ID
	}

	reqNode := findTreeChild(nodes, parentID, requestName, "request")
	if reqNode == nil {
		return nil, fmt.Errorf("request não encontrada: %s", requestName)
	}
	return reqNode, nil
}

func findTreeChild(nodes []TreeNode, parentID *string, name, nodeType string) *TreeNode {
	for i := range nodes {
		n := &nodes[i]
		if n.Type != nodeType {
			continue
		}
		if !sameParent(n.ParentID, parentID) {
			continue
		}
		if strings.EqualFold(n.Name, name) {
			return n
		}
	}
	return nil
}

func sameParent(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func RequestDataToHTTP(r RequestData, vars map[string]string) client.HTTPRequest {
	var auth client.AuthData
	_ = json.Unmarshal([]byte(r.AuthData), &auth)

	return client.HTTPRequest{
		Method:      r.Method,
		URL:         r.URL,
		QueryParams: client.ParseKeyValuesJSON(r.QueryParams),
		Headers:     client.ParseKeyValuesJSON(r.Headers),
		BodyType:    r.BodyType,
		Body:        r.Body,
		AuthType:    r.AuthType,
		AuthData:    auth,
		Variables:   vars,
	}
}

func mergeEnvVars(base map[string]string, overrides map[string]string) map[string]string {
	out := make(map[string]string, len(base)+len(overrides))
	for k, v := range base {
		out[k] = v
	}
	for k, v := range overrides {
		out[k] = v
	}
	return out
}

func parseJSONBody(body string) interface{} {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil
	}
	var data interface{}
	if err := json.Unmarshal([]byte(body), &data); err != nil {
		return nil
	}
	return data
}

func (db *DB) ExecuteByPath(path, workspaceRef string, envOverrides map[string]string) (ExecuteScriptResult, error) {
	ctx, err := db.ResolveRequestByPath(path, workspaceRef)
	if err != nil {
		return ExecuteScriptResult{Error: err.Error()}, nil
	}

	mergedVars := mergeEnvVars(ctx.EnvVars, envOverrides)
	httpReq := RequestDataToHTTP(ctx.Request, mergedVars)

	if ctx.BaseURL != "" {
		httpReq.URL = JoinURL(ctx.BaseURL, httpReq.URL)
	}

	resp := client.Send(httpReq)
	result := ExecuteScriptResult{
		StatusCode: resp.StatusCode,
		Body:       resp.Body,
		Headers:    resp.Headers,
		DurationMs: resp.DurationMs,
		Data:       parseJSONBody(resp.Body),
	}
	if resp.Error != "" {
		result.Error = resp.Error
		return result, nil
	}

	headersJSON, _ := json.Marshal(resp.Headers)
	_ = db.SaveHistory(HistoryEntry{
		RequestID:       ctx.Request.ID,
		StatusCode:      resp.StatusCode,
		DurationMs:      resp.DurationMs,
		SizeBytes:       resp.SizeBytes,
		ResponseBody:    resp.Body,
		ResponseHeaders: string(headersJSON),
		TestResults:     "[]",
	})

	return result, nil
}
