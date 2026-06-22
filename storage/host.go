package storage

import (
	"strings"
)

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
