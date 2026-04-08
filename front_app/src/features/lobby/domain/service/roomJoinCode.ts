/**
 * Извлекает идентификатор комнаты из ввода: голый код или полная ссылка с `/room/...`.
 */
export function parseRoomJoinInput(raw: string): { ok: true; roomId: string } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: "Введите код комнаты" }
  const code = trimmed.replace(/^.*\/room\//, "").split("/")[0]?.split("?")[0]?.trim() ?? ""
  if (!code) return { ok: false, error: "Введите код комнаты" }
  return { ok: true, roomId: code }
}
