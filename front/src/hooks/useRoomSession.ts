import { useCallback, useEffect, useRef, useState } from "react"
import type { RoomMember, SignalingInbound } from "@/types/member"
import { ICE_SERVERS } from "@/lib/webrtc/constants"
import { waitIceGathering } from "@/lib/webrtc/waitIceGathering"
import { postSdp } from "@/lib/webrtc/postSdp"
import { sanitizeWhepAnswerForChrome } from "@/lib/webrtc/sanitizeWhepAnswer"
import { applyH264VideoPreferences, sdpOfferIncludesH264Video } from "@/lib/webrtc/h264Preference"
import { logWebrtcTiming, shortPeerId, startWebrtcTiming } from "@/lib/webrtc/timingLog"

function signalingWsUrl(): string {
  const explicit = import.meta.env.VITE_SIGNAL_WS as string | undefined
  if (explicit?.trim()) return explicit.trim()
  const u = new URL(window.location.href)
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:"
  u.pathname = "/api/ws"
  u.search = ""
  u.hash = ""
  return u.toString()
}

function stopTrack(t: MediaStreamTrack): void {
  try {
    t.stop()
  } catch {
    /* ignore */
  }
}

export type UseRoomSessionOpts = {
  roomId: string
  nickname: string
  initialStream: MediaStream | null
  startMicOn: boolean
  startCamOn: boolean
}

export function useRoomSession(opts: UseRoomSessionOpts) {
  const [peerId] = useState(() => crypto.randomUUID())
  const [members, setMembers] = useState<RoomMember[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(opts.initialStream)

  const [localMicOn, setLocalMicOn] = useState(opts.startMicOn)
  const [localCamOn, setLocalCamOn] = useState(opts.startCamOn)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [wsLabel, setWsLabel] = useState("Подключение…")
  const [publishLabel, setPublishLabel] = useState("Ожидание сигналинга")
  const [subscribeLabel, setSubscribeLabel] = useState("—")
  const [mediaError, setMediaError] = useState<string | null>(null)
  /** Статус WHEP по удалённому peerId (как в шапке); пусто = соединение установлено или не ведётся. */
  const [peerSubscribeStatus, setPeerSubscribeStatus] = useState<Record<string, string>>({})

  const wsRef = useRef<WebSocket | null>(null)
  const publishPcRef = useRef<RTCPeerConnection | null>(null)
  const subsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(opts.initialStream)
  const sessionGen = useRef(0)
  const joinedRef = useRef(false)
  const publishLiveRef = useRef(false)
  /** Увеличивается при stopPublishing — отменяет «зависший» startPublishing (SRS + гонки с toggleCam). */
  const publishEpochRef = useRef(0)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const micRef = useRef(opts.startMicOn)
  const camRef = useRef(opts.startCamOn)
  /** Замер «от монтирования сессии до state» (один раз за жизнь эффекта WS). */
  const signalingTimingRef = useRef<ReturnType<typeof startWebrtcTiming> | null>(null)

  const commitLocalStream = useCallback((next: MediaStream | null) => {
    localStreamRef.current = next
    setLocalStream(next)
  }, [])

  useEffect(() => {
    if (opts.initialStream) {
      commitLocalStream(opts.initialStream)
    }
  }, [opts.initialStream, commitLocalStream])

  useEffect(() => {
    micRef.current = localMicOn
  }, [localMicOn])
  useEffect(() => {
    camRef.current = localCamOn
  }, [localCamOn])

  const patchPeerSubscribeStatus = useCallback((peerId: string, message: string | null) => {
    setPeerSubscribeStatus((prev) => {
      if (message == null || message === "") {
        if (!(peerId in prev)) return prev
        const next = { ...prev }
        delete next[peerId]
        return next
      }
      if (prev[peerId] === message) return prev
      return { ...prev, [peerId]: message }
    })
  }, [])

  const cleanupSub = useCallback(
    (remotePeerId: string, opts?: { clearTileStatus?: boolean }) => {
      const clearTile = opts?.clearTileStatus !== false
      const pc = subsRef.current.get(remotePeerId)
      if (pc) {
        pc.close()
        subsRef.current.delete(remotePeerId)
      }
      setRemoteStreams((prev) => {
        const n = { ...prev }
        delete n[remotePeerId]
        return n
      })
      if (clearTile) patchPeerSubscribeStatus(remotePeerId, null)
    },
    [patchPeerSubscribeStatus],
  )

  const subscribePeer = useCallback(
    async (remotePeerId: string, gen: number, wantVideo = true) => {
      if (remotePeerId === peerId) return
      if (subsRef.current.has(remotePeerId)) return
      const remoteShort = shortPeerId(remotePeerId)
      const t = startWebrtcTiming(`WHEP subscribe → ${remoteShort}`, {
        remote: remoteShort,
        wantVideo,
        sessionGen: gen,
      })
      t.mark("start")
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      subsRef.current.set(remotePeerId, pc)
      patchPeerSubscribeStatus(remotePeerId, "Согласование медиа…")
      /** Offer должен совпадать с потоком издателя: audio-only WHIP + video в offer ломает setRemoteDescription у Chrome. */
      pc.addTransceiver("audio", { direction: "recvonly" })
      if (wantVideo) {
        pc.addTransceiver("video", { direction: "recvonly" })
      }
      t.mark("transceivers_added")
      const iceLog = `WHEP ice → ${remoteShort}`
      let firstRemoteTrack = true
      pc.ontrack = (ev) => {
        const [stream] = ev.streams
        if (stream) {
          if (firstRemoteTrack) {
            firstRemoteTrack = false
            t.mark("first_ontrack", { kinds: stream.getTracks().map((x) => x.kind) })
          }
          setRemoteStreams((prev) => {
            const cur = prev[remotePeerId]
            if (cur?.id === stream.id) return prev
            return { ...prev, [remotePeerId]: stream }
          })
        }
      }
      pc.onconnectionstatechange = () => {
        if (gen !== sessionGen.current) return
        const st = pc.connectionState
        if (st === "connected") {
          logWebrtcTiming(`WHEP pc → ${remoteShort}`, "connectionState_connected", {
            iceConnectionState: pc.iceConnectionState,
          })
          patchPeerSubscribeStatus(remotePeerId, null)
        } else if (st === "failed") {
          logWebrtcTiming(`WHEP pc → ${remoteShort}`, "connectionState_failed", {
            iceConnectionState: pc.iceConnectionState,
          })
          patchPeerSubscribeStatus(remotePeerId, "Ошибка WebRTC (подписка)")
        } else if (st === "disconnected") {
          patchPeerSubscribeStatus(remotePeerId, "Соединение прервано")
        } else if (st === "connecting" || st === "new") {
          patchPeerSubscribeStatus(remotePeerId, "Установка соединения…")
        }
      }
      try {
        const offer = await pc.createOffer()
        t.mark("createOffer")
        await pc.setLocalDescription(offer)
        t.mark("setLocalDescription")
        await waitIceGathering(pc, 15_000, iceLog)
        t.mark("after_ice_gathering")
        patchPeerSubscribeStatus(remotePeerId, "Согласование медиа…")
        const raw = await postSdp("/srs/rtc/v1/whep/", remotePeerId, pc.localDescription!.sdp)
        t.mark("after_postSdp")
        const sdp = wantVideo ? sanitizeWhepAnswerForChrome(raw) : raw
        await pc.setRemoteDescription({ type: "answer", sdp })
        t.mark("setRemoteDescription_answer")
        t.end("subscribe_offer_answer_done")
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        t.end("subscribe_error", { error: msg.slice(0, 120) })
        cleanupSub(remotePeerId, { clearTileStatus: false })
        patchPeerSubscribeStatus(remotePeerId, `Ошибка: ${msg.slice(0, 72)}`)
      }
    },
    [cleanupSub, patchPeerSubscribeStatus, peerId],
  )

  const stopPublishing = useCallback(() => {
    logWebrtcTiming("WHIP", "stopPublishing", { peer: shortPeerId(peerId) })
    publishEpochRef.current += 1
    const pc = publishPcRef.current
    publishPcRef.current = null
    publishLiveRef.current = false
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "unpublish" }))
    }
    if (pc) {
      try {
        pc.close()
      } catch {
        /* ignore */
      }
    }
    setPublishLabel("Публикация выключена")
  }, [peerId])

  const startPublishing = useCallback(async (wsSessionGen: number) => {
    const stream = localStreamRef.current
    if (!stream || publishPcRef.current) return

    const pubT = startWebrtcTiming(`WHIP publish ${shortPeerId(peerId)}`, {
      peer: shortPeerId(peerId),
      wsSessionGen,
    })
    pubT.mark("start")

    const epochSnapshot = publishEpochRef.current
    const superseded = (): boolean => epochSnapshot !== publishEpochRef.current

    const releaseIfOurPc = (pc: RTCPeerConnection): void => {
      if (publishPcRef.current === pc) publishPcRef.current = null
      try {
        pc.close()
      } catch {
        /* ignore */
      }
    }

    setPublishLabel("Согласование медиа…")
    const audioTracks = stream.getAudioTracks().filter((t) => t.readyState === "live")
    const videoTracks = stream.getVideoTracks().filter((t) => t.readyState === "live")
    if (audioTracks.length === 0 && videoTracks.length === 0) {
      pubT.end("aborted_no_tracks")
      setPublishLabel("Нет медиапотока")
      return
    }

    pubT.mark("tracks_picked", {
      audioLive: audioTracks.length,
      videoLive: videoTracks.length,
    })

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    if (superseded()) {
      pc.close()
      pubT.end("aborted_superseded_after_pc_new")
      return
    }
    publishPcRef.current = pc
    pubT.mark("pc_created")

    const whipIceLog = `WHIP ice ${shortPeerId(peerId)}`
    pc.onconnectionstatechange = () => {
      if (wsSessionGen !== sessionGen.current) return
      const st = pc.connectionState
      if (st === "connected") {
        logWebrtcTiming(`WHIP pc ${shortPeerId(peerId)}`, "connectionState_connected", {
          iceConnectionState: pc.iceConnectionState,
        })
        publishLiveRef.current = true
        setPublishLabel("Медиа в эфире")
      } else if (st === "failed") {
        logWebrtcTiming(`WHIP pc ${shortPeerId(peerId)}`, "connectionState_failed", {
          iceConnectionState: pc.iceConnectionState,
        })
        setPublishLabel("Ошибка WebRTC (публикация)")
      } else if (st === "connecting" || st === "new") {
        setPublishLabel("Установка соединения…")
      }
    }

    for (const t of audioTracks) {
      t.enabled = micRef.current
      pc.addTrack(t, stream)
    }
    for (const t of videoTracks) {
      t.enabled = camRef.current
      pc.addTrack(t, stream)
    }
    if (videoTracks.length > 0) {
      applyH264VideoPreferences(pc)
    }

    try {
      const offer = await pc.createOffer()
      pubT.mark("createOffer")
      if (superseded() || wsSessionGen !== sessionGen.current) {
        releaseIfOurPc(pc)
        pubT.end("aborted_after_createOffer")
        return
      }
      await pc.setLocalDescription(offer)
      pubT.mark("setLocalDescription")
      if (superseded() || wsSessionGen !== sessionGen.current) {
        releaseIfOurPc(pc)
        pubT.end("aborted_after_setLocal")
        return
      }
      if (videoTracks.length > 0 && !sdpOfferIncludesH264Video(pc.localDescription?.sdp ?? "")) {
        setPublishLabel("Нет H.264 в предложении — SRS может отклонить публикацию")
      }
      await waitIceGathering(pc, 15_000, whipIceLog)
      pubT.mark("after_ice_gathering")
      if (superseded() || wsSessionGen !== sessionGen.current) {
        releaseIfOurPc(pc)
        pubT.end("aborted_after_ice")
        return
      }
      const raw = await postSdp("/srs/rtc/v1/whip/", peerId, pc.localDescription!.sdp)
      pubT.mark("after_postSdp")
      if (superseded() || wsSessionGen !== sessionGen.current) {
        releaseIfOurPc(pc)
        pubT.end("aborted_after_postSdp")
        return
      }
      await pc.setRemoteDescription({ type: "answer", sdp: raw })
      pubT.mark("setRemoteDescription_answer")
      if (superseded() || wsSessionGen !== sessionGen.current) {
        releaseIfOurPc(pc)
        pubT.end("aborted_after_setRemote")
        return
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ t: "publishing" }))
      }
      pubT.mark("ws_publishing_sent")
      publishLiveRef.current = true
      setPublishLabel("Медиа в эфире")
      pubT.end("publish_flow_done")
    } catch (e) {
      releaseIfOurPc(pc)
      const msg = e instanceof Error ? e.message : String(e)
      pubT.end("publish_error", { error: msg.slice(0, 120) })
      setPublishLabel(`Ошибка: ${msg.slice(0, 120)}`)
    }
  }, [peerId])

  /** SRS: после audio-only нельзя дотянуть видео тем же WHIP — полный стоп, пауза, новый publish. */
  const restartPublishing = useCallback(async () => {
    const rt = startWebrtcTiming("WHIP restartPublishing", { peer: shortPeerId(peerId) })
    const wsGen = sessionGen.current
    rt.mark("stopPublishing_called")
    stopPublishing()
    const delayMs = 450
    await new Promise((r) => setTimeout(r, delayMs))
    rt.mark("after_srs_delay", { delayMs })
    if (wsGen !== sessionGen.current) {
      rt.end("aborted_sessionGen_changed")
      return
    }
    await startPublishing(wsGen)
    rt.end("restartPublishing_done")
  }, [peerId, startPublishing, stopPublishing])

  const subscribeAllPublishers = useCallback(
    (list: RoomMember[], gen: number) => {
      const self = peerId
      let n = 0
      for (const m of list) {
        if (m.peerId !== self && m.publishing) {
          n++
          void subscribePeer(m.peerId, gen, m.camOn)
        }
      }
      setSubscribeLabel(n ? `Подписок: ${n}` : "Нет удалённых эфиров")
      if (n > 0) {
        logWebrtcTiming("subscribeAllPublishers", "scheduled", { count: n, sessionGen: gen })
      }
    },
    [peerId, subscribePeer],
  )

  const handleInbound = useCallback(
    (msg: SignalingInbound, gen: number) => {
      switch (msg.t) {
        case "state": {
          signalingTimingRef.current?.mark("inbound_state_received", {
            members: msg.members.length,
          })
          joinedRef.current = true
          setMembers(msg.members)
          subscribeAllPublishers(msg.members, gen)
          void startPublishing(gen)
          signalingTimingRef.current?.end("state_handled_while_publish_subscribe_async")
          signalingTimingRef.current = null
          break
        }
        case "peer-join": {
          setMembers((prev) => {
            if (prev.some((m) => m.peerId === msg.peerId)) return prev
            return [
              ...prev,
              {
                peerId: msg.peerId,
                nickname: msg.nickname,
                publishing: msg.publishing,
                micOn: msg.micOn,
                camOn: msg.camOn,
              },
            ]
          })
          break
        }
        case "peer-leave": {
          cleanupSub(msg.peerId)
          setMembers((prev) => prev.filter((m) => m.peerId !== msg.peerId))
          break
        }
        case "peer-publish": {
          logWebrtcTiming("signaling", "peer-publish", { from: shortPeerId(msg.peerId) })
          setMembers((prev) => {
            const next = prev.map((m) => (m.peerId === msg.peerId ? { ...m, publishing: true } : m))
            if (msg.peerId !== peerId) {
              const remote = next.find((m) => m.peerId === msg.peerId)
              const wantVideo = remote?.camOn ?? true
              queueMicrotask(() => void subscribePeer(msg.peerId, gen, wantVideo))
            }
            return next
          })
          break
        }
        case "peer-unpublish": {
          logWebrtcTiming("signaling", "peer-unpublish", { from: shortPeerId(msg.peerId) })
          cleanupSub(msg.peerId)
          setMembers((prev) => prev.map((m) => (m.peerId === msg.peerId ? { ...m, publishing: false } : m)))
          break
        }
        case "peer-presence": {
          setMembers((prev) =>
            prev.map((m) => (m.peerId === msg.peerId ? { ...m, micOn: msg.micOn, camOn: msg.camOn } : m)),
          )
          break
        }
        case "error": {
          setMediaError(msg.message)
          break
        }
        default:
          break
      }
    },
    [cleanupSub, peerId, startPublishing, subscribeAllPublishers, subscribePeer],
  )

  const inboundRef = useRef(handleInbound)
  useEffect(() => {
    inboundRef.current = handleInbound
  }, [handleInbound])

  useEffect(() => {
    const gen = ++sessionGen.current
    joinedRef.current = false
    const sigT = startWebrtcTiming("signaling WS", {
      roomId: shortPeerId(opts.roomId),
      sessionGen: gen,
    })
    signalingTimingRef.current = sigT
    sigT.mark("effect_mount")
    setWsLabel("Подключение…")
    const wsUrl = signalingWsUrl()
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    sigT.mark("websocket_created", {
      urlHost: (() => {
        try {
          return new URL(wsUrl).host
        } catch {
          return "?"
        }
      })(),
    })

    ws.onopen = () => {
      if (gen !== sessionGen.current) return
      sigT.mark("ws_open_join_sending")
      setWsLabel("Сигналинг активен")
      ws.send(
        JSON.stringify({
          t: "join",
          roomId: opts.roomId,
          peerId,
          nickname: opts.nickname,
        }),
      )
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "ping" }))
      }, 25_000)
    }

    ws.onmessage = (ev) => {
      if (gen !== sessionGen.current) return
      try {
        const raw = String(ev.data)
        const msg = JSON.parse(raw) as SignalingInbound
        if (msg.t !== "state" && msg.t !== "pong") {
          logWebrtcTiming("signaling WS", "inbound_message", { t: msg.t, bytes: raw.length })
        }
        inboundRef.current(msg, gen)
      } catch {
        /* ignore */
      }
    }

    ws.onerror = () => {
      if (gen !== sessionGen.current) return
      setWsLabel("Ошибка сокета")
    }

    ws.onclose = () => {
      if (gen !== sessionGen.current) return
      if (signalingTimingRef.current === sigT) {
        sigT.end("ws_closed_before_state")
        signalingTimingRef.current = null
      }
      setWsLabel("Отключено от сигналинга")
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }

    return () => {
      signalingTimingRef.current = null
      /* На размонтировании нужны актуальные sessionGen/subs, а не снимок на открытии эффекта. */
      /* eslint-disable react-hooks/exhaustive-deps */
      sessionGen.current++
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      ws.close()
      wsRef.current = null
      stopPublishing()
      for (const id of [...subsRef.current.keys()]) cleanupSub(id)
      setPeerSubscribeStatus({})
      const toStop = localStreamRef.current
      toStop?.getTracks().forEach(stopTrack)
      commitLocalStream(null)
      /* eslint-enable react-hooks/exhaustive-deps */
    }
  }, [opts.roomId, opts.nickname, peerId, cleanupSub, stopPublishing, commitLocalStream])

  const sendPresence = useCallback(() => {
    const ws = wsRef.current
    if (ws?.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ t: "presence", micOn: micRef.current, camOn: camRef.current }))
  }, [])

  const toggleMic = useCallback(() => {
    setLocalMicOn((m) => {
      const next = !m
      micRef.current = next
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = next
      })
      queueMicrotask(sendPresence)
      return next
    })
  }, [sendPresence])

  const toggleCam = useCallback(async () => {
    const ct = startWebrtcTiming("toggleCam", { peer: shortPeerId(peerId) })
    const next = !camRef.current
    ct.mark("start", { camWillBeOn: next })
    camRef.current = next
    setLocalCamOn(next)
    const stream = localStreamRef.current
    if (!stream) {
      ct.end("aborted_no_stream")
      return
    }

    if (!next) {
      for (const t of [...stream.getVideoTracks()]) {
        stream.removeTrack(t)
        stopTrack(t)
      }
      ct.mark("video_tracks_removed")
    } else {
      try {
        const gm0 = performance.now()
        const v = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        ct.mark("getUserMedia_video_done", { ms: Math.round((performance.now() - gm0) * 10) / 10 })
        const vt = v.getVideoTracks()[0]
        if (vt) stream.addTrack(vt)
      } catch (e) {
        camRef.current = false
        setLocalCamOn(false)
        setMediaError(e instanceof Error ? e.message : "Камера недоступна")
        ct.end("getUserMedia_failed")
        return
      }
    }

    commitLocalStream(stream)
    sendPresence()
    ct.mark("presence_sent")
    if (joinedRef.current) {
      await restartPublishing()
      ct.mark("after_restartPublishing")
    }
    ct.end("toggleCam_done")
  }, [commitLocalStream, peerId, restartPublishing, sendPresence])

  const leave = useCallback(() => {
    sessionGen.current++
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    wsRef.current?.close()
    wsRef.current = null
    stopPublishing()
    for (const id of [...subsRef.current.keys()]) cleanupSub(id)
    setPeerSubscribeStatus({})
    const toStop = localStreamRef.current
    toStop?.getTracks().forEach(stopTrack)
    commitLocalStream(null)
  }, [cleanupSub, commitLocalStream, stopPublishing])

  return {
    peerId,
    members,
    localStream,
    remoteStreams,
    peerSubscribeStatus,
    localMicOn,
    localCamOn,
    wsLabel,
    publishLabel,
    subscribeLabel,
    mediaError,
    toggleMic,
    toggleCam,
    leave,
  }
}
