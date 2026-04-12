import { useEffect, useRef, useState } from "react"
import { Mic, MicOff, MoreVertical, Pin, Video, VideoOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { RoomMember } from "@/types/member"
import { getPeerVolumePercent, setPeerVolumePercent } from "@/lib/peerVolume"
import { cn } from "@/lib/utils"

type ParticipantTileProps = {
  member: RoomMember
  isLocal: boolean
  stream: MediaStream | undefined
  /** Для локального участника — фактическое состояние UI (сервер не эхоит presence себе). */
  effectiveMicOn: boolean
  effectiveCamOn: boolean
  isPinned: boolean
  onPin: () => void
  onUnpin: () => void
  compact?: boolean
}

export function ParticipantTile({
  member,
  isLocal,
  stream,
  effectiveMicOn,
  effectiveCamOn,
  isPinned,
  onPin,
  onUnpin,
  compact,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [volume, setVolume] = useState(() => getPeerVolumePercent(member.peerId))

  const hasLiveVideo =
    !!stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled && effectiveCamOn)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = stream ?? null
    return () => {
      el.srcObject = null
    }
  }, [stream])

  useEffect(() => {
    if (isLocal || !videoRef.current) return
    videoRef.current.volume = volume / 100
  }, [volume, isLocal])

  const nickname = member.nickname || member.peerId.slice(0, 8)

  const menuBlocks = (
    <>
      {!isLocal ? (
        <>
          <ContextMenuLabel className="text-muted-foreground">Громкость</ContextMenuLabel>
          <div className="px-2 py-2">
            <Slider
              value={[volume]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => {
                const n = v[0] ?? 100
                setVolume(n)
                setPeerVolumePercent(member.peerId, n)
              }}
            />
          </div>
          <ContextMenuSeparator />
        </>
      ) : null}
      <ContextMenuItem onSelect={isPinned ? onUnpin : onPin}>{isPinned ? "Открепить" : "Закрепить"}</ContextMenuItem>
    </>
  )

  const tileInner = (
    <div
      className={cn(
        "relative flex w-full overflow-hidden rounded-lg border border-border bg-card",
        compact ? "aspect-video max-h-28" : "aspect-video min-h-[140px]",
        isPinned && "ring-1 ring-ring",
      )}
    >
      {hasLiveVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-4">
          <span className="text-center text-sm font-medium text-muted-foreground">{nickname}</span>
        </div>
      )}

      {hasLiveVideo ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 pt-8">
          <span className="text-xs font-medium text-zinc-100">{nickname}</span>
        </div>
      ) : null}

      <div className="absolute right-2 top-2 flex items-center gap-1">
        <div className="flex gap-0.5 rounded-md bg-black/50 px-1 py-0.5">
          {effectiveMicOn ? (
            <Mic className="h-3.5 w-3.5 text-zinc-200" aria-hidden />
          ) : (
            <MicOff className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
          )}
          {effectiveCamOn ? (
            <Video className="h-3.5 w-3.5 text-zinc-200" aria-hidden />
          ) : (
            <VideoOff className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
          )}
        </div>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 border-0 bg-black/50 text-zinc-100 hover:bg-black/70"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Действия"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Меню плитки</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
            {!isLocal ? (
              <>
                <DropdownMenuLabel className="font-normal text-muted-foreground">Громкость</DropdownMenuLabel>
                <div className="px-2 pb-2 pt-1">
                  <Slider
                    value={[volume]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => {
                      const n = v[0] ?? 100
                      setVolume(n)
                      setPeerVolumePercent(member.peerId, n)
                    }}
                  />
                </div>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem onClick={isPinned ? onUnpin : onPin}>
              <Pin className="mr-2 h-4 w-4" />
              {isPinned ? "Открепить" : "Закрепить"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{tileInner}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">{menuBlocks}</ContextMenuContent>
    </ContextMenu>
  )
}
