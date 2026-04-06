import type { RouteObject } from "react-router"
import { HomePage } from "./view/HomePage"

export const HomeRouter = [
  {
    index: true,
    element: <HomePage />,
  },
] satisfies RouteObject[]
