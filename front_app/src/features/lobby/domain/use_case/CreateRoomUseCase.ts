import { Inject } from "@kvt/runtime"
import { LobbyProfileRepository } from "../repository/LobbyProfileRepository"
import { LobbyRoomsApi } from "../repository/LobbyRoomsApi"

export class CreateRoomUseCase {
  constructor(
    @Inject(LobbyRoomsApi) private readonly _rooms: LobbyRoomsApi,
    @Inject(LobbyProfileRepository) private readonly _profile: LobbyProfileRepository,
  ) {}

  async execute(nickname: string, micOn: boolean, camOn: boolean): Promise<{ roomId: string }> {
    const nick = nickname.trim()
    if (!nick) throw new Error("Введите никнейм")
    this._profile.setDisplayName(nick)
    this._profile.setLobbyMediaDefaults(micOn, camOn)
    const { roomId } = await this._rooms.createRoom()
    if (!roomId) throw new Error("нет roomId")
    return { roomId }
  }
}
