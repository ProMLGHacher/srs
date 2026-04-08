import { Button, Checkbox, Modal } from "@kvatum/ui"
import { useStateFlow, useViewModel } from "@kvt/react"
import { useEffect, useRef } from "react"
import { PreJoinViewModel } from "../view_model/PreJoinViewModel"

type PreJoinModalProps = {
  onConfirm: (result: { stream: MediaStream; micOn: boolean; camOn: boolean }) => void
  onCancel: () => void
}

export function PreJoinModal({ onConfirm, onCancel }: PreJoinModalProps) {
  const vm = useViewModel(PreJoinViewModel)
  const snap = useStateFlow(vm.state)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    return vm.init()
  }, [vm])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = snap.preview
    if (snap.preview) void el.play().catch(() => {})
  }, [snap.preview])

  function handleConfirm(): void {
    const result = vm.getConfirmResult()
    if (!result) return
    onConfirm(result)
  }

  return (
    <Modal open onClose={onCancel} title="Проверка устройств перед входом" description="Сцена выглядит для других участников так.">
        <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
          {snap.preview ? (
            snap.preview.getVideoTracks().length > 0 ? (
              <video
                ref={videoRef}
                className="h-full w-full object-cover transform-[scaleX(-1)]"
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
              {snap.err || "Запрос доступа к микрофону…"}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={snap.micOn} onChange={(e) => vm.setMicOn(e.target.checked)} />
            Микрофон
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={snap.camOn} onChange={(e) => vm.setCamOn(e.target.checked)} />
            Камера
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" onClick={onCancel}>
            Назад
          </Button>
          <Button type="button" variant="primary" disabled={!snap.preview} onClick={handleConfirm}>
            Войти в комнату
          </Button>
        </div>
    </Modal>
  )
}
