import type { HTMLAttributes } from "react"

type BadgeTone = "neutral" | "primary" | "danger" | "success"

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-white/10 text-[var(--kvatum-on-surface)]",
  primary: "bg-[var(--kvatum-primary)]/20 text-[var(--kvatum-primary)]",
  danger: "bg-[var(--kvatum-error)]/20 text-[var(--kvatum-error)]",
  success: "bg-[var(--kvatum-success)]/20 text-[var(--kvatum-success)]",
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${toneClass[tone]} ${className}`}
    />
  )
}
