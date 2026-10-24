const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));
let tabCount = 0;

function toast(text) {
  $("toast").textContent = text;
  $("toast").style.opacity = 1;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ($("toast").style.opacity = 0), 1800);
}

// Animated pet
const ctx = $("pet").getContext("2d");
function frame(ms) {
  ctx.save();
  ctx.clearRect(0, 0, 220, 190);
  ctx.translate(15, 0);
  PET.draw(ctx, 190, tabCount, ms / 1000, { animate: true });
  ctx.restore();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

async function render() {
  tabCount = (await chrome.tabs.query({})).length;
  const { state: s = {} } = await chrome.storage.local.get("state");
  $("tabs").textContent = tabCount;
  $("line").textContent = PET.mood(tabCount).line;
  if (document.activeElement !== $("name")) $("name").value = s.name || "Tabby";
  const days = s.bornAt ? Math.floor((Date.now() - s.bornAt) / 864e5) : 0;
  $("age").textContent = days ? `${days} day${days > 1 ? "s" : ""} old · ${s.lifetimeOpened || 0} tabs eaten in life` : "just hatched";
  const isToday = s.day === new Date().toLocaleDateString("en-CA");
  $("opened").textContent = isToday ? s.opened || 0 : 0;
  $("closed").textContent = isToday ? s.closed || 0 : 0;
  $("eaten").textContent = isToday ? s.eaten || 0 : 0;

  const snack = s.snack || { enabled: false, threshold: 25, intervalMin: 30 };
  $("snackOn").checked = snack.enabled;
  if (document.activeElement !== $("threshold")) $("threshold").value = snack.threshold;
  if (document.activeElement !== $("interval")) $("interval").value = snack.intervalMin;

  const list = s.eatenTabs || [];
  $("eatenCount").textContent = list.length;
  $("eatenList").replaceChildren(
    ...list.map((t, i) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = t.title;
      span.title = t.url;
      const b = document.createElement("button");
      b.textContent = "Spit out";
      b.onclick = async () => {
        await send({ type: "spit", index: i });
        toast("Bleh! Tab restored.");
        render();
      };
      li.append(span, b);
      return li;
    })
  );
  if (!list.length) $("eatenList").innerHTML = '<li class="muted">Empty. Nothing eaten yet.</li>';
}

$("name").addEventListener("change", () => send({ type: "set-name", name: $("name").value.trim() }));
$("snackOn").onchange = () => send({ type: "set-snack", snack: { enabled: $("snackOn").checked } });
$("threshold").onchange = () => send({ type: "set-snack", snack: { threshold: Math.max(3, +$("threshold").value || 25) } });
$("interval").onchange = () => send({ type: "set-snack", snack: { intervalMin: Math.max(1, +$("interval").value || 30) } });
$("feed").onclick = async () => {
  const { title } = await send({ type: "feed-now" });
  toast(title ? `Nom! Ate “${title.slice(0, 30)}”` : "Nothing it's allowed to eat.");
  render();
};
$("dedupe").onclick = async () => {
  const { closed } = await send({ type: "dedupe" });
  toast(closed ? `Burned off ${closed} duplicate tab${closed > 1 ? "s" : ""}!` : "No duplicates. Fit already!");
  render();
};

chrome.storage.onChanged.addListener(render);
chrome.tabs.onCreated.addListener(render);
chrome.tabs.onRemoved.addListener(render);
render();
