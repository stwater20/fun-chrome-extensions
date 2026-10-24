const $ = (s) => document.querySelector(s);
let tab;

async function apply(theme) {
  $("#msg").textContent = "";
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (t) => (window.__tmTheme = t), args: [theme] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["filters.js"] });
    mark(theme);
  } catch (e) {
    $("#msg").textContent = "This page can't time travel (browser pages and the Web Store are off-limits).";
  }
}
function mark(theme) {
  document.querySelectorAll(".card").forEach((c) => c.classList.toggle("on", c.dataset.theme === theme));
}

document.querySelectorAll(".card").forEach((c) => (c.onclick = () => apply(c.dataset.theme)));
$("#off").onclick = () => apply("off");
$("#snap").onclick = async () => {
  try {
    const url = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-machine-${Date.now()}.png`;
    a.click();
  } catch (e) {
    $("#msg").textContent = "Couldn't take a snapshot of this page.";
  }
};

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__tm?.current || null });
    mark(result);
  } catch (_) {}
})();
