// Typing Rampage — particles, shake and a combo meter for every text box.
(() => {
  if (window.__typingRampage) return;
  window.__typingRampage = true;

  const DEFAULTS = {
    enabled: true,
    particles: true,
    shake: true,
    sound: false,
    intensity: 2, // 1..3
    theme: "rainbow", // rainbow | fire | ice | mono
    blockedHosts: []
  };
  let settings = { ...DEFAULTS };
  let stats = { best: 0, total: 0 };

  const LEVELS = [
    [500, "BEYOND GODLIKE"],
    [200, "GODLIKE"],
    [100, "UNSTOPPABLE"],
    [50, "RAMPAGE!"],
    [25, "GREAT"],
    [10, "NICE"]
  ];
  const COMBO_TIMEOUT = 2500;

  // ---------- settings ----------
  chrome.storage.sync.get(DEFAULTS, (s) => (settings = { ...DEFAULTS, ...s }));
  chrome.storage.local.get({ best: 0, total: 0 }, (s) => (stats = s));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") for (const k in changes) settings[k] = changes[k].newValue;
    if (area === "local" && changes.best) stats.best = changes.best.newValue;
  });
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === "host?") reply({ host: location.hostname });
  });
  const active = () =>
    settings.enabled && !(settings.blockedHosts || []).includes(location.hostname);

  // ---------- editable detection ----------
  const TEXT_INPUTS = new Set(["text", "search", "email", "url", "tel", "number", ""]);
  function editableTarget(el) {
    if (!el) return null;
    if (el.tagName === "TEXTAREA") return el;
    if (el.tagName === "INPUT") {
      const t = (el.getAttribute("type") || "").toLowerCase();
      return TEXT_INPUTS.has(t) ? el : null; // password fields are skipped on purpose
    }
    if (el.isContentEditable) return el;
    return null;
  }

  // ---------- caret position ----------
  const MIRROR_PROPS = [
    "boxSizing", "width", "height", "overflowX", "overflowY", "borderTopWidth",
    "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "paddingTop",
    "paddingRight", "paddingBottom", "paddingLeft", "fontStyle", "fontVariant",
    "fontWeight", "fontStretch", "fontSize", "lineHeight", "fontFamily", "textAlign",
    "textTransform", "textIndent", "letterSpacing", "wordSpacing", "tabSize"
  ];
  function caretPoint(el) {
    const rect = el.getBoundingClientRect();
    try {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        const pos = el.selectionEnd ?? el.value.length;
        const cs = getComputedStyle(el);
        const div = document.createElement("div");
        const st = div.style;
        for (const p of MIRROR_PROPS) st[p] = cs[p];
        st.position = "absolute";
        st.visibility = "hidden";
        st.whiteSpace = el.tagName === "TEXTAREA" ? "pre-wrap" : "pre";
        st.wordWrap = "break-word";
        st.top = "0";
        st.left = "-9999px";
        div.textContent = el.value.substring(0, pos);
        const span = document.createElement("span");
        span.textContent = el.value.substring(pos) || ".";
        div.appendChild(span);
        document.body.appendChild(div);
        const x = rect.left + span.offsetLeft - el.scrollLeft;
        const y = rect.top + span.offsetTop - el.scrollTop + parseFloat(cs.fontSize) * 0.6;
        div.remove();
        return {
          x: Math.min(Math.max(x, rect.left), rect.right),
          y: Math.min(Math.max(y, rect.top), rect.bottom)
        };
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const r = sel.getRangeAt(0).cloneRange();
        r.collapse(false);
        const rr = r.getClientRects()[0] || r.getBoundingClientRect();
        if (rr && (rr.x || rr.y)) return { x: rr.right, y: rr.top + rr.height / 2 };
      }
    } catch (_) {}
    return { x: rect.left + 12, y: rect.top + rect.height / 2 };
  }

  // ---------- particles ----------
  let canvas, ctx, particles = [], running = false;
  function ensureCanvas() {
    if (canvas && canvas.isConnected) return;
    canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      position: "fixed", inset: "0", width: "100vw", height: "100vh",
      pointerEvents: "none", zIndex: "2147483646"
    });
    canvas.setAttribute("aria-hidden", "true");
    document.documentElement.appendChild(canvas);
    ctx = canvas.getContext("2d");
    sizeCanvas();
  }
  function sizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", sizeCanvas);

  function color(i) {
    switch (settings.theme) {
      case "fire": return `hsl(${10 + Math.random() * 45},100%,${50 + Math.random() * 15}%)`;
      case "ice": return `hsl(${185 + Math.random() * 40},90%,${60 + Math.random() * 20}%)`;
      case "mono": return `hsl(0,0%,${30 + Math.random() * 50}%)`;
      default: return `hsl(${(performance.now() / 6 + i * 25) % 360},95%,60%)`;
    }
  }

  function burst(x, y, n, kind) {
    ensureCanvas();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (kind === "big" ? 4 : 2) + Math.random() * (kind === "big" ? 7 : 4);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2.5,
        life: 1,
        decay: 0.015 + Math.random() * 0.025,
        size: 2 + Math.random() * (kind === "big" ? 4 : 3),
        c: kind === "delete" ? `hsl(0,90%,${45 + Math.random() * 20}%)` : color(i),
        sq: Math.random() < 0.35
      });
    }
    if (particles.length > 600) particles.splice(0, particles.length - 600);
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }
  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += 0.25;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.c;
      if (p.sq) ctx.fillRect(p.x, p.y, p.size, p.size);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (particles.length) requestAnimationFrame(tick);
    else running = false;
  }

  // ---------- shake ----------
  const shaking = new WeakMap();
  function shake(el, power) {
    if (shaking.has(el)) return;
    const original = el.style.transform;
    shaking.set(el, true);
    let frames = 6;
    const step = () => {
      if (frames-- <= 0) {
        el.style.transform = original;
        shaking.delete(el);
        return;
      }
      const f = (power * frames) / 6;
      el.style.transform = `${original} translate(${(Math.random() - 0.5) * f}px, ${(Math.random() - 0.5) * f}px)`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- sound ----------
  let audio;
  function blip(combo, kind) {
    try {
      audio = audio || new AudioContext();
      const o = audio.createOscillator();
      const g = audio.createGain();
      const base = kind === "delete" ? 140 : 300 + Math.min(combo, 120) * 6;
      o.type = kind === "big" ? "square" : "triangle";
      o.frequency.setValueAtTime(base, audio.currentTime);
      o.frequency.exponentialRampToValueAtTime(base * 0.5, audio.currentTime + 0.08);
      g.gain.setValueAtTime(0.06, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.09);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.1);
    } catch (_) {}
  }

  // ---------- combo HUD ----------
  let hud, hudNum, hudLabel, hudBar, hudToast, combo = 0, comboTimer, lastKey = 0;
  function ensureHud() {
    if (hud && hud.isConnected) return;
    hud = document.createElement("div");
    hud.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;pointer-events:none;";
    const root = hud.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .box{font:800 14px/1 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:right;
             color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 12px rgba(255,80,160,.6);
             opacity:0;transition:opacity .2s;background:rgba(24,12,40,.82);padding:10px 14px 12px;border-radius:14px;
             box-shadow:0 8px 24px rgba(0,0,0,.25);position:relative}
        .box.on{opacity:1}
        .label{letter-spacing:.12em;font-size:12px;opacity:.85;min-height:12px}
        .num{font-size:44px;font-variant-numeric:tabular-nums;margin:4px 0}
        .num small{font-size:20px;opacity:.8;margin-right:2px}
        .bar{height:4px;width:120px;margin-left:auto;background:rgba(0,0,0,.25);border-radius:2px;overflow:hidden}
        .bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff3d77,#ffcc00);transform-origin:left}
        .toast{position:absolute;right:0;top:calc(100% + 8px);background:rgba(24,12,40,.82);padding:6px 12px;border-radius:999px;white-space:nowrap;font-size:22px;opacity:0;
               transform:translateY(8px) scale(.9);transition:all .25s}
        .toast.show{opacity:1;transform:none}
        .pop{animation:pop .18s ease-out}
        @keyframes pop{from{transform:scale(1.35)}to{transform:scale(1)}}
      </style>
      <div class="box"><div class="label"></div><div class="num"><small>x</small><span>0</span></div>
      <div class="bar"><i></i></div><div class="toast"></div></div>`;
    document.documentElement.appendChild(hud);
    hudNum = root.querySelector(".num span");
    hudLabel = root.querySelector(".label");
    hudBar = root.querySelector(".bar i");
    hudToast = root.querySelector(".toast");
  }
  function levelFor(n) {
    for (const [min, name] of LEVELS) if (n >= min) return name;
    return "";
  }
  function toast(text) {
    hudToast.textContent = text;
    hudToast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => hudToast.classList.remove("show"), 1100);
  }
  function drainBar() {
    hudBar.style.transition = "none";
    hudBar.style.transform = "scaleX(1)";
    void hudBar.offsetWidth;
    hudBar.style.transition = `transform ${COMBO_TIMEOUT}ms linear`;
    hudBar.style.transform = "scaleX(0)";
  }
  function bumpCombo() {
    ensureHud();
    const before = levelFor(combo);
    combo++;
    const after = levelFor(combo);
    hud.shadowRoot.querySelector(".box").classList.add("on");
    hudNum.textContent = combo;
    hudNum.parentElement.classList.remove("pop");
    void hudNum.offsetWidth;
    hudNum.parentElement.classList.add("pop");
    hudLabel.textContent = after;
    if (after && after !== before) toast(after);
    drainBar();
    clearTimeout(comboTimer);
    comboTimer = setTimeout(endCombo, COMBO_TIMEOUT);
    return after !== before && after;
  }
  function endCombo() {
    if (combo >= 10) {
      toast(combo > stats.best ? `NEW BEST x${combo}!` : "COMBO BREAK");
      if (combo > stats.best) {
        stats.best = combo;
        chrome.storage.local.set({ best: combo });
      }
    }
    combo = 0;
    setTimeout(() => {
      if (!combo && hud) hud.shadowRoot.querySelector(".box").classList.remove("on");
    }, 1200);
  }

  // total keystrokes are saved in batches
  let pendingTotal = 0;
  setInterval(() => {
    if (!pendingTotal) return;
    const add = pendingTotal;
    pendingTotal = 0;
    chrome.storage.local.get({ total: 0 }, (s) => chrome.storage.local.set({ total: s.total + add }));
  }, 4000);

  // ---------- main ----------
  document.addEventListener(
    "keydown",
    (e) => {
      if (!active() || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const el = editableTarget(e.composedPath()[0] || e.target);
      if (!el) return;
      const printable = e.key.length === 1;
      const kind =
        e.key === "Backspace" || e.key === "Delete" ? "delete" : e.key === "Enter" ? "big" : printable ? "key" : null;
      if (!kind) return;
      const now = performance.now();
      if (now - lastKey < 8) return; // key repeat storms
      lastKey = now;
      pendingTotal++;
      const leveledUp = kind === "delete" ? false : bumpCombo();
      const k = settings.intensity || 2;
      requestAnimationFrame(() => {
        const { x, y } = caretPoint(el);
        if (settings.particles) {
          const n = (kind === "big" || leveledUp ? 40 : 8 + Math.min(combo, 60) / 6) * k * 0.6;
          burst(x, y, Math.round(n), leveledUp ? "big" : kind);
        }
        if (settings.shake) shake(el, (kind === "big" ? 8 : 3 + Math.min(combo, 100) / 20) * k * 0.7);
        if (settings.sound) blip(combo, kind);
      });
    },
    true
  );
})();
