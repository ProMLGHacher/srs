import "reflect-metadata"
import "@kvt/di-autoload"
import { logApp } from "@/app/logging/kvtAppLog"
import ReactDOM from "react-dom/client"
import { App } from "@/app/presentation/app/view/App"
import "@/app/presentation/styles/index.css"

logApp.info("bootstrap: mounting React root")

ReactDOM.createRoot(document.getElementById("root")!).render(<App />)
