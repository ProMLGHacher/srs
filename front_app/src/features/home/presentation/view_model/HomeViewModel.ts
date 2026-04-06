import { logHomePresentation } from "@/app/logging/kvtAppLog"
import type { Flow } from "@kvt/runtime"
import { Inject, MutableFlow, MutableStateFlow, type ViewModel } from "@kvt/runtime"
import { ResolveRoomNavigationUseCase } from "../../domain/use_case/ResolveRoomNavigationUseCase"
import type { HomePageState } from "../model/HomePageState"
import { HomePageUiEvent } from "../model/HomePageUiEvent"

export class HomeViewModel implements ViewModel<HomePageState, HomePageUiEvent> {
  private readonly _state = new MutableStateFlow<HomePageState>({ roomInput: "" })
  readonly state = this._state.asStateFlow()

  private readonly _uiEvent = new MutableFlow<HomePageUiEvent>()
  readonly uiEvent: Flow<HomePageUiEvent> = this._uiEvent.asFlow()

  constructor(@Inject(ResolveRoomNavigationUseCase) private readonly _resolveRoom: ResolveRoomNavigationUseCase) {}

  setRoomInput(value: string): void {
    this._state.update({ roomInput: value })
  }

  submit(): void {
    const raw = this._state.value.roomInput
    const result = this._resolveRoom.execute(raw)
    if (!result.ok) {
      logHomePresentation.warn("submit rejected (empty room id)")
      return
    }
    const path = `/room/${result.pathSegment}`
    logHomePresentation.info("navigate to room", { path })
    this._uiEvent.emit(HomePageUiEvent.navigateRoom(path))
  }
}
