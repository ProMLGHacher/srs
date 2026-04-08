import { Inject, MutableStateFlow, type StateFlow, type ViewModel } from "@kvt/runtime"
import type { LobbyMediaPrefs } from "../../domain/model/LobbyMediaPrefs"
import { LobbyMediaSettingsRepository } from "../../domain/repository/LobbyMediaSettingsRepository"
import { LoadLobbyMediaSettingsUseCase } from "../../domain/use_case/LoadLobbyMediaSettingsUseCase"
import { RequestLobbyMediaPreviewUseCase } from "../../domain/use_case/RequestLobbyMediaPreviewUseCase"
import { SaveLobbyMediaSettingsUseCase } from "../../domain/use_case/SaveLobbyMediaSettingsUseCase"

type MediaSettingsState = {
  devices: MediaDeviceInfo[]
  prefs: LobbyMediaPrefs
  preview: MediaStream | null
  err: string | null
}

export class MediaSettingsViewModel implements ViewModel<MediaSettingsState> {
  private readonly _state: MutableStateFlow<MediaSettingsState>
  readonly state: StateFlow<MediaSettingsState>

  constructor(
    @Inject(LobbyMediaSettingsRepository) private readonly _repo: LobbyMediaSettingsRepository,
    @Inject(LoadLobbyMediaSettingsUseCase) private readonly _load: LoadLobbyMediaSettingsUseCase,
    @Inject(RequestLobbyMediaPreviewUseCase) private readonly _previewUseCase: RequestLobbyMediaPreviewUseCase,
    @Inject(SaveLobbyMediaSettingsUseCase) private readonly _save: SaveLobbyMediaSettingsUseCase,
  ) {
    this._state = new MutableStateFlow<MediaSettingsState>({
      devices: [],
      prefs: this._load.execute(),
      preview: null,
      err: null,
    })
    this.state = this._state.asStateFlow()
  }

  init = (): (() => void) => {
    return () => {
      this.stopPreview()
    }
  }

  async open(): Promise<void> {
    this.stopPreview()
    this._state.update({ prefs: this._load.execute(), err: null })
    try {
      const devices = await this._repo.enumerateDevices()
      this._state.update({ devices })
    } catch {
      this._state.update({ devices: [] })
    }
    await this.refreshPreview()
  }

  stopPreview(): void {
    const prev = this._state.value.preview
    prev?.getTracks().forEach((t) => t.stop())
    this._state.update({ preview: null })
  }

  async refreshPreview(): Promise<void> {
    this._state.update({ err: null })
    try {
      const stream = await this._previewUseCase.execute(this._state.value.prefs)
      const prev = this._state.value.preview
      prev?.getTracks().forEach((t) => t.stop())
      this._state.update({ preview: stream })
    } catch (e) {
      this.stopPreview()
      this._state.update({ err: String((e as { message?: string })?.message || e) })
    }
  }

  updatePrefs(patch: Partial<LobbyMediaPrefs>): void {
    this._state.update({ prefs: { ...this._state.value.prefs, ...patch } })
    void this.refreshPreview()
  }

  save(): void {
    this._save.execute(this._state.value.prefs)
  }
}
