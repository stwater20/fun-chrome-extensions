const DEFAULTS = { serverUrl: "", autoJoin: false, nick: "", color: "#ff4d6d", muted: [] };
const $ = (id) => document.getElementById(id);

async function load() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  $("nick").value = s.nick;
  $("color").value = s.color;
  $("server").value = s.serverUrl;
  $("autoJoin").checked = s.autoJoin;
  $("mutedInfo").textContent = s.muted.length
    ? `${s.muted.length} muted ${s.muted.length > 1 ? "people" : "person"}.`
    : "Nobody muted. Use 🔇 on someone's note to hide everything they make.";
  renderPages();
}

async function renderPages() {
  const all = await chrome.storage.local.get(null);
  const pages = Object.entries(all)
    .filter(([k]) => k.startsWith("page:"))
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
  const ul = $("pages");
  ul.replaceChildren();
  if (!pages.length) {
    ul.innerHTML = '<li><small>Nothing yet. Go deface something (politely).</small></li>';
    return;
  }
  for (const p of pages) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = p.url;
    a.target = "_blank";
    a.textContent = p.title || p.url;
    a.title = p.url;
    const small = document.createElement("small");
    small.textContent = `${(p.notes || []).length} notes · ${(p.strokes || []).length} strokes`;
    const del = document.createElement("button");
    del.textContent = "Forget";
    del.title = "Delete the copy saved in this browser";
    del.onclick = async () => {
      await chrome.storage.local.remove(p.key);
      renderPages();
    };
    li.append(a, small, del);
    ul.appendChild(li);
  }
}

$("nick").onchange = () => chrome.storage.sync.set({ nick: $("nick").value.trim().slice(0, 20) });
$("color").onchange = () => chrome.storage.sync.set({ color: $("color").value });
$("autoJoin").onchange = () => chrome.storage.sync.set({ autoJoin: $("autoJoin").checked });
$("server").onchange = () => {
  const v = $("server").value.trim();
  if (v && !/^wss?:\/\//.test(v)) {
    $("status").textContent = "⚠️ Address must start with wss:// (or ws:// for local testing)";
    return;
  }
  chrome.storage.sync.set({ serverUrl: v });
  $("status").textContent = v ? "Saved." : "Sharing off — local only.";
};
$("test").onclick = () => {
  const url = $("server").value.trim();
  if (!url) return ($("status").textContent = "Enter an address first.");
  $("status").textContent = "Connecting…";
  let done = false;
  try {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { if (!done) { done = true; ws.close(); $("status").textContent = "❌ No answer within 5 seconds."; } }, 5000);
    ws.onopen = () => ws.send(JSON.stringify({ t: "ping" }));
    ws.onmessage = (e) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      let ok = false;
      try { ok = JSON.parse(e.data).t === "pong"; } catch (_) {}
      $("status").textContent = ok ? "✅ Graffiti server is up." : "⚠️ Connected, but that doesn't look like a graffiti server.";
      ws.close();
    };
    ws.onerror = () => { if (!done) { done = true; clearTimeout(t); $("status").textContent = "❌ Couldn't connect."; } };
  } catch (e) {
    $("status").textContent = "❌ " + e.message;
  }
};
$("unmute").onclick = async () => {
  await chrome.storage.sync.set({ muted: [] });
  load();
};
$("export").onclick = async () => {
  const all = await chrome.storage.local.get(null);
  const pages = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith("page:")));
  const blob = new Blob([JSON.stringify({ version: 1, pages }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "web-graffiti-export.json";
  a.click();
};
$("import").onclick = () => $("file").click();
$("file").onchange = async () => {
  const f = $("file").files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const pages = Object.fromEntries(Object.entries(data.pages || {}).filter(([k]) => /^page:[a-f0-9]{64}$/.test(k)));
    await chrome.storage.local.set(pages);
    renderPages();
  } catch (e) {
    alert("That file doesn't look like a Web Graffiti export.");
  }
};
load();
