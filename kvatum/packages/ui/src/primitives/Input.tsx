import type { InputHTMLAttributes } from "react"

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`kv-input-like kv-focus-ring w-full px-3 py-2 text-sm outline-none ${className}`}
    />
  )
}
