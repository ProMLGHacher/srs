/** Локальная генерация id комнаты (как hex 8 байт у основного бэкенда), без HTTP. */
export async function createRoom(): Promise<string> {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
