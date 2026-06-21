package client

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

var atVarRe = regexp.MustCompile(`@([a-zA-Z_][\w.-]*)`)

type KeyValue struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type AuthData struct {
	Token    string `json:"token"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type HTTPRequest struct {
	Method      string            `json:"method"`
	URL         string            `json:"url"`
	QueryParams []KeyValue        `json:"queryParams"`
	Headers     []KeyValue        `json:"headers"`
	BodyType    string            `json:"bodyType"`
	Body        string            `json:"body"`
	AuthType    string            `json:"authType"`
	AuthData    AuthData          `json:"authData"`
	Variables   map[string]string `json:"variables"`
	TimeoutSec  int               `json:"timeoutSec"`
}

type HTTPResponse struct {
	StatusCode     int               `json:"statusCode"`
	StatusText     string            `json:"statusText"`
	Headers        map[string]string `json:"headers"`
	Body           string            `json:"body"`
	DurationMs     int64             `json:"durationMs"`
	SizeBytes      int64             `json:"sizeBytes"`
	Error          string            `json:"error,omitempty"`
	RequestMethod  string            `json:"requestMethod"`
	RequestURL     string            `json:"requestURL"`
	RequestHeaders map[string]string `json:"requestHeaders"`
}

func Send(req HTTPRequest) HTTPResponse {
	start := time.Now()
	resp := HTTPResponse{Headers: map[string]string{}}

	timeout := time.Duration(req.TimeoutSec) * time.Second
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	httpClient := &http.Client{Timeout: timeout}

	resolvedURL := Interpolate(req.URL, req.Variables)
	parsed, err := url.Parse(resolvedURL)
	if err != nil {
		resp.Error = fmt.Sprintf("URL inválida: %v", err)
		resp.DurationMs = time.Since(start).Milliseconds()
		return resp
	}

	q := parsed.Query()
	for _, p := range req.QueryParams {
		if p.Enabled && p.Key != "" {
			q.Set(p.Key, Interpolate(p.Value, req.Variables))
		}
	}
	parsed.RawQuery = q.Encode()

	finalURL := parsed.String()
	if parsed.Scheme == "" || parsed.Host == "" {
		if strings.HasPrefix(finalURL, "/") || strings.HasPrefix(finalURL, "?") {
			resp.Error = "URL sem host: configure a base URL do host ativo ou use uma URL absoluta (https://...)"
			resp.DurationMs = time.Since(start).Milliseconds()
			return resp
		}
	}

	httpReq, err := http.NewRequest(strings.ToUpper(req.Method), finalURL, nil)
	if err != nil {
		resp.Error = err.Error()
		resp.DurationMs = time.Since(start).Milliseconds()
		return resp
	}

	bodyReader, contentType, err := buildBody(req)
	if err != nil {
		resp.Error = err.Error()
		resp.DurationMs = time.Since(start).Milliseconds()
		return resp
	}
	if bodyReader != nil {
		httpReq.Body = io.NopCloser(bodyReader)
		if contentType != "" {
			httpReq.Header.Set("Content-Type", contentType)
		}
	}

	for _, h := range req.Headers {
		if h.Enabled && h.Key != "" {
			httpReq.Header.Set(h.Key, Interpolate(h.Value, req.Variables))
		}
	}

	applyAuth(httpReq, req)

	if httpReq.Header.Get("User-Agent") == "" {
		httpReq.Header.Set("User-Agent", "Rebeka/1.0")
	}
	captureOutgoingRequest(httpReq, &resp)

	httpResp, err := httpClient.Do(httpReq)
	resp.DurationMs = time.Since(start).Milliseconds()
	if err != nil {
		resp.Error = err.Error()
		return resp
	}
	defer httpResp.Body.Close()

	bodyBytes, err := io.ReadAll(httpResp.Body)
	if err != nil {
		resp.Error = err.Error()
		return resp
	}

	resp.StatusCode = httpResp.StatusCode
	resp.StatusText = http.StatusText(httpResp.StatusCode)
	resp.Body = string(bodyBytes)
	resp.SizeBytes = int64(len(bodyBytes))
	for k, vals := range httpResp.Header {
		if len(vals) > 0 {
			resp.Headers[k] = strings.Join(vals, ", ")
		}
	}
	return resp
}

func buildBody(req HTTPRequest) (io.Reader, string, error) {
	switch req.BodyType {
	case "none", "":
		return nil, "", nil
	case "json":
		body := Interpolate(req.Body, req.Variables)
		return strings.NewReader(body), "application/json", nil
	case "text":
		body := Interpolate(req.Body, req.Variables)
		return strings.NewReader(body), "text/plain", nil
	case "urlencoded":
		var pairs []KeyValue
		if err := json.Unmarshal([]byte(req.Body), &pairs); err != nil {
			return strings.NewReader(Interpolate(req.Body, req.Variables)), "application/x-www-form-urlencoded", nil
		}
		data := url.Values{}
		for _, p := range pairs {
			if p.Enabled && p.Key != "" {
				data.Set(p.Key, Interpolate(p.Value, req.Variables))
			}
		}
		return strings.NewReader(data.Encode()), "application/x-www-form-urlencoded", nil
	case "formdata":
		var pairs []KeyValue
		if err := json.Unmarshal([]byte(req.Body), &pairs); err != nil {
			return nil, "", fmt.Errorf("form-data inválido: %w", err)
		}
		buf := &bytes.Buffer{}
		w := multipart.NewWriter(buf)
		for _, p := range pairs {
			if p.Enabled && p.Key != "" {
				_ = w.WriteField(p.Key, Interpolate(p.Value, req.Variables))
			}
		}
		w.Close()
		return buf, w.FormDataContentType(), nil
	default:
		return strings.NewReader(Interpolate(req.Body, req.Variables)), "", nil
	}
}

func applyAuth(req *http.Request, httpReq HTTPRequest) {
	switch httpReq.AuthType {
	case "bearer":
		token := Interpolate(httpReq.AuthData.Token, httpReq.Variables)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
	case "basic":
		user := Interpolate(httpReq.AuthData.Username, httpReq.Variables)
		pass := Interpolate(httpReq.AuthData.Password, httpReq.Variables)
		if user != "" {
			cred := base64.StdEncoding.EncodeToString([]byte(user + ":" + pass))
			req.Header.Set("Authorization", "Basic "+cred)
		}
	}
}

func Interpolate(text string, vars map[string]string) string {
	if vars == nil || text == "" {
		return text
	}
	result := text
	for k, v := range vars {
		result = strings.ReplaceAll(result, "{{"+k+"}}", v)
	}
	result = atVarRe.ReplaceAllStringFunc(result, func(match string) string {
		name := match[1:]
		if v, ok := vars[name]; ok {
			return v
		}
		return match
	})
	return result
}

func captureOutgoingRequest(httpReq *http.Request, resp *HTTPResponse) {
	if httpReq == nil || resp == nil {
		return
	}
	resp.RequestMethod = httpReq.Method
	if httpReq.URL != nil {
		resp.RequestURL = httpReq.URL.RequestURI()
		if resp.RequestURL == "" {
			resp.RequestURL = httpReq.URL.String()
		}
	}
	resp.RequestHeaders = map[string]string{}
	host := httpReq.Host
	if host == "" && httpReq.URL != nil {
		host = httpReq.URL.Host
	}
	if host != "" {
		resp.RequestHeaders["Host"] = host
	}
	for k, vals := range httpReq.Header {
		if len(vals) > 0 {
			resp.RequestHeaders[k] = strings.Join(vals, ", ")
		}
	}
}

func ParseKeyValuesJSON(raw string) []KeyValue {
	if raw == "" {
		return []KeyValue{}
	}
	var pairs []KeyValue
	if err := json.Unmarshal([]byte(raw), &pairs); err != nil {
		return []KeyValue{}
	}
	return pairs
}
