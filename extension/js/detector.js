class NSFWDetector {
  constructor(settings = {}) {
    this.settings = {
      threshold: 0.7,
      uncertainThreshold: 0.45,
      cacheSize: 512,
      maxImageSize: 1600,
      enabled: true,
      debugMode: false,
      ...settings
    };

    this.cache = new Map();
    this.stats = {
      scanned: 0,
      unsafe: 0,
      latencyTotal: 0,
      avgLatency: 0
    };
  }

  async detect(imageElement) {
    if (!this.settings.enabled) {
      return this._result({
        isNSFW: false,
        isUncertain: false,
        confidence: 0,
        label: 'safe',
        model: 'disabled',
        notes: 'Detection disabled by user settings.'
      }, 0);
    }

    const source = (imageElement && (imageElement.currentSrc || imageElement.src)) || '';
    if (!source) {
      return this._result({
        isNSFW: false,
        isUncertain: false,
        confidence: 0,
        label: 'safe',
        model: 'local',
        notes: 'Image source missing or inaccessible.'
      }, 0);
    }

    if (this.cache.has(source)) {
      return this.cache.get(source);
    }

    const start = performance.now();

    try {
      const model = await window.__nsfwGuardModelLoader.ensureModel();
      const tensor = await this._toTensor(imageElement);
      const predictions = await model.classify(tensor);
      const result = this._buildResult(predictions);
      result.latency = performance.now() - start;
      this._updateStats(result);
      this.cache.set(source, result);
      return result;
    } catch (error) {
      const fallback = this._result({
        isNSFW: false,
        isUncertain: true,
        confidence: 0.4,
        label: 'uncertain',
        model: 'nsfwjs-local',
        notes: `Model classification failed: ${error.message}`
      }, performance.now() - start);
      this.cache.set(source, fallback);
      return fallback;
    }
  }

  _buildResult(predictions) {
    const unsafeClasses = new Set(['Porn', 'Hentai', 'Sexy', 'Explicit']);
    const adultScore = predictions
      .filter((entry) => unsafeClasses.has(entry.className))
      .reduce((sum, entry) => sum + Number(entry.probability || 0), 0);

    const moderateScore = predictions
      .filter((entry) => entry.className === 'Neutral' || entry.className === 'Drawing')
      .reduce((sum, entry) => sum + Number(entry.probability || 0), 0);

    const confidence = Math.min(1, Math.max(0, adultScore / Math.max(1, adultScore + moderateScore)));

    let isNSFW = false;
    let isUncertain = false;

    if (confidence >= this.settings.threshold) {
      isNSFW = true;
    } else if (confidence >= this.settings.uncertainThreshold) {
      isUncertain = true;
    }

    const label = isNSFW ? 'unsafe' : isUncertain ? 'uncertain' : 'safe';

    return this._result({
      isNSFW,
      isUncertain,
      confidence,
      label,
      model: 'nsfwjs-local',
      notes: 'Based on browser-local NSFWJS classifier.',
      details: { predictions, riskyScore: confidence }
    }, 0);
  }

  _toTensor(imageElement) {
    return new Promise((resolve, reject) => {
      const element = imageElement;
      if (!(element instanceof HTMLImageElement)) {
        reject(new Error('Only HTMLImageElement inputs are supported.'));
        return;
      }

      if (!element.complete || !element.naturalWidth) {
        reject(new Error('Image is not fully loaded yet.'));
        return;
      }

      try {
        const canvas = document.createElement('canvas');
        const maxDimension = this.settings.maxImageSize;
        const ratio = Math.min(1, maxDimension / Math.max(element.naturalWidth, element.naturalHeight));
        const width = Math.max(1, Math.round(element.naturalWidth * ratio));
        const height = Math.max(1, Math.round(element.naturalHeight * ratio));

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context is unavailable.'));
          return;
        }

        ctx.drawImage(element, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const tensor = window.tf.browser.fromPixels(imageData, 3);
        resolve(tensor);
      } catch (error) {
        reject(error);
      }
    });
  }

  _result(payload, latency) {
    return {
      ...payload,
      latency,
      confidence: Number(payload.confidence || 0),
      model: payload.model || 'local',
      notes: payload.notes || ''
    };
  }

  _updateStats(result) {
    this.stats.scanned += 1;
    if (result.isNSFW) {
      this.stats.unsafe += 1;
    }
    this.stats.latencyTotal += result.latency || 0;
    this.stats.avgLatency = Math.round(this.stats.latencyTotal / this.stats.scanned);
  }

  clearCache() {
    this.cache.clear();
  }

  getStats() {
    return { ...this.stats };
  }

  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NSFWDetector;
}
