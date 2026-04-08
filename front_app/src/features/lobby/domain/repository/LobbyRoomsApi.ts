/** HTTP-доступ к API комнат на стороне сигнального сервера (реализация в data). */
export abstract class LobbyRoomsApi {
  abstract createRoom(): Promise<{ roomId: string }>
}
