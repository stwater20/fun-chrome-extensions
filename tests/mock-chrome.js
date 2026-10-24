// A small in-page stand-in for the chrome.* extension APIs, so content scripts,
// popups and (simple) workers can be exercised in a plain browser page.
// Storage is backed by localStorage so it survives navigations within an origin.
(() => {
  const L = { changed: [], content: [], bg: [], connect: [] };
  const sent = (window.__mockSent = []);
  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const later = (fn) => setTimeout(fn, 0);
  const done = (cb, val) => (cb ? (later(() => cb(val)), undefined) : Promise.resolve(val));

  function area(name) {
    const KEY = "__mock_storage_" + name;
    const read = () => JSON.parse(localStorage.getItem(KEY) || "{}");
    const write = (o) => localStorage.setItem(KEY, JSON.stringify(o));
    return {
      get(keys, cb) {
        if (typeof keys === "function") (cb = keys), (keys = null);
        const all = read();
        let out = {};
        if (keys == null) out = all;
        else if (typeof keys === "string") { if (keys in all) out[keys] = all[keys]; }
        else if (Array.isArray(keys)) keys.forEach((k) => k in all && (out[k] = all[k]));
        else for (const k in keys) out[k] = k in all ? all[k] : keys[k];
        return done(cb, clone(out));
      },
      set(obj, cb) {
        const all = read();
        const changes = {};
        for (const k in obj) {
          changes[k] = { oldValue: all[k], newValue: clone(obj[k]) };
          all[k] = clone(obj[k]);
        }
        write(all);
        later(() => L.changed.forEach((f) => f(changes, name)));
        return done(cb);
      },
      remove(keys, cb) {
        const all = read();
        const changes = {};
        for (const k of [].concat(keys)) {
          changes[k] = { oldValue: all[k] };
          delete all[k];
        }
        write(all);
        later(() => L.changed.forEach((f) => f(changes, name)));
        return done(cb);
      },
      clear(cb) { write({}); return done(cb); }
    };
  }
  const ev = (list) => ({ addListener: (f) => list.push(f), removeListener: (f) => list.splice(list.indexOf(f), 1) });

  function deliver(list, msg, sender) {
    return new Promise((resolve) => {
      let answered = false;
      const reply = (v) => { if (!answered) { answered = true; resolve(clone(v)); } };
      let async = false;
      for (const f of list) if (f(clone(msg), sender, reply) === true) async = true;
      if (!async) later(() => reply(undefined));
    });
  }

  window.chrome = {
    storage: { sync: area("sync"), local: area("local"), session: area("session"), onChanged: ev(L.changed) },
    runtime: {
      id: "mock",
      lastError: undefined,
      getURL: (p) => p,
      onMessage: {
        addListener: (f) => (window.__mockLoadingBackground ? L.bg : L.content).push(f),
        removeListener: () => {}
      },
      onConnect: ev(L.connect),
      onInstalled: ev([]),
      onStartup: ev([]),
      sendMessage(msg, cb) {
        sent.push(msg);
        const p = (window.__mockBackground ? Promise.resolve(window.__mockBackground(msg)) : deliver(L.bg, msg, { tab: { id: 1, url: location.href } }));
        if (cb) { p.then((v) => cb(v)); return; }
        return p;
      },
      connect(info) {
        const mk = () => {
          const m = [], d = [];
          return { m, d, onMessage: ev(m), onDisconnect: ev(d) };
        };
        const a = mk(), b = mk();
        const portA = { name: info?.name, onMessage: a.onMessage, onDisconnect: a.onDisconnect, postMessage: (x) => later(() => b.m.forEach((f) => f(clone(x)))), disconnect() {} };
        const portB = { name: info?.name, sender: { tab: { id: 1 } }, onMessage: b.onMessage, onDisconnect: b.onDisconnect, postMessage: (x) => later(() => a.m.forEach((f) => f(clone(x)))), disconnect() {} };
        (window.__mockPorts ||= []).push(portB);
        later(() => L.connect.forEach((f) => f(portB)));
        return portA;
      },
      openOptionsPage() {}
    },
    tabs: {
      query: (q, cb) => done(cb, clone(window.__mockTabs || [{ id: 1, active: true, windowId: 1 }])),
      sendMessage: (id, msg, cb) => {
        const p = deliver(L.content, msg, {});
        if (cb) { p.then(cb); return; }
        return p;
      },
      create: (o, cb) => { sent.push({ tabsCreate: o }); return done(cb, { id: 2, ...o }); },
      update: (id, o, cb) => { sent.push({ tabsUpdate: [id, o] }); return done(cb, { id, ...o }); },
      remove: (ids, cb) => { sent.push({ tabsRemove: ids }); return done(cb); },
      onCreated: ev([]), onRemoved: ev([]), onUpdated: ev([]),
      captureVisibleTab: () => Promise.reject(new Error("mock"))
    },
    action: { onClicked: ev([]), setBadgeText() {}, setBadgeBackgroundColor() {}, setIcon() {}, setTitle() {} },
    alarms: { create() {}, clear: () => Promise.resolve(true), onAlarm: ev([]) },
    scripting: { executeScript: () => Promise.resolve([{ result: null }]) }
  };
  // Surface async errors (e.g. in click handlers) as page errors.
  window.addEventListener("unhandledrejection", (e) => console.error("Unhandled rejection: " + (e.reason?.message || e.reason)));
  // Let tests poke content-script listeners directly.
  window.__mockDispatch = (msg) => deliver(L.content, msg, {});
})();
