import { useEffect } from "react"

type ToastProps = {
  message: string
  onDone: () => void
  durationMs?: number
}

/** Небольшое уведомление внизу экрана; закрывается по таймеру. */
export function Toast({ message, onDone, durationMs = 2200 }: ToastProps) {
  useEffect(() => {
    const t = window.setTimeout(onDone, durationMs)
    return () => window.clearTimeout(t)
  }, [onDone, durationMs])

  return (
    <div
      className="pointer-events-none fixed bottom-24 left-1/2 z-[60] max-w-sm -translate-x-1/2 rounded-lg border border-white/15 bg-zinc-900/95 px-4 py-3 text-center text-sm text-white shadow-lg"
      role="status"
    >
      {message}
    </div>
  )
}
