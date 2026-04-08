import { Inject, MutableStateFlow, type StateFlow, type ViewModel } from "@kvt/runtime"
import type { LobbyPageState } from "../../domain/model/LobbyPageState"
import { LobbyProfileRepository } from "../../domain/repository/LobbyProfileRepository"
import { CreateRoomUseCase } from "../../domain/use_case/CreateRoomUseCase"
import { JoinRoomByCodeUseCase } from "../../domain/use_case/JoinRoomByCodeUseCase"

function initialState(profile: LobbyProfileRepository): LobbyPageState {
  const media = profile.getLobbyMediaDefaults()
  return {
    nickname: profile.getDisplayName(),
    joinCode: "",
    lobbyMic: media.micOn,
    lobbyCam: media.camOn,
    busy: false,
    err: null,
  }
}

export class LobbyViewModel implements ViewModel<LobbyPageState> {
  private readonly _state: MutableStateFlow<LobbyPageState>
  readonly state: StateFlow<LobbyPageState>

  constructor(
    @Inject(LobbyProfileRepository) private readonly _profile: LobbyProfileRepository,
    @Inject(CreateRoomUseCase) private readonly _createRoom: CreateRoomUseCase,
    @Inject(JoinRoomByCodeUseCase) private readonly _joinByCode: JoinRoomByCodeUseCase,
  ) {
    this._state = new MutableStateFlow(initialState(_profile))
    this.state = this._state.asStateFlow()
  }

  init = (): (() => void) => {
    this._state.update(initialState(this._profile))
    return () => {}
  }

  setNickname(value: string): void {
    this._state.update({ nickname: value })
  }

  setJoinCode(value: string): void {
    this._state.update({ joinCode: value })
  }

  setLobbyMic(on: boolean): void {
    const { lobbyCam } = this._state.value
    this._profile.setLobbyMediaDefaults(on, lobbyCam)
    this._state.update({ lobbyMic: on })
  }

  setLobbyCam(on: boolean): void {
    const { lobbyMic } = this._state.value
    this._profile.setLobbyMediaDefaults(lobbyMic, on)
    this._state.update({ lobbyCam: on })
  }

  /** Успех: roomId для навигации; при ошибке состояние обновляется, возвращается null. */
  async createRoom(): Promise<string | null> {
    const { nickname, lobbyMic, lobbyCam } = this._state.value
    this._state.update({ err: null, busy: true })
    try {
      const { roomId } = await this._createRoom.execute(nickname, lobbyMic, lobbyCam)
      return roomId
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this._state.update({ err: message })
      return null
    } finally {
      this._state.update({ busy: false })
    }
  }

  /** Успех: roomId для навигации; иначе ошибка в state. */
  joinByCode(): string | null {
    const { nickname, joinCode, lobbyMic, lobbyCam } = this._state.value
    this._state.update({ err: null })
    const result = this._joinByCode.execute(nickname, joinCode, lobbyMic, lobbyCam)
    if (!result.ok) {
      this._state.update({ err: result.error })
      return null
    }
    return result.roomId
  }
}
