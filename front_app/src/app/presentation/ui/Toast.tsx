import { Toast as DsToast } from "@kvatum/ui"

type ToastProps = {
  message: string
  onDone: () => void
  durationMs?: number
}

/** Совместимый facade поверх enterprise DS Toast. */
export function Toast({ message, onDone, durationMs = 2200 }: ToastProps) {
  return <DsToast message={message} onDone={onDone} durationMs={durationMs} variant="info" />
}
