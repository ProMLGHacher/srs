import { useCallback, useEffect, useRef, useState } from "react"
import type { RoomMember, SignalingInbound } from "@/types/member"
import { ICE_SERVERS } from "@/lib/webrtc/constants"
import { waitIceGathering } from "@/lib/webrtc/waitIceGathering"
import { postSdp } from "@/lib/webrtc/postSdp"
import { sanitizeWhepAnswerForChrome } from "@/lib/webrtc/sanitizeWhepAnswer"
import { applyH264VideoPreferences, sdpOfferIncludesH264Video } from "@/lib/webrtc/h264Preference"

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
  const peerIdRef = useRef(crypto.randomUUID())
  const [members, setMembers] = useState<RoomMember[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(opts.initialStream)

  useEffect(() => {
    if (opts.initialStream) {
      localStreamRef.current = opts.initialStream
      setLocalStream(opts.initialStream)
    }
  }, [opts.initialStream])
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

  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])
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
      if (remotePeerId === peerIdRef.current) return
      if (subsRef.current.has(remotePeerId)) return
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      subsRef.current.set(remotePeerId, pc)
      patchPeerSubscribeStatus(remotePeerId, "Согласование медиа…")
      /** Offer должен совпадать с потоком издателя: audio-only WHIP + video в offer ломает setRemoteDescription у Chrome. */
      pc.addTransceiver("audio", { direction: "recvonly" })
      if (wantVideo) {
        pc.addTransceiver("video", { direction: "recvonly" })
      }
      pc.ontrack = (ev) => {
        const [stream] = ev.streams
        if (stream)
          setRemoteStreams((prev) => {
            const cur = prev[remotePeerId]
            if (cur?.id === stream.id) return prev
            return { ...prev, [remotePeerId]: stream }
          })
      }
      pc.onconnectionstatechange = () => {
        if (gen !== sessionGen.current) return
        const st = pc.connectionState
        if (st === "connected") {
          patchPeerSubscribeStatus(remotePeerId, null)
        } else if (st === "failed") {
          patchPeerSubscribeStatus(remotePeerId, "Ошибка WebRTC (подписка)")
        } else if (st === "disconnected") {
          patchPeerSubscribeStatus(remotePeerId, "Соединение прервано")
        } else if (st === "connecting" || st === "new") {
          patchPeerSubscribeStatus(remotePeerId, "Установка соединения…")
        }
      }
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitIceGathering(pc)
        patchPeerSubscribeStatus(remotePeerId, "Согласование медиа…")
        const raw = await postSdp("/srs/rtc/v1/whep/", remotePeerId, pc.localDescription!.sdp)
        const sdp = wantVideo ? sanitizeWhepAnswerForChrome(raw) : raw
        await pc.setRemoteDescription({ type: "answer", sdp })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        cleanupSub(remotePeerId, { clearTileStatus: false })
        patchPeerSubscribeStatus(remotePeerId, `Ошибка: ${msg.slice(0, 72)}`)
      }
    },
    [cleanupSub, patchPeerSubscribeStatus],
  )

  const stopPublishing = useCallback(() => {
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
  }, [])

  const startPublishing = useCallback(async (wsSessionGen: number) => {
    const stream = localStreamRef.current
    if (!stream || publishPcRef.current) return

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
      setPublishLabel("Нет медиапотока")
      return
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    if (superseded()) {
      pc.close()
      return
    }
    publishPcRef.current = pc

    pc.onconnectionstatechange = () => {
      if (wsSessionGen !== sessionGen.current) return
      const st = pc.connectionState
      if (st === "connected") {
        publishLiveRef.current = true
        setPublishLabel("Медиа в эфире")
      } else if (st === "failed") {
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
      if (superseded() || wsSessionGen !== sessionGen.current) {
        releaseIfOurPc(pc)
        return
      }
      await pc.setLocalDescription(offer)
      if (superseded() || wsSessionGen !== sessionGen.current) {
        releaseIfOurPc(pc)
        return
      }
      if (videoTracks.length > 0 && !sdpOfferIncludesH264Video(pc.localDescription?.sdp ?? "")) {
        setPublishLabel("Нет H.264 в предложении — SRS может отклонить публикацию")
      }
      await waitIceGathering(pc)
      if (superseded() || wsSessionGen !== sessionGen.current) {
        releaseIfOurPc(pc)
        return
      }
      const raw = await postSdp("/srs/rtc/v1/whip/", peerIdRef.current, pc.localDescription!.sdp)
      if (superseded() || wsSessionGen !== sessionGen.current) {
        releaseIfOurPc(pc)
        return
      }
      await pc.setRemoteDescription({ type: "answer", sdp: raw })
      if (superseded() || wsSessionGen !== sessionGen.current) {
        releaseIfOurPc(pc)
        return
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ t: "publishing" }))
      }
      publishLiveRef.current = true
      setPublishLabel("Медиа в эфире")
    } catch (e) {
      releaseIfOurPc(pc)
      const msg = e instanceof Error ? e.message : String(e)
      setPublishLabel(`Ошибка: ${msg.slice(0, 120)}`)
    }
  }, [])

  /** SRS: после audio-only нельзя дотянуть видео тем же WHIP — полный стоп, пауза, новый publish. */
  const restartPublishing = useCallback(async () => {
    const wsGen = sessionGen.current
    stopPublishing()
    await new Promise((r) => setTimeout(r, 450))
    if (wsGen !== sessionGen.current) return
    await startPublishing(wsGen)
  }, [startPublishing, stopPublishing])

  const subscribeAllPublishers = useCallback(
    (list: RoomMember[], gen: number) => {
      const self = peerIdRef.current
      let n = 0
      for (const m of list) {
        if (m.peerId !== self && m.publishing) {
          n++
          void subscribePeer(m.peerId, gen, m.camOn)
        }
      }
      setSubscribeLabel(n ? `Подписок: ${n}` : "Нет удалённых эфиров")
    },
    [subscribePeer],
  )

  const handleInbound = useCallback(
    (msg: SignalingInbound, gen: number) => {
      switch (msg.t) {
        case "state": {
          joinedRef.current = true
          setMembers(msg.members)
          subscribeAllPublishers(msg.members, gen)
          void startPublishing(gen)
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
          setMembers((prev) => {
            const next = prev.map((m) => (m.peerId === msg.peerId ? { ...m, publishing: true } : m))
            if (msg.peerId !== peerIdRef.current) {
              const remote = next.find((m) => m.peerId === msg.peerId)
              const wantVideo = remote?.camOn ?? true
              queueMicrotask(() => void subscribePeer(msg.peerId, gen, wantVideo))
            }
            return next
          })
          break
        }
        case "peer-unpublish": {
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
    [cleanupSub, startPublishing, subscribeAllPublishers, subscribePeer],
  )

  const inboundRef = useRef(handleInbound)
  inboundRef.current = handleInbound

  useEffect(() => {
    const gen = ++sessionGen.current
    joinedRef.current = false
    setWsLabel("Подключение…")
    const ws = new WebSocket(signalingWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      if (gen !== sessionGen.current) return
      setWsLabel("Сигналинг активен")
      ws.send(
        JSON.stringify({
          t: "join",
          roomId: opts.roomId,
          peerId: peerIdRef.current,
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
        const msg = JSON.parse(String(ev.data)) as SignalingInbound
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
      setWsLabel("Отключено от сигналинга")
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }

    return () => {
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
      localStreamRef.current?.getTracks().forEach(stopTrack)
      localStreamRef.current = null
      setLocalStream(null)
    }
  }, [opts.roomId, opts.nickname, cleanupSub, stopPublishing])

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
    const next = !camRef.current
    camRef.current = next
    setLocalCamOn(next)
    const stream = localStreamRef.current
    if (!stream) return

    if (!next) {
      for (const t of [...stream.getVideoTracks()]) {
        stream.removeTrack(t)
        stopTrack(t)
      }
    } else {
      try {
        const v = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        const vt = v.getVideoTracks()[0]
        if (vt) stream.addTrack(vt)
      } catch (e) {
        camRef.current = false
        setLocalCamOn(false)
        setMediaError(e instanceof Error ? e.message : "Камера недоступна")
        return
      }
    }

    setLocalStream(stream)
    sendPresence()
    if (joinedRef.current) await restartPublishing()
  }, [restartPublishing, sendPresence])

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
    localStreamRef.current?.getTracks().forEach(stopTrack)
    localStreamRef.current = null
    setLocalStream(null)
  }, [cleanupSub, stopPublishing])

  return {
    peerId: peerIdRef.current,
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
