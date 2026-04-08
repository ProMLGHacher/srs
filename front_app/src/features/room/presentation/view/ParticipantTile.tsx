import type { RoomMember } from "../../domain/model/roomMember"
import { Badge, Card, Input } from "@kvatum/ui"
import { useEffect, useRef, useState } from "react"

type ParticipantTileProps = {
  member: RoomMember
  isLocal: boolean
  /** Показать видео (есть поток и камера «включена» в UI). */
  showVideo: boolean
  stream: MediaStream | null | undefined
  /** Громкость удалённого участника 0..1 */
  remoteVolume?: number
  onVolumeChange?: (peerId: string, volume01: number) => void
}

function MicCamIcons({ micOn, camOn }: { micOn: boolean; camOn: boolean }) {
  return (
    <div className="absolute right-3 top-3 flex items-center gap-1">
      <Badge tone={micOn ? "success" : "danger"}>{micOn ? "MIC" : "MUTED"}</Badge>
      <Badge tone={camOn ? "primary" : "neutral"}>{camOn ? "CAM" : "NO CAM"}</Badge>
    </div>
  )
}

export function ParticipantTile({
  member,
  isLocal,
  showVideo,
  stream,
  remoteVolume = 1,
  onVolumeChange,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.srcObject = showVideo && stream ? stream : null
    if (showVideo && stream) void v.play().catch(() => {})
  }, [showVideo, stream])

  useEffect(() => {
    const a = audioRef.current
    if (!a || isLocal) return
    a.srcObject = stream ?? null
    a.volume = remoteVolume
    if (stream) void a.play().catch(() => {})
  }, [stream, remoteVolume, isLocal])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [menuOpen])

  return (
    <Card
      className="relative aspect-video overflow-hidden border-white/15 p-0"
      onContextMenu={(e) => {
        if (isLocal || !onVolumeChange) return
        e.preventDefault()
        setMenuOpen((o) => !o)
      }}
    >
      {!isLocal && stream?.getAudioTracks().length ? (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      ) : null}

      {showVideo && stream ? (
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${isLocal ? "transform-[scaleX(-1)]" : ""}`}
          autoPlay
          playsInline
          muted={isLocal}
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#2f4a70_0%,#1a2230_45%,#131922_100%)] px-2">
          <span className="text-center text-xl font-bold uppercase tracking-[0.14em] text-white/90 md:text-2xl">
            {member.nickname || member.peerId.slice(0, 8)}
          </span>
        </div>
      )}

      {showVideo && stream ? (
        <span className="absolute bottom-3 left-3 max-w-[85%] truncate rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur">
          {member.nickname}
          {isLocal ? " (вы)" : ""}
        </span>
      ) : null}

      <MicCamIcons micOn={member.micOn} camOn={member.camOn} />

      {menuOpen && !isLocal && onVolumeChange ? (
        <div
          ref={menuRef}
          className="absolute bottom-14 right-3 z-10 w-48 rounded-2xl border border-white/20 bg-[#111722]/95 p-3 shadow-2xl backdrop-blur"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-xs tracking-wide text-white/70">ГРОМКОСТЬ</p>
          <Input
            type="range"
            min={0}
            max={100}
            className="h-2 border-0 bg-transparent p-0"
            value={Math.round(remoteVolume * 100)}
            onChange={(e) => onVolumeChange(member.peerId, Number(e.target.value) / 100)}
          />
        </div>
      ) : null}
    </Card>
  )
}
