import { logApp } from "@/app/logging/kvtAppLog"
import { AppRouter } from "@/app/presentation/router/AppRouter"
import { KvtThemeProvider, darkTheme } from "@kvt/theme"
import { useEffect } from "react"

export function App() {
  useEffect(() => {
    logApp.info("App shell mounted", { theme: "dark" })
  }, [])
  return (
    <KvtThemeProvider theme={darkTheme}>
      <AppRouter />
    </KvtThemeProvider>
  )
}
