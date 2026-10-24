chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["vendor/matter.min.js", "physics.js"]
    });
  } catch (e) {
    // chrome:// pages, the Web Store and PDFs can't be scripted.
    chrome.action.setBadgeBackgroundColor({ color: "#d33", tabId: tab.id });
    chrome.action.setBadgeText({ text: "×", tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 1500);
  }
});
