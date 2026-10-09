(function () {
  'use strict';

  const detector = new NSFWDetector();
  const blurController = new BlurController();
  const processedSources = new WeakMap();
  const processingQueue = new Set();

  function getCurrentSource(imageElement) {
    return imageElement && (imageElement.currentSrc || imageElement.src || imageElement.dataset.src || '');
  }

  function getStoredSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([
        'enabled',
        'threshold',
        'blurStrength',
        'blurMethod',
        'allowOverride',
        'cacheSize'
      ], (items) => {
        resolve({
          enabled: items.enabled !== false,
          threshold: Number(items.threshold || 70) / 100,
          blurStrength: Number(items.blurStrength || 20),
          blurMethod: items.blurMethod || 'gaussian',
          allowOverride: items.allowOverride !== false,
          cacheSize: Number(items.cacheSize || 512)
        });
      });
    });
  }

  async function applySettings() {
    const settings = await getStoredSettings();
    detector.updateSettings({
      enabled: settings.enabled,
      threshold: settings.threshold,
      cacheSize: settings.cacheSize
    });

    blurController.updateSettings({
      blurStrength: settings.blurStrength,
      blurMethod: settings.blurMethod,
      allowOverride: settings.allowOverride
    });

    if (!settings.enabled) {
      document.querySelectorAll('img').forEach((img) => {
        blurController.remove(img);
      });
    }
  }

  async function processImage(imageElement) {
    if (!(imageElement instanceof HTMLImageElement)) {
      return;
    }

    if (!imageElement.isConnected || !imageElement.src) {
      return;
    }

    const source = getCurrentSource(imageElement);
    if (!source) {
      return;
    }

    if (processingQueue.has(imageElement)) {
      return;
    }

    const previous = processedSources.get(imageElement);
    if (previous === source && imageElement.dataset.nsfwGuardProcessed === 'true') {
      return;
    }

    processingQueue.add(imageElement);
    try {
      const result = await detector.detect(imageElement);
      const wasBlurred = imageElement.dataset.nsfwGuardBlurred === 'true';

      if (result.isNSFW) {
        blurController.apply(imageElement, result);
        imageElement.dataset.nsfwGuardBlurred = 'true';
      } else {
        if (wasBlurred) {
          blurController.remove(imageElement);
        }
        imageElement.dataset.nsfwGuardBlurred = 'false';
      }

      imageElement.dataset.nsfwGuardProcessed = 'true';
      processedSources.set(imageElement, source);

      chrome.runtime.sendMessage({
        action: 'updateStats',
        result
      }).catch(() => {});
    } catch (error) {
      console.error('[NSFW Guard] Image processing failed:', error);
    } finally {
      processingQueue.delete(imageElement);
    }
  }

  function scanAllImages() {
    document.querySelectorAll('img').forEach((img) => {
      if (img.offsetParent !== null || img.getBoundingClientRect().width > 0) {
        processImage(img);
      }
    });
  }

  function observeDom() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) {
            return;
          }

          if (node.tagName === 'IMG') {
            processImage(node);
          }

          node.querySelectorAll?.('img').forEach((img) => {
            processImage(img);
          });
        });

        if (mutation.type === 'attributes' && mutation.target instanceof HTMLImageElement) {
          processImage(mutation.target);
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset']
    });

    return observer;
  }

  function observeViewport() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          processImage(entry.target);
        }
      });
    }, {
      rootMargin: '200px'
    });

    document.querySelectorAll('img').forEach((img) => observer.observe(img));
    return observer;
  }

  function handleSettingsChange() {
    applySettings().then(() => {
      scanAllImages();
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsChanged') {
      handleSettingsChange();
      sendResponse({ ok: true });
    }
    if (message.action === 'reprocess') {
      processedSources.clear();
      scanAllImages();
      sendResponse({ ok: true });
    }
  });

  window.addEventListener('load', () => {
    applySettings().then(() => {
      scanAllImages();
      observeDom();
      observeViewport();
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applySettings().then(() => {
        scanAllImages();
        observeDom();
        observeViewport();
      });
    });
  } else {
    applySettings().then(() => {
      scanAllImages();
      observeDom();
      observeViewport();
    });
  }
})();
