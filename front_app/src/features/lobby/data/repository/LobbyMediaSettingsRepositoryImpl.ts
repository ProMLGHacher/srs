import { LS_MEDIA_PREFS, loadMediaPrefs } from "@/app/media/mediaPrefs"
import type { LobbyMediaPrefs, LobbyMediaPreviewConstraints } from "../../domain/model/LobbyMediaPrefs"
import { LobbyMediaSettingsRepository } from "../../domain/repository/LobbyMediaSettingsRepository"

export class LobbyMediaSettingsRepositoryImpl extends LobbyMediaSettingsRepository {
  override loadPrefs(): LobbyMediaPrefs {
    return loadMediaPrefs()
  }

  override savePrefs(prefs: LobbyMediaPrefs): void {
    localStorage.setItem(LS_MEDIA_PREFS, JSON.stringify(prefs))
  }

  override enumerateDevices(): Promise<MediaDeviceInfo[]> {
    return navigator.mediaDevices.enumerateDevices()
  }

  override requestPreview(constraints: LobbyMediaPreviewConstraints): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia(constraints)
  }
}
