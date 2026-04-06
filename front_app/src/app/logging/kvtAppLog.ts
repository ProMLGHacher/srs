import { Logger } from "@kvt/logging"

const root = Logger.getInstance()

/** Именованные логгеры по слоям приложения (kvt logging). */
export const logApp = root.withSource("app")
export const logHomePresentation = root.withSource("home.presentation")
export const logRoomPresentation = root.withSource("room.presentation")
export const logRoomData = root.withSource("room.data")
