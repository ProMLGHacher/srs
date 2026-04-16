package sfu

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/pion/webrtc/v4"
)

// WSSender sends JSON to the browser (serialized).
type WSSender interface {
	WriteJSON(v any) error
}

// Config for building PeerConnections (ICE, UDP range, NAT 1:1).
type Config struct {
	PublicIP   string
	UDPPortMin uint16
	UDPPortMax uint16
}

func NewAPI(cfg Config) (*webrtc.API, error) {
	se := webrtc.SettingEngine{}
	if cfg.UDPPortMin > 0 && cfg.UDPPortMax >= cfg.UDPPortMin {
		if err := se.SetEphemeralUDPPortRange(cfg.UDPPortMin, cfg.UDPPortMax); err != nil {
			return nil, err
		}
	}
	if cfg.PublicIP != "" {
		se.SetNAT1To1IPs([]string{cfg.PublicIP}, webrtc.ICECandidateTypeHost)
	}
	return webrtc.NewAPI(webrtc.WithSettingEngine(se)), nil
}

// Peer is one browser participant attached to a Room.
type Peer struct {
	id   string
	name string
	room *Room

	ws WSSender
	wl sync.Mutex

	pc *webrtc.PeerConnection

	publishedMu sync.Mutex
	published   []*PublishedMedia

	firstNegotiationDone bool
	firstMu              sync.Mutex

	renegoMu      sync.Mutex
	renegoPending bool

	presMu sync.RWMutex
	micOn  bool
	camOn  bool

	closed  bool
	closeMu sync.Mutex
}

func NewPeer(room *Room, name string, ws WSSender, api *webrtc.API) (*Peer, error) {
	id := uuid.NewString()
	pc, err := api.NewPeerConnection(webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
		},
	})
	if err != nil {
		return nil, err
	}
	p := &Peer{
		id:    id,
		name:  name,
		room:  room,
		ws:    ws,
		pc:    pc,
		micOn: true,
		camOn: true,
	}
	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}
		b, err := json.Marshal(c.ToJSON())
		if err != nil {
			return
		}
		_ = p.WriteSignal("ice", "", b)
	})
	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		log.Printf("peer %s pc state %s", p.id, s.String())
		if s == webrtc.PeerConnectionStateFailed || s == webrtc.PeerConnectionStateClosed {
			p.Close()
		}
	})
	pc.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		log.Printf("peer %s OnTrack %s %s", p.id, track.Kind(), track.ID())
		pm := newPublishedMedia(track)
		p.publishedMu.Lock()
		p.published = append(p.published, pm)
		p.publishedMu.Unlock()
		for _, other := range p.room.Others(p.id) {
			if err := pm.addSubscriber(other, p.id); err != nil {
				log.Printf("addSubscriber %s <- %s: %v", other.id, p.id, err)
			}
		}
	})
	return p, nil
}

func (p *Peer) ID() string   { return p.id }
func (p *Peer) Name() string { return p.name }

func (p *Peer) SetPresence(micOn, camOn bool) {
	p.presMu.Lock()
	p.micOn, p.camOn = micOn, camOn
	p.presMu.Unlock()
}

func (p *Peer) Presence() (micOn, camOn bool) {
	p.presMu.RLock()
	defer p.presMu.RUnlock()
	return p.micOn, p.camOn
}

func (p *Peer) Publishing() bool {
	p.publishedMu.Lock()
	defer p.publishedMu.Unlock()
	return len(p.published) > 0
}

func (p *Peer) WriteSignal(kind, sdp string, candidate json.RawMessage) error {
	p.wl.Lock()
	defer p.wl.Unlock()
	m := map[string]any{"type": "signal", "kind": kind}
	if sdp != "" {
		m["sdp"] = sdp
	}
	if len(candidate) > 0 {
		var raw any
		if err := json.Unmarshal(candidate, &raw); err == nil {
			m["candidate"] = raw
		}
	}
	return p.ws.WriteJSON(m)
}

// SendServer sends a non-signal control message (joined, roster, errors).
func (p *Peer) SendServer(msg any) error {
	p.wl.Lock()
	defer p.wl.Unlock()
	return p.ws.WriteJSON(msg)
}

func (p *Peer) HandleOffer(sdp string) error {
	if err := p.pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  sdp,
	}); err != nil {
		return err
	}
	answer, err := p.pc.CreateAnswer(nil)
	if err != nil {
		return err
	}
	if err := p.pc.SetLocalDescription(answer); err != nil {
		return err
	}
	if err := p.WriteSignal("answer", answer.SDP, nil); err != nil {
		return err
	}
	p.markFirstNegotiation()
	return nil
}

func (p *Peer) HandleAnswer(sdp string) error {
	return p.pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  sdp,
	})
}

func (p *Peer) HandleICE(candidate json.RawMessage) error {
	var init webrtc.ICECandidateInit
	if err := json.Unmarshal(candidate, &init); err != nil {
		return err
	}
	return p.pc.AddICECandidate(init)
}

func (p *Peer) markFirstNegotiation() {
	p.firstMu.Lock()
	defer p.firstMu.Unlock()
	if p.firstNegotiationDone {
		return
	}
	p.firstNegotiationDone = true
	p.flushExistingPublishers()
}

func (p *Peer) flushExistingPublishers() {
	for _, other := range p.room.Others(p.id) {
		other.publishedMu.Lock()
		pubs := append([]*PublishedMedia(nil), other.published...)
		other.publishedMu.Unlock()
		for _, pm := range pubs {
			if err := pm.addSubscriber(p, other.id); err != nil {
				log.Printf("flush addSubscriber %s <- %s: %v", p.id, other.id, err)
			}
		}
	}
}

func (p *Peer) scheduleRenegotiate() {
	p.renegoMu.Lock()
	if p.renegoPending {
		p.renegoMu.Unlock()
		return
	}
	p.renegoPending = true
	p.renegoMu.Unlock()
	time.AfterFunc(80*time.Millisecond, func() {
		p.runRenegotiate()
	})
}

func (p *Peer) runRenegotiate() {
	p.renegoMu.Lock()
	p.renegoPending = false
	p.renegoMu.Unlock()

	p.closeMu.Lock()
	if p.closed {
		p.closeMu.Unlock()
		return
	}
	p.closeMu.Unlock()

	offer, err := p.pc.CreateOffer(nil)
	if err != nil {
		log.Printf("CreateOffer %s: %v", p.id, err)
		return
	}
	if err := p.pc.SetLocalDescription(offer); err != nil {
		log.Printf("SetLocalDescription offer %s: %v", p.id, err)
		return
	}
	if err := p.WriteSignal("offer", offer.SDP, nil); err != nil {
		log.Printf("WriteSignal offer %s: %v", p.id, err)
	}
}

func (p *Peer) Close() {
	p.closeMu.Lock()
	if p.closed {
		p.closeMu.Unlock()
		return
	}
	p.closed = true
	p.closeMu.Unlock()

	_ = p.pc.Close()
}
