// Shared helpers for the service worker, popup and content script.
const WIKI = (() => {
  const ARTICLE_PREFIX = /^\/(wiki|zh-(?:tw|hant|hans|cn|hk|sg|mo|my))\//;
  const NAMESPACES = new Set(
    [
      "special", "file", "image", "media", "help", "wikipedia", "wp", "category", "portal", "template",
      "user", "draft", "module", "mediawiki", "timedtext", "book", "gadget", "topic", "project",
      "特殊", "文件", "檔案", "档案", "帮助", "說明", "说明", "幫助", "维基百科", "維基百科", "分类", "分類",
      "主题", "主題", "模板", "用户", "使用者", "用戶", "草稿", "模块", "模組", "讨论", "討論", "页面", "頁面"
    ].map((s) => s.toLowerCase())
  );

  function normalize(title) {
    let t = String(title || "").replace(/_/g, " ").trim();
    t = t.split("#")[0];
    return t ? t[0].toUpperCase() + t.slice(1) : "";
  }

  // Returns the normalised article title for a Wikipedia article URL, or null.
  function titleFromUrl(href, base) {
    let u;
    try { u = new URL(href, base); } catch (_) { return null; }
    if (!/\.wikipedia\.org$/.test(u.hostname)) return null;
    const m = u.pathname.match(ARTICLE_PREFIX);
    if (!m || u.search) return null;
    let raw;
    try { raw = decodeURIComponent(u.pathname.slice(m[0].length)); } catch (_) { return null; }
    if (!raw) return null;
    return normalize(raw);
  }

  function isArticle(title) {
    if (!title) return false;
    const i = title.indexOf(":");
    if (i === -1) return true;
    const ns = title.slice(0, i).trim().toLowerCase();
    if (NAMESPACES.has(ns) || / talk$/.test(ns) || ns.endsWith("讨论") || ns.endsWith("討論")) return false;
    return true;
  }

  const langOf = (host) => host.split(".")[0];
  const articleUrl = (lang, title) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  function fmtTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  return { normalize, titleFromUrl, isArticle, langOf, articleUrl, fmtTime };
})();
if (typeof self !== "undefined") self.WIKI = WIKI;
