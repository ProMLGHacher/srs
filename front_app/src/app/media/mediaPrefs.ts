/** Сохранённые в localStorage настройки getUserMedia (лобби / настройки). */
export const LS_MEDIA_PREFS = "srs.mediaPrefs"

export type StoredMediaPrefs = {
  audioDeviceId?: string
  videoDeviceId?: string
  noiseSuppression?: boolean
  echoCancellation?: boolean
  autoGainControl?: boolean
  videoWidth?: number
  videoHeight?: number
  frameRate?: number
  facingMode?: string
}

export function loadMediaPrefs(): StoredMediaPrefs {
  try {
    const raw = localStorage.getItem(LS_MEDIA_PREFS)
    if (!raw) return {}
    return JSON.parse(raw) as StoredMediaPrefs
  } catch {
    return {}
  }
}

export function buildAudioConstraints(): MediaTrackConstraints {
  const p = loadMediaPrefs()
  const audio: MediaTrackConstraints = {
    noiseSuppression: p.noiseSuppression !== false,
    echoCancellation: p.echoCancellation !== false,
    autoGainControl: p.autoGainControl !== false,
  }
  if (p.audioDeviceId) audio.deviceId = { exact: p.audioDeviceId }
  return audio
}

export function buildVideoConstraints(): MediaTrackConstraints {
  const p = loadMediaPrefs()
  const video: MediaTrackConstraints = {
    width: p.videoWidth ? { ideal: p.videoWidth } : { ideal: 640 },
    facingMode: p.facingMode || "user",
  }
  if (p.videoHeight) video.height = { ideal: p.videoHeight }
  if (p.frameRate) video.frameRate = { ideal: p.frameRate }
  if (p.videoDeviceId) video.deviceId = { exact: p.videoDeviceId }
  return video
}

/** Оба трека (как раньше). Для «только мик» / «без камеры» используйте getUserMedia с video: false. */
export function buildGUMConstraints(): { audio: MediaTrackConstraints; video: MediaTrackConstraints } {
  return { audio: buildAudioConstraints(), video: buildVideoConstraints() }
}
