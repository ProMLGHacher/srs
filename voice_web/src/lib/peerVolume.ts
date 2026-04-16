const PREFIX = "peer_vol_"

export function getPeerVolumePercent(peerId: string): number {
  try {
    const v = localStorage.getItem(PREFIX + peerId)
    if (v == null) return 100
    const n = Number(v)
    if (!Number.isFinite(n)) return 100
    return Math.min(100, Math.max(0, Math.round(n)))
  } catch {
    return 100
  }
}

export function setPeerVolumePercent(peerId: string, percent: number): void {
  const v = Math.min(100, Math.max(0, Math.round(percent)))
  try {
    localStorage.setItem(PREFIX + peerId, String(v))
  } catch {
    /* ignore */
  }
}
