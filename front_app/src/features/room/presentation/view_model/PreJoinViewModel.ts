import { Inject, MutableStateFlow, type StateFlow, type ViewModel } from "@kvt/runtime"
import { LoadPreJoinDefaultsUseCase } from "../../domain/use_case/LoadPreJoinDefaultsUseCase"
import { RequestPreJoinPreviewUseCase } from "../../domain/use_case/RequestPreJoinPreviewUseCase"

type PreJoinState = {
  micOn: boolean
  camOn: boolean
  preview: MediaStream | null
  err: string | null
}

export class PreJoinViewModel implements ViewModel<PreJoinState> {
  private readonly _state = new MutableStateFlow<PreJoinState>({
    micOn: true,
    camOn: true,
    preview: null,
    err: null,
  })
  readonly state: StateFlow<PreJoinState> = this._state.asStateFlow()

  constructor(
    @Inject(LoadPreJoinDefaultsUseCase) private readonly _loadDefaults: LoadPreJoinDefaultsUseCase,
    @Inject(RequestPreJoinPreviewUseCase) private readonly _previewUseCase: RequestPreJoinPreviewUseCase,
  ) {}

  init = (): (() => void) => {
    const defaults = this._loadDefaults.execute()
    this._state.update({
      micOn: defaults.initialMicOn !== false,
      camOn: defaults.initialCamOn !== false,
      err: null,
    })
    void this.refreshPreview()
    return () => this.stopPreview()
  }

  setMicOn(on: boolean): void {
    this._state.update({ micOn: on })
    this.syncTrackEnabled()
  }

  setCamOn(on: boolean): void {
    this._state.update({ camOn: on })
    void this.refreshPreview()
  }

  getConfirmResult(): { stream: MediaStream; micOn: boolean; camOn: boolean } | null {
    const { preview, micOn, camOn } = this._state.value
    if (!preview) return null
    return { stream: preview, micOn, camOn }
  }

  private async refreshPreview(): Promise<void> {
    const { micOn, camOn } = this._state.value
    this._state.update({ err: null })
    try {
      const next = await this._previewUseCase.execute({ initialMicOn: micOn, initialCamOn: camOn })
      const prev = this._state.value.preview
      prev?.getTracks().forEach((t) => t.stop())
      this._state.update({ preview: next })
      this.syncTrackEnabled()
    } catch (e) {
      this.stopPreview()
      this._state.update({ err: String((e as { message?: string })?.message || e) })
    }
  }

  private syncTrackEnabled(): void {
    const { preview, micOn, camOn } = this._state.value
    if (!preview) return
    preview.getAudioTracks().forEach((t) => {
      t.enabled = micOn
    })
    preview.getVideoTracks().forEach((t) => {
      t.enabled = camOn
    })
  }

  private stopPreview(): void {
    const prev = this._state.value.preview
    prev?.getTracks().forEach((t) => t.stop())
    this._state.update({ preview: null })
  }
}
