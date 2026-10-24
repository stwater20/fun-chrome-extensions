const $ = (id) => document.getElementById(id);

// Daily challenge pools: well-known articles, so everyone races the same pair each day.
const POOLS = {
  en: ["Bubble tea", "Black hole", "Taiwan", "Pizza", "Leonardo da Vinci", "Penguin", "Moon landing", "Jazz", "Volcano",
    "Chess", "Ancient Egypt", "Tokyo", "Coffee", "Dinosaur", "Internet", "Shakespeare", "Mount Everest", "Cat", "Olympic Games",
    "Bitcoin", "Great Wall of China", "Albert Einstein", "Banana", "Titanic", "Samurai", "Electricity", "Rainbow", "Vikings",
    "Football", "Honey", "Octopus", "Mars", "Origami", "Pirate", "Chocolate", "Napoleon", "Tea", "Robot", "Sushi", "Ninja"],
  zh: ["珍珠奶茶", "黑洞", "臺灣", "披薩", "達文西", "企鵝", "阿波羅11號", "爵士樂", "火山", "國際象棋", "古埃及", "東京",
    "咖啡", "恐龍", "網際網路", "莎士比亞", "珠穆朗瑪峰", "貓", "奧林匹克運動會", "比特幣", "長城", "愛因斯坦", "香蕉",
    "鐵達尼號", "武士", "電", "彩虹", "維京人", "足球", "蜂蜜", "章魚", "火星", "摺紙", "海盜", "巧克力", "拿破崙", "茶", "機器人", "壽司", "忍者"]
};

function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

async function random(lang) {
  const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/random/summary`);
  if (!r.ok) throw new Error("Couldn't reach Wikipedia.");
  const j = await r.json();
  return j.titles?.normalized || j.title;
}

async function start(startTitle, target) {
  $("err").textContent = "";
  const lang = $("lang").value;
  if (!startTitle || !target) return ($("err").textContent = "Pick a start and a target.");
  $("go").disabled = true;
  $("go").textContent = "Checking articles…";
  const res = await chrome.runtime.sendMessage({ type: "start", lang, start: startTitle, target });
  $("go").disabled = false;
  $("go").textContent = "Start race";
  if (res?.error) $("err").textContent = res.error;
  else window.close();
}

$("lang").onchange = () => chrome.storage.local.set({ lang: $("lang").value });
for (const [btn, input] of [["r1", "start"], ["r2", "target"]]) {
  $(btn).onclick = async () => {
    $(input).value = "…";
    try { $(input).value = await random($("lang").value); }
    catch (e) { $(input).value = ""; $("err").textContent = e.message; }
  };
}
$("go").onclick = () => start($("start").value.trim(), $("target").value.trim());
for (const id of ["start", "target"]) $(id).addEventListener("keydown", (e) => e.key === "Enter" && $("go").click());
$("daily").onclick = () => {
  const lang = $("lang").value;
  const pool = POOLS[lang] || POOLS.en;
  const day = new Date().toLocaleDateString("en-CA");
  const rnd = seeded(day + lang);
  const a = Math.floor(rnd() * pool.length);
  let b = Math.floor(rnd() * (pool.length - 1));
  if (b >= a) b++;
  const usedLang = POOLS[lang] ? lang : "en";
  $("lang").value = usedLang;
  $("start").value = pool[a];
  $("target").value = pool[b];
  start(pool[a], pool[b]);
};

(async () => {
  const { lang = (navigator.language.startsWith("zh") ? "zh" : "en"), history = [] } = await chrome.storage.local.get(["lang", "history"]);
  $("lang").value = lang;

  const live = await chrome.runtime.sendMessage({ type: "status" });
  const entries = Object.entries(live || {}).filter(([, g]) => !g.finishedAt);
  if (entries.length) {
    $("liveBox").hidden = false;
    for (const [tabId, g] of entries) {
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.innerHTML = `<div class="t"></div><div class="m"></div>`;
      li.querySelector(".t").textContent = `${g.start} → ${g.target}`;
      li.querySelector(".m").textContent = g.startedAt
        ? `${g.clicks} clicks · ${WIKI.fmtTime(Date.now() - g.startedAt)} · click to jump back`
        : "starting…";
      li.onclick = () => chrome.tabs.update(+tabId, { active: true }).then(() => window.close());
      $("live").appendChild(li);
    }
  }

  if (!history.length) $("hist").innerHTML = '<li class="m">No finishes yet. Your first race awaits.</li>';
  for (const h of history.slice(0, 8)) {
    const li = document.createElement("li");
    li.innerHTML = `<div class="t"></div><div class="m"></div>`;
    li.querySelector(".t").textContent = `${h.start} → ${h.target}`;
    li.querySelector(".m").textContent =
      `${h.clicks} clicks · ${WIKI.fmtTime(h.ms)} · ${h.lang}${h.offRoute ? " · ⚠️ off-route" : ""}`;
    li.title = h.path.join(" → ");
    $("hist").appendChild(li);
  }
})();
