package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"rebeka/bek"
	"rebeka/client"
	"rebeka/storage"
	"rebeka/workflow"
)

type App struct {
	ctx       context.Context
	db        *storage.DB
	scheduler *workflow.Scheduler
	executor  *workflow.Executor
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	dataDir := filepath.Join(os.Getenv("APPDATA"), "Rebeka")
	db, err := storage.Open(dataDir)
	if err != nil {
		runtime.LogError(ctx, "failed to open db: "+err.Error())
		return
	}
	a.db = db
	a.executor = &workflow.Executor{DB: db}
	a.scheduler = workflow.NewScheduler(db, a.executor)
	a.scheduler.Start()

	ws, err := db.EnsureDefaultWorkspace()
	if err != nil {
		runtime.LogError(ctx, "default workspace: "+err.Error())
		return
	}
	state, _ := db.LoadUIState()
	if state.ActiveWorkspaceID == "" {
		state.ActiveWorkspaceID = ws.ID
	}
	host, _ := db.GetActiveHost(ws.ID)
	if state.ActiveHostID == "" && host.ID != "" {
		state.ActiveHostID = host.ID
	}
	if state.ActiveWorkspaceID != "" || state.ActiveHostID != "" {
		_ = db.SaveUIState(state)
	}
}

func (a *App) shutdown(ctx context.Context) {
	if a.scheduler != nil {
		a.scheduler.Stop()
	}
	if a.db != nil {
		_ = a.db.Close()
	}
}

func (a *App) Load() (storage.LoadResult, error) {
	if a.db == nil {
		return storage.LoadResult{}, fmt.Errorf("database not initialized")
	}
	return a.db.LoadAll()
}

func (a *App) Save(payload storage.SavePayload) error {
	if a.db == nil {
		return fmt.Errorf("database not initialized")
	}
	return a.db.SaveAll(payload)
}

func (a *App) CreateWorkspace(name string) (storage.Workspace, error) {
	return a.db.CreateWorkspace(name)
}

func (a *App) UpdateWorkspace(id, name string) error {
	return a.db.UpdateWorkspace(id, name)
}

func (a *App) DeleteWorkspace(id string) error {
	return a.db.DeleteWorkspace(id)
}

func (a *App) CreateTreeNode(workspaceID, hostID string, parentID *string, name, nodeType string) (map[string]interface{}, error) {
	node, req, err := a.db.CreateTreeNode(workspaceID, hostID, parentID, name, nodeType)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"node": node, "request": req}, nil
}

func (a *App) UpdateTreeNode(id, name string) error {
	return a.db.UpdateTreeNode(id, name)
}

func (a *App) DeleteTreeNode(id string) error {
	return a.db.DeleteTreeNode(id)
}

func (a *App) SaveRequest(req storage.RequestData) error {
	return a.db.SaveRequest(req)
}

func (a *App) SendRequest(req client.HTTPRequest, requestID, baseURL, testResults string) (client.HTTPResponse, error) {
	if baseURL != "" {
		req.URL = storage.JoinURL(baseURL, req.URL)
	}
	resp := client.Send(req)
	if requestID != "" {
		headersJSON, _ := json.Marshal(resp.Headers)
		_ = a.db.SaveHistory(storage.HistoryEntry{
			RequestID:       requestID,
			StatusCode:      resp.StatusCode,
			DurationMs:      resp.DurationMs,
			SizeBytes:       resp.SizeBytes,
			ResponseBody:    resp.Body,
			ResponseHeaders: string(headersJSON),
			TestResults:     testResults,
		})
	}
	return resp, nil
}

func (a *App) ManageEnvs(input storage.ManageEnvsInput) (interface{}, error) {
	return a.db.ManageEnvs(input)
}

func (a *App) GetActiveEnvVars(workspaceID string) (map[string]string, error) {
	_, vars, err := a.db.GetActiveEnvironment(workspaceID)
	return vars, err
}

func (a *App) ManageHosts(input storage.ManageHostsInput) (interface{}, error) {
	return a.db.ManageHosts(input)
}

func (a *App) LoadHostData(hostID string) (storage.HostLoadData, error) {
	return a.db.LoadHostData(hostID)
}

func (a *App) MirrorHostStructure(sourceHostID, targetHostID string) (int, error) {
	return a.db.MirrorHostStructure(sourceHostID, targetHostID)
}

func (a *App) MirrorTreeBranch(sourceNodeID, targetHostID string) (int, error) {
	return a.db.MirrorTreeBranch(sourceNodeID, targetHostID)
}

func (a *App) GetActiveHostVars(workspaceID string) (storage.ActiveHostVarsResult, error) {
	return a.db.GetActiveHostVars(workspaceID)
}

func (a *App) ExportBek(workspaceID string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Exportar coleção",
		DefaultFilename: "colecao.bek",
		Filters: []runtime.FileFilter{
			{DisplayName: "Rebeka Backup (*.bek)", Pattern: "*.bek"},
		},
	})
	if err != nil || path == "" {
		return "", err
	}
	if err := bek.Export(a.db, workspaceID, path); err != nil {
		return "", err
	}
	return path, nil
}

func (a *App) ImportBek() (storage.Workspace, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Importar coleção",
		Filters: []runtime.FileFilter{
			{DisplayName: "Rebeka Backup (*.bek)", Pattern: "*.bek"},
		},
	})
	if err != nil || path == "" {
		return storage.Workspace{}, err
	}
	if err := bek.ValidateZip(path); err != nil {
		return storage.Workspace{}, err
	}
	return bek.Import(a.db, path)
}

func (a *App) CreateWorkflow(workspaceID, hostID, name string) (storage.Workflow, error) {
	return a.db.CreateWorkflow(workspaceID, hostID, name)
}

func (a *App) SaveWorkflowGraph(id, graph string) error {
	return a.db.SaveWorkflowGraph(id, graph)
}

func (a *App) RunWorkflow(workflowID string, workspaceID string) (workflow.RunResult, error) {
	_, vars, _ := a.db.GetActiveEnvironment(workspaceID)
	a.executor.Variables = vars
	result, err := a.executor.Run(a.ctx, workflowID)
	if err != nil {
		return result, err
	}
	details, _ := json.Marshal(result)
	now := time.Now().UTC().Format(time.RFC3339)
	_ = a.db.SaveJobRun(storage.JobRun{
		WorkflowID: workflowID,
		Status:     result.Status,
		Details:    string(details),
		StartedAt:  now,
		FinishedAt: now,
	})
	return result, nil
}

func (a *App) ScheduleJob(workflowID string, intervalSeconds int) error {
	return a.db.SaveJobSchedule(storage.JobSchedule{
		WorkflowID:      workflowID,
		IntervalSeconds: intervalSeconds,
		Enabled:         true,
	})
}

func (a *App) ListJobRuns(workflowID string) ([]storage.JobRun, error) {
	return a.db.ListJobRuns(workflowID)
}

func (a *App) ListHistory(requestID string) ([]storage.HistoryEntry, error) {
	return a.db.ListHistory(requestID, 20)
}

func (a *App) UpdateLatestHistoryTests(requestID, testResults string) error {
	return a.db.UpdateLatestHistoryTests(requestID, testResults)
}
