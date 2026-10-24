// Web Graffiti relay server.
// - Rooms are SHA-256 hashes of page URLs; the server never sees real addresses.
// - Authors are derived from a per-install secret, so only you can edit or delete your own stuff.
// - State is kept in memory and saved to ./data/rooms.json every 30 s.
import { WebSocketServer } from "ws";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import http from "node:http";

const PORT = +process.env.PORT || 8787;
const DATA_DIR = process.env.DATA_DIR || "./data";
const LIMITS = {
  msgBytes: 64 * 1024,
  notesPerRoom: 300,
  strokesPerRoom: 3000,
  pointsPerStroke: 3000,
  textLen: 500,
  nickLen: 20,
  roomsPerConn: 20,
  opsPerSec: 30,
  cursorsPerSec: 25,
  maxRooms: 50000
};

const rooms = new Map(); // id -> { notes: Map, strokes: Map, clients: Set, touched }
let dirty = false;

mkdirSync(DATA_DIR, { recursive: true });
try {
  const saved = JSON.parse(readFileSync(`${DATA_DIR}/rooms.json`, "utf8"));
  for (const [id, r] of Object.entries(saved)) {
    rooms.set(id, {
      notes: new Map(r.notes.map((n) => [n.id, n])),
      strokes: new Map(r.strokes.map((s) => [s.id, s])),
      clients: new Set(),
      touched: r.touched || Date.now()
    });
  }
  console.log(`loaded ${rooms.size} rooms`);
} catch (_) {}

setInterval(() => {
  if (!dirty) return;
  dirty = false;
  const out = {};
  for (const [id, r] of rooms) {
    if (!r.notes.size && !r.strokes.size) continue;
    out[id] = { notes: [...r.notes.values()], strokes: [...r.strokes.values()], touched: r.touched };
  }
  writeFileSync(`${DATA_DIR}/rooms.json.tmp`, JSON.stringify(out));
  renameSync(`${DATA_DIR}/rooms.json.tmp`, `${DATA_DIR}/rooms.json`);
}, 30000);

const authorOf = (secret) => createHash("sha256").update(secret).digest("hex").slice(0, 12);
const str = (v, max) => String(v ?? "").slice(0, max);
const num = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
const id = (v) => str(v, 40).replace(/[^a-z0-9]/gi, "");
const color = (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : "#888888");

function room(rid) {
  let r = rooms.get(rid);
  if (!r) {
    if (rooms.size >= LIMITS.maxRooms) return null;
    r = { notes: new Map(), strokes: new Map(), clients: new Set(), touched: Date.now() };
    rooms.set(rid, r);
  }
  return r;
}

// Validate and normalise an op; returns null if it must be dropped.
function clean(op, author, r) {
  switch (op?.kind) {
    case "note:upsert": {
      const n = op.note || {};
      const nid = id(n.id);
      if (!nid) return null;
      const existing = r.notes.get(nid);
      if (existing && existing.author !== author) return null;
      if (!existing && r.notes.size >= LIMITS.notesPerRoom) return null;
      return { kind: op.kind, note: {
        id: nid, author, nick: str(n.nick, LIMITS.nickLen) || "anon", x: num(n.x), y: num(n.y),
        text: str(n.text, LIMITS.textLen), color: color(n.color), tilt: Math.max(-5, Math.min(5, +n.tilt || 0)), ts: Date.now()
      } };
    }
    case "note:delete": {
      const n = r.notes.get(id(op.id));
      return n && n.author === author ? { kind: op.kind, id: n.id } : null;
    }
    case "stroke:add": {
      const s = op.stroke || {};
      const sid = id(s.id);
      if (!sid || r.strokes.has(sid) || r.strokes.size >= LIMITS.strokesPerRoom) return null;
      if (!Array.isArray(s.points) || !s.points.length) return null;
      const points = s.points.slice(0, LIMITS.pointsPerStroke).map((p) => [num(p?.[0]), num(p?.[1])]);
      return { kind: op.kind, stroke: {
        id: sid, author, color: color(s.color), size: Math.max(1, Math.min(40, num(s.size))), points, ts: Date.now()
      } };
    }
    case "stroke:delete": {
      const s = r.strokes.get(id(op.id));
      return s && s.author === author ? { kind: op.kind, id: s.id } : null;
    }
    case "clear-author":
      return { kind: op.kind, author };
    default:
      return null;
  }
}

function applyOp(r, op) {
  if (op.kind === "note:upsert") r.notes.set(op.note.id, op.note);
  else if (op.kind === "note:delete") r.notes.delete(op.id);
  else if (op.kind === "stroke:add") r.strokes.set(op.stroke.id, op.stroke);
  else if (op.kind === "stroke:delete") r.strokes.delete(op.id);
  else if (op.kind === "clear-author") {
    for (const [k, n] of r.notes) if (n.author === op.author) r.notes.delete(k);
    for (const [k, s] of r.strokes) if (s.author === op.author) r.strokes.delete(k);
  }
  r.touched = Date.now();
  dirty = true;
}

function broadcast(r, rid, msg, except) {
  const data = JSON.stringify({ ...msg, room: rid });
  for (const c of r.clients) if (c !== except && c.readyState === 1) c.send(data);
}
const peers = (r, rid) => broadcast(r, rid, { t: "peers", n: r.clients.size });

function bucket(perSec) {
  let tokens = perSec, last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(perSec, tokens + ((now - last) / 1000) * perSec);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end(`web-graffiti relay · ${rooms.size} rooms\n`);
});
const wss = new WebSocketServer({ server, maxPayload: LIMITS.msgBytes });

wss.on("connection", (ws) => {
  let author = null;
  const joined = new Set();
  const opOk = bucket(LIMITS.opsPerSec);
  const curOk = bucket(LIMITS.cursorsPerSec);
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (_) { return; }
    if (m.t === "ping") return ws.send(JSON.stringify({ t: "pong" }));
    if (m.t === "hello") {
      if (typeof m.secret === "string" && m.secret.length >= 32) author = authorOf(m.secret);
      return;
    }
    const rid = typeof m.room === "string" && /^[a-f0-9]{64}$/.test(m.room) ? m.room : null;
    if (!rid) return;
    if (m.t === "join") {
      if (!joined.has(rid) && joined.size >= LIMITS.roomsPerConn) return;
      const r = room(rid);
      if (!r) return;
      joined.add(rid);
      r.clients.add(ws);
      ws.send(JSON.stringify({
        t: "snapshot", room: rid, notes: [...r.notes.values()], strokes: [...r.strokes.values()], peers: r.clients.size
      }));
      peers(r, rid);
    } else if (m.t === "leave") {
      const r = rooms.get(rid);
      joined.delete(rid);
      if (r) { r.clients.delete(ws); peers(r, rid); }
    } else if (m.t === "op") {
      const r = rooms.get(rid);
      if (!author || !r || !joined.has(rid) || !opOk()) return;
      const op = clean(m.op, author, r);
      if (!op) return;
      applyOp(r, op);
      broadcast(r, rid, { t: "op", op }, ws);
    } else if (m.t === "cursor") {
      const r = rooms.get(rid);
      if (!author || !r || !joined.has(rid) || !curOk()) return;
      broadcast(r, rid, { t: "cursor", id: author, x: num(m.x), y: num(m.y), nick: str(m.nick, LIMITS.nickLen), color: color(m.color) }, ws);
    }
  });

  ws.on("close", () => {
    for (const rid of joined) {
      const r = rooms.get(rid);
      if (!r) continue;
      r.clients.delete(ws);
      peers(r, rid);
    }
  });
});

// Drop dead connections.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`web-graffiti relay on :${PORT}`));
