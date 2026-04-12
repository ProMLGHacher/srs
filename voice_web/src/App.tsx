import { useState } from "react";
import { useVoiceRoom } from "./useVoiceRoom";

export function App() {
  const v = useVoiceRoom();
  const [room, setRoom] = useState("demo");
  const [name, setName] = useState("guest");

  return (
    <div className="layout">
      <h1>Голосовая комната (SFU, без SDK)</h1>
      <p className="self">
        WebSocket и WebRTC напрямую. Для двух устройств в LAN задайте{" "}
        <code>VOICE_PUBLIC_IP</code> для сервера (как для SRS).
      </p>

      <div className="card">
        <div className="row">
          <div>
            <label htmlFor="room">Комната</label>
            <br />
            <input
              id="room"
              value={room}
              disabled={v.connected}
              onChange={(e) => setRoom(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="name">Имя</label>
            <br />
            <input
              id="name"
              value={name}
              disabled={v.connected}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {!v.connected ? (
            <button type="button" onClick={() => void v.connect(room.trim(), name.trim() || "guest")}>
              Подключиться
            </button>
          ) : (
            <button type="button" className="danger" onClick={() => v.disconnect()}>
              Отключиться
            </button>
          )}
        </div>
        {v.error ? <div className="error">{v.error}</div> : null}
      </div>

      {v.connected ? (
        <div className="card">
          <div className="row">
            <span className="self">Ваш id: {v.selfId}</span>
            <button type="button" className="ghost" onClick={() => v.toggleMute()}>
              {v.muted ? "Вкл. микрофон" : "Выкл. микрофон"}
            </button>
            <button type="button" className="ghost" onClick={() => v.toggleDeafen()}>
              {v.deafened ? "Снять deafen" : "Deafen"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Участники</h2>
        <ul className="peers">
          {v.peers.length === 0 ? (
            <li className="self">Никого кроме вас (или ещё не вошли)</li>
          ) : (
            v.peers.map((p) => (
              <li key={p.id}>
                {p.name || p.id}
                <span className="self"> · {p.id.slice(0, 8)}…</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
