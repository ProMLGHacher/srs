const PREFIX = "srs.peerVol."

export function getPeerVolume(peerId: string): number {
  try {
    const v = localStorage.getItem(PREFIX + peerId)
    if (v == null) return 1
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1
  } catch {
    return 1
  }
}

export function setPeerVolume(peerId: string, volume01: number): void {
  const v = Math.min(1, Math.max(0, volume01))
  localStorage.setItem(PREFIX + peerId, String(v))
}
