import type { RoomSessionInitOptions } from "../model/roomSessionInit"

export abstract class PreJoinMediaRepository {
  abstract loadDefaults(): RoomSessionInitOptions
  abstract requestPreview(opts: RoomSessionInitOptions): Promise<MediaStream>
}
