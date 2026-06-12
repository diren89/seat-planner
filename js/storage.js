/* ═══════════════════════════════════════════════════════════════
   storage.js  –  localStorage persistence + JSON export / import
   ═══════════════════════════════════════════════════════════════ */

const Storage = (() => {
  const KEY = 'seatplanner_v1';

  /** Persist the full state object */
  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Storage] save failed:', e);
    }
  }

  /** Load state from localStorage; returns null when nothing stored */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[Storage] load failed:', e);
      return null;
    }
  }

  /** Wipe everything */
  function clear() {
    localStorage.removeItem(KEY);
  }

  /** Export current state as a downloadable JSON file */
  function exportJSON(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ts   = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    a.href     = url;
    a.download = `sitzplan_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import a JSON file.
   * @param {File} file
   * @returns {Promise<object>}  parsed state
   */
  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          resolve(JSON.parse(e.target.result));
        } catch (err) {
          reject(new Error('Ungültige JSON-Datei.'));
        }
      };
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
      reader.readAsText(file);
    });
  }

  return { save, load, clear, exportJSON, importJSON };
})();
