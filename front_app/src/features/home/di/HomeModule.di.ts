import { DiModule } from "@kvt/runtime"
import { ResolveRoomNavigationUseCase } from "../domain/use_case/ResolveRoomNavigationUseCase"

DiModule.register({
  nameSpace: "home",
  nameSpaceDependencies: [],
  builder: (b) => {
    b.register({
      token: ResolveRoomNavigationUseCase,
      implementation: ResolveRoomNavigationUseCase,
      lazy: true,
    })
  },
})
