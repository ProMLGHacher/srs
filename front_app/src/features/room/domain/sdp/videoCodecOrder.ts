export interface VideoCodecCapability {
  mimeType: string
}

export function hasH264InCodecList(codecs: readonly VideoCodecCapability[]): boolean {
  return codecs.some((c) => c?.mimeType.toLowerCase() === "video/h264")
}

/**
 * H.264 (+ следующий rtx) в начало, остальные в исходном порядке.
 * Нужно для SRS WHIP/WHEP и части Android Chrome.
 */
export function reorderVideoCodecsH264First<T extends VideoCodecCapability>(codecs: readonly T[]): T[] {
  if (!codecs?.length) return []
  const n = codecs.length
  const used = new Set<number>()
  const front: T[] = []
  for (let i = 0; i < n; i++) {
    if (used.has(i)) continue
    const c = codecs[i]
    if (!c || c.mimeType.toLowerCase() !== "video/h264") continue
    used.add(i)
    front.push(c)
    const next = codecs[i + 1]
    if (next?.mimeType?.toLowerCase() === "video/rtx") {
      used.add(i + 1)
      front.push(next)
    }
  }
  const tail: T[] = []
  for (let i = 0; i < n; i++) {
    if (!used.has(i)) tail.push(codecs[i])
  }
  return [...front, ...tail]
}

/** SRS проверяет rtpmap H264 в видео-блоке SDP. */
export function sdpOfferIncludesH264Video(sdp: string): boolean {
  if (!sdp) return false
  const idx = sdp.search(/^m=video /m)
  if (idx === -1) return false
  const rest = sdp.slice(idx)
  const end = rest.search(/\r?\nm=/)
  const block = end === -1 ? rest : rest.slice(0, end)
  return /a=rtpmap:\d+ H264\//i.test(block)
}
