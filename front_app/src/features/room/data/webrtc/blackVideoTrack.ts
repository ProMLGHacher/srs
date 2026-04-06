/**
 * Заглушка видео для SRS (нужен H.264 в SDP) без доступа к камере — индикатор камеры не горит.
 */
export function createBlackVideoTrack(width = 640, height = 480): MediaStreamTrack {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.fillStyle = "#101010"
    ctx.fillRect(0, 0, width, height)
  }
  const stream = canvas.captureStream(1)
  const [track] = stream.getVideoTracks()
  if (!track) {
    canvas.remove()
    throw new Error("blackVideo: captureStream без видеотрека")
  }
  const origStop = track.stop.bind(track)
  track.stop = () => {
    origStop()
    canvas.remove()
  }
  return track
}

export function stopTrackSafe(t: MediaStreamTrack | null | undefined): void {
  if (t && t.readyState !== "ended") {
    try {
      t.stop()
    } catch {
      /* ignore */
    }
  }
}
