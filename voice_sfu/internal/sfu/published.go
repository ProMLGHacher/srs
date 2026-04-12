package sfu

import (
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

func (pm *PublishedMedia) addSubscriber(sub *Peer) error {
	local, err := webrtc.NewTrackLocalStaticRTP(
		pm.remote.Codec().RTPCodecCapability,
		pm.remote.ID(),
		pm.remote.StreamID(),
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
		for _, l := range ls {
			if _, err := l.Write(buf[:n]); err != nil {
				return
			}
		}
	}
}

const receiveMTU = 1460
