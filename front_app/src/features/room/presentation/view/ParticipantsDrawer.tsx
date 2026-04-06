import type { RoomMember } from "../../domain/model/roomMember"

type ParticipantsDrawerProps = {
  open: boolean
  members: readonly RoomMember[]
  localPeerId: string
  onClose: () => void
}

export function ParticipantsDrawer({ open, members, localPeerId, onClose }: ParticipantsDrawerProps) {
  if (!open) return null
  const sorted = [...members].sort((a, b) => {
    if (a.peerId === localPeerId) return -1
    if (b.peerId === localPeerId) return 1
    return a.nickname.localeCompare(b.nickname)
  })
  return (
    <div className="fixed bottom-20 right-4 top-20 z-30 w-72 overflow-hidden rounded-xl border border-white/15 bg-[var(--kvt-color-surface)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-sm font-medium">Участники</span>
        <button type="button" className="text-white/60 hover:text-white" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      <ul className="max-h-full overflow-y-auto p-2 text-sm">
        {sorted.map((m) => (
          <li key={m.peerId} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/5">
            <span className="min-w-0 flex-1 truncate font-medium">{m.nickname}</span>
            <span className="shrink-0 text-xs opacity-70">{m.micOn ? "🎤" : "🔇"}</span>
            <span className="shrink-0 text-xs opacity-70">{m.camOn ? "📷" : "—"}</span>
            {m.peerId === localPeerId ? <span className="text-[10px] text-[var(--kvt-color-primary)]">вы</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
