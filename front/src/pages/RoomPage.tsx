import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { RoomHeader } from "@/components/room/RoomHeader"
import { RoomControls } from "@/components/room/RoomControls"
import { TileGrid } from "@/components/room/TileGrid"
import { useRoomSession } from "@/hooks/useRoomSession"
import { loadDisplayName } from "@/lib/displayNameStorage"
import { releasePendingJoinStream, takePendingJoinStream } from "@/lib/joinTransfer"
import { isValidRoomId } from "@/lib/parseRoomId"
import { useRoomUiStore } from "@/stores/roomUiStore"

type LocationState = {
  nickname?: string
  micOn?: boolean
  camOn?: boolean
}

function InvalidRoom() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <p className="text-center text-sm text-muted-foreground">
        Некорректная ссылка: код комнаты — 16 символов (hex), как в ответе «Создать комнату».
      </p>
      <button type="button" className="text-sm text-foreground underline" onClick={() => navigate("/")}>
        На главную
      </button>
    </div>
  )
}

function RoomSessionView({
  roomId,
  nickname,
  initialStream,
  startMic,
  startCam,
}: {
  roomId: string
  nickname: string
  initialStream: MediaStream | null
  startMic: boolean
  startCam: boolean
}) {
  const navigate = useNavigate()
  const setPinnedPeerId = useRoomUiStore((s) => s.setPinnedPeerId)

  useEffect(() => {
    return () => setPinnedPeerId(null)
  }, [setPinnedPeerId])

  const session = useRoomSession({
    roomId,
    nickname,
    initialStream,
    startMicOn: startMic,
    startCamOn: startCam,
  })

  const pinnedPeerId = useRoomUiStore((s) => s.pinnedPeerId)

  const getStream = useMemo(() => {
    return (peerId: string): MediaStream | undefined => {
      if (peerId === session.peerId) return session.localStream ?? undefined
      return session.remoteStreams[peerId]
    }
  }, [session.localStream, session.peerId, session.remoteStreams])

  const handleLeave = (): void => {
    session.leave()
    navigate("/", { replace: true })
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <RoomHeader
        roomId={roomId}
        wsLabel={session.wsLabel}
        publishLabel={session.publishLabel}
        subscribeLabel={session.subscribeLabel}
        mediaError={session.mediaError}
      />
      <TileGrid
        localPeerId={session.peerId}
        members={session.members}
        localMicOn={session.localMicOn}
        localCamOn={session.localCamOn}
        getStream={getStream}
        pinnedPeerId={pinnedPeerId}
        onPin={setPinnedPeerId}
        onUnpin={() => setPinnedPeerId(null)}
      />
      <RoomControls
        roomId={roomId}
        micOn={session.localMicOn}
        camOn={session.localCamOn}
        onToggleMic={session.toggleMic}
        onToggleCam={session.toggleCam}
        onLeave={handleLeave}
      />
    </div>
  )
}

function RoomPageInner({
  roomId,
  nickname,
  startMic,
  startCam,
}: {
  roomId: string
  nickname: string
  startMic: boolean
  startCam: boolean
}) {
  const [initialStream, setInitialStream] = useState<MediaStream | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let s = takePendingJoinStream()
    if (!s) {
      void (async () => {
        try {
          s = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: startCam ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          })
          s.getAudioTracks().forEach((t) => {
            t.enabled = startMic
          })
        } catch {
          s = null
        }
        setInitialStream(s)
        setReady(true)
      })()
    } else {
      setInitialStream(s)
      setReady(true)
    }
  }, [startCam, startMic])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Подготовка медиа…
      </div>
    )
  }

  return (
    <RoomSessionView
      roomId={roomId}
      nickname={nickname}
      initialStream={initialStream}
      startMic={startMic}
      startCam={startCam}
    />
  )
}

export function RoomPage() {
  const { roomId: roomParam } = useParams<{ roomId: string }>()
  const location = useLocation()
  const state = (location.state ?? {}) as LocationState

  const roomId = roomParam?.toLowerCase() ?? ""
  const valid = isValidRoomId(roomId)

  useEffect(() => {
    if (!valid) {
      releasePendingJoinStream()
    }
  }, [valid, roomId])

  const nickname = (state.nickname?.trim() || loadDisplayName()).trim() || "Участник"
  const startMic = state.micOn !== false
  const startCam = state.camOn !== false

  if (!valid) return <InvalidRoom />

  return <RoomPageInner roomId={roomId} nickname={nickname} startMic={startMic} startCam={startCam} />
}
