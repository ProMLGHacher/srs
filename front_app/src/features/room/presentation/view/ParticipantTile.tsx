import type { RoomMember } from "../../domain/model/roomMember"
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
    <div className="absolute right-2 top-2 flex gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
      <span title="Микрофон">{micOn ? "🎤" : "🔇"}</span>
      <span title="Камера">{camOn ? "📷" : "📷̸"}</span>
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
    <div
      className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-zinc-900"
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
          className={`h-full w-full object-cover ${isLocal ? "[transform:scaleX(-1)]" : ""}`}
          autoPlay
          playsInline
          muted={isLocal}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-2">
          <span className="text-center text-xl font-bold uppercase tracking-wide text-white/90 md:text-2xl">
            {member.nickname || member.peerId.slice(0, 8)}
          </span>
        </div>
      )}

      {showVideo && stream ? (
        <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded bg-black/60 px-2 py-1 text-xs text-white">
          {member.nickname}
          {isLocal ? " (вы)" : ""}
        </span>
      ) : null}

      <MicCamIcons micOn={member.micOn} camOn={member.camOn} />

      {menuOpen && !isLocal && onVolumeChange ? (
        <div
          ref={menuRef}
          className="absolute bottom-12 right-2 z-10 w-44 rounded-lg border border-white/20 bg-zinc-950 p-3 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-xs text-white/70">Громкость</p>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(remoteVolume * 100)}
            onChange={(e) => onVolumeChange(member.peerId, Number(e.target.value) / 100)}
          />
        </div>
      ) : null}
    </div>
  )
}
