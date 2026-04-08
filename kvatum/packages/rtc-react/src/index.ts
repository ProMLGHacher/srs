import { useMemo, useState } from "react"
import type { RoomSessionInitOptions } from "@kvatum/rtc"

export type UseRoomSessionState = {
  initialized: boolean
  options: RoomSessionInitOptions | null
}

export function useRoomSession() {
  const [state, setState] = useState<UseRoomSessionState>({ initialized: false, options: null })
  const api = useMemo(
    () => ({
      initialize(options: RoomSessionInitOptions) {
        setState({ initialized: true, options })
      },
      dispose() {
        setState({ initialized: false, options: null })
      },
    }),
    [],
  )
  return { state, ...api }
}
