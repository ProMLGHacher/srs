/** Профиль пользователя на лобби: ник и предпочтения медиа до входа в комнату. */
export abstract class LobbyProfileRepository {
  abstract getDisplayName(): string
  abstract setDisplayName(name: string): void
  abstract getLobbyMediaDefaults(): { micOn: boolean; camOn: boolean }
  abstract setLobbyMediaDefaults(micOn: boolean, camOn: boolean): void
}
