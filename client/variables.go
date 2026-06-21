package client

import "strings"

func FindVariables(text string) []string {
	var found []string
	i := 0
	for i < len(text) {
		start := strings.Index(text[i:], "{{")
		if start < 0 {
			break
		}
		start += i
		end := strings.Index(text[start+2:], "}}")
		if end < 0 {
			break
		}
		end = start + 2 + end
		name := strings.TrimSpace(text[start+2 : end])
		if name != "" && !contains(found, name) {
			found = append(found, name)
		}
		i = end + 2
	}
	for _, name := range atVarRe.FindAllStringSubmatch(text, -1) {
		if len(name) > 1 && name[1] != "" && !contains(found, name[1]) {
			found = append(found, name[1])
		}
	}
	return found
}

func ResolveStatus(text string, vars map[string]string) map[string]string {
	status := map[string]string{}
	for _, name := range FindVariables(text) {
		if val, ok := vars[name]; ok && val != "" {
			status[name] = "resolved"
		} else {
			status[name] = "unresolved"
		}
	}
	return status
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
