import type { StateFlow } from "@kvt/runtime"
import type { RoomPageSnapshot } from "../model/roomPageSnapshot"

/**
 * Сессия комнаты: WebSocket-сигналинг + WHIP/WHEP через бэкенд.
 * Реализация в data — браузерные API изолированы от domain-логики SDP/правил выше.
 */
export abstract class RoomSessionRepository {
  abstract readonly state: StateFlow<RoomPageSnapshot>

  abstract initialize(roomId: string, peerId: string): void
  abstract dispose(): void

  abstract startPublishing(): Promise<void>
  abstract stopPublishing(): void

  abstract getRemoteStream(peerId: string): MediaStream | undefined
  abstract getLocalPreviewStream(): MediaStream | null
}
