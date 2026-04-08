import { Inject } from "@kvt/runtime"
import type { RoomSessionInitOptions } from "../model/roomSessionInit"
import { PreJoinMediaRepository } from "../repository/PreJoinMediaRepository"

export class LoadPreJoinDefaultsUseCase {
  constructor(@Inject(PreJoinMediaRepository) private readonly _repo: PreJoinMediaRepository) {}

  execute(): RoomSessionInitOptions {
    return this._repo.loadDefaults()
  }
}
