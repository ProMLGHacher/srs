package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"srs/backend/internal/api"
	"srs/backend/internal/config"
	"srs/backend/internal/docs"
	"srs/backend/internal/srs"
	wshub "srs/backend/internal/ws"

	"github.com/gorilla/websocket"
)

const maxMessageBytes = 256 * 1024

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	cfg := config.Load()
	fetchOrigin, err := srs.ResolveFetchOrigin(cfg.SRSHTTP)
	if err != nil {
		log.Printf("SRS DNS: %v — используем %s", err, cfg.SRSHTTP)
		fetchOrigin = strings.TrimSuffix(cfg.SRSHTTP, "/")
	} else if fetchOrigin != strings.TrimSuffix(cfg.SRSHTTP, "/") {
		log.Printf("SRS: %s → запросы на %s (IPv4)", cfg.SRSHTTP, fetchOrigin)
	}

	if srs.WaitReady(fetchOrigin) {
		log.Println("SRS API готов:", fetchOrigin+"/api/v1/versions")
	} else {
		log.Println("SRS не ответил за 90 с, продолжаем старт")
	}

	hub := wshub.NewHub()

	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     func(r *http.Request) bool { return true },
	}

	mux := http.NewServeMux()
	docs.Register(mux)

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":       true,
			"srs":      cfg.SRSHTTP,
			"srsFetch": fetchOrigin,
			"eip":      cfg.SRSEIP,
		})
	})

	mux.HandleFunc("/api/rooms", api.NewRoomHandler())

	mux.HandleFunc("/api/ws", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("ws upgrade:", err)
			return
		}
		client := wshub.AttachClient(conn)
		defer func() {
			hub.RemoveConn(client)
			_ = conn.Close()
		}()
		conn.SetReadLimit(maxMessageBytes)
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				break
			}
			hub.HandleMessage(client, msg)
		}
	})

	handler := cors(mux)
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("app 0.0.0.0:%s → SRS %s (eip=%s)\n", cfg.Port, fetchOrigin, cfg.SRSEIP)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
	<-ch
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
