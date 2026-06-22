package docs

import (
	"embed"
	"fmt"
	"sort"
	"strings"
)

//go:embed *.md
var files embed.FS

type DocEntry struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Order int    `json:"order"`
}

var orderByID = map[string]int{
	"inicio":             0,
	"workspaces":         1,
	"ambientes-variaveis": 2,
	"requisicoes":        3,
	"testes-scripts":     4,
	"workflows":          5,
	"backup":             6,
}

func List() ([]DocEntry, error) {
	entries, err := files.ReadDir(".")
	if err != nil {
		return nil, err
	}

	out := make([]DocEntry, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		id := strings.TrimSuffix(e.Name(), ".md")
		content, err := files.ReadFile(e.Name())
		if err != nil {
			continue
		}
		out = append(out, DocEntry{
			ID:    id,
			Title: extractTitle(string(content), id),
			Order: orderByID[id],
		})
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].Order != out[j].Order {
			return out[i].Order < out[j].Order
		}
		return out[i].Title < out[j].Title
	})

	return out, nil
}

func Get(id string) (string, error) {
	if strings.Contains(id, "/") || strings.Contains(id, "\\") || strings.Contains(id, "..") {
		return "", fmt.Errorf("invalid doc id")
	}
	name := id + ".md"
	content, err := files.ReadFile(name)
	if err != nil {
		return "", fmt.Errorf("doc not found: %s", id)
	}
	return string(content), nil
}

func extractTitle(content, fallback string) string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "# ") {
			return strings.TrimPrefix(line, "# ")
		}
	}
	return fallback
}
