export type RoomSessionInitOptions = {
  initialMicOn: boolean
  initialCamOn: boolean
  localPreviewStream?: MediaStream | null
}

export type WsReadyStateLabel = "NONE" | "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED"

export interface RtcPeerDiagnostics {
  role: "publish" | "subscribe"
  targetPeerId: string
  connectionState: string
  iceConnectionState: string
  iceGatheringState: string
  signalingState: string
}

export type SignalingInbound =
  | { t: "pong" }
  | { t: "state"; members: Array<{ peerId: string; nickname: string; publishing: boolean; micOn: boolean; camOn: boolean }> }
  | { t: "peer-join"; peerId: string; nickname: string; publishing: boolean; micOn: boolean; camOn: boolean }
  | { t: "peer-leave"; peerId: string }
  | { t: "peer-presence"; peerId: string; micOn: boolean; camOn: boolean }
  | { t: "peer-publish"; peerId: string }
  | { t: "peer-unpublish"; peerId: string }
  | { t: "error"; message: string }
