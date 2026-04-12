package docs

import (
	_ "embed"
	"net/http"
)

//go:embed openapi.yaml
var openapiYAML []byte

//go:embed swagger-ui.html
var swaggerHTML []byte

// Register adds GET /api/docs, GET /api/docs/, GET /api/docs/openapi.yaml.
func Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/docs/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
		_, _ = w.Write(openapiYAML)
	})
	mux.HandleFunc("/api/docs/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if r.URL.Path != "/api/docs/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(swaggerHTML)
	})
	mux.HandleFunc("/api/docs", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(swaggerHTML)
	})
}
