// Package protocol defines the WebSocket JSON signaling between voice_web and voice_sfu.
//
// Client → server
//   - join: enter a room (first message after connect)
//   - signal: WebRTC offer | answer | ICE candidate
//
// Server → client
//   - joined: ack with self peerId and roster
//   - peer_joined / peer_left: roster updates
//   - signal: SDP or ICE (including server-initiated renegotiation offers)
//   - error: fatal for this connection
package protocol

import "encoding/json"

type MessageType string

const (
	TypeJoin         MessageType = "join"
	TypeSignal       MessageType = "signal"
	TypePresence     MessageType = "presence"
	TypeJoined       MessageType = "joined"
	TypePeerJoined   MessageType = "peer_joined"
	TypePeerLeft     MessageType = "peer_left"
	TypePeerPresence MessageType = "peer_presence"
	TypeError        MessageType = "error"
)

type ClientMessage struct {
	Type MessageType `json:"type"`
	// join
	Room string `json:"room,omitempty"`
	Name string `json:"name,omitempty"`
	// join initial presence or presence update (optional on join → default true)
	MicOn *bool `json:"micOn,omitempty"`
	CamOn *bool `json:"camOn,omitempty"`
	// signal
	Kind      string          `json:"kind,omitempty"` // offer | answer | ice
	SDP       string          `json:"sdp,omitempty"`
	Candidate json.RawMessage `json:"candidate,omitempty"`
}

type PeerInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	MicOn      bool   `json:"micOn"`
	CamOn      bool   `json:"camOn"`
	Publishing bool   `json:"publishing"`
}

type ServerMessage struct {
	Type MessageType `json:"type"`
	// joined
	PeerID string     `json:"peerId,omitempty"`
	Peers  []PeerInfo `json:"peers,omitempty"`
	// peer_joined
	Peer *PeerInfo `json:"peer,omitempty"`
	// peer_left (distinct key from joined.peerId)
	PeerIDLeft string `json:"leftPeerId,omitempty"`
	// signal
	Kind      string          `json:"kind,omitempty"`
	SDP       string          `json:"sdp,omitempty"`
	Candidate json.RawMessage `json:"candidate,omitempty"`
	// error
	Message string `json:"message,omitempty"`
}

func MarshalServer(m ServerMessage) ([]byte, error) {
	return json.Marshal(m)
}
