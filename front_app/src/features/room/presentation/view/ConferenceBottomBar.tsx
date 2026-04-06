import type { RoomPageSnapshot } from "../../domain/model/roomPageSnapshot"

type ConferenceBottomBarProps = {
  snap: RoomPageSnapshot
  participantsOpen: boolean
  onToggleMic: () => void
  onToggleCam: () => void
  onTogglePublish: () => void
  onLeave: () => void
  onCopyLink: () => void
  onToggleParticipants: () => void
}

export function ConferenceBottomBar({
  snap,
  participantsOpen,
  onToggleMic,
  onToggleCam,
  onTogglePublish,
  onLeave,
  onCopyLink,
  onToggleParticipants,
}: ConferenceBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[var(--kvt-color-surface)]/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 md:gap-3">
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm font-medium ${snap.localMicOn ? "bg-white/10" : "bg-red-600/80 text-white"}`}
          onClick={onToggleMic}
          title="Микрофон"
        >
          {snap.localMicOn ? "Мик вкл" : "Мик выкл"}
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm font-medium ${snap.localCamOn ? "bg-white/10" : "bg-red-600/80 text-white"}`}
          onClick={onToggleCam}
          title="Камера"
        >
          {snap.localCamOn ? "Камера вкл" : "Камера выкл"}
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm font-medium ${snap.isPublishing ? "bg-amber-600/80 text-white" : "bg-[var(--kvt-color-primary)] text-[var(--kvt-color-on-primary)]"}`}
          onClick={onTogglePublish}
          disabled={!snap.wsReady}
          title="Трансляция в комнату (SRS)"
        >
          {snap.isPublishing ? "Остановить эфир" : "В эфир"}
        </button>
        <button type="button" className="rounded-full bg-white/10 px-4 py-2 text-sm" onClick={onCopyLink}>
          Ссылка
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm ${participantsOpen ? "bg-[var(--kvt-color-primary)] text-[var(--kvt-color-on-primary)]" : "bg-white/10"}`}
          onClick={onToggleParticipants}
        >
          Участники ({snap.members.length})
        </button>
        <button type="button" className="rounded-full bg-red-900/60 px-4 py-2 text-sm text-white" onClick={onLeave}>
          Выйти
        </button>
      </div>
    </div>
  )
}
