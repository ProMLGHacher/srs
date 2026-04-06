import type { RouteObject } from "react-router"
import { LobbyPage } from "./view/LobbyPage"

export const LobbyRouter = [
  {
    index: true,
    element: <LobbyPage />,
  },
] satisfies RouteObject[]
