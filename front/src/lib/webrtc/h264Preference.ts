/** Предпочесть H.264 для отправки, если браузер его объявляет (SRS WHIP). */
export function applyH264VideoPreferences(pc: RTCPeerConnection): void {
  const caps = RTCRtpSender.getCapabilities?.("video")
  if (!caps?.codecs?.length) return
  const h264 = caps.codecs.filter((c) => c.mimeType.toLowerCase() === "video/h264")
  if (h264.length === 0) return
  const other = caps.codecs.filter((c) => c.mimeType.toLowerCase() !== "video/h264")
  const ordered = [...h264, ...other]
  for (const t of pc.getTransceivers()) {
    const k = (t as RTCRtpTransceiver & { kind?: string }).kind
    const isVideo = k === "video" || t.sender.track?.kind === "video" || t.receiver.track?.kind === "video"
    if (isVideo && t.setCodecPreferences) {
      try {
        t.setCodecPreferences(ordered)
      } catch {
        /* ignore */
      }
    }
  }
}

export function sdpOfferIncludesH264Video(sdp: string): boolean {
  const lines = sdp.split(/\r?\n/)
  let inVideo = false
  for (const line of lines) {
    if (line.startsWith("m=")) {
      inVideo = line.slice(2).startsWith("video")
      continue
    }
    if (!inVideo) continue
    if (line.includes("H264/90000") || line.includes("h264")) return true
  }
  return false
}
