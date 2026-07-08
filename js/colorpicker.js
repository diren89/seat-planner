/* ═══════════════════════════════════════════════════════════════
   colorpicker.js  –  Reusable swatch-grid color picker popover.
   Wraps a hidden native <input type="color"> (data store + full-
   freedom fallback) with a curated 24-swatch grid. Injects its own
   markup — no extra HTML needed besides the trigger button.
   ═══════════════════════════════════════════════════════════════ */

const ColorPicker = (() => {
  'use strict';

  let _popover = null;
  let _openTriggerId = null;

  function _ensurePopover() {
    if (_popover) return _popover;
    _popover = document.createElement('div');
    _popover.className = 'color-popover';
    _popover.style.display = 'none';
    document.body.appendChild(_popover);

    document.addEventListener('mousedown', e => {
      if (_popover.style.display === 'none') return;
      if (e.target.closest('.color-popover') || e.target.id === _openTriggerId) return;
      close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    return _popover;
  }

  function close() {
    if (_popover) _popover.style.display = 'none';
    _openTriggerId = null;
  }

  /** Render the swatch grid at `anchorEl` and call onPick(hex) on selection
   *  ("Eigene Farbe" spawns a throwaway native color input as fallback). */
  function _openPopover(anchorEl, onPick) {
    const pop = _ensurePopover();
    pop.innerHTML = Colorgen.SWATCHES.map(hex =>
      `<button type="button" class="color-swatch" style="background:${hex};" data-hex="${hex}" title="${hex}"></button>`
    ).join('') + `<button type="button" class="color-swatch color-swatch-custom" title="Eigene Farbe…">${Icons.get('color-palette') || '+'}</button>`;

    pop.onclick = ev => {
      const sw = ev.target.closest('.color-swatch');
      if (!sw) return;
      if (sw.classList.contains('color-swatch-custom')) {
        const tmp = document.createElement('input');
        tmp.type = 'color';
        tmp.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
        document.body.appendChild(tmp);
        tmp.addEventListener('change', () => { onPick(tmp.value); tmp.remove(); }, { once: true });
        tmp.click();
        close();
        return;
      }
      onPick(sw.dataset.hex);
      close();
    };

    const r = anchorEl.getBoundingClientRect();
    pop.style.display = 'grid';
    pop.style.top  = Math.min(r.bottom + 6, window.innerHeight - 190) + 'px';
    pop.style.left = Math.min(r.left, window.innerWidth - 200) + 'px';
  }

  /**
   * Bind a visible trigger button + hidden native color input as a pair.
   * onChange(hex) fires on swatch pick or native-picker change; the
   * trigger's own background always reflects the current color.
   */
  function attach(triggerId, hiddenInputId, onChange) {
    const trigger = document.getElementById(triggerId);
    const hidden  = document.getElementById(hiddenInputId);
    if (!trigger || !hidden) return;

    const setColor = hex => {
      hidden.value = hex;
      trigger.style.background = hex;
      if (onChange) onChange(hex);
    };

    // Reflect whatever the hidden input already holds (e.g. modal prefill)
    trigger.style.background = hidden.value || '#93a8b2';
    hidden.addEventListener('change', () => setColor(hidden.value));

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      _openPopover(trigger, setColor);
      _openTriggerId = triggerId;
    });
  }

  /** One-off popover for dynamically re-rendered elements (no fixed id
   *  pair) — e.g. a swatch button recreated on every list render. */
  function openFor(anchorEl, onPick) {
    _openPopover(anchorEl, onPick);
    _openTriggerId = null;   // outside-click still closes; anchor has no stable id to exempt
  }

  return { attach, openFor, close };
})();
