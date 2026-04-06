import {
  LS_MEDIA_PREFS,
  type StoredMediaPrefs,
  loadMediaPrefs,
} from "@/app/media/mediaPrefs"
import { useEffect, useRef, useState } from "react"

type MediaSettingsModalProps = {
  open: boolean
  onClose: () => void
}

export function MediaSettingsModal({ open, onClose }: MediaSettingsModalProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [prefs, setPrefs] = useState<StoredMediaPrefs>(() => loadMediaPrefs())
  const [preview, setPreview] = useState<MediaStream | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open) return
    void navigator.mediaDevices.enumerateDevices().then(setDevices).catch(() => setDevices([]))
    setPrefs(loadMediaPrefs())
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setErr(null)
    const { audio, video } = buildPreviewConstraints(prefs)
    navigator.mediaDevices
      .getUserMedia({ audio, video })
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
  }, [open, prefs])

  useEffect(() => {
    const el = previewVideoRef.current
    if (!el) return
    el.srcObject = preview
    if (preview) void el.play().catch(() => {})
  }, [preview])

  if (!open) return null

  const audioInputs = devices.filter((d) => d.kind === "audioinput")
  const videoInputs = devices.filter((d) => d.kind === "videoinput")

  function save(): void {
    localStorage.setItem(LS_MEDIA_PREFS, JSON.stringify(prefs))
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/15 bg-[var(--kvt-color-surface)] p-6 text-[var(--kvt-color-on-surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Настройки камеры и микрофона</h2>
        <p className="mt-1 text-sm text-[var(--kvt-color-on-surface-variant)]">
          Сохраняются в браузере и применяются при входе в конференцию.
        </p>

        <div className="mt-4 aspect-video max-h-48 overflow-hidden rounded-lg bg-black">
          {preview ? (
            <video
              ref={previewVideoRef}
              className="h-full w-full object-cover [transform:scaleX(-1)]"
              autoPlay
              playsInline
              muted
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/50">{err || "Загрузка превью…"}</div>
          )}
        </div>

        <label className="mt-4 block text-sm font-medium">Микрофон</label>
        <select
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2"
          value={prefs.audioDeviceId || ""}
          onChange={(e) => setPrefs({ ...prefs, audioDeviceId: e.target.value || undefined })}
        >
          <option value="">По умолчанию</option>
          {audioInputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId.slice(0, 8)}
            </option>
          ))}
        </select>

        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={prefs.noiseSuppression !== false}
              onChange={(e) => setPrefs({ ...prefs, noiseSuppression: e.target.checked })}
            />
            Шумоподавление
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={prefs.echoCancellation !== false}
              onChange={(e) => setPrefs({ ...prefs, echoCancellation: e.target.checked })}
            />
            Эхоподавление
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={prefs.autoGainControl !== false}
              onChange={(e) => setPrefs({ ...prefs, autoGainControl: e.target.checked })}
            />
            Автоусиление
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium">Камера</label>
        <select
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2"
          value={prefs.videoDeviceId || ""}
          onChange={(e) => setPrefs({ ...prefs, videoDeviceId: e.target.value || undefined })}
        >
          <option value="">По умолчанию</option>
          {videoInputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId.slice(0, 8)}
            </option>
          ))}
        </select>

        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <label className="text-[var(--kvt-color-on-surface-variant)]">Ширина</label>
            <input
              type="number"
              className="mt-1 w-full rounded border border-white/15 bg-white/5 px-2 py-1"
              placeholder="640"
              value={prefs.videoWidth ?? ""}
              onChange={(e) =>
                setPrefs({ ...prefs, videoWidth: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
          <div>
            <label className="text-[var(--kvt-color-on-surface-variant)]">Высота</label>
            <input
              type="number"
              className="mt-1 w-full rounded border border-white/15 bg-white/5 px-2 py-1"
              placeholder="480"
              value={prefs.videoHeight ?? ""}
              onChange={(e) =>
                setPrefs({ ...prefs, videoHeight: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
          <div>
            <label className="text-[var(--kvt-color-on-surface-variant)]">FPS</label>
            <input
              type="number"
              className="mt-1 w-full rounded border border-white/15 bg-white/5 px-2 py-1"
              placeholder="30"
              value={prefs.frameRate ?? ""}
              onChange={(e) =>
                setPrefs({ ...prefs, frameRate: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </div>
        </div>

        <label className="mt-3 block text-sm">
          facingMode (user / environment)
          <input
            className="mt-1 w-full rounded border border-white/15 bg-white/5 px-2 py-1"
            value={prefs.facingMode || ""}
            onChange={(e) => setPrefs({ ...prefs, facingMode: e.target.value || undefined })}
            placeholder="user"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-white/15 px-4 py-2" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="rounded-lg bg-[var(--kvt-color-primary)] px-4 py-2 text-[var(--kvt-color-on-primary)]" onClick={save}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

function buildPreviewConstraints(prefs: StoredMediaPrefs): { audio: MediaTrackConstraints; video: MediaTrackConstraints } {
  const audio: MediaTrackConstraints = {
    noiseSuppression: prefs.noiseSuppression !== false,
    echoCancellation: prefs.echoCancellation !== false,
    autoGainControl: prefs.autoGainControl !== false,
  }
  if (prefs.audioDeviceId) audio.deviceId = { exact: prefs.audioDeviceId }

  const video: MediaTrackConstraints = {
    width: prefs.videoWidth ? { ideal: prefs.videoWidth } : { ideal: 640 },
    facingMode: prefs.facingMode || "user",
  }
  if (prefs.videoHeight) video.height = { ideal: prefs.videoHeight }
  if (prefs.frameRate) video.frameRate = { ideal: prefs.frameRate }
  if (prefs.videoDeviceId) video.deviceId = { exact: prefs.videoDeviceId }

  return { audio, video }
}
