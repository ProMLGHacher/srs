import { useCallback, useEffect, useRef, useState } from "react"
import type { RoomMember } from "@/types/member"
import { ICE_SERVERS } from "@/lib/webrtc/constants"
import { fastStartVideoConstraints } from "@/lib/webrtc/cameraConstraints"

export type UseVoiceSfuSessionOpts = {
  roomId: string
  nickname: string
  initialStream: MediaStream | null
  startMicOn: boolean
  startCamOn: boolean
}

type WsPeer = {
  id: string
  name: string
  micOn: boolean
  camOn: boolean
  publishing: boolean
}

type ServerMsg = {
  type: string
  peerId?: string
  leftPeerId?: string
  peers?: WsPeer[]
  peer?: WsPeer
  kind?: string
  sdp?: string
  candidate?: RTCIceCandidateInit
  message?: string
  micOn?: boolean
  camOn?: boolean
}

function buildWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined
  if (explicit?.trim()) return explicit.trim()
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${location.host}/ws`
}

function buildIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS_JSON as string | undefined
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RTCIceServer[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {
      /* ignore */
    }
  }
  return ICE_SERVERS
}

function toMember(p: WsPeer): RoomMember {
  return {
    peerId: p.id,
    nickname: p.name,
    publishing: p.publishing,
    micOn: p.micOn,
    camOn: p.camOn,
  }
}

export function useVoiceSfuSession(opts: UseVoiceSfuSessionOpts) {
  const [peerId, setPeerId] = useState<string | null>(null)
  const [members, setMembers] = useState<RoomMember[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(opts.initialStream)
  const [localMicOn, setLocalMicOn] = useState(opts.startMicOn)
  const [localCamOn, setLocalCamOn] = useState(opts.startCamOn)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [wsLabel, setWsLabel] = useState("Подключение…")
  const [publishLabel, setPublishLabel] = useState("Ожидание сигналинга")
  const [subscribeLabel, setSubscribeLabel] = useState("—")
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [peerSubscribeStatus, setPeerSubscribeStatus] = useState<Record<string, string>>({})

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(opts.initialStream)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])
  const micRef = useRef(opts.startMicOn)
  const camRef = useRef(opts.startCamOn)
  const sessionGen = useRef(0)

  const commitLocalStream = useCallback((next: MediaStream | null) => {
    localStreamRef.current = next
    setLocalStream(next)
  }, [])

  useEffect(() => {
    if (opts.initialStream) commitLocalStream(opts.initialStream)
  }, [opts.initialStream, commitLocalStream])

  useEffect(() => {
    micRef.current = localMicOn
  }, [localMicOn])
  useEffect(() => {
    camRef.current = localCamOn
  }, [localCamOn])

  const patchPeerSubscribeStatus = useCallback((pid: string, message: string | null) => {
    setPeerSubscribeStatus((prev) => {
      if (message == null || message === "") {
        if (!(pid in prev)) return prev
        const next = { ...prev }
        delete next[pid]
        return next
      }
      if (prev[pid] === message) return prev
      return { ...prev, [pid]: message }
    })
  }, [])

  const sendJson = useCallback((obj: unknown) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
  }, [])

  const sendPresence = useCallback(() => {
    sendJson({
      type: "presence",
      micOn: micRef.current,
      camOn: camRef.current,
    })
  }, [sendJson])

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    const q = pendingIceRef.current
    pendingIceRef.current = []
    for (const c of q) {
      try {
        await pc.addIceCandidate(c)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const handleServerSignal = useCallback(
    async (msg: ServerMsg) => {
      const pc = pcRef.current
      if (!pc) return
      if (msg.kind === "answer" && msg.sdp) {
        await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp })
        await flushPendingIce(pc)
        return
      }
      if (msg.kind === "offer" && msg.sdp) {
        await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp })
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sendJson({ type: "signal", kind: "answer", sdp: answer.sdp ?? "" })
        await flushPendingIce(pc)
        return
      }
      if (msg.kind === "ice" && msg.candidate) {
        if (!pc.remoteDescription) {
          pendingIceRef.current.push(msg.candidate)
          return
        }
        try {
          await pc.addIceCandidate(msg.candidate)
        } catch {
          /* ignore */
        }
      }
    },
    [flushPendingIce, sendJson],
  )

  const teardown = useCallback(() => {
    pendingIceRef.current = []
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setRemoteStreams({})
    setPeerId(null)
    setMembers([])
    setWsLabel("Отключено")
    setPublishLabel("—")
    setSubscribeLabel("—")
    setPeerSubscribeStatus({})
  }, [])

  useEffect(() => {
    const gen = ++sessionGen.current
    setMediaError(null)
    setWsLabel("Подключение…")
    setSubscribeLabel("—")

    const stream = opts.initialStream
    if (!stream) {
      setMediaError("Нет локального потока")
      return
    }

    let ws: WebSocket
    try {
      ws = new WebSocket(buildWsUrl())
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "WebSocket")
      return
    }
    wsRef.current = ws

    const onMsg = async (ev: MessageEvent) => {
      if (gen !== sessionGen.current) return
      let msg: ServerMsg
      try {
        msg = JSON.parse(ev.data as string) as ServerMsg
      } catch {
        return
      }
      if (msg.type === "error") {
        setMediaError(msg.message ?? "Ошибка")
        return
      }
      if (msg.type === "joined" && msg.peerId) {
        setPeerId(msg.peerId)
        setWsLabel("Сигналинг: подключено")
        const self: RoomMember = {
          peerId: msg.peerId,
          nickname: opts.nickname,
          publishing: false,
          micOn: opts.startMicOn,
          camOn: opts.startCamOn,
        }
        const others = (msg.peers ?? []).map(toMember)
        setMembers([self, ...others])

        const pc = new RTCPeerConnection({ iceServers: buildIceServers() })
        pcRef.current = pc

        pc.onconnectionstatechange = () => {
          if (gen !== sessionGen.current) return
          const st = pc.connectionState
          setPublishLabel(`WebRTC: ${st}`)
          if (st === "failed") setMediaError("WebRTC: соединение не установлено (проверьте VOICE_PUBLIC_IP и UDP)")
        }
        pc.oniceconnectionstatechange = () => {
          if (gen !== sessionGen.current) return
          setPublishLabel(`ICE: ${pc.iceConnectionState}`)
        }

        pc.ontrack = (ev) => {
          if (gen !== sessionGen.current) return
          const sid = ev.streams[0]?.id
          if (!sid) return
          setRemoteStreams((prev) => {
            let s = prev[sid]
            if (!s) {
              s = new MediaStream()
            }
            const exists = s.getTracks().some((t) => t.id === ev.track.id)
            if (!exists) s.addTrack(ev.track)
            return { ...prev, [sid]: s }
          })
          setMembers((prev) =>
            prev.map((m) => (m.peerId === sid ? { ...m, publishing: true } : m)),
          )
          patchPeerSubscribeStatus(sid, null)
        }

        pc.onicecandidate = (ev) => {
          if (!ev.candidate) return
          sendJson({ type: "signal", kind: "ice", candidate: ev.candidate.toJSON() })
        }

        for (const t of stream.getTracks()) {
          pc.addTrack(t, stream)
        }

        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          sendJson({ type: "signal", kind: "offer", sdp: offer.sdp ?? "" })
        } catch (e) {
          setMediaError(e instanceof Error ? e.message : "createOffer")
        }
        return
      }

      if (msg.type === "peer_joined" && msg.peer) {
        setMembers((prev) => [...prev, toMember(msg.peer!)])
        return
      }
      if (msg.type === "peer_left" && msg.leftPeerId) {
        setMembers((prev) => prev.filter((m) => m.peerId !== msg.leftPeerId))
        setRemoteStreams((prev) => {
          const n = { ...prev }
          delete n[msg.leftPeerId!]
          return n
        })
        return
      }
      if (msg.type === "peer_presence" && msg.peerId) {
        setMembers((prev) =>
          prev.map((m) =>
            m.peerId === msg.peerId
              ? { ...m, micOn: msg.micOn ?? m.micOn, camOn: msg.camOn ?? m.camOn }
              : m,
          ),
        )
        return
      }
      if (msg.type === "signal") {
        await handleServerSignal(msg)
      }
    }

    ws.onmessage = (ev) => void onMsg(ev)
    ws.onclose = () => {
      if (gen !== sessionGen.current) return
      setWsLabel("Сигналинг: отключено")
    }

    void new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error("WebSocket"))
    })
      .then(() => {
        if (gen !== sessionGen.current) return
        ws.send(
          JSON.stringify({
            type: "join",
            room: opts.roomId,
            name: opts.nickname,
            micOn: opts.startMicOn,
            camOn: opts.startCamOn,
          }),
        )
      })
      .catch(() => {
        if (gen !== sessionGen.current) return
        setMediaError("Не удалось подключиться к сигналингу")
      })

    return () => {
      sessionGen.current += 1
      teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сессия на комнату/ник/стартовый поток
  }, [opts.roomId, opts.nickname, opts.initialStream, opts.startMicOn, opts.startCamOn])

  const toggleMic = useCallback(() => {
    const next = !micRef.current
    micRef.current = next
    setLocalMicOn(next)
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next
    })
    sendPresence()
  }, [sendPresence])

  const toggleCam = useCallback(async () => {
    const next = !camRef.current
    camRef.current = next
    setLocalCamOn(next)

    const pc = pcRef.current
    let stream = localStreamRef.current
    if (!stream) return

    const videoTracks = stream.getVideoTracks()

    if (next) {
      if (videoTracks.length === 0) {
        try {
          const v = await navigator.mediaDevices.getUserMedia({ video: fastStartVideoConstraints })
          const vt = v.getVideoTracks()[0]
          if (vt) {
            stream.addTrack(vt)
            commitLocalStream(new MediaStream(stream.getTracks()))
            if (pc) pc.addTrack(vt, stream)
          }
        } catch (e) {
          camRef.current = !next
          setLocalCamOn(!next)
          setMediaError(e instanceof Error ? e.message : "Камера")
          return
        }
      } else {
        videoTracks.forEach((t) => {
          t.enabled = true
        })
      }
    } else {
      videoTracks.forEach((t) => {
        t.enabled = false
      })
    }

    if (pc && pc.signalingState !== "closed") {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendJson({ type: "signal", kind: "offer", sdp: offer.sdp ?? "" })
      } catch {
        /* ignore */
      }
    }
    sendPresence()
  }, [commitLocalStream, sendJson, sendPresence])

  const leave = useCallback(() => {
    sessionGen.current += 1
    teardown()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
  }, [teardown])

  const remoteCount = Object.keys(remoteStreams).length
  useEffect(() => {
    setSubscribeLabel(remoteCount ? `Удалённых потоков: ${remoteCount}` : "—")
  }, [remoteCount])

  return {
    peerId: peerId ?? "",
    members,
    localStream,
    remoteStreams,
    localMicOn,
    localCamOn,
    toggleMic,
    toggleCam,
    leave,
    wsLabel,
    publishLabel,
    subscribeLabel,
    mediaError,
    peerSubscribeStatus,
  }
}
