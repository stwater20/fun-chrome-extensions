// Web Graffiti — sticky notes and doodles that live on top of any page.
(() => {
  if (window.__webGraffiti || window.top !== window) return;
  window.__webGraffiti = true;

  const DEFAULTS = { serverUrl: "", autoJoin: false, nick: "", color: "#ff4d6d", muted: [] };
  const NOTE_COLORS = ["#fff27a", "#ffb3c7", "#a8e6ff", "#b9f5a6", "#e2c7ff"];
  const INKS = ["#ff4d6d", "#ffb703", "#2ec4b6", "#3a86ff", "#8338ec", "#111111", "#ffffff"];
  const STRIP = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$|si$)/;

  let me = { id: "local", nick: "", color: DEFAULTS.color };
  let settings = { ...DEFAULTS };
  let room = null;
  let port = null;
  let netStatus = "off";
  let peerCount = 1;
  const notes = new Map();
  const strokes = new Map();
  let host, root, ink, notesBox, cursorsBox, capture, bar;
  let isOpen = false, hidden = false, drawMode = false;
  let pen = { color: INKS[0], size: 5 };

  // ---------- helpers ----------
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const centerX = () => document.documentElement.clientWidth / 2;
  const toDoc = (cx, cy) => ({ x: Math.round(cx + scrollX - centerX()), y: Math.round(cy + scrollY) });
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function normalizedUrl() {
    const u = new URL(location.href);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (STRIP.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    let path = u.pathname.replace(/\/+$/, "") || "/";
    return u.origin + path + (u.searchParams.toString() ? "?" + u.searchParams : "");
  }
  const muted = (author) => (settings.muted || []).includes(author);
  const mine = (item) => item.author === me.id;

  // ---------- storage ----------
  let saveTimer;
  function saveLocal() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const key = "page:" + room;
      if (!notes.size && !strokes.size) return chrome.storage.local.remove(key);
      chrome.storage.local.set({
        [key]: {
          url: location.href.split("#")[0].slice(0, 300),
          title: document.title.slice(0, 120),
          notes: [...notes.values()],
          strokes: [...strokes.values()],
          at: Date.now()
        }
      });
    }, 300);
  }

  // ---------- network ----------
  function connect() {
    if (port || !settings.serverUrl) return;
    port = chrome.runtime.connect({ name: "graffiti" });
    port.onMessage.addListener(onNet);
    port.onDisconnect.addListener(() => {
      port = null;
      netStatus = "offline";
      renderNet();
      // The worker went to sleep; reconnect if we're still drawing here.
      if (isOpen || settings.autoJoin) setTimeout(connect, 1500);
    });
    port.postMessage({ type: "join", room });
  }
  function send(msg) {
    if (port) try { port.postMessage(msg); } catch (_) {}
  }
  function onNet(m) {
    if (m.type === "status") {
      netStatus = m.status;
      renderNet();
    } else if (m.type === "peers") {
      peerCount = m.n;
      renderNet();
    } else if (m.type === "snapshot") {
      peerCount = m.peers || 1;
      const serverNotes = new Map((m.notes || []).map((n) => [n.id, n]));
      const serverStrokes = new Map((m.strokes || []).map((s) => [s.id, s]));
      // push my offline work the server hasn't seen
      for (const n of notes.values()) if (mine(n) && !serverNotes.has(n.id)) send({ type: "op", op: { kind: "note:upsert", note: n } });
      for (const s of strokes.values()) if (mine(s) && !serverStrokes.has(s.id)) send({ type: "op", op: { kind: "stroke:add", stroke: s } });
      for (const [id, n] of serverNotes) notes.set(id, n);
      for (const [id, s] of serverStrokes) strokes.set(id, s);
      if (notes.size || strokes.size) mount();
      renderAll();
      renderNet();
      saveLocal();
    } else if (m.type === "op") {
      apply(m.op, true);
    } else if (m.type === "cursor") {
      showCursor(m);
    }
  }

  // ---------- state changes ----------
  function apply(op, remote) {
    switch (op.kind) {
      case "note:upsert":
        notes.set(op.note.id, op.note);
        break;
      case "note:delete":
        notes.delete(op.id);
        break;
      case "stroke:add":
        strokes.set(op.stroke.id, op.stroke);
        break;
      case "stroke:delete":
        strokes.delete(op.id);
        break;
      case "clear-author":
        for (const [id, n] of notes) if (n.author === op.author) notes.delete(id);
        for (const [id, s] of strokes) if (s.author === op.author) strokes.delete(id);
        break;
      default:
        return;
    }
    if (!remote) send({ type: "op", op });
    if (notes.size || strokes.size) mount();
    if (host) {
      if (op.kind === "note:upsert" && remote) renderNote(op.note);
      else if (op.kind === "stroke:add") renderStroke(op.stroke);
      else if (op.kind !== "note:upsert") renderAll();
    }
    saveLocal();
  }

  // ---------- DOM ----------
  const STYLE = `
    :host{all:initial}
    .ink{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}
    .ink path{fill:none;stroke-linecap:round;stroke-linejoin:round}
    .notes,.cursors{position:absolute;left:0;top:0;width:0;height:0}
    .note{position:absolute;width:190px;min-height:150px;display:flex;flex-direction:column;border-radius:3px;
      box-shadow:0 8px 18px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.2);font:15px/1.35 "Comic Sans MS","Chalkboard SE","Segoe Print",cursive;
      color:#2b2b2b;pointer-events:none;transform:rotate(var(--tilt));transition:box-shadow .15s}
    :host(.open) .note{pointer-events:auto}
    .note .head{display:flex;align-items:center;gap:4px;padding:4px 6px 0;font:600 11px/1.6 system-ui,sans-serif;color:#0008;cursor:grab;user-select:none}
    .note .head span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .note .head button{all:unset;cursor:pointer;opacity:.55;padding:0 3px;font-size:12px}
    .note .head button:hover{opacity:1}
    .note textarea{all:unset;flex:1;min-height:110px;padding:4px 10px 10px;white-space:pre-wrap;word-break:break-word;font:inherit;color:inherit;resize:none}
    .note.dragging{box-shadow:0 18px 30px rgba(0,0,0,.25);cursor:grabbing}
    .cursor{position:absolute;pointer-events:none;transition:transform .08s linear,opacity .4s;font:600 11px system-ui,sans-serif}
    .cursor svg{display:block}
    .cursor b{position:absolute;left:14px;top:14px;color:#fff;padding:1px 6px;border-radius:8px;white-space:nowrap}
    .capture{position:fixed;inset:0;cursor:crosshair;display:none;touch-action:none}
    .capture.on{display:block}
    .bar{position:fixed;right:16px;bottom:16px;display:none;align-items:center;gap:6px;padding:7px 9px;border-radius:14px;
      background:rgba(24,24,32,.92);color:#fff;font:13px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);user-select:none}
    :host(.open) .bar{display:flex}
    .bar button{all:unset;cursor:pointer;width:30px;height:30px;display:grid;place-items:center;border-radius:8px;font-size:16px}
    .bar button:hover{background:#ffffff1f}
    .bar button.on{background:#ffffff33;box-shadow:inset 0 0 0 1px #fff6}
    .sw{width:16px;height:16px;border-radius:50%;cursor:pointer;border:2px solid transparent}
    .sw.on{border-color:#fff}
    .size{width:60px;accent-color:#fff}
    .net{padding:0 6px;font-size:12px;opacity:.9;white-space:nowrap;cursor:default}
    .sep{width:1px;height:20px;background:#ffffff30}
  `;
  function mount() {
    if (host) return;
    host = document.createElement("div");
    host.id = "__web-graffiti";
    host.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483645;";
    root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style>
      <svg class="ink" xmlns="http://www.w3.org/2000/svg"><g></g></svg>
      <div class="notes"></div><div class="cursors"></div><div class="capture"></div>
      <div class="bar">
        <button data-act="note" title="Add a sticky note">📝</button>
        <button data-act="draw" title="Draw">✏️</button>
        <span class="inks"></span>
        <input class="size" type="range" min="2" max="28" title="Pen size">
        <button data-act="undo" title="Undo my last stroke">↩️</button>
        <button data-act="clear" title="Remove everything I made on this page">🧽</button>
        <span class="sep"></span>
        <button data-act="hide" title="Hide graffiti on this page">👁️</button>
        <span class="net"></span>
        <button data-act="close" title="Close (Alt+Shift+N)">✕</button>
      </div>`;
    ink = root.querySelector(".ink g");
    notesBox = root.querySelector(".notes");
    cursorsBox = root.querySelector(".cursors");
    capture = root.querySelector(".capture");
    bar = root.querySelector(".bar");
    const inks = root.querySelector(".inks");
    inks.style.cssText = "display:flex;gap:4px;align-items:center";
    for (const c of INKS) {
      const s = document.createElement("span");
      s.className = "sw" + (c === pen.color ? " on" : "");
      s.style.background = c;
      s.title = c;
      s.onclick = () => {
        pen.color = c;
        inks.querySelectorAll(".sw").forEach((x) => x.classList.toggle("on", x === s));
        setDraw(true);
      };
      inks.appendChild(s);
    }
    const size = root.querySelector(".size");
    size.value = pen.size;
    size.oninput = () => (pen.size = +size.value);
    bar.addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.act;
      if (act === "note") addNote();
      else if (act === "draw") setDraw(!drawMode);
      else if (act === "undo") undo();
      else if (act === "clear") clearMine();
      else if (act === "hide") setHidden(!hidden);
      else if (act === "close") setOpen(false);
    });
    bindDrawing();
    document.documentElement.appendChild(host);
    addEventListener("resize", renderAll);
    renderAll();
  }

  function setOpen(v) {
    isOpen = v;
    if (v) {
      mount();
      setHidden(false);
      connect();
    } else setDraw(false);
    host.classList.toggle("open", v);
    renderNet();
  }
  function setHidden(v) {
    hidden = v;
    if (!host) return;
    for (const el of [ink.parentNode, notesBox, cursorsBox]) el.style.visibility = v ? "hidden" : "";
    root.querySelector('[data-act="hide"]').classList.toggle("on", v);
  }
  function setDraw(v) {
    drawMode = v;
    if (!host) return;
    capture.classList.toggle("on", v);
    root.querySelector('[data-act="draw"]').classList.toggle("on", v);
  }
  function renderNet() {
    if (!root) return;
    const el = root.querySelector(".net");
    if (!settings.serverUrl) {
      el.textContent = "⚪ local";
      el.title = "Only you can see this. Add a graffiti server in Options to share.";
    } else if (netStatus === "online") {
      el.textContent = `🟢 ${peerCount} here`;
      el.title = "Connected — everyone here sees changes live";
    } else if (netStatus === "connecting") {
      el.textContent = "🟠 …";
      el.title = "Connecting";
    } else {
      el.textContent = "🔴 offline";
      el.title = "Can't reach the graffiti server. Saving locally for now.";
    }
  }

  // ---------- strokes ----------
  function pathFor(points) {
    if (!points.length) return "";
    if (points.length === 1) {
      const [x, y] = points[0];
      return `M${x} ${y}l0.1 0`;
    }
    let d = `M${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i];
      const [nx, ny] = points[i + 1];
      d += `Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
    }
    const last = points[points.length - 1];
    return d + `L${last[0]} ${last[1]}`;
  }
  function renderStroke(s) {
    if (!ink || muted(s.author)) return;
    let p = ink.querySelector(`[data-id="${CSS.escape(s.id)}"]`);
    if (!p) {
      p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.dataset.id = s.id;
      ink.appendChild(p);
    }
    p.setAttribute("d", pathFor(s.points));
    p.setAttribute("stroke", s.color);
    p.setAttribute("stroke-width", s.size);
  }
  function bindDrawing() {
    let current = null, path = null;
    capture.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      capture.setPointerCapture(e.pointerId);
      const { x, y } = toDoc(e.clientX, e.clientY);
      current = { id: uid(), author: me.id, color: pen.color, size: pen.size, points: [[x, y]], ts: Date.now() };
      path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.dataset.id = current.id;
      path.setAttribute("stroke", current.color);
      path.setAttribute("stroke-width", current.size);
      ink.appendChild(path);
      path.setAttribute("d", pathFor(current.points));
    });
    capture.addEventListener("pointermove", (e) => {
      if (current) {
        const { x, y } = toDoc(e.clientX, e.clientY);
        const [lx, ly] = current.points[current.points.length - 1];
        if (Math.hypot(x - lx, y - ly) >= 2 && current.points.length < 3000) {
          current.points.push([x, y]);
          path.setAttribute("d", pathFor(current.points));
        }
      }
      sendCursor(e);
    });
    const end = () => {
      if (!current) return;
      apply({ kind: "stroke:add", stroke: current }, false);
      current = null;
      path = null;
    };
    capture.addEventListener("pointerup", end);
    capture.addEventListener("pointercancel", end);
  }
  function undo() {
    const last = [...strokes.values()].filter(mine).sort((a, b) => b.ts - a.ts)[0];
    if (last) apply({ kind: "stroke:delete", id: last.id }, false);
  }
  function clearMine() {
    const count = [...notes.values()].filter(mine).length + [...strokes.values()].filter(mine).length;
    if (!count) return;
    if (confirm(`Remove all ${count} things you made on this page?`)) apply({ kind: "clear-author", author: me.id }, false);
  }

  // ---------- notes ----------
  function addNote() {
    const { x, y } = toDoc(innerWidth / 2 - 95 + (Math.random() - 0.5) * 80, innerHeight / 2 - 75 + (Math.random() - 0.5) * 60);
    const note = {
      id: uid(), author: me.id, nick: me.nick || "anon", x, y, text: "",
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      tilt: +((Math.random() - 0.5) * 5).toFixed(1), ts: Date.now()
    };
    apply({ kind: "note:upsert", note }, false);
    renderNote(note);
    setDraw(false);
    setTimeout(() => notesBox.querySelector(`[data-id="${CSS.escape(note.id)}"] textarea`)?.focus(), 30);
  }
  function renderNote(n) {
    if (!notesBox || muted(n.author)) return;
    let el = notesBox.querySelector(`[data-id="${CSS.escape(n.id)}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "note";
      el.dataset.id = n.id;
      el.innerHTML = `<div class="head"><span></span></div><textarea maxlength="500" spellcheck="false"></textarea>`;
      const head = el.querySelector(".head");
      const ta = el.querySelector("textarea");
      if (mine(n)) {
        const del = document.createElement("button");
        del.textContent = "✕";
        del.title = "Delete note";
        del.onclick = () => apply({ kind: "note:delete", id: n.id }, false);
        const recolor = document.createElement("button");
        recolor.textContent = "🎨";
        recolor.title = "Change color";
        recolor.onclick = () => {
          const cur = notes.get(n.id);
          const next = NOTE_COLORS[(NOTE_COLORS.indexOf(cur.color) + 1) % NOTE_COLORS.length];
          apply({ kind: "note:upsert", note: { ...cur, color: next, ts: Date.now() } }, false);
          el.style.background = next;
        };
        head.append(recolor, del);
        let t;
        ta.addEventListener("input", () => {
          clearTimeout(t);
          t = setTimeout(() => apply({ kind: "note:upsert", note: { ...notes.get(n.id), text: ta.value, ts: Date.now() } }, false), 400);
        });
        dragNote(el, head, n.id);
      } else {
        ta.readOnly = true;
        const mute = document.createElement("button");
        mute.textContent = "🔇";
        mute.title = "Hide everything from this person";
        mute.onclick = () => {
          const list = [...new Set([...(settings.muted || []), n.author])];
          chrome.storage.sync.set({ muted: list });
        };
        head.appendChild(mute);
      }
      ta.addEventListener("keydown", (e) => e.stopPropagation(), true);
      notesBox.appendChild(el);
    }
    el.querySelector(".head span").textContent = mine(n) ? "you" : n.nick || "anon";
    const ta = el.querySelector("textarea");
    if (root.activeElement !== ta) ta.value = n.text || "";
    el.style.background = n.color;
    el.style.setProperty("--tilt", (n.tilt || 0) + "deg");
    el.style.left = centerX() + n.x + "px";
    el.style.top = n.y + "px";
  }
  function dragNote(el, handle, id) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      el.classList.add("dragging");
      const start = { x: e.clientX, y: e.clientY, n: { ...notes.get(id) } };
      const move = (ev) => {
        const n = notes.get(id);
        n.x = start.n.x + ev.clientX - start.x;
        n.y = start.n.y + ev.clientY - start.y;
        el.style.left = centerX() + n.x + "px";
        el.style.top = n.y + "px";
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        el.classList.remove("dragging");
        apply({ kind: "note:upsert", note: { ...notes.get(id), ts: Date.now() } }, false);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  function renderAll() {
    if (!host) return;
    ink.replaceChildren();
    ink.setAttribute("transform", `translate(${centerX()} 0)`);
    for (const s of strokes.values()) renderStroke(s);
    const keep = new Set([...notes.keys()].filter((id) => !muted(notes.get(id).author)));
    for (const el of [...notesBox.children]) if (!keep.has(el.dataset.id)) el.remove();
    for (const n of notes.values()) renderNote(n);
  }

  // ---------- cursors ----------
  let lastCursor = 0;
  function sendCursor(e) {
    if (!port || netStatus !== "online") return;
    const now = performance.now();
    if (now - lastCursor < 50) return;
    lastCursor = now;
    const { x, y } = toDoc(e.clientX, e.clientY);
    send({ type: "cursor", x, y, nick: me.nick || "anon", color: me.color });
  }
  addEventListener("pointermove", (e) => isOpen && sendCursor(e), { passive: true });
  const cursorEls = new Map();
  function showCursor(m) {
    if (!cursorsBox || muted(m.id) || hidden) return;
    let c = cursorEls.get(m.id);
    if (!c) {
      c = document.createElement("div");
      c.className = "cursor";
      c.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18"><path d="M1 1l6 15 2.5-6.5L16 7z" stroke="#fff" stroke-width="1.4"/></svg><b></b>`;
      cursorsBox.appendChild(c);
      cursorEls.set(m.id, c);
    }
    const color = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : "#888";
    c.querySelector("path").setAttribute("fill", color);
    const b = c.querySelector("b");
    b.textContent = String(m.nick || "anon").slice(0, 20);
    b.style.background = color;
    c.style.transform = `translate(${centerX() + m.x}px, ${m.y}px)`;
    c.style.opacity = 1;
    clearTimeout(c._t);
    c._t = setTimeout(() => (c.style.opacity = 0), 5000);
  }

  // ---------- boot ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "toggle") setOpen(!isOpen);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const k in changes) settings[k] = changes[k].newValue;
    me.nick = settings.nick || me.nick;
    me.color = settings.color || me.color;
    if (changes.muted) renderAll();
    if (changes.serverUrl && settings.serverUrl && isOpen) connect();
    renderNet();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawMode) setDraw(false);
  });

  (async () => {
    room = await sha256(normalizedUrl());
    settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
    const who = await chrome.runtime.sendMessage({ type: "whoami" }).catch(() => null);
    me = { id: who?.id || "local", nick: settings.nick || "anon", color: settings.color };
    const local = (await chrome.storage.local.get("page:" + room))["page:" + room];
    if (local) {
      for (const n of local.notes || []) notes.set(n.id, n);
      for (const s of local.strokes || []) strokes.set(s.id, s);
    }
    if (notes.size || strokes.size) mount();
    if (settings.autoJoin && settings.serverUrl) connect();
  })();
})();
