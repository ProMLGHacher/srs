import { DiModule } from "@kvt/runtime"

DiModule.register({
  nameSpace: "app",
  nameSpaceDependencies: ["home", "room"],
  builder: () => {},
})
