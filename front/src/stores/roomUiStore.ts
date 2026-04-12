import { create } from "zustand"

type RoomUiState = {
  pinnedPeerId: string | null
  setPinnedPeerId: (id: string | null) => void
}

export const useRoomUiStore = create<RoomUiState>((set) => ({
  pinnedPeerId: null,
  setPinnedPeerId: (id) => set({ pinnedPeerId: id }),
}))
