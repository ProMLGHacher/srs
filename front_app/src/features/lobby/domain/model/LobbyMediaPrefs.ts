export type LobbyMediaPrefs = {
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

export type LobbyMediaPreviewConstraints = {
  audio: MediaTrackConstraints
  video: MediaTrackConstraints
}

export function buildLobbyMediaPreviewConstraints(prefs: LobbyMediaPrefs): LobbyMediaPreviewConstraints {
  const audio: MediaTrackConstraints = {
    noiseSuppression: prefs.noiseSuppression !== false,
    echoCancellation: prefs.echoCancellation !== false,
    autoGainControl: prefs.autoGainControl !== false,
  }
  if (prefs.audioDeviceId) audio.deviceId = { exact: prefs.audioDeviceId }

  const video: MediaTrackConstraints = {
    width: prefs.videoWidth ? { ideal: prefs.videoWidth } : { ideal: 640 },
    facingMode: prefs.facingMode || "user",
  }
  if (prefs.videoHeight) video.height = { ideal: prefs.videoHeight }
  if (prefs.frameRate) video.frameRate = { ideal: prefs.frameRate }
  if (prefs.videoDeviceId) video.deviceId = { exact: prefs.videoDeviceId }

  return { audio, video }
}
