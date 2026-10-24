// Web Time Machine — applies the theme in window.__tmTheme (set just before this file runs).
(() => {
  const theme = window.__tmTheme;
  const TM = (window.__tm ||= { cleanup: [] });

  // ---------- remove whatever was applied before ----------
  for (const fn of TM.cleanup.splice(0)) try { fn(); } catch (_) {}
  TM.current = null;
  if (!theme || theme === "off") return;
  TM.current = theme;

  const host = location.hostname.replace(/^www\./, "");
  const title = (document.title || host).trim();
  const add = (el, parent = document.documentElement) => {
    parent.appendChild(el);
    TM.cleanup.push(() => el.remove());
    return el;
  };
  const css = (text) => {
    const s = document.createElement("style");
    s.textContent = text;
    return add(s);
  };
  const div = (styleText, html = "") => {
    const d = document.createElement("div");
    d.style.cssText = styleText;
    d.innerHTML = html;
    return add(d);
  };
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    TM.cleanup.push(() => target.removeEventListener(type, fn, opts));
  };
  const every = (ms, fn) => {
    const id = setInterval(fn, ms);
    TM.cleanup.push(() => clearInterval(id));
  };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const off = () => {
    window.__tmTheme = "off";
    for (const fn of TM.cleanup.splice(0)) try { fn(); } catch (_) {}
    TM.current = null;
  };

  // Flatten modern backgrounds so the retro look shows through, but keep media alone.
  const FLATTEN = `body *:not(img):not(video):not(svg):not(svg *):not(canvas):not(picture):not(iframe):not([data-tm]):not([data-tm] *){
    background-color:transparent!important;box-shadow:none!important;border-radius:0!important;backdrop-filter:none!important}`;

  // =====================================================================
  if (theme === "win95") {
    css(`
      html{background:#008080!important}
      body{background:#c0c0c0!important;color:#000!important;margin:30px 18px 46px!important;min-height:calc(100vh - 76px)!important;
        box-shadow:inset -1px -1px #0a0a0a,inset 1px 1px #dfdfdf,inset -2px -2px #808080,inset 2px 2px #fff!important;padding:6px!important}
      ${FLATTEN}
      body *:not([class*="icon" i]):not(i):not([class*="material" i]):not(code):not(pre):not(kbd):not([data-tm] *){
        font-family:Tahoma,"MS Sans Serif","Microsoft Sans Serif",Geneva,Verdana,sans-serif!important;color:#000!important;letter-spacing:0!important}
      body a,body a *{color:#0000ee!important}
      body a:visited,body a:visited *{color:#551a8b!important}
      button,input[type=submit],input[type=button],[role=button]{background:#c0c0c0!important;border:none!important;border-radius:0!important;color:#000!important;
        box-shadow:inset -1px -1px #0a0a0a,inset 1px 1px #fff,inset -2px -2px #808080,inset 2px 2px #dfdfdf!important;padding:4px 10px!important}
      button:active,[role=button]:active{box-shadow:inset 1px 1px #0a0a0a,inset -1px -1px #fff,inset 2px 2px #808080,inset -2px -2px #dfdfdf!important}
      input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]),textarea,select{background:#fff!important;border:none!important;border-radius:0!important;
        box-shadow:inset -1px -1px #fff,inset 1px 1px #808080,inset -2px -2px #dfdfdf,inset 2px 2px #0a0a0a!important}
      hr{border:none!important;border-top:1px solid #808080!important;border-bottom:1px solid #fff!important}
      ::-webkit-scrollbar{width:16px;height:16px;background:#dfdfdf}
      ::-webkit-scrollbar-thumb{background:#c0c0c0;box-shadow:inset -1px -1px #0a0a0a,inset 1px 1px #fff,inset -2px -2px #808080,inset 2px 2px #dfdfdf}
      ::selection{background:#000080;color:#fff}
    `);
    const bar = div(
      "position:fixed;top:0;left:18px;right:18px;height:26px;z-index:2147483646;display:flex;align-items:center;gap:6px;padding:0 4px 0 6px;" +
      "background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font:700 12px Tahoma,'MS Sans Serif',sans-serif;margin-top:4px",
      `<span style="width:16px;height:16px;background:#fff;display:inline-grid;place-items:center;color:#000080;font-size:11px">◧</span>
       <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)} - Web Explorer</span>
       ${["_", "□", "✕"].map((c) => `<button data-tm-b="${c}" style="all:unset;width:16px;height:14px;background:#c0c0c0;color:#000;display:grid;place-items:center;font:700 10px Tahoma;cursor:pointer;
         box-shadow:inset -1px -1px #0a0a0a,inset 1px 1px #fff,inset -2px -2px #808080,inset 2px 2px #dfdfdf">${c}</button>`).join("")}`
    );
    bar.dataset.tm = "";
    bar.querySelector('[data-tm-b="✕"]').onclick = off;
    bar.querySelector('[data-tm-b="_"]').onclick = () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    bar.querySelector('[data-tm-b="□"]').onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
    const task = div(
      "position:fixed;left:0;right:0;bottom:0;height:34px;z-index:2147483646;background:#c0c0c0;display:flex;align-items:center;gap:6px;padding:0 4px;" +
      "box-shadow:inset 0 1px #dfdfdf,inset 0 2px #fff;font:12px Tahoma,'MS Sans Serif',sans-serif;color:#000",
      `<span style="display:flex;align-items:center;gap:4px;padding:3px 8px;font-weight:700;box-shadow:inset -1px -1px #0a0a0a,inset 1px 1px #fff,inset -2px -2px #808080,inset 2px 2px #dfdfdf">
         <span style="font-size:13px">🖥️</span>Start</span>
       <span style="flex:1;max-width:240px;padding:3px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:inset 1px 1px #0a0a0a,inset -1px -1px #fff,inset 2px 2px #808080,inset -2px -2px #dfdfdf;background:#dfdfdf">${esc(title)}</span>
       <span style="flex:1"></span>
       <span data-clock style="padding:3px 10px;box-shadow:inset 1px 1px #808080,inset -1px -1px #fff"></span>`
    );
    task.dataset.tm = "";
    const clock = task.querySelector("[data-clock]");
    const tick = () => (clock.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    every(15000, tick);
  }

  // =====================================================================
  if (theme === "geocities") {
    css(`
      html,body{background-color:#000033!important;
        background-image:radial-gradient(1px 1px at 20px 30px,#fff,transparent),radial-gradient(1px 1px at 120px 80px,#fff,transparent),
          radial-gradient(2px 2px at 60px 140px,#ffd,transparent),radial-gradient(1px 1px at 170px 20px,#aaf,transparent),
          radial-gradient(1px 1px at 90px 190px,#fff,transparent),radial-gradient(2px 2px at 190px 160px,#fff,transparent)!important;
        background-size:200px 200px!important}
      body{padding-top:34px!important}
      ${FLATTEN}
      body *:not(code):not(pre):not([data-tm] *){font-family:"Comic Sans MS","Comic Neue","Chalkboard SE",cursive!important;color:#ffff66!important}
      body a,body a *{color:#00ffff!important;text-decoration:underline!important}
      body a:visited,body a:visited *{color:#ff66ff!important}
      body a:hover{color:#ff0!important;background:#f0f!important}
      h1,h2,h3{background:linear-gradient(90deg,#f00,#f80,#ff0,#0f0,#0ff,#00f,#f0f,#f00)!important;background-size:400% 100%!important;
        -webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;animation:tm-rainbow 4s linear infinite!important;
        text-align:center!important}
      h1{animation:tm-rainbow 4s linear infinite,tm-blink 1.2s steps(2) infinite!important}
      img{border:4px ridge #ff00ff!important}
      hr{border:none!important;height:6px!important;background:linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f)!important}
      @keyframes tm-rainbow{to{background-position:400% 0}}
      @keyframes tm-blink{50%{opacity:.35}}
      @keyframes tm-marquee{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}
      @keyframes tm-spark{to{transform:translateY(26px) scale(.2);opacity:0}}
    `);
    const m = div(
      "position:fixed;top:0;left:0;right:0;height:30px;z-index:2147483646;overflow:hidden;background:#000080;border-bottom:3px ridge #ff0;" +
      "font:700 15px/30px 'Comic Sans MS',cursive;color:#ff0;white-space:nowrap",
      `<span style="display:inline-block;animation:tm-marquee 18s linear infinite">★彡 Welcome to ${esc(title)}!!! ★ This page is best viewed in Netscape Navigator 4.0 at 800x600 ★ Please sign my guestbook ★ Thanks for visiting!!! 彡★</span>`
    );
    m.dataset.tm = "";
    const n = String((Math.abs([...host].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 900000) + 1337 + Math.floor(Date.now() / 3.6e6) % 1000).padStart(7, "0");
    const counter = div(
      "position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:2147483646;background:#000;border:3px ridge #c0c0c0;padding:4px 10px;" +
      "font:700 13px 'Comic Sans MS',cursive;color:#0f0;display:flex;gap:8px;align-items:center",
      `You are visitor <span style="display:flex;gap:2px">${[...n].map((d) => `<b style="background:#222;color:#f33;font:700 16px 'Courier New',monospace;padding:1px 4px;border:1px solid #555">${d}</b>`).join("")}</span>`
    );
    counter.dataset.tm = "";
    // Our own "under construction" sign — no borrowed GIFs.
    const sign = div(
      "position:fixed;left:12px;bottom:12px;z-index:2147483646;width:150px;font:700 12px 'Comic Sans MS',cursive;text-align:center;color:#000",
      `<svg viewBox="0 0 150 70" width="150" height="70" style="display:block">
         <defs><pattern id="tmstripe" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
           <rect width="10" height="20" fill="#111"/><rect x="10" width="10" height="20" fill="#ffcc00"/></pattern></defs>
         <rect x="2" y="2" width="146" height="66" rx="4" fill="url(#tmstripe)" stroke="#000" stroke-width="3"/>
         <rect x="14" y="18" width="122" height="34" fill="#ffcc00" stroke="#000" stroke-width="2"/>
         <text x="75" y="33" text-anchor="middle" font-size="12" font-weight="700" font-family="Comic Sans MS, cursive">UNDER</text>
         <text x="75" y="47" text-anchor="middle" font-size="12" font-weight="700" font-family="Comic Sans MS, cursive">CONSTRUCTION</text>
       </svg>`
    );
    sign.dataset.tm = "";
    sign.firstElementChild.style.animation = "tm-blink 1s steps(2) infinite";
    // sparkle cursor trail
    let last = 0;
    listen(window, "mousemove", (e) => {
      const now = performance.now();
      if (now - last < 30) return;
      last = now;
      const s = document.createElement("span");
      s.dataset.tm = "";
      s.textContent = ["✦", "✧", "★", "·"][Math.floor(Math.random() * 4)];
      s.style.cssText = `position:fixed;left:${e.clientX + (Math.random() * 10 - 5)}px;top:${e.clientY + 6}px;pointer-events:none;z-index:2147483647;
        color:hsl(${Math.random() * 360} 100% 70%);font-size:${10 + Math.random() * 8}px;animation:tm-spark .8s ease-out forwards`;
      document.documentElement.appendChild(s);
      setTimeout(() => s.remove(), 850);
    }, { passive: true });
  }

  // =====================================================================
  if (theme === "terminal" || theme === "amber") {
    const c = theme === "amber" ? { fg: "#ffb000", dim: "#a86f00", glow: "#ffb00088" } : { fg: "#33ff66", dim: "#1c9c3e", glow: "#33ff6688" };
    const tint = theme === "amber"
      ? "grayscale(1) sepia(1) saturate(4) hue-rotate(-12deg) brightness(.85) contrast(1.2)"
      : "grayscale(1) sepia(1) saturate(5) hue-rotate(65deg) brightness(.8) contrast(1.25)";
    css(`
      html,body{background:#050805!important}
      ${FLATTEN}
      body,body *:not([data-tm] *){color:${c.fg}!important;border-color:${c.dim}!important;text-shadow:0 0 5px ${c.glow}!important}
      body *:not([class*="icon" i]):not(i):not([class*="material" i]):not([data-tm] *){font-family:"VT323","IBM Plex Mono","Courier New",ui-monospace,monospace!important;letter-spacing:.02em!important}
      body a,body a *{text-decoration:underline!important}
      body a:hover{background:${c.fg}!important;color:#000!important;text-shadow:none!important}
      img,video,picture,canvas,svg image{filter:${tint}!important}
      input,textarea,select,button{background:#000!important;border:1px solid ${c.fg}!important;border-radius:0!important}
      ::selection{background:${c.fg};color:#000}
      ::-webkit-scrollbar{width:10px;background:#000}
      ::-webkit-scrollbar-thumb{background:${c.dim}}
      @keyframes tm-flicker{0%,100%{opacity:.9}50%{opacity:.97}92%{opacity:.85}}
      @keyframes tm-cursor{50%{opacity:0}}
      @keyframes tm-fade{to{opacity:0;visibility:hidden}}
    `);
    div(
      "position:fixed;inset:0;pointer-events:none;z-index:2147483646;" +
      "background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.65) 100%);" +
      "animation:tm-flicker .15s infinite"
    ).dataset.tm = "";
    const prompt = div(
      `position:fixed;left:14px;bottom:10px;z-index:2147483647;pointer-events:none;font:16px 'VT323','Courier New',monospace;color:${c.fg};text-shadow:0 0 6px ${c.glow};background:#000c;padding:2px 6px`,
      `C:\\${esc(host.toUpperCase().slice(0, 30))}&gt; <span style="display:inline-block;width:9px;height:15px;vertical-align:-2px;background:${c.fg};animation:tm-cursor 1s steps(1) infinite"></span>`
    );
    prompt.dataset.tm = "";
    // boot screen
    const boot = div(
      `position:fixed;inset:0;z-index:2147483647;background:#000;color:${c.fg};font:18px/1.5 'VT323','Courier New',monospace;padding:30px;
       text-shadow:0 0 6px ${c.glow};white-space:pre;animation:tm-fade .4s ease 1.9s forwards;pointer-events:none`
    );
    boot.dataset.tm = "";
    const lines = [
      "PHOSPHOR BIOS v2.04  (C) 1987",
      "MEMORY TEST ........ 640K OK",
      `DIALING ${host.toUpperCase()} ...`,
      "CONNECT 2400",
      `LOADING "${title.toUpperCase().slice(0, 50)}"`,
      "READY."
    ];
    let i = 0;
    every(260, () => {
      if (i < lines.length) boot.textContent += lines[i++] + "\n";
    });
    setTimeout(() => boot.remove(), 2400);
  }

  // Esc in any theme returns to the present.
  listen(window, "keydown", (e) => {
    if (e.key === "Escape" && e.shiftKey) off();
  }, true);
})();
