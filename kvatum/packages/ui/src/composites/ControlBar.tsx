import type { ReactNode } from "react"

export type ControlBarItem = {
  id: string
  content: ReactNode
}

export type ControlBarProps = {
  items: ControlBarItem[]
}

export function ControlBar({ items }: ControlBarProps) {
  return (
    <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/35 p-2 backdrop-blur">
      {items.map((item) => (
        <div key={item.id}>{item.content}</div>
      ))}
    </div>
  )
}
