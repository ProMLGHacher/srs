import type { LobbyMediaPrefs, LobbyMediaPreviewConstraints } from "../model/LobbyMediaPrefs"

export abstract class LobbyMediaSettingsRepository {
  abstract loadPrefs(): LobbyMediaPrefs
  abstract savePrefs(prefs: LobbyMediaPrefs): void
  abstract enumerateDevices(): Promise<MediaDeviceInfo[]>
  abstract requestPreview(constraints: LobbyMediaPreviewConstraints): Promise<MediaStream>
}
