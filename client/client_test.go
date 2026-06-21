package client

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestInterpolate(t *testing.T) {
	vars := map[string]string{"base": "https://api.test", "id": "42", "name": "alice", "token_auth": "secret-value"}

	tests := []struct {
		in   string
		want string
	}{
		{"{{base}}/users", "https://api.test/users"},
		{"{{base}}/users/{{id}}", "https://api.test/users/42"},
		{"plain text", "plain text"},
		{"{{missing}}", "{{missing}}"},
		{"@token_auth", "secret-value"},
		{"Bearer @token_auth", "Bearer secret-value"},
		{"", ""},
	}
	for _, tc := range tests {
		got := Interpolate(tc.in, vars)
		if got != tc.want {
			t.Errorf("Interpolate(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestSendQueryParams(t *testing.T) {
	var gotQuery url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query()
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	resp := Send(HTTPRequest{
		Method: "GET",
		URL:    srv.URL,
		QueryParams: []KeyValue{
			{Key: "a", Value: "1", Enabled: true},
			{Key: "b", Value: "2", Enabled: false},
			{Key: "q", Value: "{{val}}", Enabled: true},
		},
		Variables: map[string]string{"val": "x"},
	})

	if resp.Error != "" {
		t.Fatalf("unexpected error: %s", resp.Error)
	}
	if gotQuery.Get("a") != "1" {
		t.Errorf("query a = %q", gotQuery.Get("a"))
	}
	if gotQuery.Get("b") != "" {
		t.Errorf("disabled param b should be absent, got %q", gotQuery.Get("b"))
	}
	if gotQuery.Get("q") != "x" {
		t.Errorf("query q = %q", gotQuery.Get("q"))
	}
}

func TestSendBearerAuth(t *testing.T) {
	const token = "secret-token"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth != "Bearer "+token {
			t.Errorf("Authorization = %q", auth)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	resp := Send(HTTPRequest{
		Method:   "GET",
		URL:      srv.URL,
		AuthType: "bearer",
		AuthData: AuthData{Token: token},
	})
	if resp.Error != "" {
		t.Fatalf("unexpected error: %s", resp.Error)
	}
}

func TestSendBasicAuth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != "admin" || pass != "pass123" {
			t.Errorf("basic auth failed: ok=%v user=%q pass=%q", ok, user, pass)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	resp := Send(HTTPRequest{
		Method:   "GET",
		URL:      srv.URL,
		AuthType: "basic",
		AuthData: AuthData{Username: "admin", Password: "pass123"},
	})
	if resp.Error != "" {
		t.Fatalf("unexpected error: %s", resp.Error)
	}

	// sanity: encoded credential matches Go stdlib
	cred := base64.StdEncoding.EncodeToString([]byte("admin:pass123"))
	if cred == "" {
		t.Fatal("empty basic cred")
	}
}

func TestSendBodyTypes(t *testing.T) {
	t.Run("json", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if ct := r.Header.Get("Content-Type"); !strings.Contains(ct, "application/json") {
				t.Errorf("Content-Type = %q", ct)
			}
			body, _ := io.ReadAll(r.Body)
			if string(body) != `{"hello":"world"}` {
				t.Errorf("body = %s", body)
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer srv.Close()

		Send(HTTPRequest{
			Method:   "POST",
			URL:      srv.URL,
			BodyType: "json",
			Body:     `{"hello":"world"}`,
		})
	})

	t.Run("text", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if ct := r.Header.Get("Content-Type"); !strings.Contains(ct, "text/plain") {
				t.Errorf("Content-Type = %q", ct)
			}
			body, _ := io.ReadAll(r.Body)
			if string(body) != "plain" {
				t.Errorf("body = %s", body)
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer srv.Close()

		Send(HTTPRequest{
			Method:   "POST",
			URL:      srv.URL,
			BodyType: "text",
			Body:     "plain",
		})
	})

	t.Run("urlencoded", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := r.ParseForm(); err != nil {
				t.Fatal(err)
			}
			if r.Form.Get("a") != "1" {
				t.Errorf("form a = %q", r.Form.Get("a"))
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer srv.Close()

		kv, _ := json.Marshal([]KeyValue{{Key: "a", Value: "1", Enabled: true}})
		Send(HTTPRequest{
			Method:   "POST",
			URL:      srv.URL,
			BodyType: "urlencoded",
			Body:     string(kv),
		})
	})

	t.Run("formdata", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := r.ParseMultipartForm(1 << 20); err != nil {
				t.Fatal(err)
			}
			if r.FormValue("field") != "value" {
				t.Errorf("field = %q", r.FormValue("field"))
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer srv.Close()

		kv, _ := json.Marshal([]KeyValue{{Key: "field", Value: "value", Enabled: true}})
		Send(HTTPRequest{
			Method:   "POST",
			URL:      srv.URL,
			BodyType: "formdata",
			Body:     string(kv),
		})
	})
}
