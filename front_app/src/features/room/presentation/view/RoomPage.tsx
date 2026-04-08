import { Toast } from "@/app/presentation/ui/Toast"
import { getStoredDisplayName, setStoredDisplayName } from "@/app/profile/displayName"
import { loadLobbyMediaDefaults } from "@/app/profile/lobbyMediaPrefs"
import { Button, Card, Input } from "@kvatum/ui"
import type { RoomSessionInitOptions } from "../../domain/model/roomSessionInit"
import { useViewModel, useStateFlow } from "@kvt/react"
import { type FormEvent, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router"
import type { RoomMember } from "../../domain/model/roomMember"
import { RoomViewModel } from "../view_model/RoomViewModel"
import { ConferenceBottomBar } from "./ConferenceBottomBar"
import { ParticipantTile } from "./ParticipantTile"
import { ParticipantsDrawer } from "./ParticipantsDrawer"
import { PreJoinModal } from "./PreJoinModal"
import { RoomDebugPanel } from "./RoomDebugPanel"
import { roomConnectionStatusLabel } from "./roomConnectionStatus"
import { getPeerVolume, setPeerVolume } from "./peerVolumeStorage"

function hasLiveVideo(stream: MediaStream | null | undefined): boolean {
  return !!stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled)
}

function sortMembers(members: readonly RoomMember[], localPeerId: string): RoomMember[] {
  return [...members].sort((a, b) => {
    if (a.peerId === localPeerId) return -1
    if (b.peerId === localPeerId) return 1
    return a.nickname.localeCompare(b.nickname)
  })
}

export function RoomPage(_: unknown, VM = RoomViewModel) {
  const vm = useViewModel(VM)
  const snap = useStateFlow(vm.state)
  const navigate = useNavigate()
  const location = useLocation()
  const { roomId: roomIdParam } = useParams()
  const roomId = roomIdParam ? decodeURIComponent(roomIdParam) : ""

  /** Подтверждённый ник (без редиректа на `/` при прямой ссылке — избегаем циклов навигации). */
  const [displayName, setDisplayName] = useState(() => getStoredDisplayName().trim())
  const [nicknameDraft, setNicknameDraft] = useState(() => getStoredDisplayName())

  const [, bumpVolume] = useReducer((n: number) => n + 1, 0)
  const [participantsOpen, setParticipantsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [copyBusy, setCopyBusy] = useState(false)

  const skipPreJoin = location.state?.skipPreJoin === true
  const [manualEntry, setManualEntry] = useState<RoomSessionInitOptions | null>(null)

  const skipEntryInit = useMemo((): RoomSessionInitOptions | null => {
    if (!skipPreJoin) return null
    const l = loadLobbyMediaDefaults()
    return { initialMicOn: l.micOn, initialCamOn: l.camOn }
  }, [skipPreJoin, roomId])

  const entryInit = skipPreJoin ? skipEntryInit : manualEntry

  useEffect(() => {
    if (!roomId || !displayName || !entryInit) return
    vm.attachRoom(roomId, displayName, entryInit)
  }, [vm, roomId, displayName, entryInit])

  const autoPublishRef = useRef(false)
  useEffect(() => {
    autoPublishRef.current = false
  }, [roomId, displayName, entryInit])

  useEffect(() => {
    if (!entryInit) return
    if (!snap.wsReady || snap.isPublishing) return
    if (autoPublishRef.current) return
    autoPublishRef.current = true
    void vm.startPublish()
  }, [entryInit, snap.wsReady, snap.isPublishing, vm])

  const onVolumeChange = useCallback((peerId: string, v: number) => {
    setPeerVolume(peerId, v)
    bumpVolume()
  }, [])

  const onCopyLink = useCallback(() => {
    setCopyBusy(true)
    window.setTimeout(() => setCopyBusy(false), 400)
    void navigator.clipboard.writeText(window.location.href).then(
      () => setToast("Ссылка скопирована"),
      () => setToast("Не удалось скопировать"),
    )
  }, [])

  function confirmNickname(e: FormEvent): void {
    e.preventDefault()
    const t = nicknameDraft.trim()
    if (!t) return
    setStoredDisplayName(t)
    setDisplayName(t)
  }

  if (!roomId) {
    return <Navigate to="/" replace />
  }

  if (!displayName) {
    return (
      <div className="min-h-screen bg-[#11141d] px-4 py-10 text-[var(--kvatum-on-surface)]">
        <p className="text-sm">
          <Link to="/" className="text-[var(--kvatum-primary)] underline">
            ← На главную
          </Link>
        </p>
        <h1 className="mt-4 text-xl font-semibold">Комната {roomId}</h1>
        <p className="mt-2 text-sm text-[var(--kvatum-on-surface-variant)]">
          Введите никнейм — так вас увидят участники. Без редиректа: можно открыть ссылку с любого устройства и сразу указать имя здесь.
        </p>
        <Card className="mt-6 max-w-md space-y-4">
        <form className="space-y-4" onSubmit={confirmNickname}>
          <label htmlFor="room-nick" className="block text-sm font-medium">
            Никнейм
          </label>
          <Input
            id="room-nick"
            value={nicknameDraft}
            onChange={(e) => setNicknameDraft(e.target.value)}
            placeholder="Как вас видят в эфире"
            maxLength={64}
            autoComplete="nickname"
            autoFocus
          />
          <Button type="submit" variant="primary" disabled={!nicknameDraft.trim()}>
            Продолжить
          </Button>
        </form>
        </Card>
      </div>
    )
  }

  if (!skipPreJoin && !manualEntry) {
    return (
      <>
        <PreJoinModal
          onCancel={() => navigate("/", { replace: true })}
          onConfirm={({ stream, micOn, camOn }) => {
            setManualEntry({ initialMicOn: micOn, initialCamOn: camOn, localPreviewStream: stream })
          }}
        />
      </>
    )
  }

  const peerId = vm.getPeerId()
  const localStream = vm.getLocalPreviewStream()
  const localShowVideo =
    snap.isPublishing &&
    !!localStream &&
    snap.localCamOn &&
    hasLiveVideo(localStream)

  const statusLine = roomConnectionStatusLabel(snap)

  return (
    <div className="min-h-screen bg-[#11141d] pb-28 text-[var(--kvatum-on-surface)]">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <p className="text-sm">
          <Link to="/" className="text-[var(--kvatum-primary)] underline">
            ← На главную
          </Link>
        </p>
        <div className="mt-2 rounded-2xl border border-white/10 bg-[#1d2130] p-4">
          <h1 className="text-2xl font-semibold tracking-tight">Комната {roomId}</h1>
          <p className="mt-1 text-sm text-[var(--kvatum-on-surface-variant)]">{statusLine}</p>
        </div>
        {snap.error ? <p className="mt-2 text-sm text-red-300">{snap.error}</p> : null}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortMembers(snap.members, peerId).map((m) => {
            const isLocal = m.peerId === peerId
            const stream = isLocal ? localStream : vm.getRemoteStream(m.peerId)
            const showVideo = isLocal
              ? localShowVideo
              : m.publishing && !!stream && m.camOn && hasLiveVideo(stream)
            return (
              <ParticipantTile
                key={m.peerId}
                member={
                  isLocal
                    ? {
                        ...m,
                        nickname: snap.localNickname || m.nickname,
                        micOn: snap.localMicOn,
                        camOn: snap.localCamOn,
                      }
                    : m
                }
                isLocal={isLocal}
                showVideo={showVideo}
                stream={stream ?? null}
                remoteVolume={isLocal ? undefined : getPeerVolume(m.peerId)}
                onVolumeChange={isLocal ? undefined : onVolumeChange}
              />
            )
          })}
        </div>

        <RoomDebugPanel snap={snap} localPeerId={peerId} />
      </div>

      <ConferenceBottomBar
        snap={snap}
        participantsOpen={participantsOpen}
        copyBusy={copyBusy}
        onToggleMic={() => vm.setLocalMic(!snap.localMicOn)}
        onToggleCam={() => vm.setLocalCam(!snap.localCamOn)}
        onLeave={() => navigate("/", { replace: true })}
        onCopyLink={onCopyLink}
        onToggleParticipants={() => setParticipantsOpen((o) => !o)}
      />

      <ParticipantsDrawer
        open={participantsOpen}
        members={snap.members}
        localPeerId={peerId}
        onClose={() => setParticipantsOpen(false)}
      />

      {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
    </div>
  )
}
