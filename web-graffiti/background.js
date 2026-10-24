// Web Graffiti service worker: identity, toolbar toggle, and the WebSocket relay.
// Pages never talk to the server directly; they talk to this worker through a port,
// and only a SHA-256 of the page URL (the "room") is ever sent to the server.

const DEFAULTS = { serverUrl: "", autoJoin: false, nick: "", color: "#ff4d6d", muted: [] };

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let identityPromise;
function identity() {
  identityPromise ||= (async () => {
    let { secret } = await chrome.storage.local.get("secret");
    if (!secret) {
      secret = crypto.randomUUID() + crypto.randomUUID();
      await chrome.storage.local.set({ secret });
    }
    return { secret, id: (await sha256(secret)).slice(0, 12) };
  })();
  return identityPromise;
}

// ---------- toolbar toggle ----------
async function toggle(tab) {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
  } catch (_) {
    // Page was open before install: inject now, then toggle.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
    } catch (e) {
      chrome.action.setBadgeText({ text: "×", tabId: tab.id });
      setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 1500);
    }
  }
}
chrome.action.onClicked.addListener(toggle);

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === "whoami") {
    identity().then(({ id }) => reply({ id }));
    return true;
  }
});

// ---------- relay ----------
const rooms = new Map(); // room -> Set<Port>
let ws = null;
let wsUrl = "";
let status = "off"; // off | connecting | online | offline
let retry = 1000;
let retryTimer = null;
let pingTimer = null;
const peers = new Map(); // room -> n

async function settings() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
}

function postRoom(room, msg) {
  for (const p of rooms.get(room) || []) {
    try { p.postMessage(msg); } catch (_) {}
  }
}
function postAll(msg) {
  for (const room of rooms.keys()) postRoom(room, msg);
}
function setStatus(s) {
  status = s;
  postAll({ type: "status", status });
}
function wsSend(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

async function ensureSocket() {
  const { serverUrl } = await settings();
  if (!serverUrl || !rooms.size) {
    if (ws) ws.close();
    setStatus(serverUrl ? "offline" : "off");
    return;
  }
  if (ws && wsUrl === serverUrl && ws.readyState <= WebSocket.OPEN) return;
  if (ws) ws.close();
  wsUrl = serverUrl;
  setStatus("connecting");
  const { secret } = await identity();
  let sock;
  try {
    sock = new WebSocket(serverUrl);
  } catch (e) {
    setStatus("offline");
    return;
  }
  ws = sock;
  sock.onopen = () => {
    retry = 1000;
    sock.send(JSON.stringify({ t: "hello", v: 1, secret }));
    for (const room of rooms.keys()) sock.send(JSON.stringify({ t: "join", room }));
    setStatus("online");
    clearInterval(pingTimer);
    pingTimer = setInterval(() => wsSend({ t: "ping" }), 20000); // keeps the worker and socket alive
  };
  sock.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch (_) { return; }
    if (!m.room || !rooms.has(m.room)) return;
    if (m.t === "snapshot") {
      peers.set(m.room, m.peers);
      postRoom(m.room, { type: "snapshot", notes: m.notes, strokes: m.strokes, peers: m.peers });
    } else if (m.t === "op") postRoom(m.room, { type: "op", op: m.op });
    else if (m.t === "cursor") postRoom(m.room, { type: "cursor", ...m });
    else if (m.t === "peers") {
      peers.set(m.room, m.n);
      postRoom(m.room, { type: "peers", n: m.n });
    }
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    clearInterval(pingTimer);
    setStatus("offline");
    if (rooms.size) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(ensureSocket, retry);
      retry = Math.min(retry * 2, 30000);
    }
  };
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "graffiti") return;
  let room = null;
  port.onMessage.addListener(async (msg) => {
    if (msg.type === "join" && /^[a-f0-9]{64}$/.test(msg.room)) {
      room = msg.room;
      if (!rooms.has(room)) rooms.set(room, new Set());
      const first = rooms.get(room).size === 0;
      rooms.get(room).add(port);
      port.postMessage({ type: "status", status });
      await ensureSocket();
      if (first) wsSend({ t: "join", room });
      else if (peers.has(room)) port.postMessage({ type: "peers", n: peers.get(room) });
    } else if (room && msg.type === "op") {
      wsSend({ t: "op", room, op: msg.op });
      // other tabs on the same page in this browser
      for (const p of rooms.get(room) || []) if (p !== port) p.postMessage({ type: "op", op: msg.op });
    } else if (room && msg.type === "cursor") {
      wsSend({ t: "cursor", room, x: msg.x, y: msg.y, nick: msg.nick, color: msg.color });
    } else if (room && msg.type === "resync") {
      wsSend({ t: "join", room });
    }
  });
  port.onDisconnect.addListener(() => {
    if (!room || !rooms.has(room)) return;
    rooms.get(room).delete(port);
    if (!rooms.get(room).size) {
      rooms.delete(room);
      peers.delete(room);
      wsSend({ t: "leave", room });
      if (!rooms.size && ws) ws.close();
    }
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.serverUrl) {
    if (ws) ws.close();
    ws = null;
    ensureSocket();
  }
});

chrome.runtime.onInstalled.addListener((d) => {
  identity();
  if (d.reason === "install") chrome.runtime.openOptionsPage();
});
