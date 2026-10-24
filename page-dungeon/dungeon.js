// Page Dungeon — a tiny roguelike generated from the page you're on.
(() => {
  if (window.__pageDungeon) {
    window.__pageDungeon.quit();
    return;
  }

  // ---------- seeded randomness: same page, same dungeon ----------
  function rngFrom(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
  const pageSeed = location.origin + location.pathname;

  // ---------- 1. read the page ----------
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  function readPage() {
    let scope = document.querySelector("main, article, [role=main]");
    if (!scope || clean(scope.textContent).length < 400) scope = document.body;
    const floors = [];
    const newFloor = (name) => {
      const f = { name: name || clean(document.title) || location.hostname, paras: [], images: [], links: [], bolds: [], ads: 0, words: [] };
      floors.push(f);
      return f;
    };
    let cur = newFloor(clean(document.querySelector("h1")?.textContent));
    const seenLinks = new Set();
    const AD = 'iframe, ins.adsbygoogle, [id^="ad-" i], [id^="ad_" i], [class*="advert" i], [class*="sponsor" i], [aria-label="advertisement" i]';
    const els = document.body.querySelectorAll(`h1,h2,p,li,blockquote,pre,img,a[href],strong,b,${AD}`);
    for (const el of els) {
      if (el.closest("#__page-dungeon")) continue;
      const tag = el.tagName;
      if (el.matches(AD)) {
        cur.ads++;
        continue;
      }
      if (!scope.contains(el) && tag !== "H1") continue;
      if (tag === "H1" || tag === "H2") {
        const t = clean(el.textContent).slice(0, 60);
        if (!t) continue;
        if (cur.paras.length) cur = newFloor(t);
        else cur.name = t;
      } else if (tag === "IMG") {
        const r = el.getBoundingClientRect();
        if (el.naturalWidth > 40 || r.width > 40) cur.images.push(clean(el.alt).slice(0, 50) || "a mysterious picture");
      } else if (tag === "A") {
        const text = clean(el.textContent);
        const href = el.href;
        if (text.length >= 2 && text.length <= 60 && /^https?:/.test(href) && !seenLinks.has(href) && href.split("#")[0] !== location.href.split("#")[0]) {
          seenLinks.add(href);
          cur.links.push({ text, href });
        }
      } else if (tag === "STRONG" || tag === "B") {
        const t = clean(el.textContent);
        if (t.length >= 2 && t.length <= 28) cur.bolds.push(t);
      } else {
        const t = clean(el.textContent);
        if (t.length > 40) {
          cur.paras.push(t);
          const ws = t.match(/\b[A-Z][a-z]{3,11}\b|[一-鿿]{2,4}/g);
          if (ws) cur.words.push(...ws);
        }
      }
    }
    let fl = floors.filter((f) => f.paras.length || f.images.length || f.links.length);
    if (!fl.length) fl = [floors[0]];
    // At most 6 floors: merge neighbours.
    while (fl.length > 6) {
      let best = 0;
      for (let i = 1; i < fl.length - 1; i++) if (fl[i].paras.length + fl[i + 1].paras.length < fl[best].paras.length + fl[best + 1].paras.length) best = i;
      const a = fl[best], b = fl[best + 1];
      for (const k of ["paras", "images", "links", "bolds", "words"]) a[k].push(...b[k]);
      a.ads += b.ads;
      fl.splice(best + 1, 1);
    }
    for (const f of fl) if (!f.paras.length) f.paras.push(`The walls here are blank. Someone forgot to write ${f.name}.`);
    return fl;
  }
  const FLOORS = readPage();

  // ---------- 2. build a floor ----------
  const W = 64, H = 34;
  const TEMPLATES = ["the Wild %", "% Slime", "Feral %", "% Golem", "Lesser % Demon", "%-eater", "Haunted %", "% Wraith"];
  const AD_NAMES = ["Advertisement", "Cookie Banner", "Newsletter Popup", "Autoplay Video", "Sponsored Post"];

  function buildFloor(fi) {
    const F = FLOORS[fi];
    const rnd = rngFrom(pageSeed + "#" + fi);
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const map = Array.from({ length: H }, () => Array(W).fill("#"));
    const rooms = [];
    const want = Math.max(4, Math.min(9, F.paras.length + 2));
    for (let tries = 0; tries < 400 && rooms.length < want; tries++) {
      const w = ri(5, 12), h = ri(4, 7), x = ri(1, W - w - 2), y = ri(1, H - h - 2);
      if (rooms.some((r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), text: null, seen: false });
    }
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map[y][x] = ".";
    // order rooms left→right so the walk feels like reading
    rooms.sort((a, b) => a.cx - b.cx);
    const carve = (a, b) => {
      let { cx: x, cy: y } = a;
      const horizFirst = rnd() < 0.5;
      const stepX = () => { while (x !== b.cx) { map[y][x] = "."; x += Math.sign(b.cx - x); } };
      const stepY = () => { while (y !== b.cy) { map[y][x] = "."; y += Math.sign(b.cy - y); } };
      if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
      map[y][x] = ".";
    };
    for (let i = 0; i < rooms.length - 1; i++) carve(rooms[i], rooms[i + 1]);
    if (rooms.length > 3) carve(rooms[ri(0, rooms.length - 1)], rooms[ri(0, rooms.length - 1)]);

    rooms.forEach((r, i) => (r.text = F.paras[i] || null));
    const leftoverParas = F.paras.slice(rooms.length, rooms.length + 6);

    const occupied = new Set();
    const key = (x, y) => x + "," + y;
    const spot = (avoidFirst) => {
      for (let t = 0; t < 200; t++) {
        const r = avoidFirst && rooms.length > 1 ? rooms[ri(1, rooms.length - 1)] : pick(rooms);
        const x = ri(r.x, r.x + r.w - 1), y = ri(r.y, r.y + r.h - 1);
        if (!occupied.has(key(x, y))) { occupied.add(key(x, y)); return { x, y }; }
      }
      return null;
    };
    const start = { x: rooms[0].cx, y: rooms[0].cy };
    occupied.add(key(start.x, start.y));
    const last = rooms[rooms.length - 1];
    const final = fi === FLOORS.length - 1;
    const items = [{ x: last.cx, y: last.cy, kind: final ? "exit" : "stairs" }];
    occupied.add(key(last.cx, last.cy));

    for (const img of F.images.slice(0, 5)) { const p = spot(true); if (p) items.push({ ...p, kind: "chest", name: img }); }
    const potions = F.bolds.slice(0, 3);
    if (fi % 2 || !potions.length) potions.push("Plain Water");
    for (const b of potions) { const p = spot(true); if (p) items.push({ ...p, kind: "potion", name: b }); }
    for (const l of F.links.slice(0, 5)) { const p = spot(true); if (p) items.push({ ...p, kind: "portal", ...l }); }
    for (const t of leftoverParas) { const p = spot(false); if (p) items.push({ ...p, kind: "scroll", text: t }); }

    const monsters = [];
    const words = F.words.length ? F.words : ["Lorem", "Ipsum", "Div", "Span", "Pixel", "Cache"];
    const nAds = Math.min(F.ads, 4);
    const n = Math.max(2, Math.min(10, 2 + fi + nAds));
    for (let i = 0; i < n; i++) {
      const p = spot(true);
      if (!p) break;
      const ad = i < nAds;
      const word = pick(words);
      const name = ad ? pick(AD_NAMES) : pick(TEMPLATES).replace("%", word);
      const hp = 4 + fi * 2 + ri(0, 3) + (ad ? 6 : 0);
      monsters.push({
        ...p, name, ad, hp, max: hp, atk: 1 + fi + ri(0, 2) + (ad ? 1 : 0), xp: hp, awake: false,
        glyph: ad ? "A" : /[A-Za-z]/.test(word[0]) ? word[0].toLowerCase() : "m"
      });
    }
    return { map, rooms, items, monsters, start, name: F.name, explored: Array.from({ length: H }, () => Array(W).fill(false)) };
  }

  // ---------- 3. UI ----------
  const host = document.createElement("div");
  host.id = "__page-dungeon";
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    *{box-sizing:border-box}
    .wrap{position:absolute;inset:0;background:#0d0c14;color:#d8d6e8;display:grid;grid-template-columns:1fr 300px;grid-template-rows:1fr auto;
      font:14px/1.45 ui-monospace,"SF Mono",Menlo,Consolas,monospace}
    canvas{grid-row:1;grid-column:1;width:100%;height:100%;display:block}
    .side{grid-row:1/3;grid-column:2;border-left:1px solid #2a2840;padding:16px;overflow:auto;background:#12111c}
    .side h1{font-size:15px;margin:0 0 2px;color:#ffd166}
    .side .floor{color:#8f8ba8;font-size:12px;margin-bottom:14px}
    .bar{height:10px;background:#2a2840;border-radius:5px;overflow:hidden;margin:4px 0 10px}
    .bar i{display:block;height:100%;background:linear-gradient(90deg,#ef476f,#ff9f1c);transition:width .2s}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:13px;margin-bottom:14px}
    .grid b{color:#fff}
    .wall{background:#1d1b2b;border:1px solid #3a3756;border-radius:8px;padding:10px 12px;font:13px/1.5 Georgia,serif;color:#e9e4d0;
      max-height:42vh;overflow:auto;white-space:pre-wrap}
    .wall:empty{display:none}
    .keys{margin-top:14px;color:#7e7a98;font-size:12px;line-height:1.7}
    .keys kbd{background:#2a2840;border-radius:4px;padding:0 5px;color:#ddd}
    .log{grid-row:2;grid-column:1;border-top:1px solid #2a2840;padding:8px 14px;height:118px;overflow:hidden;font-size:13px;background:#100f19}
    .log div{opacity:.55}
    .log div:last-child,.log div:nth-last-child(2){opacity:1}
    .end{position:absolute;inset:0;display:none;place-items:center;background:#0d0c14dd}
    .end.on{display:grid}
    .end .card{text-align:center;max-width:460px;padding:24px}
    .end h2{font-size:28px;margin:0 0 8px;color:#ffd166}
    .end p{color:#bdb9d6}
  </style>
  <div class="wrap">
    <canvas></canvas>
    <div class="side">
      <h1></h1><div class="floor"></div>
      <div>HP <span class="hp"></span></div><div class="bar"><i></i></div>
      <div class="grid"><span>Level <b class="lv"></b></span><span>XP <b class="xp"></b></span>
        <span>Gold <b class="gold"></b></span><span>Kills <b class="kills"></b></span></div>
      <div class="wall"></div>
      <div class="keys"><kbd>←↑→↓</kbd>/<kbd>WASD</kbd>/<kbd>hjkl</kbd> move · bump to fight<br>
        <kbd>Enter</kbd> use stairs / portal · <kbd>.</kbd> wait<br><kbd>Esc</kbd> leave the dungeon</div>
    </div>
    <div class="log"></div>
    <div class="end"><div class="card"><h2></h2><p></p><p style="color:#7e7a98">R to try again · Esc to leave</p></div></div>
  </div>`;
  document.documentElement.appendChild(host);
  const $ = (s) => root.querySelector(s);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const oldOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  // ---------- 4. game state ----------
  let game, level;
  function newGame() {
    game = { hp: 20, max: 20, atk: 3, lv: 1, xp: 0, gold: 0, kills: 0, floor: 0, over: false, log: [] };
    $(".end").classList.remove("on");
    $(".log").replaceChildren();
    enter(0);
    say(`You descend into “${clean(document.title) || location.hostname}”. The air smells of HTML.`);
  }
  function enter(fi) {
    game.floor = fi;
    level = buildFloor(fi);
    game.x = level.start.x;
    game.y = level.start.y;
    $(".wall").textContent = "";
    fov();
    roomCheck();
    draw();
  }
  function say(text, color) {
    const d = document.createElement("div");
    d.textContent = text;
    if (color) d.style.color = color;
    const log = $(".log");
    log.appendChild(d);
    while (log.children.length > 6) log.firstChild.remove();
  }

  // ---------- 5. field of view ----------
  let visible = new Set();
  function fov() {
    visible = new Set();
    const R = 8;
    for (let y = game.y - R; y <= game.y + R; y++)
      for (let x = game.x - R; x <= game.x + R; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if ((x - game.x) ** 2 + (y - game.y) ** 2 > R * R) continue;
        // walk the line; walls block what's behind them
        let x0 = game.x, y0 = game.y;
        const dx = Math.abs(x - x0), dy = -Math.abs(y - y0), sx = x0 < x ? 1 : -1, sy = y0 < y ? 1 : -1;
        let err = dx + dy, ok = true;
        while (!(x0 === x && y0 === y)) {
          if (level.map[y0][x0] === "#" && !(x0 === game.x && y0 === game.y)) { ok = false; break; }
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
        if (ok) {
          visible.add(x + "," + y);
          level.explored[y][x] = true;
        }
      }
  }

  // ---------- 6. turns ----------
  const at = (list, x, y) => list.find((o) => o.x === x && o.y === y);
  function roomCheck() {
    const r = level.rooms.find((r) => game.x >= r.x && game.x < r.x + r.w && game.y >= r.y && game.y < r.y + r.h);
    if (r && !r.seen) {
      r.seen = true;
      if (r.text) {
        $(".wall").textContent = `Scrawled on the wall:\n\n“${r.text.slice(0, 600)}${r.text.length > 600 ? "…" : ""}”`;
        say("There is writing on the wall here.", "#e9c46a");
      }
    }
  }
  function move(dx, dy) {
    if (game.over) return;
    const nx = game.x + dx, ny = game.y + dy;
    if (level.map[ny]?.[nx] !== ".") return;
    const m = at(level.monsters, nx, ny);
    if (m) attack(m);
    else {
      game.x = nx;
      game.y = ny;
      pickup();
      roomCheck();
    }
    monstersTurn();
    fov();
    draw();
  }
  function attack(m) {
    const dmg = game.atk + Math.floor(Math.random() * 3);
    m.hp -= dmg;
    m.awake = true;
    if (m.hp <= 0) {
      level.monsters.splice(level.monsters.indexOf(m), 1);
      game.kills++;
      game.xp += m.xp;
      const gold = m.ad ? 15 + Math.floor(Math.random() * 20) : Math.floor(Math.random() * 5);
      game.gold += gold;
      say(`You defeat ${m.name}${gold ? ` and loot ${gold} gold` : ""}.`, "#06d6a0");
      while (game.xp >= game.lv * 12) {
        game.xp -= game.lv * 12;
        game.lv++;
        game.max += 5;
        game.atk += 1;
        game.hp = Math.min(game.max, game.hp + Math.ceil(game.max / 2));
        say(`You feel stronger! Level ${game.lv}.`, "#ffd166");
      }
    } else say(`You hit ${m.name} for ${dmg}.`);
  }
  function pickup() {
    const it = at(level.items, game.x, game.y);
    if (!it) return;
    if (it.kind === "chest") {
      const g = 5 + Math.floor(Math.random() * 15) + game.floor * 3;
      game.gold += g;
      say(`You open a chest: ${it.name}. ${g} gold inside!`, "#ffd60a");
    } else if (it.kind === "potion") {
      const h = it.name === "Plain Water" ? 4 : 6 + Math.floor(Math.random() * 6);
      game.hp = Math.min(game.max, game.hp + h);
      say(`You drink the Potion of ${it.name}. +${h} HP.`, "#06d6a0");
    } else if (it.kind === "scroll") {
      $(".wall").textContent = `You unroll a scroll:\n\n“${it.text.slice(0, 600)}${it.text.length > 600 ? "…" : ""}”`;
      say("You read a scroll.", "#e9c46a");
    } else if (it.kind === "portal") {
      say(`A portal hums: “${it.text}”. Press Enter to step through.`, "#4cc9f0");
      return;
    } else if (it.kind === "stairs") {
      say("Stairs lead down. Press Enter to descend.", "#fff");
      return;
    } else if (it.kind === "exit") {
      say("The way out! Press Enter to finish the page.", "#fff");
      return;
    }
    level.items.splice(level.items.indexOf(it), 1);
  }
  function interact() {
    if (game.over) return;
    const it = at(level.items, game.x, game.y);
    if (!it) return say("Nothing to use here.");
    if (it.kind === "stairs") {
      enter(game.floor + 1);
      say(`Floor ${game.floor + 1}: ${level.name}`, "#ffd166");
    } else if (it.kind === "exit") {
      end(true);
    } else if (it.kind === "portal") {
      say("Whoosh…", "#4cc9f0");
      setTimeout(() => (location.href = it.href), 300);
    }
  }
  function monstersTurn() {
    for (const m of level.monsters) {
      if (visible.has(m.x + "," + m.y)) m.awake = true;
      if (!m.awake) continue;
      const dx = game.x - m.x, dy = game.y - m.y;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        const dmg = Math.max(1, m.atk + Math.floor(Math.random() * 2) - 1);
        game.hp -= dmg;
        say(`${m.name} hits you for ${dmg}.`, "#ef476f");
        if (game.hp <= 0) return end(false, m);
        continue;
      }
      const tries = Math.abs(dx) > Math.abs(dy)
        ? [[Math.sign(dx), 0], [0, Math.sign(dy)]]
        : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
      for (const [sx, sy] of tries) {
        if (!sx && !sy) continue;
        const nx = m.x + sx, ny = m.y + sy;
        if (level.map[ny][nx] === "." && !at(level.monsters, nx, ny) && !(nx === game.x && ny === game.y)) {
          m.x = nx;
          m.y = ny;
          break;
        }
      }
    }
  }
  function end(won, killer) {
    game.over = true;
    const t = clean(document.title) || location.hostname;
    $(".end h2").textContent = won ? "You finished the page!" : "You died";
    $(".end p").textContent = won
      ? `You read “${t}” cover to cover. Level ${game.lv}, ${game.gold} gold, ${game.kills} monsters slain.`
      : `Slain by ${killer.name} on “${level.name}”. Level ${game.lv}, ${game.gold} gold.`;
    $(".end").classList.add("on");
    draw();
  }

  // ---------- 7. drawing ----------
  const TW = 12, TH = 20;
  const COLORS = { chest: "#ffd60a", potion: "#06d6a0", portal: "#4cc9f0", stairs: "#ffffff", exit: "#ffffff", scroll: "#e9c46a" };
  const GLYPHS = { chest: "$", potion: "!", portal: "Ω", stairs: ">", exit: "⚑", scroll: "?" };
  function draw() {
    const dpr = devicePixelRatio || 1;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0d0c14";
    ctx.fillRect(0, 0, cw, ch);
    ctx.font = `${TH - 4}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cols = Math.floor(cw / TW), rows = Math.floor(ch / TH);
    const camX = W <= cols ? -Math.floor((cols - W) / 2) : Math.max(0, Math.min(W - cols, game.x - (cols >> 1)));
    const camY = H <= rows ? -Math.floor((rows - H) / 2) : Math.max(0, Math.min(H - rows, game.y - (rows >> 1)));
    const px = (x) => (x - camX) * TW + TW / 2, py = (y) => (y - camY) * TH + TH / 2;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!level.explored[y][x]) continue;
        const vis = visible.has(x + "," + y);
        const wall = level.map[y][x] === "#";
        if (wall) {
          // only draw walls that border a floor
          let edge = false;
          for (let j = -1; j <= 1 && !edge; j++) for (let i = -1; i <= 1; i++) if (level.map[y + j]?.[x + i] === ".") { edge = true; break; }
          if (!edge) continue;
        }
        ctx.globalAlpha = vis ? 1 : 0.32;
        ctx.fillStyle = wall ? "#6c6a90" : "#3b3955";
        ctx.fillText(wall ? "#" : "·", px(x), py(y));
      }
    ctx.globalAlpha = 1;
    for (const it of level.items) {
      if (!level.explored[it.y][it.x]) continue;
      ctx.globalAlpha = visible.has(it.x + "," + it.y) ? 1 : 0.4;
      ctx.fillStyle = COLORS[it.kind];
      ctx.fillText(GLYPHS[it.kind], px(it.x), py(it.y));
    }
    ctx.globalAlpha = 1;
    for (const m of level.monsters) {
      if (!visible.has(m.x + "," + m.y)) continue;
      ctx.fillStyle = m.ad ? "#ff9f1c" : "#ef476f";
      ctx.font = `bold ${TH - 3}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.fillText(m.glyph, px(m.x), py(m.y));
      // tiny health bar
      ctx.fillStyle = "#ef476f88";
      ctx.fillRect(px(m.x) - 5, py(m.y) - TH / 2 + 1, 10 * Math.max(0, m.hp / m.max), 2);
    }
    ctx.font = `bold ${TH - 2}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillStyle = "#ffd166";
    ctx.fillText("@", px(game.x), py(game.y));

    $("h1").textContent = clean(document.title).slice(0, 60) || location.hostname;
    $(".floor").textContent = `Floor ${game.floor + 1}/${FLOORS.length} · ${level.name}`;
    $(".hp").textContent = `${Math.max(0, game.hp)} / ${game.max}`;
    $(".bar i").style.width = (100 * Math.max(0, game.hp)) / game.max + "%";
    $(".lv").textContent = game.lv;
    $(".xp").textContent = `${game.xp}/${game.lv * 12}`;
    $(".gold").textContent = game.gold;
    $(".kills").textContent = game.kills;
  }

  // ---------- 8. input ----------
  const DIRS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0]
  };
  function onKey(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === "Escape") quit();
    else if (DIRS[k]) move(...DIRS[k]);
    else if (k === "Enter" || k === ">") interact();
    else if (k === ".") { monstersTurn(); fov(); draw(); }
    else if (k === "r" && game.over) newGame();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  addEventListener("keydown", onKey, true);
  addEventListener("resize", draw);

  function quit() {
    removeEventListener("keydown", onKey, true);
    removeEventListener("resize", draw);
    host.remove();
    document.documentElement.style.overflow = oldOverflow;
    window.__pageDungeon = null;
  }
  window.__pageDungeon = { quit };
  newGame();
})();
