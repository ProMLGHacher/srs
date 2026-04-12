package sfu

import (
	"sync"
)

// Manager holds rooms keyed by room id.
type Manager struct {
	mu    sync.Mutex
	rooms map[string]*Room
}

func NewManager() *Manager {
	return &Manager{rooms: make(map[string]*Room)}
}

// GetOrCreate returns the room, creating it if needed.
func (m *Manager) GetOrCreate(roomID string) *Room {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.rooms[roomID]
	if !ok {
		r = newRoom(roomID)
		m.rooms[roomID] = r
	}
	return r
}

// DropRoomIfEmpty removes an empty room from the manager index.
func (m *Manager) DropRoomIfEmpty(r *Room) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r.PeerCount() == 0 {
		delete(m.rooms, r.id)
	}
}
