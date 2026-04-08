export interface VideoCodecCapability {
  mimeType: string
}

export function hasH264InCodecList(codecs: readonly VideoCodecCapability[]): boolean {
  return codecs.some((c) => c?.mimeType.toLowerCase() === "video/h264")
}

export function reorderVideoCodecsH264First<T extends VideoCodecCapability>(codecs: readonly T[]): T[] {
  if (!codecs?.length) return []
  const used = new Set<number>()
  const front: T[] = []
  for (let i = 0; i < codecs.length; i++) {
    const c = codecs[i]
    if (used.has(i) || !c || c.mimeType.toLowerCase() !== "video/h264") continue
    used.add(i)
    front.push(c)
    const next = codecs[i + 1]
    if (next?.mimeType?.toLowerCase() === "video/rtx") {
      used.add(i + 1)
      front.push(next)
    }
  }
  const tail = codecs.filter((_, i) => !used.has(i))
  return [...front, ...tail]
}

export function sdpOfferHasVideoMLine(sdp: string): boolean {
  return !!sdp && /^m=video /m.test(sdp)
}

export function sdpOfferIncludesH264Video(sdp: string): boolean {
  if (!sdp) return false
  const idx = sdp.search(/^m=video /m)
  if (idx === -1) return false
  const rest = sdp.slice(idx)
  const end = rest.search(/\r?\nm=/)
  const block = end === -1 ? rest : rest.slice(0, end)
  return /a=rtpmap:\d+ H264\//i.test(block)
}
