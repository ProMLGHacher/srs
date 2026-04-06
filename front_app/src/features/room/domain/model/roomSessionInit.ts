/** Параметры входа в комнату (лобби / pre-join). */
export type RoomSessionInitOptions = {
  initialMicOn: boolean
  initialCamOn: boolean
  /** Если задан — WHIP использует этот поток вместо нового getUserMedia. */
  localPreviewStream?: MediaStream | null
}
