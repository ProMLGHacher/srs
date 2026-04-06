package ws

import (
	"encoding/json"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
)

const maxNicknameLen = 64

// Member is signaling state for one participant (UI + publishing flag).
type Member struct {
	PeerID     string `json:"peerId"`
	Nickname   string `json:"nickname"`
	Publishing bool   `json:"publishing"`
	MicOn      bool   `json:"micOn"`
	CamOn      bool   `json:"camOn"`
}

type Client struct {
	Conn *websocket.Conn
	roomID     string
	peerID     string
	nickname   string
	publishing bool
	micOn      bool
	camOn      bool
}

// AttachClient creates a signaling client for a WebSocket connection.
func AttachClient(conn *websocket.Conn) *Client {
	return &Client{Conn: conn, micOn: true, camOn: true}
}

func (c *Client) member() Member {
	return Member{
		PeerID:     c.peerID,
		Nickname:   c.nickname,
		Publishing: c.publishing,
		MicOn:      c.micOn,
		CamOn:      c.camOn,
	}
}

type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*Client]struct{}
}

func NewHub() *Hub {
	return &Hub{rooms: make(map[string]map[*Client]struct{})}
}

func (h *Hub) roomClients(roomID string) map[*Client]struct{} {
	if h.rooms[roomID] == nil {
		h.rooms[roomID] = make(map[*Client]struct{})
	}
	return h.rooms[roomID]
}

func (h *Hub) broadcast(roomID string, msg interface{}, except *Client) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.mu.RLock()
	set := h.rooms[roomID]
	h.mu.RUnlock()
	if set == nil {
		return
	}
	for c := range set {
		if c == except {
			continue
		}
		_ = c.Conn.WriteMessage(websocket.TextMessage, data)
	}
}

func (h *Hub) send(c *Client, msg interface{}) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	_ = c.Conn.WriteMessage(websocket.TextMessage, data)
}

// RemoveConn removes client and notifies room (peer-unpublish if needed, then peer-leave).
func (h *Hub) RemoveConn(c *Client) {
	if c.roomID == "" {
		return
	}
	h.mu.Lock()
	roomID := c.roomID
	peerID := c.peerID
	wasPub := c.publishing
	set := h.rooms[roomID]
	if set != nil {
		delete(set, c)
		if len(set) == 0 {
			delete(h.rooms, roomID)
		}
	}
	c.roomID = ""
	h.mu.Unlock()

	if wasPub {
		h.broadcast(roomID, map[string]interface{}{"t": "peer-unpublish", "peerId": peerID}, nil)
	}
	h.broadcast(roomID, map[string]interface{}{"t": "peer-leave", "peerId": peerID}, nil)
}

func (h *Hub) HandleMessage(c *Client, payload []byte) {
	var m map[string]interface{}
	if err := json.Unmarshal(payload, &m); err != nil {
		h.send(c, map[string]string{"t": "error", "message": "invalid json"})
		return
	}
	t, _ := m["t"].(string)
	switch t {
	case "ping":
		h.send(c, map[string]string{"t": "pong"})
	case "join":
		h.handleJoin(c, m)
	case "publishing":
		h.handlePublishing(c, true)
	case "unpublish":
		h.handlePublishing(c, false)
	case "presence":
		h.handlePresence(c, m)
	default:
		h.send(c, map[string]string{"t": "error", "message": "unknown message type"})
	}
}

func str(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, _ := v.(string)
	return s
}

func (h *Hub) handleJoin(c *Client, m map[string]interface{}) {
	roomID := strings.TrimSpace(str(m, "roomId"))
	peerID := strings.TrimSpace(str(m, "peerId"))
	nickname := strings.TrimSpace(str(m, "nickname"))
	if roomID == "" || peerID == "" {
		h.send(c, map[string]string{"t": "error", "message": "join requires roomId and peerId"})
		return
	}
	if nickname == "" {
		h.send(c, map[string]string{"t": "error", "message": "nickname required"})
		return
	}
	if len(nickname) > maxNicknameLen {
		h.send(c, map[string]string{"t": "error", "message": "nickname too long"})
		return
	}

	h.mu.Lock()
	if c.roomID != "" && c.roomID != roomID {
		oldRoom := c.roomID
		oldPeer := c.peerID
		oldPub := c.publishing
		if set := h.rooms[oldRoom]; set != nil {
			delete(set, c)
			if len(set) == 0 {
				delete(h.rooms, oldRoom)
			}
		}
		h.mu.Unlock()
		if oldPub {
			h.broadcast(oldRoom, map[string]interface{}{"t": "peer-unpublish", "peerId": oldPeer}, nil)
		}
		h.broadcast(oldRoom, map[string]interface{}{"t": "peer-leave", "peerId": oldPeer}, nil)
		h.mu.Lock()
	}

	c.roomID = roomID
	c.peerID = peerID
	c.nickname = nickname
	c.publishing = false
	c.micOn = true
	c.camOn = true
	set := h.roomClients(roomID)
	set[c] = struct{}{}
	members := make([]Member, 0, len(set))
	for cl := range set {
		members = append(members, cl.member())
	}
	h.mu.Unlock()

	h.send(c, map[string]interface{}{"t": "state", "members": members})

	h.broadcast(roomID, map[string]interface{}{
		"t":          "peer-join",
		"peerId":     peerID,
		"nickname":   nickname,
		"publishing": false,
		"micOn":      true,
		"camOn":      true,
	}, c)
}

func (h *Hub) handlePublishing(c *Client, on bool) {
	h.mu.Lock()
	roomID := c.roomID
	peerID := c.peerID
	if roomID == "" || peerID == "" {
		h.mu.Unlock()
		return
	}
	c.publishing = on
	h.mu.Unlock()

	if on {
		h.broadcast(roomID, map[string]interface{}{"t": "peer-publish", "peerId": peerID}, c)
	} else {
		h.broadcast(roomID, map[string]interface{}{"t": "peer-unpublish", "peerId": peerID}, nil)
	}
}

func (h *Hub) handlePresence(c *Client, m map[string]interface{}) {
	h.mu.Lock()
	if c.roomID == "" || c.peerID == "" {
		h.mu.Unlock()
		return
	}
	if v, ok := m["micOn"].(bool); ok {
		c.micOn = v
	}
	if v, ok := m["camOn"].(bool); ok {
		c.camOn = v
	}
	roomID := c.roomID
	peerID := c.peerID
	mic, cam := c.micOn, c.camOn
	h.mu.Unlock()

	h.broadcast(roomID, map[string]interface{}{
		"t":      "peer-presence",
		"peerId": peerID,
		"micOn":  mic,
		"camOn":  cam,
	}, c)
}
