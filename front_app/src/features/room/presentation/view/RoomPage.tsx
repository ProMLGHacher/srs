import { getStoredDisplayName } from "@/app/profile/displayName"
import { useViewModel, useStateFlow } from "@kvt/react"
import { useCallback, useEffect, useReducer, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router"
import type { RoomMember } from "../../domain/model/roomMember"
import { RoomViewModel } from "../view_model/RoomViewModel"
import { ConferenceBottomBar } from "./ConferenceBottomBar"
import { ParticipantTile } from "./ParticipantTile"
import { ParticipantsDrawer } from "./ParticipantsDrawer"
import { RoomDebugPanel } from "./RoomDebugPanel"
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
  const { roomId: roomIdParam } = useParams()
  const roomId = roomIdParam ? decodeURIComponent(roomIdParam) : ""
  const displayName = getStoredDisplayName()
  const [, bumpVolume] = useReducer((n: number) => n + 1, 0)
  const [participantsOpen, setParticipantsOpen] = useState(false)

  useEffect(() => {
    if (!roomId || !displayName) return
    vm.attachRoom(roomId, displayName)
  }, [vm, roomId, displayName])

  const onVolumeChange = useCallback((peerId: string, v: number) => {
    setPeerVolume(peerId, v)
    bumpVolume()
  }, [])

  if (!roomId) {
    return <Navigate to="/" replace />
  }
  if (!displayName.trim()) {
    return <Navigate to="/" replace />
  }

  const peerId = vm.getPeerId()
  const localStream = vm.getLocalPreviewStream()
  const localShowVideo =
    snap.isPublishing &&
    !!localStream &&
    snap.localCamOn &&
    hasLiveVideo(localStream)

  return (
    <div className="min-h-screen bg-[var(--kvt-color-surface)] pb-28 text-[var(--kvt-color-on-surface)]">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <p className="text-sm">
          <Link to="/" className="text-[var(--kvt-color-primary)] underline">
            ← На главную
          </Link>
        </p>
        <h1 className="mt-2 text-xl font-semibold">Комната {roomId}</h1>
        {snap.error ? <p className="mt-2 text-sm text-red-300">{snap.error}</p> : null}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        onToggleMic={() => vm.setLocalMic(!snap.localMicOn)}
        onToggleCam={() => vm.setLocalCam(!snap.localCamOn)}
        onTogglePublish={() => {
          if (snap.isPublishing) vm.stopPublish()
          else void vm.startPublish()
        }}
        onLeave={() => navigate("/")}
        onCopyLink={() => {
          void navigator.clipboard.writeText(window.location.href).catch(() => {})
        }}
        onToggleParticipants={() => setParticipantsOpen((o) => !o)}
      />

      <ParticipantsDrawer
        open={participantsOpen}
        members={snap.members}
        localPeerId={peerId}
        onClose={() => setParticipantsOpen(false)}
      />
    </div>
  )
}
