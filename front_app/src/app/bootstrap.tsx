import "reflect-metadata"
import "@kvt/di-autoload"
import { logApp } from "./logging/kvtAppLog"
import ReactDOM from "react-dom/client"
import { App } from "./presentation/app/view/App"
import "./presentation/styles/index.css"

logApp.info("bootstrap: mounting React root")

ReactDOM.createRoot(document.getElementById("root")!).render(<App />)
