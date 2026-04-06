package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
)

// NewRoomHandler returns POST /api/rooms — server-generated room id.
func NewRoomHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var b [8]byte
		if _, err := rand.Read(b[:]); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		roomID := hex.EncodeToString(b[:])
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"roomId": roomID})
	}
}
