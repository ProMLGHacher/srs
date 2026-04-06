/** Сообщения сигналинга с сервера (JSON по WebSocket). */
export type SignalingInbound =
  | { t: "state"; publishers: string[] }
  | { t: "peer-publish"; peerId: string }
  | { t: "peer-unpublish"; peerId: string }
  | { t: "error"; message: string }
  /** Ответ сервера на прикладной heartbeat (см. { t: "ping" } с клиента). */
  | { t: "pong" }
