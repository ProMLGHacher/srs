import { LobbyRoomsApi } from "../../domain/repository/LobbyRoomsApi"

function apiOrigin(): string {
  return import.meta.env.VITE_SIGNAL_URL || ""
}

export class LobbyRoomsApiImpl extends LobbyRoomsApi {
  override async createRoom(): Promise<{ roomId: string }> {
    const base = apiOrigin()
    const res = await fetch(`${base}/api/rooms`, { method: "POST" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { roomId?: string }
    if (!data.roomId) throw new Error("нет roomId")
    return { roomId: data.roomId }
  }
}
