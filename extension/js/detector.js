/**
 * NSFW Image Detector - Local Processing Engine
 * Runs detection on images without sending them to external servers
 */

class NSFWDetector {
  constructor(settings = {}) {
    this.settings = {
      threshold: 0.62,
      uncertainThreshold: 0.45,
      cacheSize: 512,
      maxImageSize: 1600,
      debugMode: false,
      ...settings
    };

    this.cache = new Map();
    this.stats = {
      scanned: 0,
      unsafe: 0,
      avgLatency: 0,
      totalLatency: 0
    };
  }

  /**
   * Detect if image is NSFW
   * @param {HTMLImageElement|string} imageSource - Image element or URL
   * @returns {Promise<DetectionResult>}
   */
  async detect(imageSource) {
    try {
      const imageKey = this.getImageKey(imageSource);
      const cached = this.cache.get(imageKey);
      if (cached) return cached;

      const startTime = performance.now();
      const imageData = await this.normalizeImage(imageSource);
      const result = await this.analyzeImage(imageData);
      result.latency = performance.now() - startTime;

      this.updateStats(result);
      this.cacheResult(imageKey, result);

      return result;
    } catch (error) {
      console.error('[NSFW Guard] Detection error:', error);
      return this.getDefaultResult('error', 0.5, `Detection failed: ${error.message}`);
    }
  }

  /**
   * Get unique key for image
   * @private
   */
  getImageKey(source) {
    if (typeof source === 'string') {
      return source;
    }
    if (source instanceof HTMLImageElement) {
      return source.src || source.currentSrc || Math.random().toString();
    }
    if (source instanceof HTMLCanvasElement) {
      return source.toDataURL('image/jpeg', 0.7);
    }
    return Math.random().toString();
  }

  /**
   * Normalize image to canvas
   * @private
   */
  async normalizeImage(source) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      const loadImage = (image) => {
        // Resize if needed
        let width = image.naturalWidth || image.width;
        let height = image.naturalHeight || image.height;

        if (Math.max(width, height) > this.settings.maxImageSize) {
          const ratio = this.settings.maxImageSize / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        try {
          ctx.drawImage(image, 0, 0, width, height);
          resolve(ctx.getImageData(0, 0, width, height));
        } catch (error) {
          reject(new Error(`Failed to draw image: ${error.message}`));
        }
      };

      if (typeof source === 'string') {
        // URL
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => loadImage(img);
        img.onerror = () => reject(new Error(`Failed to load image from URL: ${source}`));
        img.src = source;
      } else if (source instanceof HTMLImageElement) {
        loadImage(source);
      } else {
        reject(new Error('Unsupported image source'));
      }
    });
  }

  /**
   * Analyze image using heuristics
   * @private
   */
  async analyzeImage(imageData) {
    const data = imageData.data;
    let rSum = 0, gSum = 0, bSum = 0;
    let saturation = 0, brightness = 0;
    let pixelCount = 0;

    // Process image data
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      rSum += r;
      gSum += g;
      bSum += b;
      pixelCount++;

      // Calculate per-pixel saturation
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const lightness = (max + min) / 2;

      if (lightness > 0) {
        saturation += delta / lightness;
      }

      brightness += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }

    const avgR = rSum / pixelCount / 255;
    const avgG = gSum / pixelCount / 255;
    const avgB = bSum / pixelCount / 255;
    const avgSaturation = saturation / pixelCount;
    const avgBrightness = brightness / pixelCount;

    // Heuristic scoring
    // High red channel + low green/blue = likely skin tone
    const skinToneLikelihood = Math.max(0, (avgR - Math.max(avgG, avgB)) * 2);
    // High saturation = potentially adult content
    const saturationScore = Math.min(1, avgSaturation * 0.8);
    // Specific color ranges
    const redBiasBias = Math.max(0, avgR - 0.5);

    let confidence = (skinToneLikelihood * 0.5 + saturationScore * 0.3 + redBiasBias * 0.2);
    confidence = Math.min(1, Math.max(0, confidence));

    const isNSFW = confidence >= this.settings.threshold;
    const isUncertain = confidence >= this.settings.uncertainThreshold && confidence < this.settings.threshold;

    return {
      isNSFW,
      isUncertain,
      confidence: Math.round(confidence * 100) / 100,
      label: isNSFW ? 'unsafe' : (isUncertain ? 'uncertain' : 'safe'),
      model: 'heuristic-local',
      details: {
        skinTone: Math.round(skinToneLikelihood * 100) / 100,
        saturation: Math.round(avgSaturation * 100) / 100,
        redBias: Math.round(redBiasBias * 100) / 100,
        brightness: Math.round(avgBrightness * 100) / 100
      }
    };
  }

  /**
   * Update statistics
   * @private
   */
  updateStats(result) {
    this.stats.scanned++;
    if (result.isNSFW) this.stats.unsafe++;
    this.stats.totalLatency += result.latency;
    this.stats.avgLatency = Math.round(this.stats.totalLatency / this.stats.scanned);
  }

  /**
   * Cache result with LRU eviction
   * @private
   */
  cacheResult(key, result) {
    if (this.cache.size >= this.settings.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, result);
  }

  /**
   * Get default result
   * @private
   */
  getDefaultResult(label, confidence, notes = '') {
    return {
      isNSFW: label === 'unsafe',
      isUncertain: label === 'uncertain',
      confidence,
      label,
      model: 'default',
      notes,
      latency: 0,
      details: {}
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
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
  module.exports = NSFWDetector;
}
