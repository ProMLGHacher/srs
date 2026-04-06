export function stopTrackSafe(t: MediaStreamTrack | null | undefined): void {
  if (t && t.readyState !== "ended") {
    try {
      t.stop()
    } catch {
      /* ignore */
    }
  }
}
