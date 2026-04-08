import type { ReactNode } from "react"

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
}

export function Modal({ open, onClose, title, description, children }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 backdrop-blur-[2px] p-4" role="dialog" onClick={onClose}>
      <div
        className="kv-modal-surface max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 text-[var(--kvatum-on-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
        {description ? <p className="mt-1 text-sm text-[var(--kvatum-on-surface-variant)]">{description}</p> : null}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
