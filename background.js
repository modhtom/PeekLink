import { Readability } from "./Readability.js";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchForReader") {
    fetch(request.url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const base = doc.createElement("base");
        base.href = request.url;
        doc.head.append(base);

        const reader = new Readability(doc);
        const article = reader.parse();

        if (article) {
          sendResponse({ success: true, article: article });
        } else {
          sendResponse({
            success: false,
            error: "Could not extract a readable article.",
          });
        }
      })
      .catch((error) =>
        sendResponse({ success: false, error: error.toString() }),
      );
    return true; // Keep the message channel open for the async response
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "searchSelection",
    title: "Search for '%s'",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "translateSelection",
    title: "Translate '%s'",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "searchSelection" && info.selectionText) {
    const searchQuery = encodeURIComponent(info.selectionText);
    chrome.tabs.create({
      url: `https://www.google.com/search?q=${searchQuery}`,
    });
  }
  if (info.menuItemId === "translateSelection" && info.selectionText) {
    const textToTranslate = encodeURIComponent(info.selectionText);
    chrome.tabs.create({
      url: `https://translate.google.com/?sl=auto&tl=en&text=${textToTranslate}&op=translate`,
    });
  }
});
