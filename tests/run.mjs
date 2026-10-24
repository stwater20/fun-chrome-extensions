// Headless checks for all eight extensions, plus screenshots.
// Usage: cd tests && npm i && node run.mjs [--shots <dir>] [--only name,name]
// Uses CHROME_PATH if set, otherwise the Chromium bundled with @sparticuz/chromium.
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const argv = process.argv.slice(2);
const SHOTS = path.resolve(argv.includes("--shots") ? argv[argv.indexOf("--shots") + 1] : path.join(HERE, "shots"));
const ONLY = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : null;
fs.mkdirSync(SHOTS, { recursive: true });
const MOCK = fs.readFileSync(path.join(HERE, "mock-chrome.js"), "utf8");
const read = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- tiny static servers ----------
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".json": "application/json", ".css": "text/css" };
function serveFile(res, file) {
  if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}
const web = http.createServer((req, res) => serveFile(res, path.join(REPO, decodeURIComponent(new URL(req.url, "http://x").pathname))));
await new Promise((r) => web.listen(8765, r));
const SITE = "http://127.0.0.1:8765/tests/site/index.html";

const certDir = fs.mkdtempSync(path.join(os.tmpdir(), "cert-"));
execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${certDir}/k.pem -out ${certDir}/c.pem -days 2 -subj /CN=en.wikipedia.org 2>/dev/null`);
const WIKI_TITLES = { Start_page: "Start page", Middle_page: "Middle page", Target_page: "Target page", Target_redirect: "Target page" };
const wiki = https.createServer({ key: fs.readFileSync(`${certDir}/k.pem`), cert: fs.readFileSync(`${certDir}/c.pem`) }, (req, res) => {
  const u = new URL(req.url, "https://en.wikipedia.org");
  const sum = u.pathname.match(/^\/api\/rest_v1\/page\/summary\/(.+)$/);
  if (sum) {
    const t = WIKI_TITLES[decodeURIComponent(sum[1])];
    res.writeHead(t ? 200 : 404, { "content-type": "application/json", "access-control-allow-origin": "*" });
    return res.end(JSON.stringify(t ? { type: "standard", title: t, titles: { canonical: t.replace(/ /g, "_"), normalized: t } } : {}));
  }
  const page = u.pathname.match(/^\/wiki\/(.+)$/)?.[1];
  const file = { Start_page: "Start_page", Middle_page: "Middle_page", Target_page: "Target_page", Target_redirect: "Target_page" }[page];
  if (!file) { res.writeHead(404); return res.end("<h1>Not found</h1>"); }
  serveFile(res, path.join(HERE, "site", "wiki", file + ".html"));
});
await new Promise((r) => wiki.listen(8443, r));

// ---------- browser ----------
let exe = process.env.CHROME_PATH;
let chromiumArgs = [];
if (!exe) {
  const chromium = (await import("@sparticuz/chromium")).default;
  exe = await chromium.executablePath();
  chromiumArgs = chromium.args.filter((a) => !/--single-process|--headless/.test(a));
}
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: "shell",
  args: [...chromiumArgs, "--autoplay-policy=no-user-gesture-required", "--ignore-certificate-errors",
    "--host-resolver-rules=MAP en.wikipedia.org 127.0.0.1:8443", "--font-render-hinting=none", "--no-proxy-server"],
  defaultViewport: { width: 1280, height: 800 },
  // keep the browser off any HTTP(S) proxy so the fake Wikipedia host resolves locally
  env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !/proxy/i.test(k)))
});

const results = [];
async function test(name, fn) {
  if (ONLY && !ONLY.some((o) => name.startsWith(o))) return;
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/favicon|404|ERR_|net::/.test(m.text()) && errors.push(m.text()));
  await page.evaluateOnNewDocument(MOCK);
  const t0 = Date.now();
  try {
    await fn(page, errors);
    if (errors.length) throw new Error("page errors: " + errors.join(" | "));
    results.push([name, "PASS", Date.now() - t0]);
    console.log(`✅ ${name}`);
  } catch (e) {
    results.push([name, "FAIL", e.message]);
    console.log(`❌ ${name}: ${e.message}`);
    await page.screenshot({ path: path.join(SHOTS, `FAIL-${name}.png`) }).catch(() => {});
  }
  await page.close();
}
const inject = async (page, files) => { for (const f of files) await page.addScriptTag({ content: read(f) }); };
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + ".png") });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const shadow = (page, hostSel, sel, fn = "textContent") =>
  page.evaluate((h, s, f) => document.querySelector(h)?.shadowRoot?.querySelector(s)?.[f], hostSel, sel, fn);

// =====================================================================
await test("typing-rampage", async (page) => {
  await page.goto(SITE);
  await inject(page, ["typing-rampage/content.js"]);
  await page.evaluate(() => document.querySelector("textarea").scrollIntoView({ block: "center" }));
  await page.click("textarea");
  await page.keyboard.type("cats are the true rulers of the internet and everyone knows", { delay: 25 });
  await sleep(60);
  await shot(page, "typing-rampage");
  const combo = await page.evaluate(() => {
    const h = [...document.documentElement.children].find((e) => e.shadowRoot?.querySelector(".num"));
    return +h.shadowRoot.querySelector(".num span").textContent;
  });
  assert(combo >= 50, "combo too low: " + combo);
  const label = await page.evaluate(() => [...document.documentElement.children].find((e) => e.shadowRoot?.querySelector(".label")).shadowRoot.querySelector(".label").textContent);
  assert(label === "RAMPAGE!", "expected RAMPAGE! label, got " + label);
  assert(await page.$("canvas"), "particle canvas missing");
  // password fields stay quiet
  await page.evaluate(() => { const i = document.createElement("input"); i.type = "password"; i.id = "pw"; document.querySelector("main").prepend(i); });
  const before = combo;
  await sleep(2700);
  await page.click("#pw");
  await page.keyboard.type("secret", { delay: 10 });
  const after = await page.evaluate(() => +[...document.documentElement.children].find((e) => e.shadowRoot?.querySelector(".num")).shadowRoot.querySelector(".num span").textContent);
  assert(after === before, `password field fed the combo (${before} -> ${after})`);
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem("__mock_storage_local")).best);
  assert(best >= 50, "best combo not saved: " + best);
});

await test("typing-rampage-popup", async (page) => {
  await page.setViewport({ width: 300, height: 470 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("__mock_storage_local", JSON.stringify({ best: 137, total: 48213 })));
  await page.goto("http://127.0.0.1:8765/typing-rampage/popup.html");
  await sleep(200);
  assert((await page.$eval("#best", (e) => e.textContent)) === "137", "best not shown");
  await page.click("#sound");
  await sleep(50);
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("__mock_storage_sync")));
  assert(s.sound === true, "setting not saved");
  await shot(page, "popup-typing-rampage");
});

// =====================================================================
await test("page-physics", async (page) => {
  await page.goto(SITE);
  await inject(page, ["page-physics/vendor/matter.min.js", "page-physics/physics.js"]);
  await sleep(300);
  const bodies = await page.evaluate(() => document.getElementById("__page-physics")?.children.length || 0);
  assert(bodies >= 8, "too few bodies: " + bodies);
  await sleep(2600);
  await shot(page, "page-physics");
  // things actually fell: most clones should now sit lower than they started
  const fell = await page.evaluate(() => [...document.getElementById("__page-physics").children]
    .filter((c) => /translate\([-\d.]+px, ([\d.]+)px\)/.test(c.style.transform) && +RegExp.$1 > innerHeight * 0.45).length);
  assert(fell >= bodies * 0.5, `only ${fell}/${bodies} bodies fell`);
  await page.mouse.move(640, 700);
  await page.mouse.down();
  await page.mouse.move(500, 200, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await sleep(800);
  await shot(page, "page-physics-zero-g");
  await page.keyboard.press("Escape");
  await sleep(100);
  const left = await page.evaluate(() => ({
    overlay: !!document.getElementById("__page-physics"),
    hidden: [...document.querySelectorAll("*")].filter((e) => e.style.visibility === "hidden").length,
    overflow: document.documentElement.style.overflow
  }));
  assert(!left.overlay && left.hidden === 0 && left.overflow === "", "page not restored: " + JSON.stringify(left));
});

// =====================================================================
for (const n of [2, 8, 18, 30, 48, 75]) {
  await test(`tab-pet-popup-${n}`, async (page) => {
    await page.setViewport({ width: 320, height: 540 });
    await page.evaluateOnNewDocument((n) => {
      window.__mockTabs = Array.from({ length: n }, (_, i) => ({ id: i + 1, active: i === 0 }));
      localStorage.setItem("__mock_storage_local", JSON.stringify({ state: {
        name: "Mochi", bornAt: Date.now() - 12 * 864e5, day: new Date().toLocaleDateString("en-CA"), opened: n + 3, closed: 4, eaten: 1,
        lifetimeOpened: 812, eatenTabs: [{ title: "How to fold a fitted sheet - a complete guide", url: "https://example.com/sheet", at: Date.now() }],
        snack: { enabled: n > 40, threshold: 25, intervalMin: 30 } } }));
    }, n);
    await page.goto("http://127.0.0.1:8765/tab-pet/popup.html");
    await sleep(400);
    assert((await page.$eval("#tabs", (e) => e.textContent)) === String(n), "tab count wrong");
    if (n === 48) await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await sleep(100);
    await shot(page, `popup-tab-pet-${n}`);
  });
}

await test("tab-pet-worker", async () => {
  // Run the real service worker in a sandbox with a fake chrome.* and check its bookkeeping.
  const store = {};
  const tabs = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, active: i === 0, pinned: i === 1, audible: i === 2, url: "https://e.com/" + i, title: "Tab " + i, lastAccessed: 1000 + i }));
  const listeners = {};
  const on = (k) => ({ addListener: (f) => ((listeners[k] ||= []).push(f)) });
  const icons = [];
  const chrome = {
    storage: {
      local: { get: async (k) => (typeof k === "string" ? { [k]: store[k] } : { ...store }), set: async (o) => Object.assign(store, JSON.parse(JSON.stringify(o))) },
      onChanged: on("changed")
    },
    tabs: { query: async () => tabs, remove: async (id) => { for (const x of [].concat(id)) tabs.splice(tabs.findIndex((t) => t.id === x), 1); }, create: async (o) => tabs.push({ id: 99, ...o }), onCreated: on("created"), onRemoved: on("removed") },
    action: { setIcon: (o) => icons.push(o), setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    alarms: { clear: async () => true, create() {}, onAlarm: on("alarm") },
    runtime: { onMessage: on("message"), onInstalled: on("installed"), onStartup: on("startup") }
  };
  const ctx = { chrome, console, setTimeout, clearTimeout, OffscreenCanvas: class { constructor(w, h) { this.w = w; this.h = h; } getContext() { return new Proxy({}, { get: (t, p) => (p === "getImageData" ? () => ({ w: 1 }) : typeof p === "string" ? () => {} : undefined), set: () => true }); } }, Math, Date, JSON, Promise, String };
  ctx.self = ctx;
  ctx.importScripts = (f) => vm.runInContext(read("tab-pet/" + f), ctx);
  vm.createContext(ctx);
  vm.runInContext(read("tab-pet/background.js"), ctx);
  const msg = (m) => new Promise((r) => listeners.message[0](m, {}, r));
  listeners.installed.forEach((f) => f({}));
  for (let i = 0; i < 3; i++) listeners.created.forEach((f) => f());
  listeners.removed.forEach((f) => f());
  await sleep(400);
  assert(store.state.opened === 3 && store.state.closed === 1, "counters wrong: " + JSON.stringify(store.state));
  assert(icons.length >= 1, "icon never drawn");
  const ate = await msg({ type: "feed-now" });
  assert(ate.title === "Tab 3", "should eat the least recently used safe tab, ate " + ate.title);
  assert(!tabs.some((t) => t.id === 4), "tab not closed");
  await sleep(400);
  assert(store.state.eaten === 1 && store.state.closed === 1, "snack counted as exercise");
  await msg({ type: "spit", index: 0 });
  assert(tabs.some((t) => t.url === "https://e.com/3"), "spit didn't reopen");
  tabs.push({ id: 50, url: "https://e.com/5#x", title: "dup", lastAccessed: 1 });
  const d = await msg({ type: "dedupe" });
  assert(d.closed === 1, "dedupe closed " + d.closed);
});

// =====================================================================
await test("web-graffiti", async (page) => {
  await page.evaluateOnNewDocument(() => {
    window.__mockBackground = (m) => (m.type === "whoami" ? { id: "me123456789a" } : undefined);
    localStorage.setItem("__mock_storage_sync", JSON.stringify({ nick: "Kai", color: "#3a86ff" }));
  });
  await page.goto(SITE);
  await inject(page, ["web-graffiti/content.js"]);
  await sleep(200);
  await page.evaluate(() => window.__mockDispatch({ type: "toggle" }));
  await sleep(150);
  const H = "#__web-graffiti";
  assert(await page.$(H), "layer not mounted");
  await page.evaluate((H) => document.querySelector(H).shadowRoot.querySelector('[data-act="note"]').click(), H);
  await sleep(100);
  await page.keyboard.type("This article is 100% correct. — a cat");
  await sleep(500);
  await page.evaluate((H) => document.querySelector(H).shadowRoot.querySelector('[data-act="draw"]').click(), H);
  await page.mouse.move(200, 300);
  await page.mouse.down();
  for (let i = 0; i <= 40; i++) await page.mouse.move(200 + i * 12, 300 + Math.sin(i / 3) * 60);
  await page.mouse.up();
  await page.mouse.move(820, 250);
  await page.mouse.down();
  for (let i = 0; i <= 30; i++) await page.mouse.move(820 + Math.cos(i / 4.8) * 70, 250 + Math.sin(i / 4.8) * 70);
  await page.mouse.up();
  await sleep(500);
  await shot(page, "web-graffiti");
  const saved = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("__mock_storage_local") || "{}");
    const k = Object.keys(s).find((k) => k.startsWith("page:"));
    return k && { notes: s[k].notes.length, strokes: s[k].strokes.length, text: s[k].notes[0]?.text, author: s[k].notes[0]?.author };
  });
  assert(saved && saved.notes === 1 && saved.strokes === 2, "not saved: " + JSON.stringify(saved));
  assert(saved.text.startsWith("This article"), "note text not saved");
  // undo removes the last stroke
  await page.evaluate((H) => document.querySelector(H).shadowRoot.querySelector('[data-act="undo"]').click(), H);
  await sleep(400);
  // a fresh visit shows the graffiti without opening the toolbar
  await page.reload();
  await inject(page, ["web-graffiti/content.js"]);
  await sleep(400);
  const after = await page.evaluate((H) => ({
    notes: document.querySelector(H)?.shadowRoot.querySelectorAll(".note").length,
    paths: document.querySelector(H)?.shadowRoot.querySelectorAll(".ink path").length,
    barShown: getComputedStyle(document.querySelector(H).shadowRoot.querySelector(".bar")).display
  }), H);
  assert(after.notes === 1 && after.paths === 1 && after.barShown === "none", "reload state wrong: " + JSON.stringify(after));
});

await test("web-graffiti-options", async (page) => {
  await page.setViewport({ width: 900, height: 900 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("__mock_storage_local", JSON.stringify({
    ["page:" + "a".repeat(64)]: { url: "https://news.example.com/cats", title: "Why Cats Run the Internet", notes: [{}], strokes: [{}, {}], at: Date.now() }
  })));
  await page.goto("http://127.0.0.1:8765/web-graffiti/options.html");
  await sleep(200);
  assert((await page.$$("#pages li")).length === 1, "page list missing");
  await shot(page, "options-web-graffiti");
});

await test("web-graffiti-relay", async () => {
  // Real server + two copies of the real service worker (two "browsers") talking through it.
  const port = 8799;
  const srv = spawn(process.execPath, ["server.js"], { cwd: path.join(REPO, "web-graffiti/server"), env: { ...process.env, PORT: port, DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "gdata-")) } });
  await sleep(600);
  try {
    function browserSW(secret) {
      const local = { secret }, sync = { serverUrl: `ws://127.0.0.1:${port}` };
      const L = {};
      const on = (k) => ({ addListener: (f) => ((L[k] ||= []).push(f)) });
      const chrome = {
        storage: {
          local: { get: async (k) => ({ [k]: local[k] }), set: async (o) => Object.assign(local, o) },
          sync: { get: async (d) => ({ ...d, ...sync }) },
          onChanged: on("changed")
        },
        action: { onClicked: on("click"), setBadgeText() {} },
        runtime: { onMessage: on("msg"), onConnect: on("connect"), onInstalled: on("inst"), openOptionsPage() {} },
        tabs: { sendMessage: async () => {} }, scripting: {}
      };
      const ctx = vm.createContext({ chrome, crypto: globalThis.crypto, TextEncoder, WebSocket: globalThis.WebSocket, setTimeout, clearTimeout, setInterval, clearInterval, console, JSON, Promise, Map, Set, Uint8Array });
      vm.runInContext(read("web-graffiti/background.js"), ctx);
      return {
        connect() {
          const got = [];
          const ml = [], dl = [];
          const p = { name: "graffiti", onMessage: { addListener: (f) => ml.push(f) }, onDisconnect: { addListener: (f) => dl.push(f) }, postMessage: (m) => got.push(m) };
          L.connect[0](p);
          return { got, send: (m) => ml.forEach((f) => f(m)), close: () => dl.forEach((f) => f()) };
        }
      };
    }
    const room = "b".repeat(64);
    const A = browserSW("x".repeat(40)).connect();
    const B = browserSW("y".repeat(40)).connect();
    A.send({ type: "join", room });
    B.send({ type: "join", room });
    await sleep(700);
    assert(A.got.some((m) => m.type === "status" && m.status === "online"), "A never online: " + JSON.stringify(A.got));
    assert(B.got.some((m) => m.type === "snapshot"), "B got no snapshot");
    const authorA = (await crypto.subtle.digest("SHA-256", new TextEncoder().encode("x".repeat(40))));
    const idA = [...new Uint8Array(authorA)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
    A.send({ type: "op", op: { kind: "note:upsert", note: { id: "n1", author: idA, nick: "A", x: 1, y: 2, text: "hi <b>", color: "#fff27a" } } });
    A.send({ type: "op", op: { kind: "stroke:add", stroke: { id: "s1", author: idA, color: "#ff0000", size: 4, points: [[0, 0], [5, 5]] } } });
    A.send({ type: "cursor", x: 10, y: 20, nick: "A", color: "#123456" });
    await sleep(400);
    const ops = B.got.filter((m) => m.type === "op");
    assert(ops.length === 2 && ops[0].op.note.text === "hi <b>" && ops[0].op.note.author === idA, "B didn't get A's ops: " + JSON.stringify(ops));
    assert(B.got.some((m) => m.type === "cursor" && m.x === 10), "B didn't see A's cursor");
    // B can't delete A's note
    B.send({ type: "op", op: { kind: "note:delete", id: "n1" } });
    await sleep(300);
    assert(!A.got.some((m) => m.type === "op" && m.op.kind === "note:delete"), "B deleted A's note!");
    // a late joiner gets the snapshot
    const C = browserSW("z".repeat(40)).connect();
    C.send({ type: "join", room });
    await sleep(600);
    const snap = C.got.find((m) => m.type === "snapshot");
    assert(snap && snap.notes.length === 1 && snap.strokes.length === 1 && snap.peers === 3, "late snapshot wrong: " + JSON.stringify(snap));
    // A clears its stuff
    A.send({ type: "op", op: { kind: "clear-author", author: idA } });
    await sleep(300);
    assert(C.got.some((m) => m.type === "op" && m.op.kind === "clear-author"), "clear not relayed");
    A.close(); B.close(); C.close();
  } finally {
    srv.kill();
  }
});

// =====================================================================
await test("wiki-race", async (page, errors) => {
  const W = "https://en.wikipedia.org/wiki/";
  const boot = async () => {
    await page.evaluate(() => (window.__mockLoadingBackground = true));
    await page.addScriptTag({ content: "window.importScripts = () => {};" });
    await inject(page, ["wiki-race/wiki.js", "wiki-race/background.js"]);
    await page.evaluate(() => (window.__mockLoadingBackground = false));
    await inject(page, ["wiki-race/content.js"]);
    await sleep(300);
  };
  const host = "body > div, html > div";
  const sr = (sel) => page.evaluate((sel) => [...document.documentElement.children].find((e) => e.shadowRoot)?.shadowRoot.querySelector(sel)?.textContent, sel);
  await page.goto(W + "Start_page#wikirace=Target_page");
  await boot();
  assert((await sr(".banner"))?.includes("Target page"), "challenge banner missing");
  await shot(page, "wiki-race-challenge");
  const nav = page.waitForNavigation();
  await page.evaluate(() => [...document.documentElement.children].find((e) => e.shadowRoot).shadowRoot.querySelector(".banner button").click());
  await nav;
  await boot();
  assert((await sr(".hud"))?.includes("Target page"), "HUD missing after start");
  // search is hidden, forbidden links are blocked
  assert(await page.$eval("#p-search", (e) => getComputedStyle(e).display) === "none", "search not hidden");
  await page.click('a[href="/wiki/Special:Random"]');
  await sleep(300);
  assert(page.url().endsWith("Start_page"), "blocked link navigated: " + page.url());
  assert((await sr(".flash"))?.includes("Only article links"), "no flash for blocked link");
  await page.click('a[href="#cite_note-1"]');
  await Promise.all([page.waitForNavigation(), page.click('a[href="/wiki/Middle_page"]')]);
  await boot();
  assert((await sr("#clicks")) === "1", "click count should be 1, got " + (await sr("#clicks")));
  await shot(page, "wiki-race-hud");
  await sleep(1100);
  await Promise.all([page.waitForNavigation(), page.click('a[href="/wiki/Target_redirect"]')]);
  await boot();
  assert((await sr(".card h2"))?.includes("You made it"), "no win screen");
  await shot(page, "wiki-race-win");
  const hist = await page.evaluate(() => JSON.parse(localStorage.getItem("__mock_storage_local")).history);
  assert(hist.length === 1 && hist[0].clicks === 2 && hist[0].offRoute === 0 && hist[0].path.join(">") === "Start page>Middle page>Target page", "history wrong: " + JSON.stringify(hist));
});

await test("wiki-race-popup", async (page) => {
  await page.setViewport({ width: 340, height: 600 });
  await page.evaluateOnNewDocument(() => {
    window.__mockBackground = (m) => (m.type === "status" ? { 7: { start: "Bubble tea", target: "Black hole", clicks: 3, startedAt: Date.now() - 47000 } } : {});
    localStorage.setItem("__mock_storage_local", JSON.stringify({ lang: "en", history: [
      { lang: "en", start: "Penguin", target: "Mount Everest", clicks: 4, ms: 83000, path: ["Penguin", "Antarctica", "Mountain", "Himalayas", "Mount Everest"] },
      { lang: "zh", start: "珍珠奶茶", target: "火星", clicks: 6, ms: 151000, path: [] }] }));
  });
  await page.goto("http://127.0.0.1:8765/wiki-race/popup.html");
  await sleep(300);
  assert((await page.$$("#hist li")).length === 2, "history missing");
  await shot(page, "popup-wiki-race");
});

// =====================================================================
await test("page-dungeon", async (page) => {
  await page.goto(SITE);
  await inject(page, ["page-dungeon/dungeon.js"]);
  await sleep(300);
  const sr = (sel) => page.evaluate((s) => document.getElementById("__page-dungeon").shadowRoot.querySelector(s)?.textContent, sel);
  assert((await sr(".floor"))?.startsWith("Floor 1/4"), "expected 4 floors (title + 3 sections), got " + (await sr(".floor")));
  // wander with a simple explorer: prefer unexplored directions, take stairs when on them
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  let k = 0;
  for (let i = 0; i < 700; i++) {
    if (i % 9 === 0) k = Math.floor(Math.random() * 4);
    await page.keyboard.press(keys[k]);
    if (i % 3 === 0) await page.keyboard.press("Enter");
    const over = await page.evaluate(() => document.getElementById("__page-dungeon")?.shadowRoot.querySelector(".end.on"));
    if (over) break;
    if (i === 40) await shot(page, "page-dungeon");
  }
  const log = await sr(".log");
  assert(log && log.length > 10, "no log output");
  await shot(page, "page-dungeon-later");
  await page.keyboard.press("Escape");
  assert(!(await page.$("#__page-dungeon")), "dungeon didn't close");
});

// =====================================================================
await test("page-symphony", async (page) => {
  await page.goto(SITE);
  await inject(page, ["page-symphony/symphony.js"]);
  await sleep(200);
  const sr = (s) => page.evaluate((s) => document.getElementById("__page-symphony").shadowRoot.querySelector(s), s);
  await page.evaluate(() => document.getElementById("__page-symphony").shadowRoot.querySelector(".play").click());
  await sleep(3500);
  const st = await page.evaluate(() => {
    const r = document.getElementById("__page-symphony").shadowRoot;
    return { now: r.querySelector(".now").textContent, prog: parseFloat(r.querySelector(".prog i").style.width), lit: [...document.querySelectorAll("*")].some((e) => e.style.outline.includes("solid")) };
  });
  assert(st.now !== "Press play to hear this page." && st.prog > 0 && st.lit, "not playing: " + JSON.stringify(st));
  await shot(page, "page-symphony");
  await page.evaluate(() => document.getElementById("__page-symphony").shadowRoot.querySelector(".stop").click());
  await page.evaluate(() => document.getElementById("__page-symphony").shadowRoot.querySelector(".x").click());
  const left = await page.evaluate(() => [...document.querySelectorAll("*")].filter((e) => e.style.outline.includes("solid")).length);
  assert(left === 0 && !(await page.$("#__page-symphony")), "player not cleaned up");
});

// =====================================================================
for (const theme of ["win95", "geocities", "terminal", "amber"]) {
  await test(`time-machine-${theme}`, async (page) => {
    await page.goto(SITE);
    const before = await page.evaluate(() => document.querySelectorAll("style").length);
    await page.evaluate((t) => (window.__tmTheme = t), theme);
    await inject(page, ["time-machine/filters.js"]);
    await page.mouse.move(600, 400);
    for (let i = 0; i < 12; i++) await page.mouse.move(600 + i * 15, 400 + i * 6);
    await sleep(2600);
    await shot(page, `time-machine-${theme}`);
    await page.evaluate(() => (window.__tmTheme = "off"));
    await inject(page, ["time-machine/filters.js"]);
    const after = await page.evaluate(() => ({ styles: document.querySelectorAll("style").length, extra: document.querySelectorAll("[data-tm]").length }));
    assert(after.styles === before && after.extra === 0, "theme not removed: " + JSON.stringify(after));
  });
}
await test("time-machine-popup", async (page) => {
  await page.setViewport({ width: 330, height: 420 });
  await page.goto("http://127.0.0.1:8765/time-machine/popup.html");
  await sleep(200);
  await page.click('[data-theme="geocities"]');
  await sleep(100);
  await shot(page, "popup-time-machine");
});

// ---------- manifests ----------
await test("manifests", async () => {
  for (const dir of ["typing-rampage", "page-physics", "tab-pet", "web-graffiti", "wiki-race", "page-dungeon", "page-symphony", "time-machine"]) {
    const m = JSON.parse(read(`${dir}/manifest.json`));
    assert(m.manifest_version === 3, dir + " not MV3");
    const files = [m.background?.service_worker, m.action?.default_popup, m.options_page, ...Object.values(m.icons),
      ...(m.content_scripts || []).flatMap((c) => c.js)].filter(Boolean);
    for (const f of files) assert(fs.existsSync(path.join(REPO, dir, f)), `${dir}: missing ${f}`);
    for (const loc of ["en", "zh_TW"]) {
      const msgs = JSON.parse(read(`${dir}/_locales/${loc}/messages.json`));
      for (const k of JSON.stringify(m).match(/__MSG_(\w+)__/g).map((s) => s.slice(6, -2))) assert(msgs[k], `${dir} ${loc} missing ${k}`);
      assert(msgs.description.message.length <= 132, `${dir} ${loc} description too long (${msgs.description.message.length})`);
      assert(msgs.name.message.length <= 75, `${dir} name too long`);
    }
  }
});

await browser.close();
web.close();
wiki.close();
const failed = results.filter((r) => r[1] === "FAIL");
console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshots in ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
