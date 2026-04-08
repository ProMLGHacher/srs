import { Inject } from "@kvt/runtime"
import type { LobbyMediaPrefs } from "../model/LobbyMediaPrefs"
import { LobbyMediaSettingsRepository } from "../repository/LobbyMediaSettingsRepository"

export class LoadLobbyMediaSettingsUseCase {
  constructor(@Inject(LobbyMediaSettingsRepository) private readonly _repo: LobbyMediaSettingsRepository) {}

  execute(): LobbyMediaPrefs {
    return this._repo.loadPrefs()
  }
}
