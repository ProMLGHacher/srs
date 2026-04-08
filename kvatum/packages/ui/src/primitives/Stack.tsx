import type { HTMLAttributes } from "react"

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: "sm" | "md" | "lg"
}

const gapClass = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
} as const

export function Stack({ gap = "md", className = "", ...props }: StackProps) {
  return <div {...props} className={`flex flex-col ${gapClass[gap]} ${className}`} />
}
