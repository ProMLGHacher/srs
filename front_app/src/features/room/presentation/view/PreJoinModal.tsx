import { buildAudioConstraints, buildVideoConstraints } from "@/app/media/mediaPrefs"
import { loadLobbyMediaDefaults } from "@/app/profile/lobbyMediaPrefs"
import { useEffect, useRef, useState } from "react"

type PreJoinModalProps = {
  onConfirm: (result: { stream: MediaStream; micOn: boolean; camOn: boolean }) => void
  onCancel: () => void
}

export function PreJoinModal({ onConfirm, onCancel }: PreJoinModalProps) {
  const defaults = loadLobbyMediaDefaults()
  const [micOn, setMicOn] = useState(defaults.micOn)
  const [camOn, setCamOn] = useState(defaults.camOn)
  const [preview, setPreview] = useState<MediaStream | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let cancelled = false
    setErr(null)
    const audio = buildAudioConstraints()
    const gum = camOn
      ? navigator.mediaDevices.getUserMedia({ audio, video: buildVideoConstraints() })
      : navigator.mediaDevices.getUserMedia({ audio, video: false })

    gum
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        setPreview((prev) => {
          prev?.getTracks().forEach((t) => t.stop())
          return s
        })
      })
      .catch((e) => setErr(String(e?.message || e)))

    return () => {
      cancelled = true
      setPreview((prev) => {
        prev?.getTracks().forEach((t) => t.stop())
        return null
      })
    }
  }, [camOn])

  useEffect(() => {
    const s = preview
    if (!s) return
    s.getAudioTracks().forEach((t) => {
      t.enabled = micOn
    })
    s.getVideoTracks().forEach((t) => {
      t.enabled = camOn
    })
  }, [preview, micOn, camOn])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = preview
    if (preview) void el.play().catch(() => {})
  }, [preview])

  function handleConfirm(): void {
    if (!preview) return
    onConfirm({ stream: preview, micOn, camOn })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog">
      <div className="w-full max-w-md rounded-xl border border-white/15 bg-[var(--kvt-color-surface)] p-6 text-[var(--kvt-color-on-surface)] shadow-xl">
        <h2 className="text-lg font-semibold">Перед входом в комнату</h2>
        <p className="mt-1 text-sm text-[var(--kvt-color-on-surface-variant)]">
          Проверьте микрофон и камеру. Превью — как будет в эфире.
        </p>

        <div className="mt-4 aspect-video overflow-hidden rounded-lg bg-black">
          {preview ? (
            preview.getVideoTracks().length > 0 ? (
              <video
                ref={videoRef}
                className="h-full w-full object-cover [transform:scaleX(-1)]"
                autoPlay
                playsInline
                muted
              />
            ) : (
              <div className="flex h-full items-center justify-center px-2 text-center text-sm text-white/60">
                Камера выключена — доступ к камере не запрашивается
              </div>
            )
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-sm text-white/60">
              {err || "Запрос доступа к микрофону…"}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={micOn} onChange={(e) => setMicOn(e.target.checked)} />
            Микрофон
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={camOn} onChange={(e) => setCamOn(e.target.checked)} />
            Камера
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-white/15 px-4 py-2" onClick={onCancel}>
            Назад
          </button>
          <button
            type="button"
            className="rounded-lg bg-[var(--kvt-color-primary)] px-4 py-2 font-medium text-[var(--kvt-color-on-primary)] disabled:opacity-45"
            disabled={!preview}
            onClick={handleConfirm}
          >
            Войти в комнату
          </button>
        </div>
      </div>
    </div>
  )
}
