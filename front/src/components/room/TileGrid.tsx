import { ScrollArea } from "@/components/ui/scroll-area"
import type { RoomMember } from "@/types/member"
import { ParticipantTile } from "./ParticipantTile"
import { cn } from "@/lib/utils"

type TileGridProps = {
  localPeerId: string
  members: RoomMember[]
  localMicOn: boolean
  localCamOn: boolean
  getStream: (peerId: string) => MediaStream | undefined
  peerSubscribeStatus: Record<string, string>
  pinnedPeerId: string | null
  onPin: (peerId: string) => void
  onUnpin: () => void
}

function sortMembers(members: RoomMember[], localPeerId: string): RoomMember[] {
  return [...members].sort((a, b) => {
    if (a.peerId === localPeerId) return -1
    if (b.peerId === localPeerId) return 1
    return a.nickname.localeCompare(b.nickname)
  })
}

export function TileGrid({
  localPeerId,
  members,
  localMicOn,
  localCamOn,
  getStream,
  peerSubscribeStatus,
  pinnedPeerId,
  onPin,
  onUnpin,
}: TileGridProps) {
  const sorted = sortMembers(members, localPeerId)
  const pinned = pinnedPeerId ? sorted.find((m) => m.peerId === pinnedPeerId) : null
  const rest = pinned ? sorted.filter((m) => m.peerId !== pinnedPeerId) : sorted

  const renderTile = (m: RoomMember, compact: boolean) => {
    const isLocal = m.peerId === localPeerId
    return (
      <ParticipantTile
        key={m.peerId}
        member={m}
        isLocal={isLocal}
        stream={getStream(m.peerId)}
        effectiveMicOn={isLocal ? localMicOn : m.micOn}
        effectiveCamOn={isLocal ? localCamOn : m.camOn}
        remoteMediaStatus={isLocal ? undefined : peerSubscribeStatus[m.peerId]}
        isPinned={pinnedPeerId === m.peerId}
        onPin={() => onPin(m.peerId)}
        onUnpin={onUnpin}
        compact={compact}
      />
    )
  }

  if (pinned) {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-4 lg:grid-cols-[1fr_11rem]">
        <div className="min-h-0 min-w-0">{renderTile(pinned, false)}</div>
        <ScrollArea className="h-full min-h-[200px] lg:max-h-full">
          <div className="flex flex-col gap-2 pr-3">{rest.map((m) => renderTile(m, true))}</div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div
        className={cn(
          "grid auto-rows-fr gap-3 p-4",
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {sorted.map((m) => renderTile(m, false))}
      </div>
    </ScrollArea>
  )
}
