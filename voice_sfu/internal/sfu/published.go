package sfu

import (
	"fmt"
	"io"
	"log"
	"sync"

	"github.com/pion/webrtc/v4"
)

// PublishedMedia is one inbound track from a publisher, fanned out to subscribers.
type PublishedMedia struct {
	remote *webrtc.TrackRemote
	mu     sync.Mutex
	locals []*webrtc.TrackLocalStaticRTP
	start  bool
}

func newPublishedMedia(remote *webrtc.TrackRemote) *PublishedMedia {
	return &PublishedMedia{remote: remote}
}

// addSubscriber forwards this publisher's track to sub's PeerConnection.
// publisherID is used as MediaStream id in the browser so the client can map tracks to signaling peer ids.
func (pm *PublishedMedia) addSubscriber(sub *Peer, publisherID string) error {
	local, err := webrtc.NewTrackLocalStaticRTP(
		pm.remote.Codec().RTPCodecCapability,
		fmt.Sprintf("%s-%s", publisherID, pm.remote.Kind()),
		publisherID,
	)
	if err != nil {
		return err
	}
	pm.mu.Lock()
	pm.locals = append(pm.locals, local)
	shouldStart := !pm.start
	if shouldStart {
		pm.start = true
	}
	pm.mu.Unlock()

	if _, err := sub.pc.AddTrack(local); err != nil {
		return err
	}
	// Pion sender requires RTCP to be drained; otherwise pipeline can stall.
	go drainRTCP(sub, local)
	if shouldStart {
		go pm.readLoop()
	}
	sub.scheduleRenegotiate()
	return nil
}

func (pm *PublishedMedia) readLoop() {
	buf := make([]byte, receiveMTU)
	for {
		n, _, err := pm.remote.Read(buf)
		if err != nil {
			return
		}
		pm.mu.Lock()
		ls := append([]*webrtc.TrackLocalStaticRTP(nil), pm.locals...)
		pm.mu.Unlock()
		alive := ls[:0]
		for _, l := range ls {
			if _, err := l.Write(buf[:n]); err != nil {
				// Drop only failed subscriber; keep forwarding to the rest.
				log.Printf("drop local RTP writer: %v", err)
				continue
			}
			alive = append(alive, l)
		}
		if len(alive) != len(ls) {
			pm.mu.Lock()
			pm.locals = append([]*webrtc.TrackLocalStaticRTP(nil), alive...)
			pm.mu.Unlock()
		}
	}
}

const receiveMTU = 1460

func drainRTCP(sub *Peer, local *webrtc.TrackLocalStaticRTP) {
	senders := sub.pc.GetSenders()
	for _, sender := range senders {
		if sender.Track() != local {
			continue
		}
		buf := make([]byte, 1500)
		for {
			if _, _, err := sender.Read(buf); err != nil {
				if err != io.EOF {
					log.Printf("rtcp drain ended: %v", err)
				}
				return
			}
		}
	}
}
