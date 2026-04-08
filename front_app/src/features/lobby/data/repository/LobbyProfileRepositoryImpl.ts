import { getStoredDisplayName, setStoredDisplayName } from "@/app/profile/displayName"
import { loadLobbyMediaDefaults, saveLobbyMediaDefaults } from "@/app/profile/lobbyMediaPrefs"
import { LobbyProfileRepository } from "../../domain/repository/LobbyProfileRepository"

export class LobbyProfileRepositoryImpl extends LobbyProfileRepository {
  override getDisplayName(): string {
    return getStoredDisplayName()
  }

  override setDisplayName(name: string): void {
    setStoredDisplayName(name)
  }

  override getLobbyMediaDefaults(): { micOn: boolean; camOn: boolean } {
    return loadLobbyMediaDefaults()
  }

  override setLobbyMediaDefaults(micOn: boolean, camOn: boolean): void {
    saveLobbyMediaDefaults(micOn, camOn)
  }
}
