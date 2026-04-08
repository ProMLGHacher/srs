import { DiModule } from "@kvt/runtime"
import { LobbyProfileRepositoryImpl } from "../data/repository/LobbyProfileRepositoryImpl"
import { LobbyMediaSettingsRepositoryImpl } from "../data/repository/LobbyMediaSettingsRepositoryImpl"
import { LobbyRoomsApiImpl } from "../data/repository/LobbyRoomsApiImpl"
import { LobbyMediaSettingsRepository } from "../domain/repository/LobbyMediaSettingsRepository"
import { LobbyProfileRepository } from "../domain/repository/LobbyProfileRepository"
import { LobbyRoomsApi } from "../domain/repository/LobbyRoomsApi"
import { CreateRoomUseCase } from "../domain/use_case/CreateRoomUseCase"
import { JoinRoomByCodeUseCase } from "../domain/use_case/JoinRoomByCodeUseCase"
import { LoadLobbyMediaSettingsUseCase } from "../domain/use_case/LoadLobbyMediaSettingsUseCase"
import { RequestLobbyMediaPreviewUseCase } from "../domain/use_case/RequestLobbyMediaPreviewUseCase"
import { SaveLobbyMediaSettingsUseCase } from "../domain/use_case/SaveLobbyMediaSettingsUseCase"

DiModule.register({
  nameSpace: "lobby",
  nameSpaceDependencies: [],
  builder: (b) => {
    b.register({
      token: LobbyProfileRepository,
      implementation: LobbyProfileRepositoryImpl,
      isSingleton: true,
    })
    b.register({
      token: LobbyRoomsApi,
      implementation: LobbyRoomsApiImpl,
      isSingleton: true,
    })
    b.register({
      token: LobbyMediaSettingsRepository,
      implementation: LobbyMediaSettingsRepositoryImpl,
      isSingleton: true,
    })
    b.register({
      token: CreateRoomUseCase,
      implementation: CreateRoomUseCase,
      lazy: true,
    })
    b.register({
      token: JoinRoomByCodeUseCase,
      implementation: JoinRoomByCodeUseCase,
      lazy: true,
    })
    b.register({
      token: LoadLobbyMediaSettingsUseCase,
      implementation: LoadLobbyMediaSettingsUseCase,
      lazy: true,
    })
    b.register({
      token: RequestLobbyMediaPreviewUseCase,
      implementation: RequestLobbyMediaPreviewUseCase,
      lazy: true,
    })
    b.register({
      token: SaveLobbyMediaSettingsUseCase,
      implementation: SaveLobbyMediaSettingsUseCase,
      lazy: true,
    })
  },
})
