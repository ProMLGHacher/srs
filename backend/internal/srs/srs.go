package srs

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ResolveFetchOrigin replaces hostname with IPv4 if needed (Docker DNS).
func ResolveFetchOrigin(srsHTTP string) (origin string, err error) {
	u, err := url.Parse(srsHTTP)
	if err != nil {
		return srsHTTP, err
	}
	if ip := net.ParseIP(u.Hostname()); ip != nil {
		return strings.TrimSuffix(srsHTTP, "/"), nil
	}
	r := net.Resolver{PreferGo: true}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	addrs, err := r.LookupIPAddr(ctx, u.Hostname())
	if err != nil {
		return strings.TrimSuffix(srsHTTP, "/"), err
	}
	for _, a := range addrs {
		if v4 := a.IP.To4(); v4 != nil {
			u.Host = net.JoinHostPort(v4.String(), u.Port())
			return strings.TrimSuffix(u.String(), "/"), nil
		}
	}
	return strings.TrimSuffix(srsHTTP, "/"), fmt.Errorf("no IPv4 for %s", u.Hostname())
}

func WaitReady(fetchOrigin string) bool {
	u := strings.TrimSuffix(fetchOrigin, "/") + "/api/v1/versions"
	deadline := time.Now().Add(90 * time.Second)
	client := &http.Client{Timeout: 5 * time.Second}
	for time.Now().Before(deadline) {
		resp, err := client.Get(u)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return true
			}
		}
		time.Sleep(time.Second)
	}
	return false
}

func StreamURL(fetchOrigin, kind, peer, eip string) string {
	q := url.Values{}
	q.Set("app", "live")
	q.Set("stream", peer)
	q.Set("eip", eip)
	return fmt.Sprintf("%s/rtc/v1/%s/?%s", strings.TrimSuffix(fetchOrigin, "/"), kind, q.Encode())
}

func ProxySDP(fetchOrigin, kind, peer, eip string, body []byte) (int, string, error) {
	target := StreamURL(fetchOrigin, kind, peer, eip)
	req, err := http.NewRequest(http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		return 0, "", err
	}
	req.Header.Set("Content-Type", "application/sdp")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	if err != nil {
		return 0, "", err
	}
	return resp.StatusCode, string(b), nil
}
