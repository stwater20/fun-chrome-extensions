importScripts("pet.js");

const DEFAULT_STATE = {
  name: "Tabby",
  bornAt: 0,
  day: "",
  opened: 0, // today: food
  closed: 0, // today: exercise
  eaten: 0, // today: snacks
  lifetimeOpened: 0,
  eatenTabs: [], // [{title, url, at}]
  snack: { enabled: false, threshold: 25, intervalMin: 30 }
};

const today = () => new Date().toLocaleDateString("en-CA");

async function getState() {
  const { state } = await chrome.storage.local.get("state");
  const s = { ...DEFAULT_STATE, ...(state || {}) };
  s.snack = { ...DEFAULT_STATE.snack, ...(s.snack || {}) };
  if (!s.bornAt) s.bornAt = Date.now();
  if (s.day !== today()) Object.assign(s, { day: today(), opened: 0, closed: 0, eaten: 0 });
  return s;
}
const setState = (s) => chrome.storage.local.set({ state: s });

// Serialize read-modify-write so rapid tab events don't clobber each other.
let queue = Promise.resolve();
function update(fn) {
  queue = queue.then(async () => {
    const s = await getState();
    await fn(s);
    await setState(s);
  }).catch(console.error);
  return queue;
}

async function countTabs() {
  return (await chrome.tabs.query({})).length;
}

let iconTimer;
function refreshIcon() {
  clearTimeout(iconTimer);
  iconTimer = setTimeout(async () => {
    const n = await countTabs();
    const imageData = {};
    for (const size of [16, 32]) {
      const c = new OffscreenCanvas(size, size);
      PET.draw(c.getContext("2d"), size, n);
      imageData[size] = c.getContext("2d").getImageData(0, 0, size, size);
    }
    chrome.action.setIcon({ imageData });
    chrome.action.setBadgeText({ text: String(n) });
    const hue = 140 - Math.max(0, Math.min(1, (n - 4) / 60)) * 140;
    chrome.action.setBadgeBackgroundColor({ color: `hsl(${hue},60%,38%)` });
    chrome.action.setTitle({ title: `${n} tabs — ${PET.mood(n).line}` });
  }, 150);
}

chrome.tabs.onCreated.addListener(() => {
  update((s) => { s.opened++; s.lifetimeOpened++; });
  refreshIcon();
});
chrome.tabs.onRemoved.addListener(() => {
  if (!snacking) update((s) => { s.closed++; });
  refreshIcon();
});

// ---------- snack mode ----------
let snacking = false;
async function scheduleSnack() {
  const s = await getState();
  await chrome.alarms.clear("snack");
  if (s.snack.enabled) {
    chrome.alarms.create("snack", { periodInMinutes: Math.max(1, s.snack.intervalMin) });
  }
}

async function snack(force = false) {
  const s = await getState();
  const tabs = await chrome.tabs.query({});
  if (!force && (!s.snack.enabled || tabs.length <= s.snack.threshold)) return null;
  const food = tabs
    .filter((t) => !t.active && !t.pinned && !t.audible && t.url && !/^chrome(-extension)?:/.test(t.url))
    .sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0))[0];
  if (!food) return null;
  snacking = true;
  try {
    await chrome.tabs.remove(food.id);
  } finally {
    setTimeout(() => (snacking = false), 300);
  }
  await update((st) => {
    st.eaten++;
    st.eatenTabs.unshift({ title: food.title || food.url, url: food.url, at: Date.now() });
    st.eatenTabs = st.eatenTabs.slice(0, 30);
  });
  chrome.action.setBadgeText({ text: "nom" });
  setTimeout(refreshIcon, 1800);
  return food.title;
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "snack") snack();
});

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.state) return;
  const a = changes.state.oldValue?.snack, b = changes.state.newValue?.snack;
  if (JSON.stringify(a) !== JSON.stringify(b)) scheduleSnack();
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === "feed-now") {
    snack(true).then((title) => reply({ title }));
    return true;
  }
  if (msg.type === "set-name") {
    update((s) => { s.name = String(msg.name).slice(0, 24) || "Tabby"; }).then(() => reply({}));
    return true;
  }
  if (msg.type === "set-snack") {
    update((s) => { s.snack = { ...s.snack, ...msg.snack }; }).then(() => reply({}));
    return true;
  }
  if (msg.type === "spit") {
    // Re-open an eaten tab and forget it.
    update(async (s) => {
      const [item] = s.eatenTabs.splice(msg.index, 1);
      if (item) await chrome.tabs.create({ url: item.url, active: false });
    }).then(() => reply({}));
    return true;
  }
  if (msg.type === "dedupe") {
    chrome.tabs.query({}).then(async (tabs) => {
      const seen = new Set();
      const dupes = [];
      for (const t of tabs.sort((a, b) => (b.active - a.active) || (b.lastAccessed - a.lastAccessed))) {
        const key = (t.url || "").split("#")[0];
        if (!key) continue;
        if (seen.has(key) && !t.pinned && !t.active) dupes.push(t.id);
        else seen.add(key);
      }
      if (dupes.length) await chrome.tabs.remove(dupes);
      reply({ closed: dupes.length });
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  update(() => {});
  scheduleSnack();
  refreshIcon();
});
chrome.runtime.onStartup.addListener(() => {
  scheduleSnack();
  refreshIcon();
});
refreshIcon();
