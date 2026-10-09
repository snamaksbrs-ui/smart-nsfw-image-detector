(function () {
  'use strict';

  const state = {
    promise: null,
    model: null,
    error: null
  };

  const tfScriptUrl = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
  const nsfwScriptUrl = 'https://cdn.jsdelivr.net/npm/nsfwjs@2.1.1/dist/nsfwjs.min.js';
  const modelUrl = 'https://cdn.jsdelivr.net/gh/infinitered/nsfwjs@master/weights/';

  function waitForGlobal(name, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (window[name]) {
          resolve(window[name]);
          return;
        }
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out while waiting for ${name}`));
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  function loadScriptSource(url) {
    return fetch(url, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch script: ${url} (${response.status})`);
        }
        return response.text();
      })
      .then((source) => {
        // eslint-disable-next-line no-new-func
        Function(source)();
      });
  }

  async function ensureLibraries() {
    if (!window.tf) {
      await loadScriptSource(tfScriptUrl);
      await waitForGlobal('tf');
    }

    if (!window.nsfwjs) {
      await loadScriptSource(nsfwScriptUrl);
      await waitForGlobal('nsfwjs');
    }
  }

  async function ensureModel() {
    if (state.model) return state.model;
    if (state.promise) return state.promise;

    state.promise = (async () => {
      try {
        await ensureLibraries();
        state.model = await window.nsfwjs.load(modelUrl);
        state.error = null;
        return state.model;
      } catch (error) {
        state.error = error;
        throw error;
      }
    })().finally(() => {
      // keep promise for one-time use but allow future re-attempt only after state reset
      setTimeout(() => {
        state.promise = null;
      }, 0);
    });

    return state.promise;
  }

  window.__nsfwGuardModelLoader = {
    ensureModel,
    getState: () => ({
      model: !!state.model,
      error: state.error ? state.error.message : null,
      ready: !!state.model
    }),
    getModel: () => state.model
  };
})();
