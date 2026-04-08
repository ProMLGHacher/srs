import { useEffect, useRef } from "react"
import { Card } from "@kvatum/ui"

type RemoteTileProps = {
  stream: MediaStream
  label: string
}

export function RemoteTile({ stream, label }: RemoteTileProps) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    return () => {
      el.srcObject = null
    }
  }, [stream])
  return (
    <Card className="relative aspect-video overflow-hidden p-0">
      <video ref={ref} className="h-full w-full object-cover" autoPlay playsInline />
      <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-3 py-1 text-xs text-white">{label}</span>
    </Card>
  )
}
