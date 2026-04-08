import type { SelectHTMLAttributes } from "react"

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`kv-input-like kv-focus-ring w-full px-3 py-2 text-sm outline-none ${className}`}
    >
      {children}
    </select>
  )
}
