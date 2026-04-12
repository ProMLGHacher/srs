import { useEffect, useRef, useState } from "react"
import { Mic, MicOff, Video, VideoOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loadDisplayName, saveDisplayName } from "@/lib/displayNameStorage"
import { startWebrtcTiming } from "@/lib/webrtc/timingLog"

type PreJoinDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomId: string
  onJoin: (p: { stream: MediaStream; nickname: string; micOn: boolean; camOn: boolean }) => void
}

function stopTracks(s: MediaStream | null): void {
  s?.getTracks().forEach((t) => {
    try {
      t.stop()
    } catch {
      /* ignore */
    }
  })
}

export function PreJoinDialog({ open, onOpenChange, roomId, onJoin }: PreJoinDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const transferredRef = useRef(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [nickname, setNickname] = useState(() => loadDisplayName())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const micOnRef = useRef(micOn)

  useEffect(() => {
    micOnRef.current = micOn
  }, [micOn])

  useEffect(() => {
    if (!open) return
    transferredRef.current = false
    setError(null)
    let alive = true
    stopTracks(streamRef.current)
    streamRef.current = null
    void (async () => {
      const pt = startWebrtcTiming("PreJoinDialog preview", { camOn })
      pt.mark("getUserMedia_start")
      try {
        const t0 = performance.now()
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: camOn ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        })
        pt.mark("getUserMedia_done", { ms: Math.round((performance.now() - t0) * 10) / 10 })
        if (!alive || transferredRef.current) {
          stopTracks(stream)
          pt.end("aborted_after_gum_alive_or_transferred")
          return
        }
        stream.getAudioTracks().forEach((t) => {
          t.enabled = micOnRef.current
        })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        pt.end("preview_attached")
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Не удалось получить доступ к камере или микрофону")
        pt.end("getUserMedia_error")
      }
    })()
    return () => {
      alive = false
      if (!transferredRef.current) stopTracks(streamRef.current)
      streamRef.current = null
      /* eslint-disable react-hooks/exhaustive-deps -- сбрасываем превью по ref на момент unmount */
      if (videoRef.current) videoRef.current.srcObject = null
      /* eslint-enable react-hooks/exhaustive-deps */
    }
  }, [open, camOn])

  useEffect(() => {
    if (!open || !streamRef.current) return
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = micOn
    })
  }, [micOn, open])

  const handleCamToggle = (): void => {
    setCamOn((c) => !c)
  }

  const handleSubmit = (): void => {
    const name = nickname.trim()
    if (!name) {
      setError("Укажите отображаемое имя")
      return
    }
    const stream = streamRef.current
    if (!stream) {
      setError("Нет медиапотока")
      return
    }
    saveDisplayName(name)
    transferredRef.current = true
    setBusy(true)
    onJoin({ stream, nickname: name, micOn, camOn })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setBusy(false)
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Перед входом в комнату</DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            {roomId.slice(0, 8)}…{roomId.slice(-4)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full scale-x-[-1] object-cover"
            />
            {!camOn ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Камера выключена
              </div>
            ) : null}
          </div>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant={micOn ? "secondary" : "outline"}
              size="icon"
              onClick={() => setMicOn((m) => !m)}
              aria-label={micOn ? "Выключить микрофон" : "Включить микрофон"}
            >
              {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant={camOn ? "secondary" : "outline"}
              size="icon"
              onClick={handleCamToggle}
              aria-label={camOn ? "Выключить камеру" : "Включить камеру"}
            >
              {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prejoin-name">Отображаемое имя</Label>
            <Input
              id="prejoin-name"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Как вас видят другие"
              maxLength={64}
              autoComplete="name"
            />
          </div>
          {error ? <p className="text-sm text-destructive-foreground">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            Войти
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
