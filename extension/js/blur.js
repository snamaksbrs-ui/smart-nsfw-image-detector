/**
 * NSFW Blur Controller - Apply visual blur/overlay to unsafe images
 */

class BlurController {
  constructor(settings = {}) {
    this.settings = {
      blurStrength: 20,
      blurMethod: 'gaussian',
      overlayColor: 'rgba(20, 20, 20, 0.95)',
      allowOverride: true,
      ...settings
    };

    this.blurredElements = new WeakMap();
  }

  /**
   * Apply blur to image element
   */
  apply(imageElement, result) {
    if (!imageElement) return false;

    try {
      const overlay = this.createOverlay(imageElement, result);
      const parent = imageElement.parentElement;

      if (!parent) {
        imageElement.style.display = 'none';
        return false;
      }

      // Store original position if needed
      if (window.getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }

      // Apply blur based on method
      if (this.settings.blurMethod === 'gaussian') {
        imageElement.style.filter = `blur(${this.settings.blurStrength}px)`;
        imageElement.style.opacity = '0.7';
      } else if (this.settings.blurMethod === 'pixelate') {
        imageElement.style.filter = `blur(${Math.ceil(this.settings.blurStrength / 2)}px) brightness(0.6)`;
        imageElement.style.imageRendering = 'pixelated';
      }

      imageElement.classList.add('nsfw-guard-blurred');
      parent.appendChild(overlay);
      this.blurredElements.set(imageElement, { overlay, result });

      // Handle click to reveal
      if (this.settings.allowOverride) {
        overlay.addEventListener('click', () => this.reveal(imageElement));
      }

      return true;
    } catch (error) {
      console.error('[NSFW Guard] Blur application failed:', error);
      return false;
    }
  }

  /**
   * Create overlay element
   * @private
   */
  createOverlay(imageElement, result) {
    const overlay = document.createElement('div');
    overlay.className = 'nsfw-guard-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = imageElement.offsetTop + 'px';
    overlay.style.left = imageElement.offsetLeft + 'px';
    overlay.style.width = imageElement.offsetWidth + 'px';
    overlay.style.height = imageElement.offsetHeight + 'px';

    const message = document.createElement('div');
    message.className = 'nsfw-guard-message';
    message.innerHTML = `
      <div class="nsfw-guard-icon">🔒</div>
      <h3>محتوى مسيء</h3>
      <p>تم كشف صورة قد تحتوي على محتوى غير مناسب</p>
      <div class="nsfw-guard-confidence">الثقة: ${(result.confidence * 100).toFixed(1)}%</div>
      ${this.settings.allowOverride ? '<button class="nsfw-guard-btn">اضغط للكشف</button>' : ''}
    `;

    overlay.appendChild(message);

    // Update position on window resize
    const updatePosition = () => {
      overlay.style.top = imageElement.offsetTop + 'px';
      overlay.style.left = imageElement.offsetLeft + 'px';
      overlay.style.width = imageElement.offsetWidth + 'px';
      overlay.style.height = imageElement.offsetHeight + 'px';
    };

    window.addEventListener('resize', updatePosition);
    const observer = new MutationObserver(updatePosition);
    observer.observe(imageElement.parentElement, { attributes: true });

    return overlay;
  }

  /**
   * Reveal blurred image
   */
  reveal(imageElement) {
    try {
      const data = this.blurredElements.get(imageElement);
      if (!data) return;

      const overlay = data.overlay;
      overlay.classList.add('revealed');
      imageElement.style.filter = 'none';
      imageElement.style.opacity = '1';

      setTimeout(() => {
        overlay.remove();
      }, 300);
    } catch (error) {
      console.error('[NSFW Guard] Reveal failed:', error);
    }
  }

  /**
   * Remove blur from image
   */
  remove(imageElement) {
    try {
      const data = this.blurredElements.get(imageElement);
      if (!data) return;

      const overlay = data.overlay;
      imageElement.style.filter = 'none';
      imageElement.style.opacity = '1';
      imageElement.classList.remove('nsfw-guard-blurred');
      overlay.remove();
    } catch (error) {
      console.error('[NSFW Guard] Remove blur failed:', error);
    }
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlurController;
}
