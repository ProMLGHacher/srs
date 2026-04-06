package config

import (
	"os"
	"strings"
)

type Config struct {
	Port     string
	SRSHTTP  string
	SRSEIP   string
	StaticFS bool // if true, static from embed only
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	srs := strings.TrimSuffix(os.Getenv("SRS_HTTP"), "/")
	if srs == "" {
		srs = "http://127.0.0.1:1985"
	}
	eip := os.Getenv("SRS_EIP")
	if eip == "" {
		eip = "127.0.0.1"
	}
	return Config{Port: port, SRSHTTP: srs, SRSEIP: eip}
}
