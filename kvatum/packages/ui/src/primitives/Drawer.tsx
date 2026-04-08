import type { ReactNode } from "react"

type DrawerProps = {
  open: boolean
  onClose: () => void
  side?: "left" | "right"
  title?: string
  children: ReactNode
}

export function Drawer({ open, onClose, side = "right", title, children }: DrawerProps) {
  if (!open) return null
  const sideClass = side === "right" ? "right-0" : "left-0"
  return (
    <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose}>
      <aside
        className={`absolute ${sideClass} top-0 h-full w-full max-w-sm border-l border-black/40 bg-[#2b2d31] p-4 text-[var(--kvatum-on-surface)] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#cfd3dc]">{title}</h2> : null}
        {children}
      </aside>
    </div>
  )
}
