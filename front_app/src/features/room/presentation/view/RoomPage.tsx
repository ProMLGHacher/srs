import { useViewModel, useStateFlow } from "@kvt/react"
import { useEffect, useRef } from "react"
import { Link, Navigate, useParams } from "react-router"
import { RoomViewModel } from "../view_model/RoomViewModel"
import { RemoteTile } from "./RemoteTile"
import { RoomDebugPanel } from "./RoomDebugPanel"

export function RoomPage(_: unknown, VM = RoomViewModel) {
  const vm = useViewModel(VM)
  const snap = useStateFlow(vm.state)
  const { roomId: roomIdParam } = useParams()
  const roomId = roomIdParam ? decodeURIComponent(roomIdParam) : ""

  const localVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!roomId) return
    vm.attachRoom(roomId)
  }, [vm, roomId])

  useEffect(() => {
    const el = localVideoRef.current
    if (!el) return
    el.srcObject = vm.getLocalPreviewStream()
    return () => {
      el.srcObject = null
    }
  }, [vm, snap.mediaEpoch, snap.isPublishing])

  if (!roomId) {
    return <Navigate to="/" replace />
  }

  const peerId = vm.getPeerId()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-[var(--kvt-color-on-surface)]">
      <p>
        <Link to="/" className="text-[var(--kvt-color-primary)] underline">
          ← На главную
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">Комната: {roomId}</h1>
      <p className="mt-2 text-sm text-[var(--kvt-color-on-surface-variant)]">
        Ваш peer: <code className="text-[var(--kvt-color-on-surface)]">{peerId.slice(0, 8)}…</code> — откройте эту же
        комнату в другой вкладке (лучше инкогнито), чтобы получить второго участника.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!snap.isPublishing ? (
          <button
            type="button"
            className="rounded-lg bg-[var(--kvt-color-primary)] px-4 py-2 font-medium text-[var(--kvt-color-on-primary)] disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => void vm.startPublish()}
            disabled={!snap.wsReady}
          >
            Включить микрофон и камеру
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 font-medium"
            onClick={() => vm.stopPublish()}
          >
            Отключить трансляцию
          </button>
        )}
      </div>

      {snap.error ? <p className="mt-3 text-sm text-red-300">{snap.error}</p> : null}

      <h2 className="mt-8 text-lg font-medium">Участники</h2>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black">
          <video ref={localVideoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
          <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-1 text-xs">
            Вы {snap.isPublishing ? "(в эфире)" : ""}
          </span>
        </div>
        {snap.remotePeerIds.map((rid) => {
          const stream = vm.getRemoteStream(rid)
          if (!stream) return null
          return <RemoteTile key={rid} stream={stream} label={`Участник ${rid.slice(0, 8)}…`} />
        })}
      </div>

      <RoomDebugPanel snap={snap} localPeerId={peerId} />
    </div>
  )
}
