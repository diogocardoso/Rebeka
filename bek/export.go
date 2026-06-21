package bek

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"rebeka/storage"
)

const manifestName = "manifest.json"
const dataName = "data.json"

type Manifest struct {
	Format  string `json:"format"`
	Version string `json:"version"`
	App     string `json:"app"`
	Export  string `json:"exportedAt"`
}

func Export(db *storage.DB, workspaceID, destPath string) error {
	data, err := db.ExportWorkspace(workspaceID)
	if err != nil {
		return err
	}
	if !strings.HasSuffix(strings.ToLower(destPath), ".bek") {
		destPath += ".bek"
	}
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil && filepath.Dir(destPath) != "." {
		return err
	}

	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)

	manifest := Manifest{
		Format:  "rebeka-bek",
		Version: "1.0",
		App:     "Rebeka",
		Export:  time.Now().UTC().Format(time.RFC3339),
	}
	if err := writeJSON(zw, manifestName, manifest); err != nil {
		return err
	}
	if err := writeJSON(zw, dataName, data); err != nil {
		return err
	}
	if err := zw.Close(); err != nil {
		return err
	}
	return os.WriteFile(destPath, buf.Bytes(), 0o644)
}

func Import(db *storage.DB, srcPath string) (storage.Workspace, error) {
	r, err := zip.OpenReader(srcPath)
	if err != nil {
		return storage.Workspace{}, fmt.Errorf("abrir .bek: %w", err)
	}
	defer r.Close()

	var data storage.WorkspaceExport
	found := false
	for _, f := range r.File {
		if f.Name != dataName {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return storage.Workspace{}, err
		}
		err = json.NewDecoder(rc).Decode(&data)
		rc.Close()
		if err != nil {
			return storage.Workspace{}, fmt.Errorf("parse data.json: %w", err)
		}
		found = true
		break
	}
	if !found {
		return storage.Workspace{}, fmt.Errorf("data.json não encontrado no .bek")
	}
	return db.ImportWorkspace(data)
}

func writeJSON(zw *zip.Writer, name string, v interface{}) error {
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

func ReadPreview(srcPath string) (storage.WorkspaceExport, error) {
	r, err := zip.OpenReader(srcPath)
	if err != nil {
		return storage.WorkspaceExport{}, err
	}
	defer r.Close()
	for _, f := range r.File {
		if f.Name == dataName {
			rc, err := f.Open()
			if err != nil {
				return storage.WorkspaceExport{}, err
			}
			defer rc.Close()
			var data storage.WorkspaceExport
			if err := json.NewDecoder(rc).Decode(&data); err != nil {
				return storage.WorkspaceExport{}, err
			}
			return data, nil
		}
	}
	return storage.WorkspaceExport{}, fmt.Errorf("data.json ausente")
}

// ValidateZip checks minimal structure without full import.
func ValidateZip(srcPath string) error {
	r, err := zip.OpenReader(srcPath)
	if err != nil {
		return err
	}
	defer r.Close()
	hasData := false
	for _, f := range r.File {
		if f.Name == dataName {
			hasData = true
			rc, err := f.Open()
			if err != nil {
				return err
			}
			_, err = io.Copy(io.Discard, rc)
			rc.Close()
			if err != nil {
				return err
			}
		}
	}
	if !hasData {
		return fmt.Errorf("arquivo .bek inválido")
	}
	return nil
}
