import type { UIEvent } from "@kvt/runtime"

export type HomePageUiEvent = UIEvent<"navigate_room", { path: string }>

export const HomePageUiEvent = {
  navigateRoom(path: string): HomePageUiEvent {
    return { type: "navigate_room", payload: { path } }
  },
}
