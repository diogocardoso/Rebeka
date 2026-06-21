package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

	"rebeka/client"
	"rebeka/storage"
)

type Graph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

type Node struct {
	ID      string              `json:"id"`
	Label   string              `json:"label"`
	Request client.HTTPRequest  `json:"request"`
	X       float64             `json:"x"`
	Y       float64             `json:"y"`
}

type Edge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type NodeResult struct {
	NodeID     string              `json:"nodeId"`
	Label      string              `json:"label"`
	Response   client.HTTPResponse `json:"response"`
	Error      string              `json:"error,omitempty"`
	DurationMs int64               `json:"durationMs"`
}

type RunResult struct {
	WorkflowID string       `json:"workflowId"`
	Results    []NodeResult `json:"results"`
	Status     string       `json:"status"`
	Error      string       `json:"error,omitempty"`
}

type Executor struct {
	DB        *storage.DB
	Variables map[string]string
}

func ParseGraph(raw string) (Graph, error) {
	var g Graph
	if raw == "" {
		return g, nil
	}
	err := json.Unmarshal([]byte(raw), &g)
	return g, err
}

func (e *Executor) Run(ctx context.Context, workflowID string) (RunResult, error) {
	wf, err := e.DB.GetWorkflow(workflowID)
	if err != nil {
		return RunResult{}, err
	}
	graph, err := ParseGraph(wf.Graph)
	if err != nil {
		return RunResult{}, err
	}

	result := RunResult{WorkflowID: workflowID, Status: "success"}
	if len(graph.Nodes) == 0 {
		return result, nil
	}

	adj := buildAdjacency(graph)
	inDegree := buildInDegree(graph)
	roots := findRoots(graph, inDegree)
	if len(roots) == 0 {
		return RunResult{}, fmt.Errorf("workflow sem nó inicial")
	}

	var mu sync.Mutex
	var allResults []NodeResult

	var runNode func(nodeID string) error
	runNode = func(nodeID string) error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		node := findNode(graph, nodeID)
		if node == nil {
			return fmt.Errorf("nó %s não encontrado", nodeID)
		}
		req := node.Request
		req.Variables = e.Variables
		start := time.Now()
		resp := sendWithRetry(req)
		nr := NodeResult{
			NodeID:     nodeID,
			Label:      node.Label,
			Response:   resp,
			DurationMs: time.Since(start).Milliseconds(),
		}
		if resp.Error != "" {
			nr.Error = resp.Error
		}
		mu.Lock()
		allResults = append(allResults, nr)
		mu.Unlock()

		children := adj[nodeID]
		if len(children) == 0 {
			return nil
		}
		if len(children) == 1 {
			return runNode(children[0])
		}
		g, _ := errgroup.WithContext(ctx)
		for _, child := range children {
			cid := child
			g.Go(func() error {
				return runNode(cid)
			})
		}
		return g.Wait()
	}

	g, _ := errgroup.WithContext(ctx)
	for _, root := range roots {
		rid := root
		g.Go(func() error {
			return runNode(rid)
		})
	}
	if err := g.Wait(); err != nil {
		result.Status = "failed"
		result.Error = err.Error()
	}
	result.Results = allResults
	if result.Status == "success" {
		for _, r := range allResults {
			if r.Error != "" || r.Response.StatusCode >= 400 {
				result.Status = "failed"
				break
			}
		}
	}
	return result, nil
}

func sendWithRetry(req client.HTTPRequest) client.HTTPResponse {
	method := strings.ToUpper(req.Method)
	maxRetries := 1
	if method == "GET" || method == "HEAD" || method == "OPTIONS" {
		maxRetries = 3
	}
	var last client.HTTPResponse
	for i := 0; i < maxRetries; i++ {
		last = client.Send(req)
		if last.Error == "" {
			return last
		}
		if i < maxRetries-1 {
			time.Sleep(time.Duration(200*(i+1)) * time.Millisecond)
		}
	}
	return last
}

func buildAdjacency(g Graph) map[string][]string {
	adj := map[string][]string{}
	for _, e := range g.Edges {
		adj[e.From] = append(adj[e.From], e.To)
	}
	return adj
}

func buildInDegree(g Graph) map[string]int {
	deg := map[string]int{}
	for _, n := range g.Nodes {
		deg[n.ID] = 0
	}
	for _, e := range g.Edges {
		deg[e.To]++
	}
	return deg
}

func findRoots(g Graph, inDegree map[string]int) []string {
	var roots []string
	for _, n := range g.Nodes {
		if inDegree[n.ID] == 0 {
			roots = append(roots, n.ID)
		}
	}
	return roots
}

func findNode(g Graph, id string) *Node {
	for i := range g.Nodes {
		if g.Nodes[i].ID == id {
			return &g.Nodes[i]
		}
	}
	return nil
}
