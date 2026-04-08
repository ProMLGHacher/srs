import { Inject } from "@kvt/runtime"
import type { LobbyMediaPrefs } from "../model/LobbyMediaPrefs"
import { LobbyMediaSettingsRepository } from "../repository/LobbyMediaSettingsRepository"

export class SaveLobbyMediaSettingsUseCase {
  constructor(@Inject(LobbyMediaSettingsRepository) private readonly _repo: LobbyMediaSettingsRepository) {}

  execute(prefs: LobbyMediaPrefs): void {
    this._repo.savePrefs(prefs)
  }
}
