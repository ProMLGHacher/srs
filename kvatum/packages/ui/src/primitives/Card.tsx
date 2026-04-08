import type { HTMLAttributes } from "react"

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`kv-card p-6 text-[var(--kvatum-on-surface)] ${className}`}
    />
  )
}
