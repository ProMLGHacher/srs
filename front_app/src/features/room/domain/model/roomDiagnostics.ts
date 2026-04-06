/** Состояние WebSocket сигналинга (без привязки к API браузера). */
export type WsReadyStateLabel = "NONE" | "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED"

/** Снимок RTCPeerConnection для отладки в UI. */
export interface RtcPeerDiagnostics {
  role: "publish" | "subscribe"
  /** Для publish — локальный peerId; для subscribe — удалённый publisher id. */
  targetPeerId: string
  connectionState: string
  iceConnectionState: string
  iceGatheringState: string
  signalingState: string
}
