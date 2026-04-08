import { Button, Checkbox, Input, Modal, Select } from "@kvatum/ui"
import { useStateFlow, useViewModel } from "@kvt/react"
import { useEffect, useRef } from "react"
import { MediaSettingsViewModel } from "../view_model/MediaSettingsViewModel"

type MediaSettingsModalProps = {
  open: boolean
  onClose: () => void
}

export function MediaSettingsModal({ open, onClose }: MediaSettingsModalProps) {
  const vm = useViewModel(MediaSettingsViewModel)
  const snap = useStateFlow(vm.state)
  const previewVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const dispose = vm.init()
    return dispose
  }, [vm])

  useEffect(() => {
    if (open) {
      void vm.open()
    } else {
      vm.stopPreview()
    }
  }, [open])

  useEffect(() => {
    const el = previewVideoRef.current
    if (!el) return
    el.srcObject = snap.preview
    if (snap.preview) void el.play().catch(() => {})
  }, [snap.preview])

  const audioInputs = snap.devices.filter((d) => d.kind === "audioinput")
  const videoInputs = snap.devices.filter((d) => d.kind === "videoinput")

  function save(): void {
    vm.save()
    vm.stopPreview()
    onClose()
  }

  function handleClose(): void {
    vm.stopPreview()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Настройки камеры и микрофона" description="Локальный профиль устройств.">
        <div className="mt-4 aspect-video max-h-52 overflow-hidden rounded-xl border border-white/10 bg-black">
          {snap.preview ? (
            <video
              ref={previewVideoRef}
              className="h-full w-full object-cover transform-[scaleX(-1)]"
              autoPlay
              playsInline
              muted
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/50">
              {snap.err || "Загрузка превью…"}
            </div>
          )}
        </div>

        <label className="mt-4 block text-sm font-medium">Микрофон</label>
        <Select
          className="mt-1"
          value={snap.prefs.audioDeviceId || ""}
          onChange={(e) => vm.updatePrefs({ audioDeviceId: e.target.value || undefined })}
        >
          <option value="">По умолчанию</option>
          {audioInputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId.slice(0, 8)}
            </option>
          ))}
        </Select>

        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={snap.prefs.noiseSuppression !== false}
              onChange={(e) => vm.updatePrefs({ noiseSuppression: e.target.checked })}
            />
            Шумоподавление
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={snap.prefs.echoCancellation !== false}
              onChange={(e) => vm.updatePrefs({ echoCancellation: e.target.checked })}
            />
            Эхоподавление
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={snap.prefs.autoGainControl !== false}
              onChange={(e) => vm.updatePrefs({ autoGainControl: e.target.checked })}
            />
            Автоусиление
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium">Камера</label>
        <Select
          className="mt-1"
          value={snap.prefs.videoDeviceId || ""}
          onChange={(e) => vm.updatePrefs({ videoDeviceId: e.target.value || undefined })}
        >
          <option value="">По умолчанию</option>
          {videoInputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId.slice(0, 8)}
            </option>
          ))}
        </Select>

        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <label className="text-(--kvt-color-on-surface-variant)">Ширина</label>
            <Input
              type="number"
              className="mt-1"
              placeholder="640"
              value={snap.prefs.videoWidth ?? ""}
              onChange={(e) => vm.updatePrefs({ videoWidth: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div>
            <label className="text-(--kvt-color-on-surface-variant)">Высота</label>
            <Input
              type="number"
              className="mt-1"
              placeholder="480"
              value={snap.prefs.videoHeight ?? ""}
              onChange={(e) => vm.updatePrefs({ videoHeight: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div>
            <label className="text-(--kvt-color-on-surface-variant)">FPS</label>
            <Input
              type="number"
              className="mt-1"
              placeholder="30"
              value={snap.prefs.frameRate ?? ""}
              onChange={(e) => vm.updatePrefs({ frameRate: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        </div>

        <label className="mt-3 block text-sm">
          facingMode (user / environment)
          <Input
            className="mt-1"
            value={snap.prefs.facingMode || ""}
            onChange={(e) => vm.updatePrefs({ facingMode: e.target.value || undefined })}
            placeholder="user"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" onClick={handleClose}>
            Отмена
          </Button>
          <Button type="button" variant="primary" onClick={save}>
            Сохранить
          </Button>
        </div>
    </Modal>
  )
}
