import type { RoomPageSnapshot } from "../../domain/model/roomPageSnapshot"

/** Краткий статус для пользователя под заголовком комнаты. */
export function roomConnectionStatusLabel(snap: RoomPageSnapshot): string {
  if (snap.error) {
    return "Что-то пошло не так — см. сообщение ниже"
  }
  if (!snap.wsReady) {
    if (snap.wsReadyState === "CONNECTING") return "Сигналинг: подключаемся…"
    if (snap.wsReadyState === "CLOSING" || snap.wsReadyState === "CLOSED") return "Сигналинг: отключено"
    return "Сигналинг: нет соединения"
  }
  if (!snap.isPublishing) return "Эфир: запускаем…"
  const pub = snap.publishPeer
  if (!pub) return "Эфир: готовимся…"
  if (pub.connectionState === "connected") return "В эфире"
  if (pub.connectionState === "connecting" || pub.iceConnectionState === "checking") {
    return "Эфир: связываемся с сервером…"
  }
  if (pub.connectionState === "failed" || pub.iceConnectionState === "failed") {
    return "Эфир: не удалось установить связь"
  }
  return "Эфир: подключаемся…"
}
