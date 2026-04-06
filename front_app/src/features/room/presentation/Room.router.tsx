import type { RouteObject } from "react-router"
import { RoomPage } from "./view/RoomPage"

export const RoomRouter = [
  {
    path: "room/:roomId",
    element: <RoomPage />,
  },
] satisfies RouteObject[]
