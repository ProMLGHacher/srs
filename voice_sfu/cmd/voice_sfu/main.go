package main

import (
	"log"
	"net/http"
	"os"
	"strconv"

	"voice_sfu/internal/signaling"
	"voice_sfu/internal/sfu"
)

func main() {
	addr := getenv("VOICE_HTTP_ADDR", ":8088")
	publicIP := os.Getenv("VOICE_PUBLIC_IP")
	if publicIP == "" {
		publicIP = "127.0.0.1"
		log.Printf("VOICE_PUBLIC_IP empty, using %s (set for LAN/docker)", publicIP)
	}
	udpMin := uint16(parseUint16("VOICE_UDP_PORT_MIN", 10000))
	udpMax := uint16(parseUint16("VOICE_UDP_PORT_MAX", 10100))

	api, err := sfu.NewAPI(sfu.Config{
		PublicIP:   publicIP,
		UDPPortMin: udpMin,
		UDPPortMax: udpMax,
	})
	if err != nil {
		log.Fatal(err)
	}

	mgr := sfu.NewManager()
	srv := signaling.NewServer(mgr, api)
	mux := http.NewServeMux()
	srv.Register(mux)

	log.Printf("voice_sfu listening HTTP %s ICE host=%s UDP %d-%d", addr, publicIP, udpMin, udpMax)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func parseUint16(k string, def uint16) uint16 {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	n, err := strconv.ParseUint(v, 10, 16)
	if err != nil {
		return def
	}
	return uint16(n)
}
