// Wiki Race — in-page HUD, link rules and the finish screen.
(async () => {
  if (window.__wikiRace) return;
  window.__wikiRace = true;

  const lang = WIKI.langOf(location.hostname);
  const canonicalHref = document.querySelector('link[rel="canonical"]')?.href;
  const here = WIKI.titleFromUrl(canonicalHref || location.href, location.href);
  if (!here) return;
  const urlTitle = WIKI.titleFromUrl(location.href);
  const redirectedFrom = document.querySelector(".mw-redirectedfrom a")?.getAttribute("title");
  const from = WIKI.normalize(redirectedFrom || (urlTitle !== here ? urlTitle : "")) || null;
  const backForward = performance.getEntriesByType("navigation")[0]?.type === "back_forward";

  const send = (msg) => chrome.runtime.sendMessage(msg);
  const res = await send({ type: "page", title: here, from, backForward });

  // ---------- shared UI shell ----------
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;pointer-events:none;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    *{box-sizing:border-box}
    .hud{pointer-events:auto;margin:10px auto 0;width:max-content;max-width:calc(100vw - 20px);display:flex;align-items:center;gap:14px;
      padding:8px 10px 8px 16px;border-radius:999px;background:#151321ee;color:#fff;font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;
      box-shadow:0 8px 24px rgba(0,0,0,.3)}
    .hud b{color:#ffd166}
    .t{font-variant-numeric:tabular-nums;font-size:15px}
    .path{display:flex;gap:4px;align-items:center;overflow:hidden;max-width:38vw;opacity:.85;font-weight:500;font-size:12px}
    .path span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px}
    button{all:unset;cursor:pointer;padding:6px 12px;border-radius:999px;background:#ffffff1a;font:600 12px system-ui,sans-serif;color:#fff}
    button:hover{background:#ffffff33}
    button.go{background:#7b5cff}
    .flash{pointer-events:none;position:fixed;left:50%;top:60px;transform:translateX(-50%);background:#e63946;color:#fff;
      font:600 13px system-ui,sans-serif;padding:7px 14px;border-radius:999px;opacity:0;transition:opacity .2s}
    .flash.on{opacity:1}
    .win{pointer-events:auto;position:fixed;inset:0;display:grid;place-items:center;background:#0b0a14cc;backdrop-filter:blur(3px)}
    .card{width:min(520px,calc(100vw - 32px));background:#fff;color:#1d1b2b;border-radius:18px;padding:26px 26px 20px;
      font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.4);text-align:center}
    .card h2{margin:0;font-size:26px}
    .big{display:flex;justify-content:center;gap:28px;margin:16px 0}
    .big b{display:block;font-size:30px;color:#7b5cff;font-variant-numeric:tabular-nums}
    .big span{font-size:12px;color:#777}
    .chain{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:10px 0 18px}
    .chain span{background:#f0edff;border-radius:999px;padding:3px 10px;font-size:12.5px}
    .chain i{color:#aaa;font-style:normal}
    .card button{background:#eee;color:#222;margin:4px}
    .card button.go{background:#7b5cff;color:#fff}
    .warn{color:#b5541b;font-size:12.5px}
    .banner{pointer-events:auto;margin:10px auto 0;width:max-content;max-width:calc(100vw - 20px);display:flex;gap:12px;align-items:center;
      background:#7b5cff;color:#fff;padding:8px 10px 8px 16px;border-radius:999px;font:600 13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)}
  </style><div class="flash"></div>`;
  document.documentElement.appendChild(host);
  const flash = (text) => {
    const f = root.querySelector(".flash");
    f.textContent = text;
    f.classList.add("on");
    clearTimeout(flash.t);
    flash.t = setTimeout(() => f.classList.remove("on"), 1400);
  };
  const el = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  async function randomTitle() {
    const r = await fetch(`/api/rest_v1/page/random/summary`);
    const j = await r.json();
    return j.titles?.canonical || j.title;
  }
  async function newRandomRace() {
    flash("Rolling the dice…");
    const [s, t] = await Promise.all([randomTitle(), randomTitle()]);
    go(await send({ type: "start-here", lang, start: s, target: t }));
  }
  // The worker registered the race for this tab; now load the start article.
  function go(out) {
    if (!out || out.error) return flash(out?.error || "Couldn't start the race");
    // Dropping the #fragment makes this a real reload, so the race starts on a fresh page.
    if (out.start === here) location.replace(location.origin + location.pathname);
    else location.href = out.url;
  }

  // ---------- not racing: offer a challenge from the link ----------
  const game = res?.game;
  if (!game) {
    const m = location.hash.match(/^#wikirace=(.+)$/);
    if (m) {
      let target;
      try { target = decodeURIComponent(m[1]); } catch (_) { return; }
      const b = el(`<div class="banner">🏁 Challenge: get from <u>${esc(here)}</u> to <u>${esc(WIKI.normalize(target))}</u></div>`);
      const startBtn = el(`<button>Start</button>`);
      startBtn.onclick = async () => {
        go(await send({ type: "start-here", lang, start: here, target }));
      };
      const x = el(`<button>✕</button>`);
      x.onclick = () => b.remove();
      b.append(startBtn, x);
      root.appendChild(b);
    }
    return;
  }

  // ---------- finished ----------
  if (game.finishedAt) {
    const ms = game.finishedAt - game.startedAt;
    const chain = game.path.map((p) => `<span>${esc(p)}</span>`).join("<i>→</i>");
    const card = el(`<div class="win"><div class="card">
      <div style="font-size:44px">🏁</div>
      <h2>You made it!</h2>
      <div class="big"><div><b>${game.clicks}</b><span>clicks</span></div><div><b>${WIKI.fmtTime(ms)}</b><span>time</span></div></div>
      <div class="chain">${chain}</div>
      ${game.offRoute ? `<p class="warn">⚠️ ${game.offRoute} step${game.offRoute > 1 ? "s" : ""} didn't come from a link click (typed address or new tab?).</p>` : ""}
      <div><button class="go" data-a="share">📋 Copy challenge</button><button data-a="again">🎲 New random race</button><button data-a="close">Close</button></div>
    </div></div>`);
    card.addEventListener("click", async (e) => {
      const a = e.target.dataset?.a;
      if (a === "share") {
        const link = WIKI.articleUrl(game.lang, game.start) + "#wikirace=" + encodeURIComponent(game.target);
        const text = `🏁 Wiki Race: ${game.start} → ${game.target} in ${game.clicks} clicks (${WIKI.fmtTime(ms)}). Beat me: ${link}`;
        await navigator.clipboard.writeText(text).catch(() => {});
        e.target.textContent = "✅ Copied!";
      } else if (a === "again") newRandomRace();
      else if (a === "close" || e.target === card) {
        card.remove();
        send({ type: "give-up" });
      }
    });
    root.appendChild(card);
    return;
  }

  // ---------- racing ----------
  // No searching allowed.
  const style = document.createElement("style");
  style.textContent = `#p-search,#searchform,.vector-search-box,.search-toggle,#simpleSearch,.cdx-search-input,
    .vector-header-end .vector-search-box,.minerva-search-form,#searchIcon,.mw-editsection{display:none!important}`;
  document.documentElement.appendChild(style);

  const hud = el(`<div class="hud">
    <span>🎯 <b>${esc(game.target)}</b></span>
    <span class="t">⏱ <span id="time">00:00</span></span>
    <span>👣 <span id="clicks">${game.clicks}</span></span>
    <span class="path"></span>
    <button id="target" title="Peek at the target article in a new tab">Peek</button>
    <button id="quit">Give up</button>
  </div>`);
  root.appendChild(hud);
  const pathEl = hud.querySelector(".path");
  const tail = game.path.slice(-4);
  pathEl.innerHTML = (game.path.length > 4 ? "<span>…</span>→" : "") + tail.map((p) => `<span>${esc(p)}</span>`).join("→");
  const timeEl = hud.querySelector("#time");
  const tick = () => (timeEl.textContent = WIKI.fmtTime(Date.now() - game.startedAt));
  tick();
  setInterval(tick, 250);
  hud.querySelector("#quit").onclick = async () => {
    await send({ type: "give-up" });
    host.remove();
    style.remove();
  };
  hud.querySelector("#target").onclick = () => window.open(WIKI.articleUrl(game.lang, game.target), "_blank", "noopener");

  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a || e.composedPath().includes(host)) return;
      const href = a.getAttribute("href");
      if (href.startsWith("#")) return; // footnotes, same page
      const content = a.closest(".mw-parser-output, #mw-content-text, #bodyContent");
      const t = WIKI.titleFromUrl(a.href);
      const sameHost = (() => { try { return new URL(a.href).hostname === location.hostname; } catch (_) { return false; } })();
      if (content && t && sameHost && WIKI.isArticle(t)) {
        if (t !== here) send({ type: "click", title: t });
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      flash("🚫 Only article links inside the page count");
    },
    true
  );
  document.addEventListener("submit", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    flash("🚫 No searching during a race");
  }, true);
  addEventListener("keydown", (e) => {
    // Wikipedia's "/" search shortcut
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) e.stopImmediatePropagation();
  }, true);
})();
