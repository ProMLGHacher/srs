export type RoomMember = {
  peerId: string
  nickname: string
  publishing: boolean
  micOn: boolean
  camOn: boolean
}

export type SignalingInbound =
  | { t: "pong" }
  | { t: "error"; message: string }
  | { t: "state"; members: RoomMember[] }
  | { t: "peer-join"; peerId: string; nickname: string; publishing: boolean; micOn: boolean; camOn: boolean }
  | { t: "peer-leave"; peerId: string }
  | { t: "peer-publish"; peerId: string }
  | { t: "peer-unpublish"; peerId: string }
  | { t: "peer-presence"; peerId: string; micOn: boolean; camOn: boolean }
