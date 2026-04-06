import type { RoomMember } from "./roomMember"

/** Сообщения сигналинга с сервера (JSON по WebSocket). */
export type SignalingInbound =
  | { t: "pong" }
  | { t: "state"; members: RoomMember[] }
  | {
      t: "peer-join"
      peerId: string
      nickname: string
      publishing: boolean
      micOn: boolean
      camOn: boolean
    }
  | { t: "peer-leave"; peerId: string }
  | { t: "peer-presence"; peerId: string; micOn: boolean; camOn: boolean }
  | { t: "peer-publish"; peerId: string }
  | { t: "peer-unpublish"; peerId: string }
  | { t: "error"; message: string }
