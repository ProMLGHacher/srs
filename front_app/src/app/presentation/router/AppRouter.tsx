import { logApp } from "@/app/logging/kvtAppLog"
import { RootLayout } from "@/app/presentation/layout/RootLayout"
import { LobbyRouter } from "@/features/lobby/presentation/Lobby.router"
import { RoomRouter } from "@/features/room/presentation/Room.router"
import { useEffect, useMemo } from "react"
import { Navigate, createBrowserRouter, RouterProvider } from "react-router"

export function AppRouter() {
  const router = useMemo(
    () =>
      createBrowserRouter([
        {
          path: "/",
          element: <RootLayout />,
          children: [...LobbyRouter, ...RoomRouter, { path: "*", element: <Navigate to="/" replace /> }],
        },
      ]),
    [],
  )

  useEffect(() => {
    logApp.info("AppRouter: RouterProvider готов")
  }, [router])

  return <RouterProvider router={router} />
}
