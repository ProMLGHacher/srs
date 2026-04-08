import type { RoomPageSnapshot } from "../../domain/model/roomPageSnapshot"
import { Button, ControlBar } from "@kvatum/ui"

type ConferenceBottomBarProps = {
  snap: RoomPageSnapshot
  participantsOpen: boolean
  copyBusy?: boolean
  onToggleMic: () => void
  onToggleCam: () => void
  onLeave: () => void
  onCopyLink: () => void
  onToggleParticipants: () => void
}

export function ConferenceBottomBar({
  snap,
  participantsOpen,
  copyBusy = false,
  onToggleMic,
  onToggleCam,
  onLeave,
  onCopyLink,
  onToggleParticipants,
}: ConferenceBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#11141d]/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto max-w-4xl">
        <ControlBar
          items={[
            {
              id: "mic",
              content: (
                <Button size="sm" variant={snap.localMicOn ? "secondary" : "danger"} onClick={onToggleMic} title="Микрофон">
                  {snap.localMicOn ? "Мик вкл" : "Мик выкл"}
                </Button>
              ),
            },
            {
              id: "cam",
              content: (
                <Button size="sm" variant={snap.localCamOn ? "secondary" : "danger"} onClick={onToggleCam} title="Камера">
                  {snap.localCamOn ? "Камера вкл" : "Камера выкл"}
                </Button>
              ),
            },
            {
              id: "link",
              content: (
                <Button size="sm" onClick={onCopyLink} disabled={copyBusy}>
                  {copyBusy ? "Копируем…" : "Ссылка"}
                </Button>
              ),
            },
            {
              id: "members",
              content: (
                <Button size="sm" variant={participantsOpen ? "primary" : "secondary"} onClick={onToggleParticipants}>
                  Участники ({snap.members.length})
                </Button>
              ),
            },
            {
              id: "leave",
              content: (
                <Button size="sm" variant="danger" onClick={onLeave}>
                  Выйти
                </Button>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
