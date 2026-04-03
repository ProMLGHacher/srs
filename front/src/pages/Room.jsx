/**
 * Комната: сигналинг по WebSocket (кто публикует), медиа — WebRTC к SRS.
 *
 * Поток данных:
 * 1) WS /ws — join / publishing / unpublish; с сервера — state, peer-publish, peer-unpublish.
 * 2) Публикация: getUserMedia → RTCPeerConnection → POST /api/rtc/whip (SDP) — прокси на SRS WHIP.
 * 3) Подписка на участника: отдельный PC на каждый remote peerId → POST /api/rtc/whep.
 *
 * VITE_SIGNAL_URL — база для fetch (пусто = тот же origin, удобно за ngrok/https).
 * VITE_SIGNAL_WS — полный URL вебсокета, если сигналинг на другом хосте.
 */
import { useParams, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

/** Публичный STUN; при жёстком NAT без TURN может не хватить, но для LAN обычно достаточно. */
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

/**
 * SRS требует H.264 в SDP. На части Android Chrome узкий список только H264+rtx в
 * setCodecPreferences игнорируется — в offer остаются VP8/AV1/H265 без H264.
 * Решение: передать полную перестановку getCapabilities() — все H264 (+ следующий rtx)
 * в начале, остальные кодеки в исходном порядке (валидно для Chrome).
 */
function reorderVideoCodecsH264First(codecs) {
  if (!codecs?.length) return [];
  const n = codecs.length;
  const used = new Set();
  const front = [];
  for (let i = 0; i < n; i++) {
    if (used.has(i)) continue;
    const c = codecs[i];
    if (!c || c.mimeType.toLowerCase() !== 'video/h264') continue;
    used.add(i);
    front.push(c);
    const next = codecs[i + 1];
    if (next?.mimeType?.toLowerCase() === 'video/rtx') {
      used.add(i + 1);
      front.push(next);
    }
  }
  const tail = [];
  for (let i = 0; i < n; i++) {
    if (!used.has(i)) tail.push(codecs[i]);
  }
  return [...front, ...tail];
}

function hasH264InCodecList(codecs) {
  return codecs.some((c) => c?.mimeType?.toLowerCase() === 'video/h264');
}

/**
 * Для публикации важен только RTCRtpSender — список receiver не задаёт кодек энкодера.
 * Для WHEP — в приоритете receiver.
 */
function h264VideoCodecPreferences(role) {
  const sender = RTCRtpSender.getCapabilities?.('video')?.codecs ?? [];
  const recv = RTCRtpReceiver.getCapabilities?.('video')?.codecs ?? [];
  try {
    if (role === 'publish') {
      if (hasH264InCodecList(sender)) return reorderVideoCodecsH264First(sender);
      return [];
    }
    if (hasH264InCodecList(recv)) return reorderVideoCodecsH264First(recv);
    if (hasH264InCodecList(sender)) return reorderVideoCodecsH264First(sender);
    return [];
  } catch {
    return [];
  }
}

/** SRS смотрит на payload в SDP: без строки rtpmap … H264/ публикация будет отклонена. */
function sdpOfferIncludesH264Video(sdp) {
  if (!sdp) return false;
  const idx = sdp.search(/^m=video /m);
  if (idx === -1) return false;
  const rest = sdp.slice(idx);
  const end = rest.search(/\r?\nm=/);
  const block = end === -1 ? rest : rest.slice(0, end);
  return /a=rtpmap:\d+ H264\//i.test(block);
}

function applyH264VideoOnly(transceiver, role) {
  const codecs = h264VideoCodecPreferences(role);
  if (!codecs.length || !transceiver?.setCodecPreferences) return;
  try {
    transceiver.setCodecPreferences(codecs);
  } catch (e) {
    console.warn('H.264 setCodecPreferences:', e);
  }
}

/** Ждём end-of-candidates в SDP: SRS WHIP/WHEP в этом проекте без trickle ICE. */
function waitIceGathering(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(t);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const t = setTimeout(done, 4000);
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

/** Копирует локальный SDP (после ICE gather) в буфер — для отладки. */
async function copyLocalSdpToClipboard(sdp, label) {
  if (!sdp) return;
  const text = `--- WebRTC local SDP [${label}] ---\n${sdp}`;
  try {
    await navigator.clipboard.writeText(text);
    console.info(`[SDP] скопирован в буфер: ${label}`);
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      console.info(`[SDP] скопирован (fallback): ${label}`);
    } catch (e2) {
      console.warn('[SDP] буфер обмена недоступен:', e, e2);
    }
  }
}

/** Стабильный UUID на вкладку; новая вкладка = новый peer = отдельный поток в SRS (live/<peerId>). */
function getOrCreatePeerId() {
  const k = 'srs-room-peer';
  let id = sessionStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(k, id);
  }
  return id;
}

/** wss при https-странице (ngrok); иначе ws на текущий хост. */
function signalingWsUrl() {
  const explicit = import.meta.env.VITE_SIGNAL_WS;
  if (explicit) return explicit;
  const u = new URL(window.location.href);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/ws';
  u.search = '';
  u.hash = '';
  return u.toString();
}

export default function Room() {
  const { roomId } = useParams();
  const peerIdRef = useRef(getOrCreatePeerId());
  const peerId = peerIdRef.current;

  const [err, setErr] = useState('');
  const [live, setLive] = useState(false);
  /** WS открыт — можно слать join и publishing (кнопка публикации disabled до onopen). */
  const [wsReady, setWsReady] = useState(false);
  /** remotePeerId → MediaStream с ontrack (один поток на участника). */
  const [remoteStreams, setRemoteStreams] = useState(() => new Map());

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const publishPcRef = useRef(null);
  /** Подписки WHEP: по одному RTCPeerConnection на каждого удалённого peerId. */
  const subsRef = useRef(new Map());
  const wsRef = useRef(null);

  /** Префикс URL для API (production за другим доменом). */
  const base = import.meta.env.VITE_SIGNAL_URL || '';

  /** Прокси бэкенда на SRS: path = /api/rtc/whip | whep, peer = SRS stream name. */
  async function postSdp(path, qPeer, sdp) {
    const url = `${base}${path}?peer=${encodeURIComponent(qPeer)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: sdp,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${path} ${r.status}: ${text}`);
    return text;
  }

  // Сигналинг + подписки на уже публикующихся; при размонтировании — unpublish и закрытие всех PC.
  useEffect(() => {
    const ws = new WebSocket(signalingWsUrl());
    wsRef.current = ws;

    function cleanupSub(remotePeer) {
      const pc = subsRef.current.get(remotePeer);
      if (pc) {
        pc.close();
        subsRef.current.delete(remotePeer);
      }
      setRemoteStreams((prev) => {
        if (!prev.has(remotePeer)) return prev;
        const n = new Map(prev);
        n.delete(remotePeer);
        return n;
      });
    }

    /** WHEP-play потока live/<remotePeer> через наш бэкенд. */
    async function subscribePeer(remotePeer) {
      if (remotePeer === peerId || subsRef.current.has(remotePeer)) return;

      const pc = new RTCPeerConnection({ iceServers: ICE });
      subsRef.current.set(remotePeer, pc);
      pc.addTransceiver('audio', { direction: 'recvonly' });
      const videoRx = pc.addTransceiver('video', { direction: 'recvonly' });
      applyH264VideoOnly(videoRx, 'subscribe');

      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (!stream) return;
        setRemoteStreams((prev) => {
          const n = new Map(prev);
          n.set(remotePeer, stream);
          return n;
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanupSub(remotePeer);
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitIceGathering(pc);
        void copyLocalSdpToClipboard(pc.localDescription?.sdp, `WHEP → ${remotePeer.slice(0, 8)}…`);
        const answerSdp = await postSdp('/api/rtc/whep', remotePeer, pc.localDescription.sdp);
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch (e) {
        console.error(e);
        cleanupSub(remotePeer);
        setErr((prev) => prev || String(e.message || e));
      }
    }

    ws.onopen = () => {
      setErr('');
      setWsReady(true);
      ws.send(JSON.stringify({ t: 'join', roomId, peerId }));
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.t === 'state' && Array.isArray(msg.publishers)) {
        msg.publishers.forEach((p) => subscribePeer(p));
        return;
      }
      if (msg.t === 'peer-publish' && msg.peerId) {
        subscribePeer(msg.peerId);
        return;
      }
      if (msg.t === 'peer-unpublish' && msg.peerId) {
        cleanupSub(msg.peerId);
        return;
      }
      if (msg.t === 'error' && msg.message) {
        setErr(msg.message);
      }
    };

    ws.onerror = () => {
      setErr('WebSocket: ошибка соединения');
    };

    ws.onclose = () => {
      setWsReady(false);
      if (wsRef.current === ws) wsRef.current = null;
    };

    return () => {
      setWsReady(false);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.send(JSON.stringify({ t: 'unpublish' }));
      }
      ws.close();
      wsRef.current = null;
      publishPcRef.current?.close();
      publishPcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      subsRef.current.forEach((pc) => pc.close());
      subsRef.current.clear();
      setRemoteStreams(new Map());
      setLive(false);
    };
  }, [roomId, peerId, base]);

  /** WHIP-publish: один поток на peerId, после успеха уведомляем комнату по WS. */
  async function startPublish() {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 640 }, facingMode: 'user' },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection({ iceServers: ICE });
      publishPcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const videoTx = pc.getTransceivers().find((tr) => tr.sender?.track?.kind === 'video');
      if (!h264VideoCodecPreferences('publish').length) {
        throw new Error(
          'Среди кодеков отправки (RTCRtpSender) нет H.264 — SRS не примет WHIP. Попробуйте другое устройство или браузер.',
        );
      }
      if (videoTx) applyH264VideoOnly(videoTx, 'publish');

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitIceGathering(pc);

      const localSdp = pc.localDescription?.sdp;
      if (!sdpOfferIncludesH264Video(localSdp)) {
        throw new Error(
          'В SDP публикации нет H.264 (часто Chrome на Android с аппаратным HEVC: в offer только VP8/VP9/AV1/H.265). SRS WHIP требует H.264 в offer. Варианты: Firefox для Android, Safari/iOS, публикация с ПК, либо цепочка с перекодированием, не «голый» SRS.',
        );
      }

      await copyLocalSdpToClipboard(localSdp, 'WHIP publish');
      const answerSdp = await postSdp('/api/rtc/whip', peerId, localSdp);
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setLive(true);
      const w = wsRef.current;
      if (w && w.readyState === WebSocket.OPEN) {
        w.send(JSON.stringify({ t: 'publishing' }));
      }
    } catch (e) {
      console.error(e);
      setErr(String(e.message || e));
      publishPcRef.current?.close();
      publishPcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    }
  }

  /** Закрываем PC и снимаем себя из списка издателей на сервере сигналинга. */
  async function stopPublish() {
    const w = wsRef.current;
    if (w && w.readyState === WebSocket.OPEN) {
      w.send(JSON.stringify({ t: 'unpublish' }));
    }
    publishPcRef.current?.close();
    publishPcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setLive(false);
  }

  return (
    <div className="layout">
      <p>
        <Link to="/">← На главную</Link>
      </p>
      <h1>Комната: {roomId}</h1>
      <p style={{ color: '#9aa0a6', fontSize: 14 }}>
        Ваш peer: <code style={{ color: '#c9d1d9' }}>{peerId.slice(0, 8)}…</code> — откройте эту же комнату в другой вкладке
        (лучше инкогнито), чтобы получить второго участника.
      </p>

      <div className="toolbar">
        {!live ? (
          <button type="button" onClick={startPublish} disabled={!wsReady}>
            Включить микрофон и камеру
          </button>
        ) : (
          <button type="button" className="secondary" onClick={stopPublish}>
            Отключить трансляцию
          </button>
        )}
      </div>

      {err ? <div className="err">{err}</div> : null}

      <h2 style={{ marginTop: '1.5rem', fontSize: '1.1rem' }}>Участники</h2>
      <div className="grid">
        <div className="tile">
          <video ref={localVideoRef} autoPlay playsInline muted />
          <span className="label">Вы {live ? '(в эфире)' : ''}</span>
        </div>
        {[...remoteStreams.entries()].map(([rid, stream]) => (
          <RemoteTile key={rid} stream={stream} label={`Участник ${rid.slice(0, 8)}…`} />
        ))}
      </div>
    </div>
  );
}

/** Отдельный <video>: при смене stream перепривязываем srcObject (ключ в списке = peerId). */
function RemoteTile({ stream, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return (
    <div className="tile">
      <video ref={ref} autoPlay playsInline />
      <span className="label">{label}</span>
    </div>
  );
}
