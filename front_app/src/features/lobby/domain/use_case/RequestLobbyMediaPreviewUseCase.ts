import { Inject } from "@kvt/runtime"
import { buildLobbyMediaPreviewConstraints, type LobbyMediaPrefs } from "../model/LobbyMediaPrefs"
import { LobbyMediaSettingsRepository } from "../repository/LobbyMediaSettingsRepository"

export class RequestLobbyMediaPreviewUseCase {
  constructor(@Inject(LobbyMediaSettingsRepository) private readonly _repo: LobbyMediaSettingsRepository) {}

  async execute(prefs: LobbyMediaPrefs): Promise<MediaStream> {
    const constraints = buildLobbyMediaPreviewConstraints(prefs)
    return this._repo.requestPreview(constraints)
  }
}
