import type { ButtonHTMLAttributes, ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "danger"
type ButtonSize = "sm" | "md" | "lg"

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  fullWidth?: boolean
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--kvatum-primary)] text-[var(--kvatum-on-primary)] border-[color:var(--kvatum-primary)] hover:bg-[var(--kvatum-primary-container)] hover:text-white",
  secondary:
    "bg-[var(--kvatum-secondary-container)] text-[var(--kvatum-on-secondary-container)] border-[color:var(--kvatum-outline)] hover:bg-[#313338]",
  danger:
    "bg-[var(--kvatum-error)] text-[var(--kvatum-on-error)] border-[color:var(--kvatum-error)] hover:bg-[#d7363a]",
}

const sizeClass: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  leftIcon,
  fullWidth = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`kv-btn kv-focus-ring inline-flex items-center justify-center gap-2 font-medium disabled:cursor-not-allowed disabled:opacity-45 ${sizeClass[size]} ${fullWidth ? "w-full" : ""} ${variantClass[variant]} ${className}`}
    >
      {leftIcon}
      <span>{children}</span>
    </button>
  )
}
