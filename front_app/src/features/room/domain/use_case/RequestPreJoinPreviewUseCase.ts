import { Inject } from "@kvt/runtime"
import type { RoomSessionInitOptions } from "../model/roomSessionInit"
import { PreJoinMediaRepository } from "../repository/PreJoinMediaRepository"

export class RequestPreJoinPreviewUseCase {
  constructor(@Inject(PreJoinMediaRepository) private readonly _repo: PreJoinMediaRepository) {}

  execute(opts: RoomSessionInitOptions): Promise<MediaStream> {
    return this._repo.requestPreview(opts)
  }
}
