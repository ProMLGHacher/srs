import { Link2, LogOut, Mic, MicOff, Video, VideoOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type RoomControlsProps = {
  roomId: string
  micOn: boolean
  camOn: boolean
  onToggleMic: () => void
  onToggleCam: () => void
  onLeave: () => void
}

export function RoomControls({ roomId, micOn, camOn, onToggleMic, onToggleCam, onLeave }: RoomControlsProps) {
  const copyLink = async (): Promise<void> => {
    const url = `${window.location.origin}/room/${roomId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Ссылка скопирована")
    } catch {
      toast.error("Не удалось скопировать")
    }
  }

  return (
    <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-border bg-card/90 px-4 py-3 backdrop-blur-sm">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={micOn ? "secondary" : "outline"}
            size="icon"
            onClick={onToggleMic}
            aria-label={micOn ? "Выключить микрофон" : "Включить микрофон"}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{micOn ? "Выключить микрофон" : "Включить микрофон"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={camOn ? "secondary" : "outline"}
            size="icon"
            onClick={() => void onToggleCam()}
            aria-label={camOn ? "Выключить камеру" : "Включить камеру"}
          >
            {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{camOn ? "Выключить камеру" : "Включить камеру"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={() => void copyLink()} aria-label="Копировать ссылку">
            <Link2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Скопировать ссылку</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="destructive" size="icon" onClick={onLeave} aria-label="Выйти">
            <LogOut className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Выйти из комнаты</TooltipContent>
      </Tooltip>
    </footer>
  )
}
