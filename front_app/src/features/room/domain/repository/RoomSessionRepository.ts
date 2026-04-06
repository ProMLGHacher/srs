import type { StateFlow } from "@kvt/runtime"
import type { RoomPageSnapshot } from "../model/roomPageSnapshot"
import type { RoomSessionInitOptions } from "../model/roomSessionInit"

/**
 * Сессия комнаты: WebSocket-сигналинг + WHIP/WHEP через бэкенд.
 * Реализация в data — браузерные API изолированы от domain-логики SDP/правил выше.
 */
export abstract class RoomSessionRepository {
  abstract readonly state: StateFlow<RoomPageSnapshot>

  abstract initialize(roomId: string, peerId: string, nickname: string, opts?: RoomSessionInitOptions): void
  abstract dispose(): void

  abstract startPublishing(): Promise<void>
  abstract stopPublishing(): void

  /** Отправить на сервер и применить к локальным трекам (если есть). */
  abstract setLocalMicEnabled(on: boolean): void
  abstract setLocalCamEnabled(on: boolean): void

  abstract getRemoteStream(peerId: string): MediaStream | undefined
  abstract getLocalPreviewStream(): MediaStream | null
}
