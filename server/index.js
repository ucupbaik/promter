import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());

const distPath = join(__dirname, "..", "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/.*/, (req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// rooms: Map<roomId, { state, clients:Map<connId, conn>, apiToken }>
const rooms = new Map();

function defaultState() {
  return {
    roomTitle: "Acara Live Saya",
    timers: [
      { id: "t1", title: "Pembukaan", speaker: "MC", notes: "", durationSec: 300, finishTime: null, mode: "countdown", startType: "manual", startTime: null, linked: false, wrapYellow: 2, wrapRed: 1, color: "#3b82f6", running: false, startEpoch: null, elapsedAtPause: 0, chimeYellow: false, chimeRed: false, flashOnWrap: false },
      { id: "t2", title: "Presentasi Utama", speaker: "Pembicara", notes: "", durationSec: 1200, finishTime: null, mode: "countdown", startType: "manual", startTime: null, linked: false, wrapYellow: 2, wrapRed: 1, color: "#22c55e", running: false, startEpoch: null, elapsedAtPause: 0, chimeYellow: false, chimeRed: false, flashOnWrap: false },
      { id: "t3", title: "Tanya Jawab", speaker: "Panel", notes: "", durationSec: 600, finishTime: null, mode: "countdown", startType: "manual", startTime: null, linked: false, wrapYellow: 2, wrapRed: 1, color: "#eab308", running: false, startEpoch: null, elapsedAtPause: 0, chimeYellow: false, chimeRed: false, flashOnWrap: false },
    ],
    activeId: "t1",
    blackout: false,
    onAir: false,
    follow: true,
    flashSignal: 0,
    messages: [
      { id: "m1", text: "Mohon ditutup dalam 1 menit", color: "white", bold: false, upper: false, flash: false, visible: false, focus: false },
      { id: "m2", text: "Waktu habis!", color: "red", bold: true, upper: true, flash: true, visible: false, focus: false },
    ],
    questions: [],
    logs: [],
    settings: { timezone: "Waktu Lokal", displayFormat: "24h", overtime: "stop" },
    stage: {
      backdrop: { type: "color", value: "#000000", opacity: 1 },
      showLogo: false,
      logo: null,
      bumpers: [],
      layout: {
        logo: { x: 50, y: 7, w: 160, show: false },
        title: { x: 50, y: 24, size: 30 },
        timer: { x: 50, y: 48, size: 170 },
        speaker: { x: 50, y: 72, size: 30 },
        progress: { x: 50, y: 84, w: 55 },
        messages: { x: 50, y: 93 },
      },
    },
  };
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { state: defaultState(), clients: new Map(), apiToken: Math.random().toString(36).slice(2, 10) });
  }
  return rooms.get(roomId);
}

function connList(room) {
  return [...room.clients.values()].map((c) => ({
    id: c.id, output: c.output, identifier: c.identifier,
    connectedAt: c.connectedAt, transport: c.transport,
  }));
}

function broadcast(roomId, payload, exceptWs) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify(payload);
  room.clients.forEach((c) => {
    if (c.ws !== exceptWs && c.ws.readyState === 1) c.ws.send(msg);
  });
}

function sendConnections(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  broadcast(roomId, { type: "connections", connections: connList(room) });
}

function addLog(roomId, text) {
  const room = rooms.get(roomId);
  if (!room) return;
  const entry = { t: Date.now(), text };
  room.state.logs = [...room.state.logs.slice(-199), entry];
  broadcast(roomId, { type: "state", state: room.state });
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const roomId = url.searchParams.get("room") || "default";
  const output = url.searchParams.get("output") || "controller";
  const room = getRoom(roomId);
  const connId = Math.random().toString(36).slice(2, 8);
  const conn = { id: connId, ws, output, identifier: "", connectedAt: Date.now(), transport: "WebSocket" };
  room.clients.set(connId, conn);
  ws.connId = connId;
  ws.roomId = roomId;

  ws.send(JSON.stringify({ type: "init", state: room.state, connections: connList(room), apiToken: room.apiToken }));
  sendConnections(roomId);
  addLog(roomId, `Koneksi baru: ${output}`);

  ws.on("message", (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    if (data.type === "update" && data.state) {
      room.state = data.state;
      broadcast(roomId, { type: "state", state: room.state }, ws);
    } else if (data.type === "flash") {
      room.state.flashSignal = (room.state.flashSignal || 0) + 1;
      broadcast(roomId, { type: "state", state: room.state }, ws);
    } else if (data.type === "stage-update" && data.stage) {
      room.state.stage = data.stage;
      broadcast(roomId, { type: "state", state: room.state }, ws);
    } else if (data.type === "log" && data.text) {
      addLog(roomId, data.text);
    } else if (data.type === "question-add" && data.question) {
      room.state.questions = [...room.state.questions, { id: Math.random().toString(36).slice(2, 9), text: data.question, name: data.name || "", answered: false, t: Date.now() }];
      broadcast(roomId, { type: "state", state: room.state });
    } else if (data.type === "question-update" && data.id) {
      room.state.questions = room.state.questions.map((q) => q.id === data.id ? { ...q, ...data.patch } : q);
      broadcast(roomId, { type: "state", state: room.state });
    } else if (data.type === "question-delete" && data.id) {
      room.state.questions = room.state.questions.filter((q) => q.id !== data.id);
      broadcast(roomId, { type: "state", state: room.state });
    } else if (data.type === "conn-update") {
      const c = room.clients.get(data.id);
      if (c) { c.identifier = data.identifier || ""; sendConnections(roomId); }
    } else if (data.type === "conn-action") {
      const c = room.clients.get(data.id);
      if (c && c.ws.readyState === 1) {
        if (data.action === "reload") c.ws.send(JSON.stringify({ type: "reload" }));
        if (data.action === "flash") c.ws.send(JSON.stringify({ type: "identify" }));
        if (data.action === "disconnect") c.ws.close();
      }
    } else if (data.type === "conn-action-all") {
      room.clients.forEach((c) => {
        if (c.id === connId) return;
        if (data.action === "reload" && c.ws.readyState === 1) c.ws.send(JSON.stringify({ type: "reload" }));
        if (data.action === "disconnect") c.ws.close();
      });
    }
  });

  ws.on("close", () => {
    room.clients.delete(connId);
    sendConnections(roomId);
    addLog(roomId, `Koneksi tertutup: ${output}`);
  });
});

/* ===================== HTTP API ===================== */
function auth(req, res, roomId) {
  const token = req.query.token || req.body?.token;
  const room = rooms.get(roomId);
  if (!room || token !== room.apiToken) {
    res.status(401).json({ error: "Token tidak valid" });
    return null;
  }
  return room;
}

app.get("/api/:room/state", (req, res) => {
  const room = auth(req, res, req.params.room);
  if (!room) return;
  res.json(room.state);
});
app.post("/api/:room/timer/start", (req, res) => {
  const room = auth(req, res, req.params.room);
  if (!room) return;
  const id = req.body.id || room.state.activeId;
  room.state.timers = room.state.timers.map((t) => t.id === id && !t.running ? { ...t, running: true, startEpoch: Date.now() - t.elapsedAtPause * 1000 } : t);
  broadcast(req.params.room, { type: "state", state: room.state });
  res.json({ ok: true });
});
app.post("/api/:room/timer/pause", (req, res) => {
  const room = auth(req, res, req.params.room);
  if (!room) return;
  const id = req.body.id || room.state.activeId;
  room.state.timers = room.state.timers.map((t) => {
    if (t.id !== id || !t.running) return t;
    const el = (Date.now() - t.startEpoch) / 1000;
    return { ...t, running: false, elapsedAtPause: el };
  });
  broadcast(req.params.room, { type: "state", state: room.state });
  res.json({ ok: true });
});
app.post("/api/:room/timer/reset", (req, res) => {
  const room = auth(req, res, req.params.room);
  if (!room) return;
  const id = req.body.id || room.state.activeId;
  room.state.timers = room.state.timers.map((t) => t.id === id ? { ...t, running: false, elapsedAtPause: 0, startEpoch: null } : t);
  broadcast(req.params.room, { type: "state", state: room.state });
  res.json({ ok: true });
});
app.post("/api/:room/timer/adjust", (req, res) => {
  const room = auth(req, res, req.params.room);
  if (!room) return;
  const id = req.body.id || room.state.activeId;
  const delta = Number(req.body.delta) || 0;
  room.state.timers = room.state.timers.map((t) => {
    if (t.id !== id) return t;
    if (t.running) return { ...t, startEpoch: t.startEpoch - delta * 1000 };
    return { ...t, elapsedAtPause: Math.max(0, t.elapsedAtPause + delta) };
  });
  broadcast(req.params.room, { type: "state", state: room.state });
  res.json({ ok: true });
});
app.post("/api/:room/blackout", (req, res) => {
  const room = auth(req, res, req.params.room);
  if (!room) return;
  room.state.blackout = !!req.body.value;
  broadcast(req.params.room, { type: "state", state: room.state });
  res.json({ ok: true });
});
app.post("/api/:room/flash", (req, res) => {
  const room = auth(req, res, req.params.room);
  if (!room) return;
  room.state.flashSignal = (room.state.flashSignal || 0) + 1;
  broadcast(req.params.room, { type: "state", state: room.state });
  res.json({ ok: true });
});

server.listen(PORT, () => {
  console.log(`Stage Timer server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});
