/** Участник комнаты (сигналинг + UI). */
export interface RoomMember {
  peerId: string
  nickname: string
  publishing: boolean
  micOn: boolean
  camOn: boolean
}
