import { logWebrtcTiming } from "./timingLog"

/** Пауза после последнего ICE-кандидата перед POST SDP (Chrome часто не переходит в `complete` долго). */
const ICE_IDLE_AFTER_CANDIDATE_MS = 600

export type IceGatheringDoneReason =
  | "already_complete"
  | "complete"
  | "end_of_candidates"
  | "idle_sufficient_sdp"
  | "timeout"

function sdpHasIceCandidateLines(sdp: string): boolean {
  return /a=candidate:/m.test(sdp)
}

/**
 * WHIP/WHEP без trickle: ждём достаточного SDP, не обязательно `iceGatheringState === "complete"`.
 * Иначе Chrome может ~15 с оставаться в `gathering` при уже рабочих кандидатах.
 */
export function waitIceGathering(
  pc: RTCPeerConnection,
  maxWaitMs = 15_000,
  logScope?: string,
  idleAfterCandidateMs = ICE_IDLE_AFTER_CANDIDATE_MS,
): Promise<void> {
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
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = (): void => {
      pc.removeEventListener("icegatheringstatechange", onGatheringStateChange)
      pc.removeEventListener("icecandidate", onIceCandidate)
    }

    const done = (reason: IceGatheringDoneReason): void => {
      if (finished) return
      finished = true
      clearTimeout(maxTimer)
      if (idleTimer) {
        clearTimeout(idleTimer)
        idleTimer = null
      }
      cleanup()
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

    const scheduleIdleDebounce = (): void => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        idleTimer = null
        if (finished) return
        const sdp = pc.localDescription?.sdp ?? ""
        if (sdpHasIceCandidateLines(sdp)) {
          done("idle_sufficient_sdp")
        }
      }, idleAfterCandidateMs)
    }

    const onGatheringStateChange = (): void => {
      if (pc.iceGatheringState === "complete") {
        done("complete")
      }
    }

    const onIceCandidate = (ev: RTCPeerConnectionIceEvent): void => {
      if (ev.candidate == null) {
        done("end_of_candidates")
        return
      }
      scheduleIdleDebounce()
    }

    const maxTimer = setTimeout(() => done("timeout"), maxWaitMs)

    pc.addEventListener("icegatheringstatechange", onGatheringStateChange)
    pc.addEventListener("icecandidate", onIceCandidate)
  })
}
