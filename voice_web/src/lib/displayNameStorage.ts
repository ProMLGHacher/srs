const KEY = "conference_display_name"

export function loadDisplayName(): string {
  try {
    return localStorage.getItem(KEY)?.trim() ?? ""
  } catch {
    return ""
  }
}

export function saveDisplayName(name: string): void {
  try {
    localStorage.setItem(KEY, name.trim())
  } catch {
    /* ignore */
  }
}
