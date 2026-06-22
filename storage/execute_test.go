package storage

import (
	"testing"
)

func TestResolvePathInTree(t *testing.T) {
	frota := TreeNode{ID: "f1", Name: "Frota", Type: "folder"}
	empresa := TreeNode{ID: "f2", Name: "Empresa", Type: "folder", ParentID: &frota.ID}
	dataGrid := TreeNode{ID: "r1", Name: "dataGrid", Type: "request", ParentID: &empresa.ID}
	rootReq := TreeNode{ID: "r2", Name: "health", Type: "request"}

	nodes := []TreeNode{frota, empresa, dataGrid, rootReq}

	got, err := resolvePathInTree(nodes, "Frota.Empresa.dataGrid")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "r1" {
		t.Fatalf("expected r1, got %s", got.ID)
	}

	got, err = resolvePathInTree(nodes, "health")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "r2" {
		t.Fatalf("expected r2, got %s", got.ID)
	}

	_, err = resolvePathInTree(nodes, "Frota.missing.dataGrid")
	if err == nil {
		t.Fatal("expected error for missing folder")
	}
}
