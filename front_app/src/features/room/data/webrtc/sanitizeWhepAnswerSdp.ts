/**
 * Chrome Unified Plan: в одной m-секции не допускается несколько независимых треков через разные a=ssrc+msid.
 * Ответ SRS/WHEP иногда содержит лишние SSRC (например после перепубликации или с мобильного клиента).
 * Оставляем один msid-трек на секцию + связанный FID (rtx), упрощаем SIM.
 */
export function sanitizeWhepAnswerForChrome(sdp: string): string {
  const normalized = sdp.includes("\r\n") ? sdp : sdp.replace(/\n/g, "\r\n")
  const lines = normalized.split(/\r\n/)
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].startsWith("m=")) {
      const start = i
      i++
      while (i < lines.length && !lines[i].startsWith("m=")) i++
      out.push(...sanitizeOneMediaSection(lines.slice(start, i)))
    } else {
      out.push(lines[i])
      i++
    }
  }
  return out.join("\r\n")
}

function sanitizeOneMediaSection(sectionLines: string[]): string[] {
  const mline = sectionLines[0]
  if (!mline?.startsWith("m=")) return sectionLines

  const ssrcToKey = new Map<number, string>()
  for (const line of sectionLines) {
    const ms = line.match(/^a=ssrc:(\d+) msid:(\S+) (\S+)/)
    if (ms) ssrcToKey.set(Number(ms[1]), `${ms[2]}|${ms[3]}`)
  }

  const uniqueKeys = [...new Set(ssrcToKey.values())]
  if (uniqueKeys.length <= 1) return sectionLines

  const keepKey = uniqueKeys[0]
  const keepSsrcs = new Set<number>()
  for (const [ssrc, key] of ssrcToKey) {
    if (key === keepKey) keepSsrcs.add(ssrc)
  }

  for (const line of sectionLines) {
    const m = line.match(/^a=ssrc-group:FID (\d+) (\d+)/)
    if (m) {
      const main = Number(m[1])
      const rtx = Number(m[2])
      if (keepSsrcs.has(main)) keepSsrcs.add(rtx)
    }
  }

  const result: string[] = [mline]
  for (let idx = 1; idx < sectionLines.length; idx++) {
    const line = sectionLines[idx]

    const ssrcMatch = line.match(/^a=ssrc:(\d+)/)
    if (ssrcMatch) {
      if (keepSsrcs.has(Number(ssrcMatch[1]))) result.push(line)
      continue
    }

    const fid = line.match(/^a=ssrc-group:FID (\d+) (\d+)/)
    if (fid) {
      const main = Number(fid[1])
      const rtx = Number(fid[2])
      if (keepSsrcs.has(main) && keepSsrcs.has(rtx)) result.push(line)
      continue
    }

    const sim = line.match(/^a=ssrc-group:SIM (.+)/)
    if (sim) {
      const ids = sim[1]
        .trim()
        .split(/\s+/)
        .map((x) => Number(x))
        .filter((n) => !Number.isNaN(n))
      const kept = ids.filter((id) => keepSsrcs.has(id))
      if (kept.length === 0) continue
      if (kept.length === ids.length) result.push(line)
      else result.push(`a=ssrc-group:SIM ${kept.join(" ")}`)
      continue
    }

    const msidLine = line.match(/^a=msid:(\S+) (\S+)/)
    if (msidLine) {
      const key = `${msidLine[1]}|${msidLine[2]}`
      if (key === keepKey) result.push(line)
      continue
    }

    result.push(line)
  }
  return result
}
