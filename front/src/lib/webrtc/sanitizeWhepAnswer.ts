/**
 * Ответ SRS/WHEP иногда содержит несколько SSRC в одной video m-line;
 * Chrome может отказаться корректно применить SDP — оставляем SSRC первой группы.
 */
export function sanitizeWhepAnswerForChrome(sdp: string): string {
  const lines = sdp.split(/\r?\n/)
  const out: string[] = []
  let inVideo = false
  let keepSsrc: string | null = null

  for (const line of lines) {
    if (line.startsWith("m=")) {
      inVideo = line.slice(2).startsWith("video")
      keepSsrc = null
      out.push(line)
      continue
    }
    if (!inVideo) {
      out.push(line)
      continue
    }
    const m = /^a=ssrc:(\d+)\s/.exec(line)
    if (m) {
      if (keepSsrc === null) keepSsrc = m[1]
      if (m[1] !== keepSsrc) continue
    }
    out.push(line)
  }
  return out.join("\r\n")
}
