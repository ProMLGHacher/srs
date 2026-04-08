import { buildAudioConstraints, buildVideoConstraints } from "@/app/media/mediaPrefs"
import { loadLobbyMediaDefaults } from "@/app/profile/lobbyMediaPrefs"
import type { RoomSessionInitOptions } from "../../domain/model/roomSessionInit"
import { PreJoinMediaRepository } from "../../domain/repository/PreJoinMediaRepository"

export class PreJoinMediaRepositoryImpl extends PreJoinMediaRepository {
  override loadDefaults(): RoomSessionInitOptions {
    const defaults = loadLobbyMediaDefaults()
    return { initialMicOn: defaults.micOn, initialCamOn: defaults.camOn }
  }

  override requestPreview(opts: RoomSessionInitOptions): Promise<MediaStream> {
    const audio = buildAudioConstraints()
    if (opts.initialCamOn) {
      return navigator.mediaDevices.getUserMedia({ audio, video: buildVideoConstraints() })
    }
    return navigator.mediaDevices.getUserMedia({ audio, video: false })
  }
}
