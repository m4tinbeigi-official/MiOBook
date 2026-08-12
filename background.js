// Service Worker for MioBook Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
  console.log("MioBook Extension Installed successfully.");
  
  // Set panel behavior to open sidepanel on clicking the extension icon
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("Error setting panel behavior:", error));
  }
});

// Set up Context Menu for Highlighting (Phase 2 feature, but safe to prepare now)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "miobook-highlight",
    title: "هایلایت کردن در میو بوک",
    contexts: ["selection"]
  });
});

// Listen for Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "miobook-highlight" && tab.id) {
    // Send a message to content script of the active tab to highlight the selected text
    chrome.tabs.sendMessage(tab.id, { action: "trigger-highlight" })
      .catch((err) => console.log("Content script not active or loaded yet:", err));
  }
});

// Listen for messages from content script or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "open-dashboard") {
    chrome.runtime.openOptionsPage()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keeps sendResponse channel open for async response
  }
});
