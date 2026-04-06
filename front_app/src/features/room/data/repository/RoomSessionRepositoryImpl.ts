import { logRoomData } from "@/app/logging/kvtAppLog"
import { buildAudioConstraints, buildVideoConstraints } from "@/app/media/mediaPrefs"
import { loadLobbyMediaDefaults } from "@/app/profile/lobbyMediaPrefs"
import { MutableStateFlow } from "@kvt/runtime"
import type { RoomMember } from "../../domain/model/roomMember"
import type { SignalingInbound } from "../../domain/model/signalingInbound"
import type { RoomPageSnapshot } from "../../domain/model/roomPageSnapshot"
import type { RtcPeerDiagnostics, WsReadyStateLabel } from "../../domain/model/roomDiagnostics"
import { sdpOfferHasVideoMLine, sdpOfferIncludesH264Video } from "../../domain/sdp/videoCodecOrder"
import type { RoomSessionInitOptions } from "../../domain/model/roomSessionInit"
import { RoomSessionRepository } from "../../domain/repository/RoomSessionRepository"
import { applyH264VideoOnly, h264VideoCodecPreferences } from "../webrtc/webrtcCodecPreferences"
import { waitIceGathering } from "../webrtc/iceGathering"
import { stopTrackSafe } from "../webrtc/blackVideoTrack"
import { createMediaMutex } from "../webrtc/mediaMutex"
import { copyLocalSdpToClipboard } from "../webrtc/sdpClipboard"
import { sanitizeWhepAnswerForChrome } from "../webrtc/sanitizeWhepAnswerSdp"

const ICE: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]
const WS_HEARTBEAT_MS = 25_000

function signalingWsUrl(): string {
  const explicit = import.meta.env.VITE_SIGNAL_WS
  if (explicit) return explicit
  const u = new URL(window.location.href)
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:"
  u.pathname = "/ws"
  u.search = ""
  u.hash = ""
  return u.toString()
}

const initialSnapshot = (): RoomPageSnapshot => ({
  roomId: "",
  wsReady: false,
  wsReadyState: "NONE",
  signalingWsUrl: "",
  isPublishing: false,
  error: null,
  members: [],
  remotePeerIds: [],
  mediaEpoch: 0,
  publishPeer: null,
  subscribePeers: [],
  localNickname: "",
  localMicOn: true,
  localCamOn: true,
})

const ICE_FAILED_HINT =
  "Проверьте SRS_CANDIDATE_IP и SRS_EIP в docker-compose (.env): укажите LAN-IP машины с Docker (не 127.0.0.1), чтобы другие устройства достигали UDP 8000. См. комментарий в docker-compose.yml."

function mapWsReadyState(ws: WebSocket | null): WsReadyStateLabel {
  if (!ws) return "NONE"
  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return "CONNECTING"
    case WebSocket.OPEN:
      return "OPEN"
    case WebSocket.CLOSING:
      return "CLOSING"
    case WebSocket.CLOSED:
      return "CLOSED"
    default:
      return "NONE"
  }
}

/** В lib.dom иногда нет `kind` на transceiver; в браузере — есть. */
function transceiverIsVideo(tr: RTCRtpTransceiver): boolean {
  const k = (tr as RTCRtpTransceiver & { kind?: string }).kind
  if (k === "video") return true
  return tr.sender?.track?.kind === "video" || tr.receiver?.track?.kind === "video"
}

function peerDiag(role: RtcPeerDiagnostics["role"], targetPeerId: string, pc: RTCPeerConnection): RtcPeerDiagnostics {
  return {
    role,
    targetPeerId,
    connectionState: pc.connectionState,
    iceConnectionState: pc.iceConnectionState,
    iceGatheringState: pc.iceGatheringState,
    signalingState: pc.signalingState,
  }
}

export class RoomSessionRepositoryImpl extends RoomSessionRepository {
  private readonly _state = new MutableStateFlow<RoomPageSnapshot>(initialSnapshot())
  override readonly state = this._state.asStateFlow()

  private _sessionGeneration = 0
  private _publishLifecycleIgnore = false

  private _roomId = ""
  private _peerId = ""
  private _nickname = ""
  private _ws: WebSocket | null = null
  private _publishPc: RTCPeerConnection | null = null
  private _localStream: MediaStream | null = null
  private readonly _subs = new Map<string, RTCPeerConnection>()
  private readonly _remoteStreams = new Map<string, MediaStream>()
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private _publishStarting = false
  private readonly _mediaMutex = createMediaMutex()

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer != null) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = null
    }
  }

  private _startHeartbeat(ws: WebSocket): void {
    this._stopHeartbeat()
    this._heartbeatTimer = setInterval(() => {
      if (this._ws !== ws || ws.readyState !== WebSocket.OPEN) {
        this._stopHeartbeat()
        return
      }
      try {
        ws.send(JSON.stringify({ t: "ping" }))
        logRoomData.debug("WS heartbeat ping")
      } catch (e) {
        logRoomData.warn("WS heartbeat send failed", e)
      }
    }, WS_HEARTBEAT_MS)
  }

  private get _base(): string {
    return import.meta.env.VITE_SIGNAL_URL || ""
  }

  private _bumpMediaEpoch(): void {
    this._state.update({ mediaEpoch: this._state.value.mediaEpoch + 1 })
  }

  private _setRemotePeerIds(): void {
    this._state.update({ remotePeerIds: [...this._remoteStreams.keys()] })
  }

  private _flushDiagnostics(): void {
    const ws = this._ws
    const pub = this._publishPc
    this._state.update({
      wsReadyState: mapWsReadyState(ws),
      signalingWsUrl: signalingWsUrl(),
      publishPeer: pub ? peerDiag("publish", this._peerId, pub) : null,
      subscribePeers: [...this._subs.entries()].map(([id, pc]) => peerDiag("subscribe", id, pc)),
    })
  }

  private _sendPresenceWS(): void {
    const w = this._ws
    if (!w || w.readyState !== WebSocket.OPEN) return
    const { localMicOn, localCamOn } = this._state.value
    w.send(JSON.stringify({ t: "presence", micOn: localMicOn, camOn: localCamOn }))
  }

  private async _postSdp(path: string, qPeer: string, sdp: string): Promise<string> {
    const url = `${this._base}${path}?peer=${encodeURIComponent(qPeer)}`
    logRoomData.debug("POST SDP", { path, peer: qPeer.slice(0, 8), base: this._base || "(same-origin)" })
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: sdp,
    })
    const text = await r.text()
    if (!r.ok) {
      logRoomData.error("POST SDP failed", { path, status: r.status, bodyPreview: text.slice(0, 200) })
      throw new Error(`${path} ${r.status}: ${text}`)
    }
    logRoomData.info("POST SDP ok", { path, status: r.status, answerChars: text.length })
    return text
  }

  private _disposeLocalMedia(): void {
    if (this._localStream) {
      this._localStream.getTracks().forEach((t) => stopTrackSafe(t))
    }
    this._localStream = null
  }

  /** Синхронизирует MediaStream с localMicOn/localCamOn: без камеры — только аудио (без видеотреков). */
  private async ensureLocalStreamMatchesState(): Promise<void> {
    const gen = this._sessionGeneration
    const { localMicOn, localCamOn } = this._state.value

    const applyMic = (): void => {
      this._localStream?.getAudioTracks().forEach((t) => {
        t.enabled = localMicOn
      })
    }

    let stream = this._localStream

    if (!stream) {
      const audio = buildAudioConstraints()
      if (localCamOn) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio,
          video: buildVideoConstraints(),
        })
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio,
          video: false,
        })
      }
      if (gen !== this._sessionGeneration) {
        stream.getTracks().forEach((t) => stopTrackSafe(t))
        return
      }
      this._localStream = stream
      applyMic()
      this._bumpMediaEpoch()
      return
    }

    applyMic()
    if (gen !== this._sessionGeneration) return

    if (localCamOn) {
      const liveVideo = stream.getVideoTracks().filter((t) => t.readyState === "live")
      if (liveVideo.length === 0) {
        const v = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: buildVideoConstraints(),
        })
        if (gen !== this._sessionGeneration) {
          v.getTracks().forEach((t) => stopTrackSafe(t))
          return
        }
        const vt = v.getVideoTracks()[0]
        if (vt) stream.addTrack(vt)
      }
      stream.getVideoTracks().forEach((t) => {
        if (t.readyState === "live") t.enabled = true
      })
    } else {
      for (const t of [...stream.getVideoTracks()]) {
        stopTrackSafe(t)
        stream.removeTrack(t)
      }
    }

    if (gen !== this._sessionGeneration) return
    this._localStream = stream
    this._bumpMediaEpoch()
  }

  private _ensurePublishVideoCodecPreferences(pc: RTCPeerConnection): void {
    const videoTx = pc.getTransceivers().find((tr) => transceiverIsVideo(tr))
    if (!videoTx) return
    if (!h264VideoCodecPreferences("publish").length) {
      throw new Error(
        "Среди кодеков отправки (RTCRtpSender) нет H.264 — SRS не примет WHIP. Попробуйте другое устройство или браузер.",
      )
    }
    applyH264VideoOnly(videoTx, "publish")
  }

  private async _finalizeWhipNegotiation(pc: RTCPeerConnection, pubGen: number, clipboardLabel: string): Promise<void> {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitIceGathering(pc)
    if (pubGen !== this._sessionGeneration) return
    this._flushDiagnostics()

    const localSdp = pc.localDescription?.sdp ?? ""
    if (sdpOfferHasVideoMLine(localSdp) && !sdpOfferIncludesH264Video(localSdp)) {
      throw new Error(
        "В SDP публикации нет H.264 (часто Chrome на Android с аппаратным HEVC: в offer только VP8/VP9/AV1/H.265). SRS WHIP требует H.264 в offer. Варианты: Firefox для Android, Safari/iOS, публикация с ПК, либо цепочка с перекодированием, не «голый» SRS.",
      )
    }

    await copyLocalSdpToClipboard(localSdp, clipboardLabel)
    const answerSdp = await this._postSdp("/api/rtc/whip", this._peerId, localSdp)
    if (pubGen !== this._sessionGeneration) return
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp })
  }

  /**
   * После публикации только с аудио второй POST на тот же WHIP/stream у SRS даёт 502/EOF — ренегоциация не поддерживается.
   * Закрываем PC, unpublish, новый полный WHIP; локальный MediaStream не трогаем.
   */
  private _restartPublishKeepingMedia(pubGen: number): void {
    if (pubGen !== this._sessionGeneration) return
    logRoomData.info("WHIP restart publish (video после audio-only: новый WHIP вместо renegotiate)")
    this._publishLifecycleIgnore = true
    const w = this._ws
    if (w && w.readyState === WebSocket.OPEN) {
      w.send(JSON.stringify({ t: "unpublish" }))
    }
    this._publishPc?.close()
    this._publishPc = null
    this._state.update({ isPublishing: false })
    this._bumpMediaEpoch()
    this._flushDiagnostics()
    queueMicrotask(() => {
      void this.startPublishing()
    })
  }

  private async _syncPublishVideoSender(): Promise<void> {
    const pc = this._publishPc
    const stream = this._localStream
    if (!pc || !stream || !this._state.value.isPublishing) return
    const pubGen = this._sessionGeneration
    const vt = stream.getVideoTracks()[0]
    const videoTr = pc.getTransceivers().find((tr) => transceiverIsVideo(tr))

    if (vt && videoTr) {
      await videoTr.sender.replaceTrack(vt)
      return
    }
    if (!vt && videoTr) {
      await videoTr.sender.replaceTrack(null)
      return
    }
    if (vt && !videoTr) {
      this._restartPublishKeepingMedia(pubGen)
    }
  }

  override initialize(roomId: string, peerId: string, nickname: string, opts?: RoomSessionInitOptions): void {
    this.dispose()
    const gen = this._sessionGeneration
    this._roomId = roomId
    this._peerId = peerId
    this._nickname = nickname.trim()
    const lobby = loadLobbyMediaDefaults()
    const initialMicOn = opts?.initialMicOn ?? lobby.micOn
    const initialCamOn = opts?.initialCamOn ?? lobby.camOn
    const sigUrl = signalingWsUrl()
    this._state.set({
      ...initialSnapshot(),
      roomId,
      signalingWsUrl: sigUrl,
      wsReadyState: "CONNECTING",
      localNickname: this._nickname,
      localMicOn: initialMicOn,
      localCamOn: initialCamOn,
    })
    if (opts?.localPreviewStream) {
      this._localStream = opts.localPreviewStream
      this._localStream.getAudioTracks().forEach((t) => {
        t.enabled = initialMicOn
      })
      if (!initialCamOn) {
        this._localStream.getVideoTracks().forEach((t) => {
          stopTrackSafe(t)
          this._localStream!.removeTrack(t)
        })
      } else {
        this._localStream.getVideoTracks().forEach((t) => {
          t.enabled = true
        })
      }
      this._bumpMediaEpoch()
    }
    logRoomData.info("session initialize", { roomId, peerId: peerId.slice(0, 8), signalingWsUrl: sigUrl })

    const ws = new WebSocket(sigUrl)
    this._ws = ws
    this._flushDiagnostics()

    const cleanupSub = (remotePeer: string): void => {
      logRoomData.info("subscribe cleanup", { remote: remotePeer.slice(0, 8) })
      const pc = this._subs.get(remotePeer)
      if (pc) {
        pc.close()
        this._subs.delete(remotePeer)
      }
      if (this._remoteStreams.delete(remotePeer)) {
        this._setRemotePeerIds()
        this._bumpMediaEpoch()
      }
      this._flushDiagnostics()
    }

    const attachPcStateLogging = (remotePeer: string, pc: RTCPeerConnection): void => {
      const flush = (): void => {
        if (gen !== this._sessionGeneration) return
        this._flushDiagnostics()
      }
      const logStates = (tag: string): void => {
        if (gen !== this._sessionGeneration) return
        logRoomData.debug(`WHEP PC ${tag}`, {
          remote: remotePeer.slice(0, 8),
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          iceGatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState,
        })
        flush()
      }
      pc.onconnectionstatechange = () => {
        if (gen !== this._sessionGeneration) return
        logStates("connectionstatechange")
        const st = pc.connectionState
        if (st === "failed") {
          cleanupSub(remotePeer)
          logRoomData.warn("WHEP connection failed", { remote: remotePeer.slice(0, 8) })
          this._state.update({
            error: `Просмотр участника: WebRTC не соединился (ICE/сеть). ${ICE_FAILED_HINT}`,
          })
          return
        }
        if (st === "closed") {
          cleanupSub(remotePeer)
        }
      }
      pc.oniceconnectionstatechange = () => logStates("iceconnectionstatechange")
      pc.onicegatheringstatechange = () => logStates("icegatheringstatechange")
      pc.onsignalingstatechange = () => logStates("signalingstatechange")
      flush()
    }

    const subscribePeer = async (remotePeer: string): Promise<void> => {
      if (remotePeer === this._peerId || this._subs.has(remotePeer)) return

      logRoomData.info("WHEP subscribe start", { remote: remotePeer.slice(0, 8) })
      const pc = new RTCPeerConnection({ iceServers: ICE })
      this._subs.set(remotePeer, pc)
      attachPcStateLogging(remotePeer, pc)
      const member = this._state.value.members.find((m) => m.peerId === remotePeer)
      const subscribeAudioOnly = member ? !member.camOn : false
      if (subscribeAudioOnly) {
        pc.addTransceiver("audio", { direction: "recvonly" })
      } else {
        /* SRS: порядок m= в answer должен соответствовать offer; у потока с видео — обычно video, затем audio. */
        const videoRx = pc.addTransceiver("video", { direction: "recvonly" })
        applyH264VideoOnly(videoRx, "subscribe")
        pc.addTransceiver("audio", { direction: "recvonly" })
      }

      pc.ontrack = (ev) => {
        if (gen !== this._sessionGeneration) return
        const [stream] = ev.streams
        if (!stream) return
        logRoomData.info("WHEP ontrack", { remote: remotePeer.slice(0, 8), tracks: stream.getTracks().map((t) => t.kind) })
        this._remoteStreams.set(remotePeer, stream)
        this._setRemotePeerIds()
        this._bumpMediaEpoch()
        this._flushDiagnostics()
      }

      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitIceGathering(pc)
        void copyLocalSdpToClipboard(pc.localDescription?.sdp, `WHEP → ${remotePeer.slice(0, 8)}…`)
        const rawAnswer = await this._postSdp("/api/rtc/whep", remotePeer, pc.localDescription!.sdp)
        const answerSdp = sanitizeWhepAnswerForChrome(rawAnswer)
        if (answerSdp !== rawAnswer) {
          logRoomData.warn("WHEP answer SDP sanitized (multi-ssrc / Unified Plan)", { remote: remotePeer.slice(0, 8) })
        }
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp })
        logRoomData.info("WHEP setRemoteDescription done", { remote: remotePeer.slice(0, 8) })
        this._flushDiagnostics()
      } catch (e) {
        logRoomData.error("WHEP subscribe error", e)
        cleanupSub(remotePeer)
        const msg = e instanceof Error ? e.message : String(e)
        this._state.update({ error: this._state.value.error || msg })
      }
    }

    const subscribePublishersInMembers = (members: readonly RoomMember[]): void => {
      for (const m of members) {
        if (m.publishing && m.peerId !== this._peerId) void subscribePeer(m.peerId)
      }
    }

    const patchMember = (peerId: string, patch: Partial<RoomMember>): void => {
      const members = this._state.value.members.map((m) => (m.peerId === peerId ? { ...m, ...patch } : m))
      this._state.update({ members })
    }

    const onMessage = (ev: MessageEvent): void => {
      let msg: SignalingInbound
      try {
        msg = JSON.parse(ev.data as string) as SignalingInbound
      } catch {
        return
      }
      logRoomData.debug("WS inbound", { t: msg.t })
      if (msg.t === "pong") {
        logRoomData.debug("WS heartbeat pong")
        return
      }
      if (msg.t === "state" && Array.isArray(msg.members)) {
        this._state.update({ members: msg.members })
        subscribePublishersInMembers(msg.members)
        return
      }
      if (msg.t === "peer-join") {
        const nm: RoomMember = {
          peerId: msg.peerId,
          nickname: msg.nickname,
          publishing: msg.publishing,
          micOn: msg.micOn,
          camOn: msg.camOn,
        }
        const others = this._state.value.members.filter((m) => m.peerId !== msg.peerId)
        this._state.update({ members: [...others, nm] })
        if (msg.publishing && msg.peerId !== this._peerId) void subscribePeer(msg.peerId)
        return
      }
      if (msg.t === "peer-leave") {
        cleanupSub(msg.peerId)
        this._state.update({
          members: this._state.value.members.filter((m) => m.peerId !== msg.peerId),
        })
        return
      }
      if (msg.t === "peer-presence") {
        patchMember(msg.peerId, { micOn: msg.micOn, camOn: msg.camOn })
        return
      }
      if (msg.t === "peer-publish") {
        patchMember(msg.peerId, { publishing: true })
        if (msg.peerId !== this._peerId) void subscribePeer(msg.peerId)
        return
      }
      if (msg.t === "peer-unpublish") {
        cleanupSub(msg.peerId)
        patchMember(msg.peerId, { publishing: false })
        return
      }
      if (msg.t === "error" && msg.message) {
        logRoomData.warn("signaling error message", { message: msg.message })
        this._state.update({ error: msg.message })
      }
    }

    ws.onopen = () => {
      logRoomData.info("WebSocket open", { roomId })
      this._state.update({ error: null, wsReady: true })
      this._flushDiagnostics()
      ws.send(
        JSON.stringify({
          t: "join",
          roomId: this._roomId,
          peerId: this._peerId,
          nickname: this._nickname,
        }),
      )
      this._sendPresenceWS()
      this._startHeartbeat(ws)
    }

    ws.onmessage = onMessage

    ws.onerror = () => {
      logRoomData.error("WebSocket error")
      this._stopHeartbeat()
      this._state.update({ error: "WebSocket: ошибка соединения" })
      this._flushDiagnostics()
    }

    ws.onclose = (ev) => {
      logRoomData.warn("WebSocket close", { code: ev.code, reason: ev.reason })
      this._stopHeartbeat()
      if (this._ws === ws) this._ws = null
      this._state.update({ wsReady: false })
      this._flushDiagnostics()
    }
  }

  override dispose(): void {
    logRoomData.info("session dispose")
    this._stopHeartbeat()
    this._sessionGeneration += 1
    this._publishLifecycleIgnore = true
    const ws = this._ws
    this._ws = null
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.send(JSON.stringify({ t: "unpublish" }))
    }
    ws?.close()

    this._publishPc?.close()
    this._publishPc = null
    this._disposeLocalMedia()

    this._subs.forEach((pc) => pc.close())
    this._subs.clear()
    this._remoteStreams.clear()

    this._state.set(initialSnapshot())
  }

  override setLocalMicEnabled(on: boolean): void {
    this._state.update({ localMicOn: on })
    this._localStream?.getAudioTracks().forEach((t) => {
      t.enabled = on
    })
    this._sendPresenceWS()
  }

  override setLocalCamEnabled(on: boolean): void {
    this._state.update({ localCamOn: on })
    this._sendPresenceWS()
    void this._mediaMutex.run(async () => {
      try {
        await this.ensureLocalStreamMatchesState()
        await this._syncPublishVideoSender()
      } catch (e) {
        logRoomData.error("setLocalCam", e)
        this._state.update({ error: e instanceof Error ? e.message : String(e) })
      }
    })
  }

  override async startPublishing(): Promise<void> {
    return this._mediaMutex.run(async () => {
      if (this._state.value.isPublishing && this._publishPc != null) return
      if (this._publishStarting) return
      this._publishStarting = true
      logRoomData.info("WHIP startPublishing")
      this._state.update({ error: null })
      try {
        await this.ensureLocalStreamMatchesState()
        const stream = this._localStream
        if (!stream) throw new Error("нет локального MediaStream")
        logRoomData.info("WHIP local stream ready", { tracks: stream.getTracks().map((t) => t.kind) })

      const pc = new RTCPeerConnection({ iceServers: ICE })
      this._publishPc = pc
      this._publishLifecycleIgnore = false
      const pubGen = this._sessionGeneration

      const logPublishStates = (tag: string): void => {
        if (pubGen !== this._sessionGeneration || this._publishLifecycleIgnore) return
        logRoomData.debug(`WHIP PC ${tag}`, {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          iceGatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState,
        })
        this._flushDiagnostics()
      }

      pc.onconnectionstatechange = () => {
        if (pubGen !== this._sessionGeneration || this._publishLifecycleIgnore) return
        logPublishStates("connectionstatechange")
        const st = pc.connectionState
        if (st === "failed") {
          const wasPublishing = this._state.value.isPublishing
          if (!wasPublishing) return
          logRoomData.error("WHIP connection failed")
          this._publishLifecycleIgnore = true
          this._publishPc?.close()
          this._publishPc = null
          this._disposeLocalMedia()
          this._state.update({
            isPublishing: false,
            error: `Публикация: WebRTC с SRS не выдержал соединение (ICE failed). ${ICE_FAILED_HINT}`,
          })
          this._bumpMediaEpoch()
          this._flushDiagnostics()
        }
      }
      pc.oniceconnectionstatechange = () => logPublishStates("iceconnectionstatechange")
      pc.onicegatheringstatechange = () => logPublishStates("icegatheringstatechange")
      pc.onsignalingstatechange = () => logPublishStates("signalingstatechange")

      stream.getTracks().forEach((t) => pc.addTrack(t, stream))
      this._ensurePublishVideoCodecPreferences(pc)
      await this._finalizeWhipNegotiation(pc, pubGen, "WHIP publish")
      if (pubGen !== this._sessionGeneration) return

      this._state.update({ isPublishing: true })
      this._flushDiagnostics()
      logRoomData.info("WHIP publishing active", { peerId: this._peerId.slice(0, 8) })
      const w = this._ws
      if (w && w.readyState === WebSocket.OPEN) {
        w.send(JSON.stringify({ t: "publishing" }))
      }
    } catch (e) {
      logRoomData.error("WHIP startPublishing failed", e)
      const msg = e instanceof Error ? e.message : String(e)
      this._state.update({ error: msg })
      this._publishPc?.close()
      this._publishPc = null
      this._disposeLocalMedia()
      this._bumpMediaEpoch()
      this._flushDiagnostics()
    } finally {
      this._publishStarting = false
    }
    })
  }

  override stopPublishing(): void {
    logRoomData.info("WHIP stopPublishing")
    this._publishLifecycleIgnore = true
    const w = this._ws
    if (w && w.readyState === WebSocket.OPEN) {
      w.send(JSON.stringify({ t: "unpublish" }))
    }
    this._publishPc?.close()
    this._publishPc = null
    this._disposeLocalMedia()
    this._state.update({ isPublishing: false })
    this._bumpMediaEpoch()
    this._flushDiagnostics()
  }

  override getRemoteStream(peerId: string): MediaStream | undefined {
    return this._remoteStreams.get(peerId)
  }

  override getLocalPreviewStream(): MediaStream | null {
    return this._localStream
  }
}
