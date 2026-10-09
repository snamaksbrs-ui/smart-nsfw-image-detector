/**
 * Background Service Worker
 * Manages extension settings and statistics
 */

const defaultSettings = {
  enabled: true,
  threshold: 62,
  blurStrength: 20,
  blurMethod: 'gaussian',
  allowOverride: true,
  cacheSize: 512,
  uncertainThreshold: 45
};

const statistics = {
  imagesScanned: 0,
  imagesBlurred: 0,
  totalProcessingTime: 0,
  avgProcessingTime: 0
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(null, (items) => {
    if (Object.keys(items).length === 0) {
      chrome.storage.sync.set(defaultSettings);
    }
  });
  chrome.storage.local.set({ statistics });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStats') {
    updateStatistics(request.result);
    sendResponse({ status: 'stats updated' });
  }
});

// Update statistics
function updateStatistics(result) {
  chrome.storage.local.get(['statistics'], (data) => {
    const stats = data.statistics || statistics;
    stats.imagesScanned++;
    if (result.isNSFW) {
      stats.imagesBlurred++;
    }
    stats.totalProcessingTime += result.latency || 0;
    stats.avgProcessingTime = Math.round(stats.totalProcessingTime / stats.imagesScanned);
    chrome.storage.local.set({ statistics: stats });
  });
}

// Listen for changes in settings
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    // Notify all tabs to update their settings
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { action: 'settingsChanged' }).catch(() => {});
      });
    });
  }
});
