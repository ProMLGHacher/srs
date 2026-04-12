/** WHIP/WHEP без trickle — ждём complete или таймаут. */
export function waitIceGathering(pc: RTCPeerConnection, timeoutMs = 15_000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve()
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer)
      pc.removeEventListener("icegatheringstatechange", onChange)
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    const onChange = (): void => {
      if (pc.iceGatheringState === "complete") done()
    }
    pc.addEventListener("icegatheringstatechange", onChange)
  })
}
