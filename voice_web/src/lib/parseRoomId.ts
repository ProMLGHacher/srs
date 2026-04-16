/**
 * Бэкенд: `POST /api/rooms` → roomId = hex от 8 байт = 16 символов.
 * Дополнительно принимаем 32 hex на случай смены формата.
 */
const HEX16 = /^[0-9a-f]{16}$/i
const HEX32 = /^[0-9a-f]{32}$/i

export function isValidRoomId(id: string): boolean {
  return HEX16.test(id) || HEX32.test(id)
}

/** Из сырого кода или полного URL извлекает roomId. */
export function parseRoomIdInput(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (HEX16.test(s) || HEX32.test(s)) return s.toLowerCase()
  try {
    const u = new URL(s, typeof window !== "undefined" ? window.location.origin : "http://localhost")
    const parts = u.pathname.split("/").filter(Boolean)
    const roomIdx = parts.indexOf("room")
    if (roomIdx >= 0 && parts[roomIdx + 1]) {
      const seg = parts[roomIdx + 1]
      if (HEX16.test(seg) || HEX32.test(seg)) return seg.toLowerCase()
    }
    const last = parts[parts.length - 1]
    if (last && (HEX16.test(last) || HEX32.test(last))) return last.toLowerCase()
  } catch {
    /* ignore */
  }
  return null
}
