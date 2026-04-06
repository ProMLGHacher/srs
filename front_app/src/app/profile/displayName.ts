export const LS_DISPLAY_NAME = "srs.displayName"

export function getStoredDisplayName(): string {
  try {
    return (localStorage.getItem(LS_DISPLAY_NAME) || "").trim()
  } catch {
    return ""
  }
}

export function setStoredDisplayName(name: string): void {
  localStorage.setItem(LS_DISPLAY_NAME, name.trim())
}
