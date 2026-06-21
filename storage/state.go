package storage

import (
	"encoding/json"
	"fmt"
)

type UIState struct {
	ActiveWorkspaceID string `json:"activeWorkspaceId"`
	ActiveHostID      string `json:"activeHostId"`
	ActiveRequestID   string `json:"activeRequestId"`
	ActiveView        string `json:"activeView"`
	SidebarWidth      int    `json:"sidebarWidth"`
}

func defaultUIState() UIState {
	return UIState{
		ActiveView:   "request",
		SidebarWidth: 280,
	}
}

func (db *DB) LoadUIState() (UIState, error) {
	var raw string
	err := db.conn.QueryRow(`SELECT value FROM app_state WHERE key = 'ui_state'`).Scan(&raw)
	if err != nil {
		return defaultUIState(), nil
	}
	var state UIState
	if err := json.Unmarshal([]byte(raw), &state); err != nil {
		return defaultUIState(), nil
	}
	if state.SidebarWidth == 0 {
		state.SidebarWidth = 280
	}
	if state.ActiveView == "" {
		state.ActiveView = "request"
	}
	return state, nil
}

func (db *DB) SaveUIState(state UIState) error {
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	_, err = db.conn.Exec(
		`INSERT INTO app_state(key, value) VALUES('ui_state', ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		string(data),
	)
	return err
}

type LoadResult struct {
	UIState      UIState       `json:"uiState"`
	Workspaces   []Workspace   `json:"workspaces"`
	Hosts        []Host        `json:"hosts"`
	Tree         []TreeNode    `json:"tree"`
	Requests     []RequestData `json:"requests"`
	Environments []Environment `json:"environments"`
	Workflows    []Workflow    `json:"workflows"`
	JobRuns      []JobRun      `json:"jobRuns"`
}

func (db *DB) LoadAll() (LoadResult, error) {
	result := LoadResult{}
	var err error
	result.UIState, err = db.LoadUIState()
	if err != nil {
		return result, err
	}
	result.Workspaces, err = db.ListWorkspaces()
	if err != nil {
		return result, err
	}
	if result.UIState.ActiveWorkspaceID != "" {
		result.Hosts, err = db.ListHosts(result.UIState.ActiveWorkspaceID)
		if err != nil {
			return result, err
		}
		activeHostID := result.UIState.ActiveHostID
		if activeHostID != "" {
			host, err := db.GetHost(activeHostID)
			if err != nil || host.WorkspaceID != result.UIState.ActiveWorkspaceID {
				activeHostID = ""
			}
		}
		if activeHostID == "" {
			host, _ := db.GetActiveHost(result.UIState.ActiveWorkspaceID)
			activeHostID = host.ID
			result.UIState.ActiveHostID = activeHostID
		}
		if activeHostID != "" {
			hostData, err := db.LoadHostData(activeHostID)
			if err != nil {
				return result, err
			}
			result.Tree = hostData.Tree
			result.Requests = hostData.Requests
			result.Environments = hostData.Environments
			result.Workflows = hostData.Workflows
		}
	}
	result.JobRuns, _ = db.ListRecentJobRuns(50)
	return result, nil
}

func (db *DB) SaveAll(payload SavePayload) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := db.SaveUIState(payload.UIState); err != nil {
		return fmt.Errorf("save ui state: %w", err)
	}
	if payload.Workspace != nil {
		if err := db.saveWorkspaceTx(tx, *payload.Workspace); err != nil {
			return err
		}
	}
	if len(payload.Tree) > 0 && payload.WorkspaceID != "" {
		if err := db.replaceTreeTx(tx, payload.WorkspaceID, payload.Tree); err != nil {
			return err
		}
	}
	for _, req := range payload.Requests {
		if err := db.saveRequestTx(tx, req); err != nil {
			return err
		}
	}
	if payload.Environment != nil {
		if err := db.saveEnvironmentTx(tx, *payload.Environment); err != nil {
			return err
		}
	}
	if payload.Workflow != nil {
		if err := db.saveWorkflowTx(tx, *payload.Workflow); err != nil {
			return err
		}
	}
	return tx.Commit()
}

type SavePayload struct {
	UIState     UIState       `json:"uiState"`
	Workspace   *Workspace    `json:"workspace,omitempty"`
	WorkspaceID string        `json:"workspaceId,omitempty"`
	Tree        []TreeNode    `json:"tree,omitempty"`
	Requests    []RequestData `json:"requests,omitempty"`
	Environment *Environment  `json:"environment,omitempty"`
	Workflow    *Workflow     `json:"workflow,omitempty"`
}
