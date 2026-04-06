import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import fs from "fs";
import net from "net";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

dns.setDefaultResultOrder("ipv4first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3001;
const SRS_HTTP = (process.env.SRS_HTTP || "http://127.0.0.1:1985").replace(
  /\/$/,
  "",
);
const SRS_EIP = process.env.SRS_EIP || "192.168.1.248";

/** База URL для fetch к SRS (имя сервиса может быть зарезолвлено в IPv4). */
let srsFetchOrigin = SRS_HTTP;

function formatFetchErr(e) {
  const parts = [];
  for (let x = e; x; x = x.cause) {
    if (x.code) parts.push(x.code);
    if (x.syscall) parts.push(x.syscall);
    if (x.address) parts.push(`${x.address}:${x.port ?? ""}`);
    if (x.message) parts.push(x.message);
  }
  return parts.filter(Boolean).join(" | ") || String(e);
}

async function resolveSrsFetchOrigin() {
  try {
    const u = new URL(SRS_HTTP);
    if (net.isIP(u.hostname)) {
      srsFetchOrigin = SRS_HTTP;
      return;
    }
    const { address } = await dnsPromises.lookup(u.hostname, { family: 4 });
    u.hostname = address;
    srsFetchOrigin = u.origin;
    console.log(`SRS: ${SRS_HTTP} → запросы на ${srsFetchOrigin} (IPv4)`);
  } catch (e) {
    console.warn("SRS DNS (IPv4):", formatFetchErr(e), "— оставляем", SRS_HTTP);
    srsFetchOrigin = SRS_HTTP;
  }
}

async function waitForSrsReady() {
  const url = `${srsFetchOrigin}/api/v1/versions`;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 5000);
      const r = await fetch(url, { signal: ac.signal });
      clearTimeout(t);
      if (r.ok) {
        console.log("SRS API готов:", url);
        return true;
      }
      console.warn("SRS /api/v1/versions → HTTP", r.status);
    } catch (e) {
      console.warn("ожидание SRS...", formatFetchErr(e));
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const app = express();
app.use(cors({ origin: "*", credentials: false }));

const rawSdp = express.raw({
  type: ["application/sdp", "application/*", "*/*"],
  limit: "256kb",
});

function srsStreamUrl(kind, peer) {
  const q = new URLSearchParams({
    app: "live",
    stream: peer,
    eip: SRS_EIP,
  });
  return `${srsFetchOrigin}/rtc/v1/${kind}/?${q.toString()}`;
}

app.post("/api/rtc/whip", rawSdp, async (req, res) => {
  const peer = req.query.peer;
  if (!peer || typeof peer !== "string") {
    res.status(400).type("text/plain").send("query peer required");
    return;
  }
  try {
    const url = srsStreamUrl("whip", peer);
    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || "");
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body,
    });
    const text = await r.text();
    res.status(r.status).type("application/sdp").send(text);
  } catch (e) {
    console.error("whip proxy", e);
    res
      .status(502)
      .type("text/plain")
      .send(`fetch failed: ${formatFetchErr(e)}`);
  }
});

app.post("/api/rtc/whep", rawSdp, async (req, res) => {
  const peer = req.query.peer;
  if (!peer || typeof peer !== "string") {
    res.status(400).type("text/plain").send("query peer required");
    return;
  }
  try {
    const url = srsStreamUrl("whep", peer);
    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || "");
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body,
    });
    const text = await r.text();
    res.status(r.status).type("application/sdp").send(text);
  } catch (e) {
    console.error("whep proxy", e);
    res
      .status(502)
      .type("text/plain")
      .send(`fetch failed: ${formatFetchErr(e)}`);
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    srs: SRS_HTTP,
    srsFetch: srsFetchOrigin,
    eip: SRS_EIP,
  });
});

const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    const index = path.join(publicDir, "index.html");
    if (fs.existsSync(index)) res.sendFile(index);
    else next();
  });
}

const server = http.createServer(app);

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const socketsByRoom = new Map();
/** @type {Map<string, Set<string>>} */
const publishersByRoom = new Map();

function roomSockets(roomId) {
  if (!socketsByRoom.has(roomId)) socketsByRoom.set(roomId, new Set());
  return socketsByRoom.get(roomId);
}

function roomPublishers(roomId) {
  if (!publishersByRoom.has(roomId)) publishersByRoom.set(roomId, new Set());
  return publishersByRoom.get(roomId);
}

function safeSend(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcastRoom(roomId, msg, except) {
  const data = JSON.stringify(msg);
  const set = socketsByRoom.get(roomId);
  if (!set) return;
  for (const client of set) {
    if (client !== except && client.readyState === 1) client.send(data);
  }
}

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  /** @type {{ roomId?: string, peerId?: string, isPublishing?: boolean }} */
  const meta = {};

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      safeSend(ws, { t: "error", message: "invalid json" });
      return;
    }
    const t = msg.t;
    if (t === "ping") {
      safeSend(ws, { t: "pong" });
      return;
    }
    if (t === "join") {
      const roomId = msg.roomId != null ? String(msg.roomId) : "";
      const peerId = msg.peerId != null ? String(msg.peerId) : "";
      if (!roomId || !peerId) {
        safeSend(ws, {
          t: "error",
          message: "join requires roomId and peerId",
        });
        return;
      }
      if (meta.roomId && meta.roomId !== roomId) {
        roomSockets(meta.roomId).delete(ws);
      }
      meta.roomId = roomId;
      meta.peerId = peerId;
      meta.isPublishing = false;
      roomSockets(roomId).add(ws);
      const pubs = roomPublishers(roomId);
      const others = [...pubs].filter((p) => p !== peerId);
      safeSend(ws, { t: "state", publishers: others });
      return;
    }
    if (t === "publishing") {
      const { roomId, peerId } = meta;
      if (!roomId || !peerId) return;
      meta.isPublishing = true;
      roomPublishers(roomId).add(peerId);
      broadcastRoom(roomId, { t: "peer-publish", peerId }, ws);
      return;
    }
    if (t === "unpublish") {
      const { roomId, peerId } = meta;
      if (!roomId || !peerId) return;
      meta.isPublishing = false;
      const pubs = publishersByRoom.get(roomId);
      if (pubs) pubs.delete(peerId);
      broadcastRoom(roomId, { t: "peer-unpublish", peerId });
    }
  });

  ws.on("close", () => {
    const { roomId, peerId, isPublishing } = meta;
    if (roomId) {
      roomSockets(roomId).delete(ws);
      const pubs = publishersByRoom.get(roomId);
      if (pubs && peerId) pubs.delete(peerId);
      if (isPublishing && peerId) {
        broadcastRoom(roomId, { t: "peer-unpublish", peerId });
      }
      if (roomSockets(roomId).size === 0) socketsByRoom.delete(roomId);
      if (pubs && pubs.size === 0) publishersByRoom.delete(roomId);
    }
  });
});

server.on("upgrade", (request, socket, head) => {
  const host = request.headers.host || "localhost";
  let pathname = "/";
  try {
    pathname = new URL(request.url || "/", `http://${host}`).pathname;
  } catch {
    socket.destroy();
    return;
  }
  if (pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

async function main() {
  await resolveSrsFetchOrigin();
  const srsOk = await waitForSrsReady();
  if (!srsOk) {
    console.error(
      `SRS не ответил за 90 с по ${srsFetchOrigin}. Проверьте: docker compose ps, логи srs, общая сеть srsnet.`,
    );
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      `app 0.0.0.0:${PORT}  →  SRS ${srsFetchOrigin}  (eip=${SRS_EIP})`,
    );
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
