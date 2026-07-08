/* ═══════════════════════════════════════════════════════════════
   colorgen.js  –  HSL color math + curated palette generation.
   Shared by the swatch-grid color picker and the per-section
   "generate team colors" feature.
   ═══════════════════════════════════════════════════════════════ */

const Colorgen = (() => {
  'use strict';

  function hexToHsl(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return { h: 0, s: 0, l: 50 };
    const n = parseInt(m[1], 16);
    let r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return '#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
  }

  /**
   * Generate `count` distinguishable-but-related colors.
   * baseHue: starting hue in degrees (random if omitted).
   * spread:  total arc in degrees the hues are spread across
   *          (360 = full rainbow, ~100 = a "family" close to baseHue).
   * sat/light: center of the pastel/mid-tone band (kept readable with
   *            the app's fixed dark seat-label text).
   */
  function palette(count, opts = {}) {
    const {
      baseHue = Math.random() * 360,
      spread = 360,
      sat = 58,
      light = 65
    } = opts;
    if (count <= 0) return [];
    const step = count > 1 ? spread / count : 0;
    const out = [];
    for (let i = 0; i < count; i++) {
      const h = baseHue + i * step;
      const l = light + (i % 2 === 0 ? -6 : 6);   // alternate light/dark for extra separation
      out.push(hslToHex(h, sat, l));
    }
    return out;
  }

  const SWATCHES = palette(24);

  return { hexToHsl, hslToHex, palette, SWATCHES };
})();
