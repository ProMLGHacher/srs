/** Снимок состояния экрана лобби (только presentation-ориентированные поля UI). */
export type LobbyPageState = {
  nickname: string
  joinCode: string
  lobbyMic: boolean
  lobbyCam: boolean
  busy: boolean
  err: string | null
}
