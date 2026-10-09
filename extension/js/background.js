/**
 * Background Service Worker
 * Manages extension settings and statistics.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  threshold: 70,
  blurStrength: 20,
  blurMethod: 'gaussian',
  allowOverride: true,
  cacheSize: 512,
  uncertainThreshold: 45
};

async function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (items) => {
      resolve({
        ...DEFAULT_SETTINGS,
        ...items
      });
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getStoredSettings();
  chrome.storage.sync.set(existing);
  chrome.storage.local.set({
    statistics: {
      imagesScanned: 0,
      imagesBlurred: 0,
      totalProcessingTime: 0,
      avgProcessingTime: 0
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStats') {
    const stats = request.result || {};
    chrome.storage.local.get(['statistics'], (data) => {
      const current = data.statistics || {
        imagesScanned: 0,
        imagesBlurred: 0,
        totalProcessingTime: 0,
        avgProcessingTime: 0
      };

      current.imagesScanned = (Number(current.imagesScanned) || 0) + 1;
      if (stats.isNSFW) {
        current.imagesBlurred = (Number(current.imagesBlurred) || 0) + 1;
      }
      current.totalProcessingTime = (Number(current.totalProcessingTime) || 0) + Number(stats.latency || 0);
      current.avgProcessingTime = Math.round(current.totalProcessingTime / current.imagesScanned);
      chrome.storage.local.set({ statistics: current });
    });

    sendResponse({ ok: true });
    return true;
  }

  return false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'settingsChanged' }).catch(() => {});
        }
      });
    });
  }
});
