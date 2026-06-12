/* ═══════════════════════════════════════════════════════════════
   elements.js  –  Architektur-Ebene: Räume, Wände, Türen.
                   Gerendert als SVG-Overlay im selben Bild-
                   Koordinatensystem wie die Sitzplätze.
   Modell (kind-diskriminiert, alle in state.elements[]):
     Raum:  { id, kind:'room', x, y, w, h, label, color }
     Wand:  { id, kind:'wall', x1, y1, x2, y2, thickness }
     Tür:   { id, kind:'door', x, y, width, angle, swing:'left'|'right' }
   ═══════════════════════════════════════════════════════════════ */

const Elements = (() => {

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const GRID   = 10;            // Raster-Schrittweite (Bild-px)
  const MIN    = 12;            // Mindestgröße Raum / Wandlänge

  /* ── Defaults ─────────────────────────────────────────────── */
  const ROOM_COLOR  = '#3b82f6';
  const WALL_THICK  = 6;
  const DOOR_WIDTH  = 40;

  /* ── State / DI ───────────────────────────────────────────── */
  let _getState, _setState, _onChange;
  let _stage, _getTransform, _getTool;
  let _selectedId = null;

  function uid() { return 'E' + Math.random().toString(36).slice(2, 9); }

  function init(getState, setState, onChange) {
    _getState = getState;
    _setState = setState;
    _onChange = onChange;
  }

  function getAll() { return _getState().elements || []; }
  function get(id)  { return getAll().find(e => e.id === id) || null; }

  /* ── CRUD ─────────────────────────────────────────────────── */
  function _commit(elements) {
    const state = _getState();
    _setState({ ...state, elements });
  }

  function addRoom(x, y, w, h) {
    const el = { id: uid(), kind: 'room', x: Math.round(x), y: Math.round(y),
                 w: Math.round(w), h: Math.round(h), label: 'Raum', color: ROOM_COLOR };
    _commit([...getAll(), el]);
    selectElement(el.id);
    return el;
  }

  function addWall(x1, y1, x2, y2) {
    const el = { id: uid(), kind: 'wall',
                 x1: Math.round(x1), y1: Math.round(y1),
                 x2: Math.round(x2), y2: Math.round(y2), thickness: WALL_THICK };
    _commit([...getAll(), el]);
    selectElement(el.id);
    return el;
  }

  function addDoor(x, y) {
    const el = { id: uid(), kind: 'door', x: Math.round(x), y: Math.round(y),
                 width: DOOR_WIDTH, angle: 0, swing: 'right' };
    _commit([...getAll(), el]);
    selectElement(el.id);
    return el;
  }

  function updateElement(id, patch) {
    _commit(getAll().map(e => e.id === id ? { ...e, ...patch } : e));
    _onChange('element-updated', id);
  }

  function deleteElements(ids) {
    _commit(getAll().filter(e => !ids.includes(e.id)));
    if (ids.includes(_selectedId)) _selectedId = null;
    _onChange('elements-deleted', ids);
  }

  /* ── Selection ────────────────────────────────────────────── */
  function selectElement(id, silent = false) {
    _selectedId = id;
    // Sitzplatz-Auswahl räumen, damit Entf eindeutig ist
    if (id && typeof Seats !== 'undefined') Seats.clearSelection(true);
    if (!silent) _onChange('element-selected', id);
  }

  function clearSelection(silent = false) {
    if (_selectedId === null) return;
    _selectedId = null;
    if (!silent) _onChange('element-deselected');
  }

  function getSelectedId() { return _selectedId; }

  /* ── Geometrie-Helfer / Snapping ──────────────────────────── */
  function snap(v, free)  { return free ? Math.round(v) : Math.round(v / GRID) * GRID; }

  /** Snap-Endpunkt einer Linie auf 45°-Schritte relativ zum Startpunkt. */
  function snapLine(x1, y1, x2, y2, free) {
    if (free) return { x: Math.round(x2), y: Math.round(y2) };
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const step = Math.PI / 4;
    const ang = Math.round(Math.atan2(dy, dx) / step) * step;
    return { x: snap(x1 + Math.cos(ang) * len), y: snap(y1 + Math.sin(ang) * len) };
  }

  function clientToStage(e) {
    const rect = _stage.getBoundingClientRect();
    const z = _getTransform().zoom;
    return { x: (e.clientX - rect.left) / z, y: (e.clientY - rect.top) / z };
  }

  /* ── SVG-Rendering ────────────────────────────────────────── */
  const _nodes = new Map();      // id -> <g>
  let _overlay, _handlesGroup;

  function _mk(tag, attrs) {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function render(svg) {
    _overlay = svg || _overlay;
    if (!_overlay) return;

    // Handles-Gruppe immer zuletzt (oberste Ebene)
    if (!_handlesGroup) {
      _handlesGroup = _mk('g', { class: 'arch-handles' });
    }

    const els = getAll();

    // Gelöschte Nodes entfernen
    for (const [id, node] of _nodes) {
      if (!els.find(e => e.id === id)) { node.remove(); _nodes.delete(id); }
    }

    for (const el of els) {
      let g = _nodes.get(el.id);
      if (!g) {
        g = _mk('g', { 'data-id': el.id });
        g.classList.add('arch', 'arch-' + el.kind);
        _attachEvents(g, el.id);
        _overlay.appendChild(g);
        _nodes.set(el.id, g);
      }
      g.classList.toggle('selected', el.id === _selectedId);
      _draw(g, el);
    }

    // Handles neu aufbauen für aktuelle Auswahl
    _overlay.appendChild(_handlesGroup);  // ans Ende = oben
    _renderHandles();
  }

  function _draw(g, el) {
    g.replaceChildren();
    if (el.kind === 'room') {
      g.appendChild(_mk('rect', { x: el.x, y: el.y, width: el.w, height: el.h,
                                  class: 'arch-room-rect', fill: el.color }));
      const t = _mk('text', { x: el.x + el.w / 2, y: el.y + el.h / 2, class: 'arch-room-label' });
      t.textContent = el.label || '';
      g.appendChild(t);
    } else if (el.kind === 'wall') {
      // breite unsichtbare Trefferlinie + sichtbare Wand
      g.appendChild(_mk('line', { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2,
                                  class: 'arch-wall-hit',
                                  'stroke-width': Math.max(el.thickness, 14) }));
      g.appendChild(_mk('line', { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2,
                                  class: 'arch-wall-line', 'stroke-width': el.thickness }));
    } else if (el.kind === 'door') {
      const s = el.swing === 'left' ? -1 : 1;
      const w = el.width;
      const inner = _mk('g', { transform: `translate(${el.x},${el.y}) rotate(${el.angle})` });
      // Rahmenöffnung
      inner.appendChild(_mk('line', { x1: 0, y1: 0, x2: w, y2: 0, class: 'arch-door-frame' }));
      // Türblatt (geöffnet, senkrecht zur Öffnung)
      inner.appendChild(_mk('line', { x1: 0, y1: 0, x2: 0, y2: s * w, class: 'arch-door-leaf' }));
      // Schwenkbogen
      const sweep = s === 1 ? 1 : 0;
      inner.appendChild(_mk('path', { d: `M ${w} 0 A ${w} ${w} 0 0 ${sweep} 0 ${s * w}`,
                                      class: 'arch-door-arc' }));
      g.appendChild(inner);
    }
  }

  /* ── Handles ──────────────────────────────────────────────── */
  function _renderHandles() {
    const el = get(_selectedId);
    _buildHandles(el);
  }

  /** Baut die Handles für ein (ggf. Live-)Element-Objekt. */
  function _buildHandles(el) {
    _handlesGroup.replaceChildren();
    if (!el) return;
    if (el.kind === 'room') {
      const pts = _roomHandlePoints(el);
      for (const h in pts) _addHandle(pts[h].x, pts[h].y, h);
    } else if (el.kind === 'wall') {
      _addHandle(el.x1, el.y1, 'p1');
      _addHandle(el.x2, el.y2, 'p2');
    } else if (el.kind === 'door') {
      // Dreh-Handle am Ende der Rahmenöffnung
      const a = el.angle * Math.PI / 180;
      _addHandle(el.x + Math.cos(a) * el.width, el.y + Math.sin(a) * el.width, 'rot', 'rotate');
    }
  }

  function _roomHandlePoints(el) {
    const { x, y, w, h } = el;
    return {
      nw: { x,        y },        n: { x: x + w / 2, y },
      ne: { x: x + w, y },        e: { x: x + w,     y: y + h / 2 },
      se: { x: x + w, y: y + h }, s: { x: x + w / 2, y: y + h },
      sw: { x,        y: y + h }, w: { x,            y: y + h / 2 }
    };
  }

  function _addHandle(x, y, name, variant) {
    const c = _mk('circle', { cx: x, cy: y, r: 6,
                              class: 'arch-handle' + (variant ? ' arch-handle-' + variant : ''),
                              'data-handle': name });
    c.addEventListener('mousedown', ev => _startHandleDrag(ev, name));
    _handlesGroup.appendChild(c);
  }

  /* ── Events: Auswahl + Body-Drag ──────────────────────────── */
  function _attachEvents(g, id) {
    g.addEventListener('mousedown', e => {
      if (e.button !== 0 || _getTool() !== 'select') return;
      e.stopPropagation();                  // verhindert Lasso/Pan
      selectElement(id);
      _startBodyDrag(e, id);
    });
    g.addEventListener('dblclick', e => {
      e.stopPropagation();
      openElementModal(id);
    });
    g.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation();
      selectElement(id);
      openElementModal(id);
    });
  }

  /* ── Live-Drag (Body verschieben) ─────────────────────────── */
  let _drag = null;  // { mode, id, start{x,y}, orig, handle }

  function _startBodyDrag(e, id) {
    const el = get(id);
    if (!el) return;
    _drag = { mode: 'move', id, start: clientToStage(e), orig: { ...el } };
  }

  function _startHandleDrag(e, handle) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = get(_selectedId);
    if (!el) return;
    _drag = { mode: 'handle', id: el.id, handle, start: clientToStage(e), orig: { ...el } };
  }

  /** Vorschau ohne setState — schreibt direkt ins DOM, committet erst bei mouseup. */
  function _applyLive(el) {
    const g = _nodes.get(el.id);
    if (g) _draw(g, el);
    _buildHandles(el);
  }

  function _computeLive(e) {
    const cur = clientToStage(e);
    const free = e.altKey;
    const o = _drag.orig;
    const dx = cur.x - _drag.start.x;
    const dy = cur.y - _drag.start.y;

    if (_drag.mode === 'move') {
      if (o.kind === 'room') {
        return { ...o, x: snap(o.x + dx, free), y: snap(o.y + dy, free) };
      } else if (o.kind === 'wall') {
        return { ...o, x1: snap(o.x1 + dx, free), y1: snap(o.y1 + dy, free),
                       x2: snap(o.x2 + dx, free), y2: snap(o.y2 + dy, free) };
      } else { // door
        return { ...o, x: snap(o.x + dx, free), y: snap(o.y + dy, free) };
      }
    }

    // mode === 'handle'
    if (o.kind === 'room') {
      let { x, y, w, h } = o;
      const h2 = _drag.handle;
      if (h2.includes('n')) { y = snap(o.y + dy, free); h = o.h - (y - o.y); }
      if (h2.includes('s')) { h = snap(o.h + dy, free); }
      if (h2.includes('w')) { x = snap(o.x + dx, free); w = o.w - (x - o.x); }
      if (h2.includes('e')) { w = snap(o.w + dx, free); }
      // Mindestgröße / Negativ verhindern
      if (w < MIN) { if (h2.includes('w')) x = o.x + o.w - MIN; w = MIN; }
      if (h < MIN) { if (h2.includes('n')) y = o.y + o.h - MIN; h = MIN; }
      return { ...o, x, y, w, h };
    } else if (o.kind === 'wall') {
      if (_drag.handle === 'p1') {
        const p = snapLine(o.x2, o.y2, cur.x, cur.y, free);
        return { ...o, x1: p.x, y1: p.y };
      } else {
        const p = snapLine(o.x1, o.y1, cur.x, cur.y, free);
        return { ...o, x2: p.x, y2: p.y };
      }
    } else { // door rotate
      let deg = Math.atan2(cur.y - o.y, cur.x - o.x) * 180 / Math.PI;
      if (!free) deg = Math.round(deg / 15) * 15;
      return { ...o, angle: Math.round(deg) };
    }
  }

  /* ── Zeichnen (Draw-Modi) ─────────────────────────────────── */
  let _drawing = null;   // { tool, start, previewNode }

  function _startDraw(e) {
    const tool = _getTool();
    const p = clientToStage(e);
    const free = e.altKey;

    if (tool === 'door') {
      addDoor(snap(p.x, free), snap(p.y, free));
      return true;
    }
    if (tool === 'room' || tool === 'wall') {
      _drawing = { tool, start: { x: snap(p.x, free), y: snap(p.y, free) } };
      _drawing.previewNode = _mk(tool === 'room' ? 'rect' : 'line', { class: 'arch-preview' });
      _overlay.appendChild(_drawing.previewNode);
      return true;
    }
    return false;
  }

  function _updateDraw(e) {
    if (!_drawing) return;
    const cur = clientToStage(e);
    const free = e.altKey;
    const s = _drawing.start;
    if (_drawing.tool === 'room') {
      const x2 = snap(cur.x, free), y2 = snap(cur.y, free);
      const x = Math.min(s.x, x2), y = Math.min(s.y, y2);
      _drawing.previewNode.setAttribute('x', x);
      _drawing.previewNode.setAttribute('y', y);
      _drawing.previewNode.setAttribute('width',  Math.abs(x2 - s.x));
      _drawing.previewNode.setAttribute('height', Math.abs(y2 - s.y));
    } else {
      const p = snapLine(s.x, s.y, cur.x, cur.y, free);
      _drawing.previewNode.setAttribute('x1', s.x);
      _drawing.previewNode.setAttribute('y1', s.y);
      _drawing.previewNode.setAttribute('x2', p.x);
      _drawing.previewNode.setAttribute('y2', p.y);
    }
  }

  function _finishDraw(e) {
    if (!_drawing) return;
    const cur = clientToStage(e);
    const free = e.altKey;
    const s = _drawing.start;
    _drawing.previewNode.remove();
    if (_drawing.tool === 'room') {
      const x2 = snap(cur.x, free), y2 = snap(cur.y, free);
      const x = Math.min(s.x, x2), y = Math.min(s.y, y2);
      const w = Math.abs(x2 - s.x), h = Math.abs(y2 - s.y);
      if (w >= MIN && h >= MIN) {
        const room = addRoom(x, y, w, h);
        // Direkt nach dem Aufziehen benennen lassen
        openElementModal(room.id);
        requestAnimationFrame(() => {
          const inp = document.getElementById('modal-el-room-label');
          if (inp) { inp.focus(); inp.select(); }   // Default "Raum" markiert → Tippen ersetzt ihn
        });
      }
    } else {
      const p = snapLine(s.x, s.y, cur.x, cur.y, free);
      if (Math.hypot(p.x - s.x, p.y - s.y) >= MIN) addWall(s.x, s.y, p.x, p.y);
    }
    _drawing = null;
  }

  /* ── Globale Interaktions-Verdrahtung ─────────────────────── */
  function initInteractions(viewport, stage, getTransform, getTool) {
    _stage = stage;
    _getTransform = getTransform;
    _getTool = getTool;

    // Zeichnen startet auf leerer Fläche (Draw-Modi)
    viewport.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const tool = getTool();
      if (tool === 'select' || tool === 'seat') return;   // select/seat anderswo behandelt
      // Nicht starten, wenn auf bestehendem Element (dort: select-mode only)
      _startDraw(e);
    });

    document.addEventListener('mousemove', e => {
      if (_drawing) { _updateDraw(e); return; }
      if (_drag)    { _applyLive(_computeLive(e)); }
    });

    document.addEventListener('mouseup', e => {
      if (_drawing) { _finishDraw(e); return; }
      if (_drag) {
        const live = _computeLive(e);
        const { id } = _drag;
        _drag = null;
        // einmalig committen → genau ein Undo-Schritt
        const { kind, ...rest } = live;
        updateElement(id, rest);
      }
    });
  }

  /* ── Bearbeiten-Modal ─────────────────────────────────────── */
  let _editingId = null;

  function openElementModal(id) {
    const el = get(id);
    if (!el) return;
    _editingId = id;

    document.querySelectorAll('#modal-element .el-fields').forEach(f => f.style.display = 'none');
    const title = document.getElementById('modal-element-title');

    if (el.kind === 'room') {
      title.textContent = 'Raum bearbeiten';
      document.getElementById('el-room-fields').style.display = 'block';
      document.getElementById('modal-el-room-label').value = el.label || '';
      document.getElementById('modal-el-room-color').value = el.color || ROOM_COLOR;
    } else if (el.kind === 'wall') {
      title.textContent = 'Wand bearbeiten';
      document.getElementById('el-wall-fields').style.display = 'block';
      document.getElementById('modal-el-wall-thick').value = el.thickness;
    } else if (el.kind === 'door') {
      title.textContent = 'Tür bearbeiten';
      document.getElementById('el-door-fields').style.display = 'block';
      document.getElementById('modal-el-door-width').value = el.width;
      document.getElementById('modal-el-door-swing').value = el.swing;
    }
    document.getElementById('modal-element').style.display = 'flex';
  }

  function saveElementModal() {
    const el = get(_editingId);
    if (!el) return;
    if (el.kind === 'room') {
      updateElement(el.id, {
        label: document.getElementById('modal-el-room-label').value.trim(),
        color: document.getElementById('modal-el-room-color').value
      });
    } else if (el.kind === 'wall') {
      updateElement(el.id, {
        thickness: Math.max(1, parseInt(document.getElementById('modal-el-wall-thick').value, 10) || WALL_THICK)
      });
    } else if (el.kind === 'door') {
      updateElement(el.id, {
        width: Math.max(10, parseInt(document.getElementById('modal-el-door-width').value, 10) || DOOR_WIDTH),
        swing: document.getElementById('modal-el-door-swing').value
      });
    }
    _editingId = null;
    document.getElementById('modal-element').style.display = 'none';
  }

  return {
    init, initInteractions, render,
    addRoom, addWall, addDoor, updateElement, deleteElements,
    getAll, get,
    selectElement, clearSelection, getSelectedId,
    openElementModal, saveElementModal
  };
})();
