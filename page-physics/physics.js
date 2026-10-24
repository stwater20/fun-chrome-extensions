// Page Physics — clones what's on screen into a Matter.js world.
// The real page is only hidden (visibility), never rearranged, so Esc restores it exactly.
(() => {
  if (window.__pagePhysics) {
    window.__pagePhysics.stop();
    return;
  }
  const M = window.Matter;
  if (!M || !document.body) return;

  const vw = innerWidth;
  const vh = innerHeight;
  const MAX_BODIES = 220;
  const MAX_STYLED_NODES = 7000;
  const REPLACED = new Set(["IMG", "SVG", "VIDEO", "CANVAS", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "IFRAME", "EMBED", "OBJECT", "PICTURE", "HR"]);
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META", "BR", "HEAD", "SOURCE", "TRACK"]);

  // ---------- 1. pick the things on screen ----------
  function hasOwnText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }
  function visible(el, r) {
    if (r.width < 6 || r.height < 6) return false;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return false;
    if (r.width * r.height > vw * vh * 0.6) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05;
  }

  const candidates = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(el) {
      if (SKIP.has(el.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  for (let el = walker.nextNode(); el; el = walker.nextNode()) {
    const tag = el.tagName.toUpperCase();
    const replaced = REPLACED.has(tag);
    if (!replaced && !hasOwnText(el)) continue;
    const r = el.getBoundingClientRect();
    if (visible(el, r)) candidates.push({ el, r });
  }

  // Keep only outermost picks so a paragraph falls together with its links.
  const picked = new Set();
  const chosen = [];
  for (const c of candidates) {
    let p = c.el.parentElement, inside = false;
    while (p) {
      if (picked.has(p)) { inside = true; break; }
      p = p.parentElement;
    }
    if (inside) continue;
    picked.add(c.el);
    chosen.push(c);
  }
  // Prefer bigger things when there's too much on screen.
  chosen.sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
  chosen.length = Math.min(chosen.length, MAX_BODIES);
  if (!chosen.length) return;

  // ---------- 2. clone with computed styles ----------
  const PROPS = [
    "display", "box-sizing", "color", "font-family", "font-size", "font-weight", "font-style",
    "line-height", "letter-spacing", "word-spacing", "text-align", "text-decoration-line",
    "text-decoration-color", "text-transform", "text-shadow", "white-space", "vertical-align",
    "background-color", "background-image", "background-size", "background-position", "background-repeat",
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
    "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "box-shadow", "opacity", "list-style-type", "list-style-position", "object-fit", "object-position",
    "flex-direction", "flex-wrap", "align-items", "justify-content", "gap", "fill", "stroke", "overflow"
  ];
  let styled = 0;
  function copy(src, dst, isRoot) {
    if (styled++ > MAX_STYLED_NODES) return;
    const cs = getComputedStyle(src);
    const s = dst.style;
    for (const p of PROPS) s.setProperty(p, cs.getPropertyValue(p));
    const tag = src.tagName.toUpperCase();
    if (!isRoot && (REPLACED.has(tag) || cs.display.includes("inline-block"))) {
      s.width = cs.width;
      s.height = cs.height;
    }
  }
  function deepCopy(src, dst) {
    copy(src, dst, true);
    const a = document.createTreeWalker(src, NodeFilter.SHOW_ELEMENT);
    const b = document.createTreeWalker(dst, NodeFilter.SHOW_ELEMENT);
    let x = a.nextNode(), y = b.nextNode();
    while (x && y) {
      copy(x, y, false);
      x = a.nextNode();
      y = b.nextNode();
    }
  }
  function makeClone(el, r) {
    const tag = el.tagName.toUpperCase();
    let clone;
    if (tag === "IFRAME" || tag === "EMBED" || tag === "OBJECT") {
      // Re-cloning an iframe would reload it, so it falls as a placeholder box.
      clone = document.createElement("div");
      clone.textContent = "📺";
      clone.style.cssText = "display:flex;align-items:center;justify-content:center;font-size:28px;" +
        "background:repeating-linear-gradient(45deg,#ddd 0 10px,#eee 10px 20px);border:2px dashed #999;border-radius:6px";
    } else if (tag === "CANVAS") {
      clone = document.createElement("img");
      try { clone.src = el.toDataURL(); } catch (_) {}
      copy(el, clone, true);
    } else {
      clone = el.cloneNode(true);
      clone.removeAttribute("id");
      deepCopy(el, clone);
      if ("value" in el && typeof el.value === "string") clone.value = el.value;
      clone.querySelectorAll("iframe").forEach((f) => f.removeAttribute("src"));
      clone.querySelectorAll("video,audio").forEach((m) => { m.autoplay = false; m.removeAttribute("autoplay"); });
    }
    Object.assign(clone.style, {
      position: "absolute", left: "0", top: "0", margin: "0",
      width: r.width + "px", height: r.height + "px", boxSizing: "border-box",
      maxWidth: "none", maxHeight: "none", transformOrigin: "50% 50%",
      willChange: "transform", pointerEvents: "none", userSelect: "none", overflow: "hidden"
    });
    return clone;
  }

  // ---------- 3. build the world ----------
  const overlay = document.createElement("div");
  overlay.id = "__page-physics";
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483646;overflow:hidden;cursor:grab;contain:strict;";
  const hidden = [];
  const items = chosen.map(({ el, r }) => {
    const clone = makeClone(el, r);
    overlay.appendChild(clone);
    return { el, r, clone };
  });
  for (const { el } of items) {
    hidden.push([el, el.style.getPropertyValue("visibility"), el.style.getPropertyPriority("visibility")]);
    el.style.setProperty("visibility", "hidden", "important");
  }
  const rootStyle = document.documentElement.style;
  const oldOverflow = rootStyle.overflow;
  rootStyle.overflow = "hidden";
  document.documentElement.appendChild(overlay);

  const engine = M.Engine.create({ gravity: { x: 0, y: 1 } });
  const world = engine.world;
  const T = 200;
  M.Composite.add(world, [
    M.Bodies.rectangle(vw / 2, vh + T / 2, vw * 3, T, { isStatic: true }),
    M.Bodies.rectangle(vw / 2, -T / 2, vw * 3, T, { isStatic: true }),
    M.Bodies.rectangle(-T / 2, vh / 2, T, vh * 3, { isStatic: true }),
    M.Bodies.rectangle(vw + T / 2, vh / 2, T, vh * 3, { isStatic: true })
  ]);

  const bodies = items.map((it) => {
    const { r } = it;
    const body = M.Bodies.rectangle(r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, {
      restitution: 0.25,
      friction: 0.4,
      frictionAir: 0.012,
      chamfer: { radius: Math.min(6, r.width / 4, r.height / 4) }
    });
    // Pin it in place until its turn to fall. (Creating it with isStatic: true
    // leaves Matter without the original mass, so it could never be released.)
    M.Body.setStatic(body, true);
    it.body = body;
    return body;
  });
  M.Composite.add(world, bodies);

  function draw() {
    for (const it of items) {
      const { body, r, clone } = it;
      clone.style.transform =
        `translate(${body.position.x - r.width / 2}px, ${body.position.y - r.height / 2}px) rotate(${body.angle}rad)`;
    }
  }
  draw();

  // Let things go one by one, top of the page first, so it "collapses".
  const order = items.slice().sort((a, b) => a.r.top - b.r.top + (Math.random() - 0.5) * 120);
  const timers = order.map((it, i) =>
    setTimeout(() => {
      M.Body.setStatic(it.body, false);
      M.Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.04);
    }, 250 + (i / order.length) * 1400)
  );

  const mouse = M.Mouse.create(overlay);
  const grab = M.MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, damping: 0.1, render: { visible: false } }
  });
  M.Composite.add(world, grab);
  M.Events.on(grab, "startdrag", () => (overlay.style.cursor = "grabbing"));
  M.Events.on(grab, "enddrag", () => (overlay.style.cursor = "grab"));

  const runner = M.Runner.create();
  M.Events.on(engine, "afterUpdate", draw);
  M.Runner.run(runner, engine);

  // ---------- 4. toys ----------
  function impulseFrom(x, y, power) {
    for (const b of bodies) {
      if (b.isStatic) continue;
      const dx = b.position.x - x, dy = b.position.y - y;
      const d = Math.max(40, Math.hypot(dx, dy));
      const f = (power * b.mass) / d;
      M.Body.setVelocity(b, { x: b.velocity.x + (dx / d) * f * 40, y: b.velocity.y + (dy / d) * f * 40 });
      M.Body.setAngularVelocity(b, b.angularVelocity + (Math.random() - 0.5) * 0.2);
    }
  }
  function quake() {
    for (const b of bodies) {
      if (b.isStatic) continue;
      M.Body.setVelocity(b, { x: b.velocity.x + (Math.random() - 0.5) * 18, y: b.velocity.y - Math.random() * 16 });
    }
  }
  const G = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  function onKey(e) {
    if (e.key === "Escape") return stop();
    if (e.key === " ") quake();
    else if (G[e.key]) { engine.gravity.x = G[e.key][0]; engine.gravity.y = G[e.key][1]; }
    else if (e.key === "0") { const z = engine.gravity.x === 0 && engine.gravity.y === 0; engine.gravity.x = 0; engine.gravity.y = z ? 1 : 0; }
    else if (e.key.toLowerCase() === "b") impulseFrom(mouse.position.x, mouse.position.y, 1.2);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }
  addEventListener("keydown", onKey, true);
  overlay.addEventListener("dblclick", (e) => impulseFrom(e.clientX, e.clientY, 1.2));

  const hint = document.createElement("div");
  hint.textContent = "Drag & throw · Space quake · Arrows gravity · 0 zero-G · B / double-click bomb · Esc restore";
  hint.style.cssText =
    "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;" +
    "background:rgba(20,20,30,.85);color:#fff;font:600 13px/1.3 system-ui,sans-serif;padding:8px 14px;" +
    "border-radius:999px;transition:opacity .6s;white-space:nowrap";
  document.documentElement.appendChild(hint);
  const hintTimer = setTimeout(() => (hint.style.opacity = "0"), 5000);

  function stop() {
    timers.forEach(clearTimeout);
    clearTimeout(hintTimer);
    M.Runner.stop(runner);
    M.Engine.clear(engine);
    M.Mouse.clearSourceEvents && M.Mouse.clearSourceEvents(mouse);
    removeEventListener("keydown", onKey, true);
    overlay.remove();
    hint.remove();
    for (const [el, v, prio] of hidden) {
      if (v) el.style.setProperty("visibility", v, prio);
      else el.style.removeProperty("visibility");
    }
    rootStyle.overflow = oldOverflow;
    window.__pagePhysics = null;
  }
  window.__pagePhysics = { stop };
})();
