import type { RtcPeerDiagnostics, WsReadyStateLabel } from "./roomDiagnostics"

/** Снимок UI комнаты: без MediaStream — потоки запрашиваются у репозитория по peerId. */
export interface RoomPageSnapshot {
  wsReady: boolean
  wsReadyState: WsReadyStateLabel
  /** URL вебсокета сигналинга (для отладки). */
  signalingWsUrl: string
  isPublishing: boolean
  error: string | null
  remotePeerIds: readonly string[]
  /** Инкремент при смене локального/удалённого MediaStream для перерисовки video. */
  mediaEpoch: number
  /** WHIP: локальный peer connection. */
  publishPeer: RtcPeerDiagnostics | null
  /** WHEP: по одному PC на удалённого издателя. */
  subscribePeers: readonly RtcPeerDiagnostics[]
}
