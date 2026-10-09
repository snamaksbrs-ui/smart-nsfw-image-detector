/**
 * Popup Script - Settings and Statistics UI
 */

(function() {
  'use strict';

  // DOM elements
  const enableToggle = document.getElementById('enable-toggle');
  const sensitivitySlider = document.getElementById('sensitivity');
  const sensitivityValue = document.getElementById('sensitivity-value');
  const blurStrengthSlider = document.getElementById('blur-strength');
  const blurValue = document.getElementById('blur-value');
  const blurMethodSelect = document.getElementById('blur-method');
  const cacheSlider = document.getElementById('cache-size');
  const cacheValue = document.getElementById('cache-value');
  const allowOverrideToggle = document.getElementById('allow-override');
  const clearCacheBtn = document.getElementById('clear-cache');
  const resetStatsBtn = document.getElementById('reset-stats');
  const imagesScannedEl = document.getElementById('images-scanned');
  const imagesBlurredEl = document.getElementById('images-blurred');
  const processingTimeEl = document.getElementById('processing-time');

  const sensitivityLabels = {
    0: 'منخفض جدًا',
    25: 'منخفض',
    50: 'متوسط',
    75: 'عالي',
    100: 'عالي جدًا'
  };

  // Load settings on popup open
  loadSettings();
  loadStatistics();

  // Event listeners
  enableToggle.addEventListener('change', (e) => {
    saveSettings({ enabled: e.target.checked });
  });

  sensitivitySlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    updateSensitivityLabel(value);
    saveSettings({ threshold: value });
  });

  blurStrengthSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    blurValue.textContent = value;
    saveSettings({ blurStrength: value });
  });

  blurMethodSelect.addEventListener('change', (e) => {
    saveSettings({ blurMethod: e.target.value });
  });

  cacheSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    cacheValue.textContent = value;
    saveSettings({ cacheSize: value });
  });

  allowOverrideToggle.addEventListener('change', (e) => {
    saveSettings({ allowOverride: e.target.checked });
  });

  clearCacheBtn.addEventListener('click', () => {
    chrome.storage.local.set({ imageCache: [] });
    showNotification('تم مسح الذاكرة المؤقتة بنجاح');
  });

  resetStatsBtn.addEventListener('click', () => {
    chrome.storage.local.set({
      statistics: {
        imagesScanned: 0,
        imagesBlurred: 0,
        totalProcessingTime: 0,
        avgProcessingTime: 0
      }
    });
    loadStatistics();
    showNotification('تم إعادة تعيين الإحصائيات');
  });

  // Functions
  function loadSettings() {
    chrome.storage.sync.get(
      ['enabled', 'threshold', 'blurStrength', 'blurMethod', 'allowOverride', 'cacheSize'],
      (items) => {
        enableToggle.checked = items.enabled !== false;
        const threshold = items.threshold || 62;
        sensitivitySlider.value = threshold;
        updateSensitivityLabel(threshold);
        blurStrengthSlider.value = items.blurStrength || 20;
        blurValue.textContent = items.blurStrength || 20;
        blurMethodSelect.value = items.blurMethod || 'gaussian';
        allowOverrideToggle.checked = items.allowOverride !== false;
        cacheSlider.value = items.cacheSize || 512;
        cacheValue.textContent = items.cacheSize || 512;
      }
    );
  }

  function saveSettings(settings) {
    chrome.storage.sync.set(settings);
  }

  function loadStatistics() {
    chrome.storage.local.get(['statistics'], (data) => {
      const stats = data.statistics || {};
      imagesScannedEl.textContent = stats.imagesScanned || 0;
      imagesBlurredEl.textContent = stats.imagesBlurred || 0;
      processingTimeEl.textContent = (stats.avgProcessingTime || 0) + 'ms';
    });
  }

  function updateSensitivityLabel(value) {
    let label = 'متوسط';
    if (value <= 25) label = sensitivityLabels[0];
    else if (value <= 50) label = sensitivityLabels[25];
    else if (value <= 75) label = sensitivityLabels[75];
    else label = sensitivityLabels[100];
    sensitivityValue.textContent = label;
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #10b981;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  // Refresh statistics every 5 seconds
  setInterval(loadStatistics, 5000);
})();
