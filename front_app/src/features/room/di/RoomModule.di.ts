import { DiModule } from "@kvt/runtime"
import { PreJoinMediaRepositoryImpl } from "../data/repository/PreJoinMediaRepositoryImpl"
import { TabPeerIdRepository } from "../domain/repository/TabPeerIdRepository"
import { PreJoinMediaRepository } from "../domain/repository/PreJoinMediaRepository"
import { RoomSessionRepository } from "../domain/repository/RoomSessionRepository"
import { LoadPreJoinDefaultsUseCase } from "../domain/use_case/LoadPreJoinDefaultsUseCase"
import { RequestPreJoinPreviewUseCase } from "../domain/use_case/RequestPreJoinPreviewUseCase"
import { TabPeerIdRepositoryImpl } from "../data/repository/TabPeerIdRepositoryImpl"
import { RoomSessionRepositoryImpl } from "../data/repository/RoomSessionRepositoryImpl"

DiModule.register({
  nameSpace: "room",
  nameSpaceDependencies: [],
  builder: (b) => {
    b.register({
      token: TabPeerIdRepository,
      implementation: TabPeerIdRepositoryImpl,
      isSingleton: true,
    })
    b.register({
      token: RoomSessionRepository,
      implementation: RoomSessionRepositoryImpl,
      isSingleton: true,
    })
    b.register({
      token: PreJoinMediaRepository,
      implementation: PreJoinMediaRepositoryImpl,
      isSingleton: true,
    })
    b.register({
      token: LoadPreJoinDefaultsUseCase,
      implementation: LoadPreJoinDefaultsUseCase,
      lazy: true,
    })
    b.register({
      token: RequestPreJoinPreviewUseCase,
      implementation: RequestPreJoinPreviewUseCase,
      lazy: true,
    })
  },
})
