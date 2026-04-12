import { useCallback, useRef, useState } from "react";

export type PeerInfo = { id: string; name: string };

type ServerMsg = {
  type: string;
  peerId?: string;
  leftPeerId?: string;
  peers?: PeerInfo[];
  peer?: PeerInfo;
  kind?: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  message?: string;
};

function buildWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return explicit;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

function buildIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RTCIceServer[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      /* ignore */
    }
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

export function useVoiceRoom() {
  const [connected, setConnected] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const send = useCallback((obj: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    const q = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const c of q) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const attachRemote = useCallback((peerId: string, stream: MediaStream) => {
    const map = remoteAudioRef.current;
    let el = map.get(peerId);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      map.set(peerId, el);
    }
    el.srcObject = stream;
    void el.play().catch(() => {
      /* user gesture may be required */
    });
  }, []);

  const teardownMedia = useCallback(() => {
    pendingIceRef.current = [];
    for (const el of remoteAudioRef.current.values()) {
      el.srcObject = null;
    }
    remoteAudioRef.current.clear();
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }, []);

  const startWebRTC = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    pcRef.current = pc;
    for (const track of stream.getAudioTracks()) {
      pc.addTrack(track, stream);
    }
    pc.ontrack = (ev) => {
      const rs = ev.streams[0];
      if (!rs) return;
      const key = rs.id || ev.track.id;
      attachRemote(key, rs);
    };
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      send({ type: "signal", kind: "ice", candidate: ev.candidate.toJSON() });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: "signal", kind: "offer", sdp: offer.sdp ?? "" });
  }, [attachRemote, send]);

  const handleServerSignal = useCallback(
    async (msg: ServerMsg) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (msg.kind === "answer" && msg.sdp) {
        await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
        await flushPendingIce(pc);
        return;
      }
      if (msg.kind === "offer" && msg.sdp) {
        await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: "signal", kind: "answer", sdp: answer.sdp ?? "" });
        await flushPendingIce(pc);
        return;
      }
      if (msg.kind === "ice" && msg.candidate) {
        if (!pc.remoteDescription) {
          pendingIceRef.current.push(msg.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(msg.candidate);
        } catch {
          /* ignore */
        }
      }
    },
    [flushPendingIce, send],
  );

  const connect = useCallback(
    async (room: string, name: string) => {
      setError(null);
      teardownMedia();
      const url = buildWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = async (ev) => {
        let msg: ServerMsg;
        try {
          msg = JSON.parse(ev.data as string) as ServerMsg;
        } catch {
          return;
        }
        if (msg.type === "error") {
          setError(msg.message ?? "error");
          return;
        }
        if (msg.type === "joined" && msg.peerId) {
          setSelfId(msg.peerId);
          setPeers(msg.peers ?? []);
          setConnected(true);
          try {
            await startWebRTC();
          } catch (e) {
            setError(e instanceof Error ? e.message : "getUserMedia failed");
          }
          return;
        }
        if (msg.type === "peer_joined" && msg.peer) {
          setPeers((p) => [...p, msg.peer!]);
          return;
        }
        if (msg.type === "peer_left" && msg.leftPeerId) {
          setPeers((p) => p.filter((x) => x.id !== msg.leftPeerId));
          return;
        }
        if (msg.type === "signal") {
          await handleServerSignal(msg);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setSelfId(null);
        setPeers([]);
        teardownMedia();
      };

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("WebSocket error"));
      });

      ws.send(JSON.stringify({ type: "join", room, name }));
    },
    [handleServerSignal, startWebRTC, teardownMedia],
  );

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    teardownMedia();
    setConnected(false);
    setSelfId(null);
    setPeers([]);
  }, [teardownMedia]);

  const toggleMute = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  const toggleDeafen = useCallback(() => {
    const next = !deafened;
    setDeafened(next);
    for (const el of remoteAudioRef.current.values()) {
      el.muted = next;
    }
  }, [deafened]);

  return {
    connected,
    selfId,
    peers,
    error,
    connect,
    disconnect,
    muted,
    deafened,
    toggleMute,
    toggleDeafen,
  };
}
