import { api } from "./client"

export type CreateRoomResponse = { roomId: string }

export async function createRoom(): Promise<string> {
  const { data } = await api.post<CreateRoomResponse>("/api/rooms")
  return data.roomId
}
