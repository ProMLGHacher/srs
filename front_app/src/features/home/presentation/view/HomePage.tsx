import { useFlow, useViewModel, useStateFlow } from "@kvt/react"
import { useNavigate } from "react-router"
import type { HomePageUiEvent } from "../model/HomePageUiEvent"
import { HomeViewModel } from "../view_model/HomeViewModel"

export function HomePage(_: unknown, VM = HomeViewModel) {
  const vm = useViewModel(VM)
  const { roomInput } = useStateFlow(vm.state)
  const navigate = useNavigate()

  useFlow(
    (event: HomePageUiEvent) => {
      if (event.type === "navigate_room" && event.payload) navigate(event.payload.path)
    },
    vm.uiEvent,
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-[var(--kvt-color-on-surface)]">
      <h1 className="text-2xl font-semibold">Голос и видео (SRS SFU)</h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--kvt-color-on-surface-variant)]">
        Укажите идентификатор комнаты и откройте ту же ссылку на другом устройстве или во второй вкладке с{" "}
        <strong>другой</strong> вкладкой/браузером — у каждого участника свой анонимный peer id.
      </p>
      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
        <label htmlFor="room" className="mb-2 block text-sm font-medium">
          ID комнаты
        </label>
        <input
          id="room"
          type="text"
          placeholder="например, standup-42"
          className="w-full min-w-[220px] rounded-lg border border-white/15 bg-[var(--kvt-color-surface)] px-3 py-2 text-[var(--kvt-color-on-surface)] placeholder:text-[var(--kvt-color-on-surface-variant)]"
          value={roomInput}
          onChange={(e) => vm.setRoomInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && vm.submit()}
        />
        <div className="mt-4">
          <button
            type="button"
            className="rounded-lg bg-[var(--kvt-color-primary)] px-4 py-2 font-medium text-[var(--kvt-color-on-primary)] disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => vm.submit()}
            disabled={!roomInput.trim()}
          >
            Войти
          </button>
        </div>
      </div>

      <details className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <summary className="cursor-pointer font-medium text-[var(--kvt-color-on-surface)]">
          Состояние экрана (отладка)
        </summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs text-[var(--kvt-color-on-surface)]">
          <dt className="text-[var(--kvt-color-on-surface-variant)]">roomInput.length</dt>
          <dd>{roomInput.length}</dd>
          <dt className="text-[var(--kvt-color-on-surface-variant)]">trim пустой</dt>
          <dd>{String(!roomInput.trim())}</dd>
          <dt className="text-[var(--kvt-color-on-surface-variant)]">кнопка активна</dt>
          <dd>{String(!!roomInput.trim())}</dd>
        </dl>
        <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-white/10 bg-black/40 p-2 text-[10px] text-[var(--kvt-color-on-surface-variant)]">
          {JSON.stringify({ roomInput }, null, 2)}
        </pre>
      </details>
    </div>
  )
}
