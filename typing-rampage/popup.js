const DEFAULTS = {
  enabled: true, particles: true, shake: true, sound: false,
  intensity: 2, theme: "rainbow", blockedHosts: []
};
const $ = (id) => document.getElementById(id);

chrome.storage.local.get({ best: 0, total: 0 }, (s) => {
  $("best").textContent = s.best.toLocaleString();
  $("total").textContent = s.total.toLocaleString();
});

chrome.storage.sync.get(DEFAULTS, (s) => {
  for (const k of ["enabled", "particles", "shake", "sound"]) {
    $(k).checked = s[k];
    $(k).onchange = () => chrome.storage.sync.set({ [k]: $(k).checked });
  }
  $("intensity").value = s.intensity;
  $("intensity").oninput = () => chrome.storage.sync.set({ intensity: +$("intensity").value });
  $("theme").value = s.theme;
  $("theme").onchange = () => chrome.storage.sync.set({ theme: $("theme").value });

  // Per-site switch: ask the page which host it is (no "tabs" permission needed).
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: "host?" }, (res) => {
      if (chrome.runtime.lastError || !res || !res.host) return;
      const host = res.host;
      const btn = $("site");
      const render = (list) => {
        const blocked = list.includes(host);
        btn.textContent = blocked ? `Turn back on for ${host}` : `Turn off for ${host}`;
      };
      let list = s.blockedHosts || [];
      render(list);
      btn.hidden = false;
      btn.onclick = () => {
        list = list.includes(host) ? list.filter((h) => h !== host) : [...list, host];
        chrome.storage.sync.set({ blockedHosts: list });
        render(list);
      };
    });
  });
});
