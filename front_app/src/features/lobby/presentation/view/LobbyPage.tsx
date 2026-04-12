import { Button, Card, Checkbox, Input, Stack } from "@kvatum/ui"
import { useViewModel, useStateFlow } from "@kvt/react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { LobbyViewModel } from "../view_model/LobbyViewModel"
import { MediaSettingsModal } from "./MediaSettingsModal"

export function LobbyPage(_: unknown, VM = LobbyViewModel) {
  const navigate = useNavigate()
  const vm = useViewModel(VM)

  const state = useStateFlow(vm.state)

  const [settingsOpen, setSettingsOpen] = useState(false)

  const trimmedNick = snap.nickname.trim()
  const canAct = trimmedNick.length > 0

  async function onCreateRoom(): Promise<void> {
    if (!canAct) return
    const roomId = await vm.createRoom()
    if (roomId) {
      navigate(`/room/${encodeURIComponent(roomId)}`, { state: { skipPreJoin: true } })
    }
  }

  function onJoinByCode(): void {
    if (!canAct) return
    const roomId = vm.joinByCode()
    if (roomId) {
      navigate(`/room/${encodeURIComponent(roomId)}`, { state: { skipPreJoin: false } })
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-6xl grid-cols-1 items-center gap-8 px-4 py-10 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-3xl border border-white/10 bg-linear-to-br from-[#202236] to-[#151826] p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#aab3c5]">kvatum live</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight text-white">Создавайте комнаты как в Discord</h1>
        <p className="mt-4 max-w-xl text-sm text-[#b8c0d4]">
          Быстрый вход, приватная ссылка, живые участники и управление медиа в одном плотном интерфейсе.
        </p>
      </section>

      <Card className="border-white/10 bg-[#1f2330]">
        <Stack gap="md">
          <div>
            <label htmlFor="nick" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#a8b0c2]">
              Никнейм
            </label>
            <Input
              id="nick"
              value={snap.nickname}
              onChange={(e) => vm.setNickname(e.target.value)}
              placeholder="Как вас видят в эфире"
              maxLength={64}
            />
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-[#d3d8e4]">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={snap.lobbyMic}
                onChange={(e) => {
                  vm.setLobbyMic(e.target.checked)
                }}
              />
              Микрофон при входе
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={snap.lobbyCam}
                onChange={(e) => {
                  vm.setLobbyCam(e.target.checked)
                }}
              />
              Камера при входе
            </label>
          </div>

          <Button variant="primary" fullWidth size="lg" disabled={!canAct || snap.busy} onClick={() => void onCreateRoom()}>
            Создать комнату
          </Button>

          <div className="border-t border-white/10 pt-4">
            <label htmlFor="code" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#a8b0c2]">
              Код или ссылка
            </label>
            <Input
              id="code"
              value={snap.joinCode}
              onChange={(e) => vm.setJoinCode(e.target.value)}
              placeholder="например abcdef12 или полная ссылка"
              onKeyDown={(e) => e.key === "Enter" && onJoinByCode()}
            />
            <Button className="mt-3" fullWidth disabled={!canAct} onClick={onJoinByCode}>
              Присоединиться
            </Button>
          </div>

          <Button variant="secondary" fullWidth onClick={() => setSettingsOpen(true)}>
            Настройки камеры и микрофона
          </Button>

          {snap.err ? <p className="text-center text-sm text-red-300">{snap.err}</p> : null}
        </Stack>
      </Card>

      <MediaSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
