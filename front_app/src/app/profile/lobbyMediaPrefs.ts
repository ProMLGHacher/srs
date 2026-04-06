/** Вкл/выкл мик и кам на лобби до входа в комнату (sessionStorage). */
export const SS_LOBBY_MIC = "srs-lobby-mic"
export const SS_LOBBY_CAM = "srs-lobby-cam"

function readBool(key: string, defaultTrue: boolean): boolean {
  try {
    const v = sessionStorage.getItem(key)
    if (v === null) return defaultTrue
    return v === "1" || v === "true"
  } catch {
    return defaultTrue
  }
}

export function loadLobbyMediaDefaults(): { micOn: boolean; camOn: boolean } {
  return { micOn: readBool(SS_LOBBY_MIC, true), camOn: readBool(SS_LOBBY_CAM, true) }
}

export function saveLobbyMediaDefaults(micOn: boolean, camOn: boolean): void {
  try {
    sessionStorage.setItem(SS_LOBBY_MIC, micOn ? "1" : "0")
    sessionStorage.setItem(SS_LOBBY_CAM, camOn ? "1" : "0")
  } catch {
    /* ignore */
  }
}
