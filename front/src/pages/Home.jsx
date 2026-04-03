/**
 * Главная: произвольный строковый ID комнаты в URL (без нормализации на бэкенде).
 * Один и тот же roomId + разные вкладки/устройства = разные peerId в sessionStorage.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [id, setId] = useState('');
  const navigate = useNavigate();

  function go() {
    const trimmed = id.trim();
    if (!trimmed) return;
    // encodeURIComponent сохраняет спецсимволы в path-сегменте
    navigate(`/room/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="layout">
      <h1>Голос и видео (SRS SFU)</h1>
      <p style={{ color: '#9aa0a6', maxWidth: '36rem' }}>
        Укажите идентификатор комнаты и откройте ту же ссылку на другом устройстве или во второй вкладке с{' '}
        <strong>другой</strong> вкладкой/браузером — у каждого участника свой анонимный peer id.
      </p>
      <div className="card" style={{ marginTop: '1rem' }}>
        <label htmlFor="room" style={{ display: 'block', marginBottom: '0.5rem' }}>
          ID комнаты
        </label>
        <input
          id="room"
          type="text"
          placeholder="например, standup-42"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
        />
        <div style={{ marginTop: '1rem' }}>
          <button type="button" onClick={go} disabled={!id.trim()}>
            Войти
          </button>
        </div>
      </div>
    </div>
  );
}
