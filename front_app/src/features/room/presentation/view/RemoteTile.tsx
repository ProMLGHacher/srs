import { useEffect, useRef } from "react"

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
    <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black">
      <video ref={ref} className="h-full w-full object-cover" autoPlay playsInline />
      <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-1 text-xs">{label}</span>
    </div>
  )
}
