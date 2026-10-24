chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["dungeon.js"] });
  } catch (e) {
    chrome.action.setBadgeBackgroundColor({ color: "#d33", tabId: tab.id });
    chrome.action.setBadgeText({ text: "×", tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 1500);
  }
});
