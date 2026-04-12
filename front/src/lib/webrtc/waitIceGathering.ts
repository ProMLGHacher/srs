import { logWebrtcTiming } from "./timingLog"

/** WHIP/WHEP без trickle — ждём complete или таймаут. */
export function waitIceGathering(pc: RTCPeerConnection, timeoutMs = 15_000, logScope?: string): Promise<void> {
  const t0 = performance.now()
  const initial = pc.iceGatheringState
  if (initial === "complete") {
    if (logScope) {
      logWebrtcTiming(logScope, "ice_gathering", {
        ms: 0,
        reason: "already_complete",
        iceGatheringState: initial,
      })
    }
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    let finished = false
    const done = (reason: "complete" | "timeout"): void => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      pc.removeEventListener("icegatheringstatechange", onChange)
      if (logScope) {
        const ms = Math.round((performance.now() - t0) * 10) / 10
        logWebrtcTiming(logScope, "ice_gathering", {
          ms,
          reason,
          iceGatheringState: pc.iceGatheringState,
        })
      }
      resolve()
    }
    const timer = setTimeout(() => done("timeout"), timeoutMs)
    const onChange = (): void => {
      if (pc.iceGatheringState === "complete") done("complete")
    }
    pc.addEventListener("icegatheringstatechange", onChange)
  })
}
