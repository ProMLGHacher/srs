package sfu

import (
	"sync"
)

// Room is a voice channel with multiple Peers.
type Room struct {
	id    string
	peers map[string]*Peer
	mu    sync.RWMutex
}

func newRoom(id string) *Room {
	return &Room{id: id, peers: make(map[string]*Peer)}
}

// AddPeer registers a connected participant.
func (r *Room) AddPeer(p *Peer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.peers[p.id] = p
}

// PeerCount returns the number of connected peers.
func (r *Room) PeerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.peers)
}

// RemovePeer removes a participant and returns how many remain.
func (r *Room) RemovePeer(id string) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.peers, id)
	return len(r.peers)
}

// Others returns peers except the given id.
func (r *Room) Others(exceptID string) []*Peer {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*Peer, 0, len(r.peers))
	for id, p := range r.peers {
		if id != exceptID {
			out = append(out, p)
		}
	}
	return out
}
