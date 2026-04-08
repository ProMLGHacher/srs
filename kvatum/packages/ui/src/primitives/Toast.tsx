import { useEffect } from "react"

export type ToastProps = {
  message: string
  onDone: () => void
  durationMs?: number
  variant?: "info" | "success" | "warning" | "danger"
}

const toneClass = {
  info: "border-white/15 bg-zinc-900/95 text-white",
  success: "border-emerald-300/30 bg-emerald-950/90 text-emerald-100",
  warning: "border-amber-300/30 bg-amber-950/90 text-amber-100",
  danger: "border-red-300/30 bg-red-950/90 text-red-100",
} as const

export function Toast({ message, onDone, durationMs = 2200, variant = "info" }: ToastProps) {
  useEffect(() => {
    const t = window.setTimeout(onDone, durationMs)
    return () => window.clearTimeout(t)
  }, [onDone, durationMs])

  return (
    <div
      className={`pointer-events-none fixed bottom-24 left-1/2 z-[60] max-w-sm -translate-x-1/2 rounded-lg border px-4 py-3 text-center text-sm shadow-lg ${toneClass[variant]}`}
      role="status"
    >
      {message}
    </div>
  )
}
