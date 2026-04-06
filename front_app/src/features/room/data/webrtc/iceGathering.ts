/** WHIP/WHEP в этом проекте без trickle ICE — ждём complete или таймаут. */
export function waitIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(t)
      pc.removeEventListener("icegatheringstatechange", onChange)
      resolve()
    }
    const t = setTimeout(done, 4000)
    const onChange = () => {
      if (pc.iceGatheringState === "complete") done()
    }
    pc.addEventListener("icegatheringstatechange", onChange)
  })
}
