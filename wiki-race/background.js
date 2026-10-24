importScripts("wiki.js");

// Games live in storage.session keyed by tab id so they survive the worker sleeping.
async function games() {
  return (await chrome.storage.session.get({ games: {} })).games;
}
async function saveGames(g) {
  await chrome.storage.session.set({ games: g });
}
let lock = Promise.resolve();
function withGames(fn) {
  const run = lock.then(async () => {
    const g = await games();
    const out = await fn(g);
    await saveGames(g);
    return out;
  });
  lock = run.catch(() => {});
  return run;
}

async function canonical(lang, title) {
  const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (!r.ok) throw new Error(`“${title}” isn't a ${lang} Wikipedia article.`);
  const j = await r.json();
  if (j.type === "disambiguation") return WIKI.normalize(j.titles?.canonical || j.title);
  return WIKI.normalize(j.titles?.canonical || j.title);
}

async function startGame({ lang, start, target, tabId }) {
  const [s, t] = await Promise.all([canonical(lang, start), canonical(lang, target)]);
  if (s === t) throw new Error("Start and target are the same article.");
  let id = tabId;
  const fresh = id == null;
  if (fresh) id = (await chrome.tabs.create({ url: "about:blank" })).id;
  // Register the race before the article loads so the first page counts.
  await withGames((g) => {
    g[id] = { lang, start: s, target: t, path: [], clicks: 0, offRoute: 0, startedAt: 0, finishedAt: 0, expected: null };
  });
  if (fresh) await chrome.tabs.update(id, { url: WIKI.articleUrl(lang, s) });
  return { tabId: id, start: s, url: WIKI.articleUrl(lang, s) };
}

async function record(game) {
  const { history = [] } = await chrome.storage.local.get("history");
  history.unshift({
    lang: game.lang, start: game.start, target: game.target, clicks: game.clicks,
    ms: game.finishedAt - game.startedAt, path: game.path, offRoute: game.offRoute, at: game.finishedAt
  });
  await chrome.storage.local.set({ history: history.slice(0, 100) });
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab?.id;
  (async () => {
    switch (msg.type) {
      case "start":
        return startGame(msg);
      case "start-here":
        return startGame({ ...msg, tabId });
      case "click":
        return withGames((g) => {
          if (g[tabId] && !g[tabId].finishedAt) g[tabId].expected = msg.title;
        });
      case "page":
        return withGames(async (g) => {
          const game = g[tabId];
          if (!game) return { game: null };
          if (game.finishedAt) return { game };
          const here = msg.title;
          const last = game.path[game.path.length - 1];
          if (!game.startedAt) {
            if (here !== game.start && msg.from !== game.start) return { game: null, wrongStart: true };
            game.startedAt = Date.now();
            game.path.push(here);
          } else if (here !== last) {
            const legit =
              msg.backForward ||
              (game.expected && (game.expected === here || game.expected === msg.from)) ||
              game.path.includes(here);
            if (!legit) game.offRoute++;
            game.clicks++;
            game.path.push(here);
          }
          game.expected = null;
          if (here === game.target || msg.from === game.target) {
            game.finishedAt = Date.now();
            await record(game);
          }
          return { game };
        });
      case "give-up":
        return withGames((g) => {
          delete g[tabId];
        });
      case "status":
        return games();
    }
  })().then(reply, (e) => reply({ error: e.message }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => withGames((g) => { delete g[tabId]; }));
