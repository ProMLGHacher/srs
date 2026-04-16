import { Badge } from "@/components/ui/badge"

type RoomHeaderProps = {
  roomId: string
  wsLabel: string
  publishLabel: string
  subscribeLabel: string
  mediaError: string | null
}

export function RoomHeader({ roomId, wsLabel, publishLabel, subscribeLabel, mediaError }: RoomHeaderProps) {
  const short = `${roomId.slice(0, 6)}…${roomId.slice(-4)}`
  return (
    <header className="flex flex-col gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Комната</p>
        <p className="font-mono text-sm text-foreground" title={roomId}>
          {short}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="font-normal">
          Сигналинг: {wsLabel}
        </Badge>
        <Badge variant="outline" className="font-normal">
          Публикация: {publishLabel}
        </Badge>
        <Badge variant="muted" className="font-normal">
          {subscribeLabel}
        </Badge>
        {mediaError ? (
          <Badge variant="destructive" className="font-normal">
            {mediaError}
          </Badge>
        ) : null}
      </div>
    </header>
  )
}
