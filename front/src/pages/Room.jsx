import { useParams, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

/**
 * Только H.264 для video (SRS требует валидный H.264 payload в SDP).
 * Нужно передавать в setCodecPreferences не только video/H264, но и следующий
 * в списке capabilities video/rtx (apt=…), иначе Chrome часто игнорирует prefs
 * и шлёт VP8/VP9/AV1/H265 без H.264.
 */
function extractH264BlocksFromCapabilities(codecs) {
  if (!codecs?.length) return [];
  const out = [];
  for (let i = 0; i < codecs.length; i++) {
    const c = codecs[i];
    if (!c || c.mimeType.toLowerCase() !== 'video/h264') continue;
    out.push(c);
    const next = codecs[i + 1];
    if (next?.mimeType?.toLowerCase() === 'video/rtx') {
      out.push(next);
    }
  }
  return out;
}

function isExcludedNonH264VideoMime(mime) {
  const x = (mime || '').toLowerCase();
  return (
    x === 'video/vp8' ||
    x === 'video/vp9' ||
    x === 'video/av1' ||
    x === 'video/h265' ||
    x === 'video/hevc'
  );
}

/** Если H.264+rtx не идут подряд в списке — убираем «лишние» видеокодеки, порядок остального сохраняем. */
function stripToH264FriendlyCodecs(codecs) {
  if (!codecs?.length) return [];
  const filtered = codecs.filter((c) => c && !isExcludedNonH264VideoMime(c.mimeType));
  return filtered.some((c) => c.mimeType.toLowerCase() === 'video/h264') ? filtered : [];
}

function h264VideoCodecPreferences(role) {
  const sender = RTCRtpSender.getCapabilities?.('video')?.codecs ?? [];
  const recv = RTCRtpReceiver.getCapabilities?.('video')?.codecs ?? [];
  try {
    const primary = role === 'subscribe' ? recv : sender;
    const secondary = role === 'subscribe' ? sender : recv;
    let prefs = extractH264BlocksFromCapabilities(primary);
    if (!prefs.length) prefs = extractH264BlocksFromCapabilities(secondary);
    if (!prefs.length) prefs = stripToH264FriendlyCodecs(primary);
    if (!prefs.length) prefs = stripToH264FriendlyCodecs(secondary);
    return prefs;
  } catch {
    return [];
  }
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

function getOrCreatePeerId() {
  const k = 'srs-room-peer';
  let id = sessionStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(k, id);
  }
  return id;
}

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
  const [wsReady, setWsReady] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState(() => new Map());

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const publishPcRef = useRef(null);
  const subsRef = useRef(new Map());
  const wsRef = useRef(null);

  const base = import.meta.env.VITE_SIGNAL_URL || '';

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
          'Браузер не сообщает H.264 для отправки видео — SRS не примет поток. Попробуйте Chrome, Edge или другое устройство.',
        );
      }
      if (videoTx) applyH264VideoOnly(videoTx, 'publish');

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitIceGathering(pc);
      const answerSdp = await postSdp('/api/rtc/whip', peerId, pc.localDescription.sdp);
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
