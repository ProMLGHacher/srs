package signaling

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v4"
	"voice_sfu/internal/protocol"
	"voice_sfu/internal/sfu"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Server wires HTTP /health and WebSocket /ws to the SFU.
type Server struct {
	mgr *sfu.Manager
	api *webrtc.API
}

// NewServer creates signaling server. api must be non-nil (from sfu.NewAPI).
func NewServer(mgr *sfu.Manager, api *webrtc.API) *Server {
	return &Server{mgr: mgr, api: api}
}

func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/ws", s.handleWS)
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade: %v", err)
		return
	}
	go s.runSession(conn)
}

func peerToInfo(p *sfu.Peer) protocol.PeerInfo {
	mic, cam := p.Presence()
	return protocol.PeerInfo{
		ID:         p.ID(),
		Name:       p.Name(),
		MicOn:      mic,
		CamOn:      cam,
		Publishing: p.Publishing(),
	}
}

func (s *Server) runSession(conn *websocket.Conn) {
	defer conn.Close()

	var peer *sfu.Peer
	var room *sfu.Room

	cleanup := func() {
		if peer == nil || room == nil {
			return
		}
		id := peer.ID()
		peer.Close()
		rem := room.RemovePeer(id)
		broadcastPeerLeft(room, id)
		if rem == 0 {
			s.mgr.DropRoomIfEmpty(room)
		}
		peer = nil
	}
	defer cleanup()

	_, first, err := conn.ReadMessage()
	if err != nil {
		return
	}
	var join protocol.ClientMessage
	if err := json.Unmarshal(first, &join); err != nil || join.Type != protocol.TypeJoin || join.Room == "" {
		_ = conn.WriteJSON(protocol.ServerMessage{Type: protocol.TypeError, Message: "first message must be join with room"})
		return
	}

	mic := true
	cam := true
	if join.MicOn != nil {
		mic = *join.MicOn
	}
	if join.CamOn != nil {
		cam = *join.CamOn
	}

	room = s.mgr.GetOrCreate(join.Room)
	p, err := sfu.NewPeer(room, join.Name, conn, s.api)
	if err != nil {
		log.Printf("NewPeer: %v", err)
		s.mgr.DropRoomIfEmpty(room)
		_ = conn.WriteJSON(protocol.ServerMessage{Type: protocol.TypeError, Message: "pc failed"})
		return
	}
	p.SetPresence(mic, cam)
	peer = p
	room.AddPeer(peer)

	roster := rosterInfos(room, peer.ID())
	if err := peer.SendServer(protocol.ServerMessage{
		Type:   protocol.TypeJoined,
		PeerID: peer.ID(),
		Peers:  roster,
	}); err != nil {
		return
	}
	broadcastPeerJoined(room, peer)

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		var msg protocol.ClientMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		switch msg.Type {
		case protocol.TypePresence:
			mic := true
			cam := true
			if msg.MicOn != nil {
				mic = *msg.MicOn
			}
			if msg.CamOn != nil {
				cam = *msg.CamOn
			}
			peer.SetPresence(mic, cam)
			broadcastPeerPresence(room, peer, mic, cam)
		case protocol.TypeSignal:
			switch msg.Kind {
			case "offer":
				if err := peer.HandleOffer(msg.SDP); err != nil {
					log.Printf("HandleOffer: %v", err)
				}
			case "answer":
				if err := peer.HandleAnswer(msg.SDP); err != nil {
					log.Printf("HandleAnswer: %v", err)
				}
			case "ice":
				if len(msg.Candidate) > 0 {
					if err := peer.HandleICE(msg.Candidate); err != nil {
						log.Printf("HandleICE: %v", err)
					}
				}
			}
		default:
			// ignore
		}
	}
}

func rosterInfos(room *sfu.Room, except string) []protocol.PeerInfo {
	others := room.Others(except)
	out := make([]protocol.PeerInfo, 0, len(others))
	for _, p := range others {
		out = append(out, peerToInfo(p))
	}
	return out
}

func broadcastPeerJoined(room *sfu.Room, self *sfu.Peer) {
	msg := protocol.ServerMessage{
		Type: protocol.TypePeerJoined,
		Peer: func() *protocol.PeerInfo {
			i := peerToInfo(self)
			return &i
		}(),
	}
	for _, p := range room.Others(self.ID()) {
		_ = p.SendServer(msg)
	}
}

func broadcastPeerLeft(room *sfu.Room, leftID string) {
	msg := protocol.ServerMessage{Type: protocol.TypePeerLeft, PeerIDLeft: leftID}
	for _, p := range room.Others(leftID) {
		_ = p.SendServer(msg)
	}
}

func broadcastPeerPresence(room *sfu.Room, self *sfu.Peer, mic, cam bool) {
	msg := map[string]any{
		"type":   string(protocol.TypePeerPresence),
		"peerId": self.ID(),
		"micOn":  mic,
		"camOn":  cam,
	}
	for _, p := range room.Others(self.ID()) {
		_ = p.SendServer(msg)
	}
}
