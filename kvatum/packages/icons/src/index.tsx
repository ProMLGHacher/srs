import type { SVGProps } from "react"

export type IconName = "mic" | "micOff" | "camera" | "cameraOff"

export type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName
}

export function Icon({ name, ...props }: IconProps) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 }
  if (name === "mic") {
    return (
      <svg {...common} {...props}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </svg>
    )
  }
  if (name === "micOff") {
    return (
      <svg {...common} {...props}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
        <path d="M3 3l18 18" />
      </svg>
    )
  }
  if (name === "camera") {
    return (
      <svg {...common} {...props}>
        <rect x="3" y="7" width="13" height="10" rx="2" />
        <path d="M16 10l5-3v10l-5-3z" />
      </svg>
    )
  }
  return (
    <svg {...common} {...props}>
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
      <path d="M3 3l18 18" />
    </svg>
  )
}
