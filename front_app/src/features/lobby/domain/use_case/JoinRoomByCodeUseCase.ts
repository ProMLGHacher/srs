import { Inject } from "@kvt/runtime"
import { LobbyProfileRepository } from "../repository/LobbyProfileRepository"
import { parseRoomJoinInput } from "../service/roomJoinCode"

export type JoinRoomByCodeResult =
  | { ok: true; roomId: string }
  | { ok: false; error: string }

export class JoinRoomByCodeUseCase {
  constructor(@Inject(LobbyProfileRepository) private readonly _profile: LobbyProfileRepository) {}

  execute(nickname: string, rawCode: string, micOn: boolean, camOn: boolean): JoinRoomByCodeResult {
    const nick = nickname.trim()
    if (!nick) return { ok: false, error: "Введите никнейм" }
    const parsed = parseRoomJoinInput(rawCode)
    if (!parsed.ok) return parsed
    this._profile.setDisplayName(nick)
    this._profile.setLobbyMediaDefaults(micOn, camOn)
    return { ok: true, roomId: parsed.roomId }
  }
}
