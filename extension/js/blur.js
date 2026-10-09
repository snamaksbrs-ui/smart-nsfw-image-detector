class BlurController {
  constructor(settings = {}) {
    this.settings = {
      blurStrength: 20,
      blurMethod: 'gaussian',
      allowOverride: true,
      ...settings
    };

    this.state = new WeakMap();
  }

  apply(imageElement, result) {
    if (!imageElement || !result || !result.isNSFW) {
      return false;
    }

    const existing = this.state.get(imageElement);
    if (existing && existing.overlay && existing.overlay.isConnected) {
      existing.overlay.remove();
    }

    const parent = imageElement.parentElement;
    if (!parent) {
      return false;
    }

    if (window.getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    imageElement.classList.add('nsfw-guard-blurred');
    imageElement.style.filter = this._filterValue();
    imageElement.style.opacity = '0.7';

    const overlay = document.createElement('div');
    overlay.className = 'nsfw-guard-overlay';
    overlay.dataset.nsfwGuardOverlay = 'true';

    const message = document.createElement('div');
    message.className = 'nsfw-guard-message';
    message.innerHTML = `
      <div class="nsfw-guard-icon">🔒</div>
      <h3>محتوى غير مناسب</h3>
      <p>تم اكتشاف صورة قد تحتوي على محتوى غير لائق.</p>
      <div class="nsfw-guard-confidence">الثقة: ${(Number(result.confidence || 0) * 100).toFixed(1)}%</div>
      ${this.settings.allowOverride ? '<button class="nsfw-guard-btn">إظهار الصورة</button>' : ''}
    `;

    overlay.appendChild(message);
    parent.appendChild(overlay);

    if (this.settings.allowOverride) {
      const revealButton = overlay.querySelector('.nsfw-guard-btn');
      if (revealButton) {
        revealButton.addEventListener('click', () => this.reveal(imageElement));
      }
    }

    const updatePosition = () => {
      const rect = imageElement.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      overlay.style.position = 'absolute';
      overlay.style.top = `${rect.top - parentRect.top}px`;
      overlay.style.left = `${rect.left - parentRect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    };

    updatePosition();
    this.state.set(imageElement, { overlay, updatePosition });

    const resizeHandler = () => updatePosition();
    window.addEventListener('resize', resizeHandler, { passive: true });
    const observer = new MutationObserver(() => updatePosition());
    observer.observe(parent, { attributes: true, childList: true, subtree: true });

    const data = this.state.get(imageElement);
    data.resizeHandler = resizeHandler;
    data.observer = observer;

    return true;
  }

  reveal(imageElement) {
    const existing = this.state.get(imageElement);
    if (!existing) {
      return;
    }

    imageElement.style.filter = 'none';
    imageElement.style.opacity = '1';
    imageElement.classList.remove('nsfw-guard-blurred');

    if (existing.overlay) {
      existing.overlay.classList.add('revealed');
      setTimeout(() => {
        existing.overlay.remove();
      }, 200);
    }

    if (existing.resizeHandler) {
      window.removeEventListener('resize', existing.resizeHandler);
    }
    if (existing.observer) {
      existing.observer.disconnect();
    }

    this.state.delete(imageElement);
  }

  remove(imageElement) {
    const existing = this.state.get(imageElement);
    if (!existing) {
      return;
    }

    imageElement.style.filter = 'none';
    imageElement.style.opacity = '1';
    imageElement.classList.remove('nsfw-guard-blurred');

    if (existing.overlay) {
      existing.overlay.remove();
    }

    if (existing.resizeHandler) {
      window.removeEventListener('resize', existing.resizeHandler);
    }
    if (existing.observer) {
      existing.observer.disconnect();
    }

    this.state.delete(imageElement);
  }

  _filterValue() {
    if (this.settings.blurMethod === 'pixelate') {
      return `blur(${Math.max(2, Math.round(this.settings.blurStrength / 2))}px) brightness(0.75)`;
    }
    if (this.settings.blurMethod === 'overlay') {
      return `brightness(0.7) saturate(0.5)`;
    }
    return `blur(${this.settings.blurStrength}px)`;
  }

  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlurController;
}
