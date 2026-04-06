import type { RtcPeerDiagnostics, WsReadyStateLabel } from "./roomDiagnostics"
import type { RoomMember } from "./roomMember"

/** Снимок UI комнаты: без MediaStream — потоки запрашиваются у репозитория по peerId. */
export interface RoomPageSnapshot {
  /** Id комнаты (для копирования ссылки). */
  roomId: string
  wsReady: boolean
  wsReadyState: WsReadyStateLabel
  signalingWsUrl: string
  isPublishing: boolean
  error: string | null
  /** Участники комнаты (сигналинг). */
  members: readonly RoomMember[]
  remotePeerIds: readonly string[]
  mediaEpoch: number
  publishPeer: RtcPeerDiagnostics | null
  subscribePeers: readonly RtcPeerDiagnostics[]
  /** Локальный ник (вошедший пользователь). */
  localNickname: string
  /** Локальные переключатели мик/кам (и для presence). */
  localMicOn: boolean
  localCamOn: boolean
}
