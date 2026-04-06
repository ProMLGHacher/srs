package static

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed all:web/dist
var webDist embed.FS

// FS is the dist subtree for SPA + assets.
func FS() (fs.FS, error) {
	return fs.Sub(webDist, "web/dist")
}

// FileServer serves embedded web/dist.
func FileServer() (http.Handler, error) {
	sub, err := FS()
	if err != nil {
		return nil, err
	}
	return http.FileServer(http.FS(sub)), nil
}
