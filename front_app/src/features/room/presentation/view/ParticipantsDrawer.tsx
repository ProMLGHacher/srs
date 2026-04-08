import type { RoomMember } from "../../domain/model/roomMember"
import { Badge, Button, Drawer } from "@kvatum/ui"

type ParticipantsDrawerProps = {
  open: boolean
  members: readonly RoomMember[]
  localPeerId: string
  onClose: () => void
}

export function ParticipantsDrawer({ open, members, localPeerId, onClose }: ParticipantsDrawerProps) {
  const sorted = [...members].sort((a, b) => {
    if (a.peerId === localPeerId) return -1
    if (b.peerId === localPeerId) return 1
    return a.nickname.localeCompare(b.nickname)
  })
  return (
    <Drawer open={open} onClose={onClose} side="right" title={`Участники (${sorted.length})`}>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={onClose}>
          Закрыть
        </Button>
      </div>
      <ul className="max-h-[calc(100vh-170px)] space-y-2 overflow-y-auto text-sm">
        {sorted.map((m) => (
          <li key={m.peerId} className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#1a1f2d] px-3 py-2 hover:bg-[#252b3b]">
            <span className="min-w-0 flex-1 truncate font-medium">{m.nickname}</span>
            <Badge tone={m.micOn ? "success" : "danger"}>{m.micOn ? "MIC" : "MUTED"}</Badge>
            <Badge tone={m.camOn ? "primary" : "neutral"}>{m.camOn ? "CAM" : "OFF"}</Badge>
            {m.peerId === localPeerId ? <Badge tone="primary">YOU</Badge> : null}
          </li>
        ))}
      </ul>
    </Drawer>
  )
}
