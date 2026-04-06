import { DiModule } from "@kvt/runtime"
import { TabPeerIdRepository } from "../domain/repository/TabPeerIdRepository"
import { RoomSessionRepository } from "../domain/repository/RoomSessionRepository"
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
  },
})
