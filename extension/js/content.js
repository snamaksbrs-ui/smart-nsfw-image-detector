/**
 * Content Script - Main injection point for image monitoring
 * Runs in the page context and processes images
 */

(function() {
  'use strict';

  // Inject detector and blur scripts
  function injectScripts() {
    const detector = document.createElement('script');
    detector.src = chrome.runtime.getURL('js/detector.js');
    detector.onload = function() { this.remove(); };
    document.documentElement.appendChild(detector);

    const blur = document.createElement('script');
    blur.src = chrome.runtime.getURL('js/blur.js');
    blur.onload = function() { this.remove(); };
    document.documentElement.appendChild(blur);
  }

  // Initialize NSFW Guard
  function initNSFWGuard() {
    injectScripts();

    // Wait for scripts to load
    setTimeout(() => {
      window.nsfw_detector = new NSFWDetector();
      window.blur_controller = new BlurController();

      // Load settings from chrome storage
      chrome.storage.sync.get(['enabled', 'threshold', 'blurStrength', 'blurMethod', 'allowOverride'], (items) => {
        const settings = {
          threshold: items.threshold || 62,
          blurStrength: items.blurStrength || 20,
          blurMethod: items.blurMethod || 'gaussian',
          allowOverride: items.allowOverride !== false
        };

        if (items.enabled !== false) {
          window.nsfw_detector.updateSettings({ threshold: items.threshold / 100 });
          window.blur_controller.updateSettings({
            blurStrength: items.blurStrength,
            blurMethod: items.blurMethod,
            allowOverride: items.allowOverride
          });

          processAllImages();
          setupMutationObserver();
        }
      });
    }, 100);
  }

  // Process all existing images
  async function processAllImages() {
    const images = document.querySelectorAll('img');
    console.log(`[NSFW Guard] Found ${images.length} images to process`);

    for (const img of images) {
      if (img.src && img.src.trim()) {
        processImage(img);
      }
    }
  }

  // Process single image
  async function processImage(img) {
    if (img.dataset.nsfwGuardProcessed) return;
    img.dataset.nsfwGuardProcessed = 'true';

    try {
      const result = await window.nsfw_detector.detect(img);

      if (result.isNSFW) {
        window.blur_controller.apply(img, result);
        console.log(`[NSFW Guard] Blurred image:`, img.src, result);
      } else if (result.isUncertain && result.confidence > 0.5) {
        window.blur_controller.apply(img, result);
        console.log(`[NSFW Guard] Applied cautious blur:`, img.src, result);
      }

      // Send stats to background
      chrome.runtime.sendMessage({
        action: 'updateStats',
        result: result
      }).catch(() => {});
    } catch (error) {
      console.error('[NSFW Guard] Image processing failed:', error);
    }
  }

  // Setup mutation observer for dynamic images
  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'IMG') {
              setTimeout(() => processImage(node), 100);
            } else {
              const images = node.querySelectorAll('img');
              images.forEach(img => {
                setTimeout(() => processImage(img), 100);
              });
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'reprocess') {
      document.querySelectorAll('img[data-nsfw-guard-processed]').forEach(img => {
        delete img.dataset.nsfwGuardProcessed;
      });
      processAllImages();
      sendResponse({ status: 'reprocessing' });
    }
  });

  // Start on DOM ready or immediately if already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNSFWGuard);
  } else {
    initNSFWGuard();
  }
})();
