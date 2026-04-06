import { getStoredDisplayName, setStoredDisplayName } from "@/app/profile/displayName"
import { loadLobbyMediaDefaults, saveLobbyMediaDefaults } from "@/app/profile/lobbyMediaPrefs"
import { useState } from "react"
import { useNavigate } from "react-router"
import { MediaSettingsModal } from "./MediaSettingsModal"

function apiOrigin(): string {
  return import.meta.env.VITE_SIGNAL_URL || ""
}

export function LobbyPage() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState(() => getStoredDisplayName())
  const [joinCode, setJoinCode] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [lobbyMic, setLobbyMic] = useState(() => loadLobbyMediaDefaults().micOn)
  const [lobbyCam, setLobbyCam] = useState(() => loadLobbyMediaDefaults().camOn)

  const trimmedNick = nickname.trim()
  const canAct = trimmedNick.length > 0

  async function createRoom(): Promise<void> {
    if (!canAct) return
    setErr(null)
    setBusy(true)
    try {
      setStoredDisplayName(trimmedNick)
      saveLobbyMediaDefaults(lobbyMic, lobbyCam)
      const res = await fetch(`${apiOrigin()}/api/rooms`, { method: "POST" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { roomId?: string }
      if (!data.roomId) throw new Error("нет roomId")
      navigate(`/room/${encodeURIComponent(data.roomId)}`, { state: { skipPreJoin: true } })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function joinByCode(): void {
    if (!canAct) return
    const raw = joinCode.trim()
    if (!raw) {
      setErr("Введите код комнаты")
      return
    }
    setErr(null)
    setStoredDisplayName(trimmedNick)
    const code = raw.replace(/^.*\/room\//, "").split("/")[0].split("?")[0]
    saveLobbyMediaDefaults(lobbyMic, lobbyCam)
    navigate(`/room/${encodeURIComponent(code)}`, { state: { skipPreJoin: false } })
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-12 text-[var(--kvt-color-on-surface)]">
      <h1 className="text-center text-2xl font-semibold">Видеоконференции</h1>
      <p className="mt-2 text-center text-sm text-[var(--kvt-color-on-surface-variant)]">
        Укажите никнейм — без него вход недоступен.
      </p>

      <div className="mt-8 space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
        <div>
          <label htmlFor="nick" className="mb-1 block text-sm font-medium">
            Никнейм
          </label>
          <input
            id="nick"
            className="w-full rounded-lg border border-white/15 bg-[var(--kvt-color-surface)] px-3 py-2"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Как вас видят в эфире"
            maxLength={64}
          />
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={lobbyMic}
              onChange={(e) => {
                setLobbyMic(e.target.checked)
                saveLobbyMediaDefaults(e.target.checked, lobbyCam)
              }}
            />
            Микрофон при входе
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={lobbyCam}
              onChange={(e) => {
                setLobbyCam(e.target.checked)
                saveLobbyMediaDefaults(lobbyMic, e.target.checked)
              }}
            />
            Камера при входе
          </label>
        </div>

        <button
          type="button"
          className="w-full rounded-lg bg-[var(--kvt-color-primary)] py-3 font-medium text-[var(--kvt-color-on-primary)] disabled:opacity-45"
          disabled={!canAct || busy}
          onClick={() => void createRoom()}
        >
          Создать комнату
        </button>

        <div className="border-t border-white/10 pt-4">
          <label htmlFor="code" className="mb-1 block text-sm font-medium">
            Код или ссылка
          </label>
          <input
            id="code"
            className="w-full rounded-lg border border-white/15 bg-[var(--kvt-color-surface)] px-3 py-2"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="например abcdef12 или полная ссылка"
            onKeyDown={(e) => e.key === "Enter" && joinByCode()}
          />
          <button
            type="button"
            className="mt-3 w-full rounded-lg border border-white/15 py-3 font-medium disabled:opacity-45"
            disabled={!canAct}
            onClick={joinByCode}
          >
            Присоединиться
          </button>
        </div>

        <button
          type="button"
          className="w-full rounded-lg border border-white/10 py-2 text-sm text-[var(--kvt-color-on-surface-variant)]"
          onClick={() => setSettingsOpen(true)}
        >
          Настройки камеры и микрофона
        </button>

        {err ? <p className="text-center text-sm text-red-300">{err}</p> : null}
      </div>

      <MediaSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
