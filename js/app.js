/* ═══════════════════════════════════════════════════════════════
   app.js  –  Main controller: state, zoom/pan, event wiring,
              undo, tabs, toasts, keyboard shortcuts
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════════ */
  const DEFAULT_STATE = {
    seats: [],
    teams: [],
    elements: [],
    floors: [],
    comments: [],
    locked: false,
    view:  { zoom: 1, panX: 0, panY: 0 }
  };

  /* Legacy states (and the seed) know nothing about floors — this floor
     is what their entities get backfilled onto. */
  const DEFAULT_FLOOR = { id: 'og2', name: '2. OG', image: 'floorplan/plan-2og.jpg', w: 1139, h: 1349 };

  /* Ensure floors exist and every entity carries a floorId (non-destructive). */
  function normalizeState(s) {
    const st = { ...DEFAULT_STATE, ...s };
    if (!Array.isArray(st.floors) || st.floors.length === 0) {
      st.floors = [JSON.parse(JSON.stringify(DEFAULT_FLOOR))];
    }
    const fid = st.floors[0].id;
    const fill = arr => (arr || []).map(x => x.floorId ? x : { ...x, floorId: fid });
    st.seats    = fill(st.seats);
    st.elements = fill(st.elements);
    st.comments = fill(st.comments);
    return st;
  }

  let _state = { ...DEFAULT_STATE };
  let _undoStack = [];
  let _redoStack = [];
  const UNDO_LIMIT = 30;
  let _settingLock = false;   // bypasses the lock-guard for the lock toggle itself

  function isLocked() { return !!_state.locked; }
  let _applyingRemote = false;   // true while applying a peer's state (no re-broadcast)

  function getState()       { return _state; }
  function setState(next, skipUndo = false) {
    if (_state.locked && !_applyingRemote && !_settingLock) {
      toast('Plan ist gesperrt.', 'warn');
      return;
    }
    if (!skipUndo) {
      _undoStack.push(JSON.stringify(_state));
      if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
      _redoStack = [];   // a new action invalidates the redo history
    }
    _state = next;
    Storage.save(_state);
    refresh();
    if (!_applyingRemote && typeof Collab !== 'undefined' && Collab.enabled) {
      Collab.broadcastState(_state);
    }
  }

  /* Apply a plan state received from a collaborator (keep our local view). */
  function applyRemoteState(remote) {
    _applyingRemote = true;
    _state = normalizeState({
      seats:    remote.seats    || [],
      teams:    remote.teams    || [],
      elements: remote.elements || [],
      floors:   remote.floors   || [],
      comments: remote.comments || [],
      locked:   !!remote.locked,
      view:     _state.view
    });
    Storage.save(_state);
    applyFloorBackground();
    refresh();
    _applyingRemote = false;
  }

  /* Toggle the whole-plan lock (read-only for everyone). Bypasses the guard. */
  function setLocked(v) {
    _settingLock = true;
    setState({ ..._state, locked: !!v });
    _settingLock = false;
    applyLockUI();
    toast(v ? 'Plan gesperrt.' : 'Plan entsperrt.', 'success');
  }

  function applyLockUI() {
    document.body.classList.toggle('app-locked', isLocked());
    const btn = document.getElementById('btn-lock');
    if (btn) { btn.innerHTML = (typeof Icons !== 'undefined') ? Icons.get(isLocked() ? 'locked' : 'unlocked') : ''; btn.title = isLocked() ? 'Plan entsperren' : 'Plan sperren (nur Ansicht)'; btn.setAttribute('aria-label', btn.title); }
    if (isLocked() && typeof setTool === 'function') setTool('select');
  }

  function undo() {
    if (isLocked()) return toast('Plan ist gesperrt.', 'warn');
    if (_undoStack.length === 0) return toast('Nichts zum Rückgängig-Machen.', 'warn');
    _redoStack.push(JSON.stringify(_state));
    _state = JSON.parse(_undoStack.pop());
    Storage.save(_state);
    refresh(true);
    if (typeof Collab !== 'undefined' && Collab.enabled) Collab.broadcastState(_state);
    toast('Rückgängig gemacht.', 'success');
  }

  function redo() {
    if (isLocked()) return toast('Plan ist gesperrt.', 'warn');
    if (_redoStack.length === 0) return toast('Nichts zum Wiederherstellen.', 'warn');
    _undoStack.push(JSON.stringify(_state));
    _state = JSON.parse(_redoStack.pop());
    Storage.save(_state);
    refresh(true);
    if (typeof Collab !== 'undefined' && Collab.enabled) Collab.broadcastState(_state);
    toast('Wiederhergestellt.', 'success');
  }

  /* ══════════════════════════════════════════════════════════
     REFRESH  (re-render everything from state)
     ══════════════════════════════════════════════════════════ */
  function refresh(full = false) {
    Seats.render();
    Elements.render(document.getElementById('plan-overlay'));
    Elements.renderDetailPanel();
    Teams.renderList();
    Teams.renderAssignSelect();
    Stats.render();
    Seats.renderDetailPanel();
    Comments.render();
    populateRoomFilter();
    populateFloorSelect();
    renderFloorsPanel();
    updateSelectionUI();
    applyLockUI();
    updateHistoryUI();
    if (full) applyTransform();
  }

  /* Enable/disable the undo/redo header buttons to mirror the stacks */
  function updateHistoryUI() {
    const u = document.getElementById('btn-undo');
    const r = document.getElementById('btn-redo');
    if (u) u.disabled = _undoStack.length === 0;
    if (r) r.disabled = _redoStack.length === 0;
  }

  /* ══════════════════════════════════════════════════════════
     FLOORS  (active floor is local, like zoom — not synced)
     ══════════════════════════════════════════════════════════ */
  let _activeFloor = null;

  function getActiveFloor() {
    const floors = _state.floors || [];
    if (!floors.some(f => f.id === _activeFloor)) _activeFloor = floors[0]?.id || null;
    return _activeFloor;
  }

  function getFloor(id) { return (_state.floors || []).find(f => f.id === id) || null; }

  function setActiveFloor(id) {
    if (id === _activeFloor) return;
    _activeFloor = id;
    Seats.clearSelection(true);
    Elements.clearSelection(true);
    applyFloorBackground();
    refresh();
  }

  /* Swap background image + stage/overlay dimensions to the active floor. */
  function applyFloorBackground() {
    const f = getFloor(getActiveFloor());
    const img     = document.getElementById('floorplan-img');
    const overlay = document.getElementById('plan-overlay');
    const stage   = document.getElementById('plan-stage');
    if (!f || !img) return;
    img.style.width  = f.w + 'px';
    img.style.height = f.h + 'px';
    if (f.image) {
      if (img.getAttribute('src') !== f.image) img.src = f.image;
      img.style.visibility = '';
      stage.classList.remove('no-image');
    } else {
      img.removeAttribute('src');
      img.style.visibility = 'hidden';
      stage.classList.add('no-image');
    }
    stage.style.width  = f.w + 'px';
    stage.style.height = f.h + 'px';
    if (overlay) {
      overlay.setAttribute('width', f.w);
      overlay.setAttribute('height', f.h);
      overlay.setAttribute('viewBox', `0 0 ${f.w} ${f.h}`);
    }
  }

  function populateFloorSelect() {
    const sel = document.getElementById('floor-select');
    if (!sel) return;
    const floors = _state.floors || [];
    const af = getActiveFloor();
    sel.innerHTML = floors.map(f =>
      `<option value="${f.id}"${f.id === af ? ' selected' : ''}>${escAttr(f.name)}</option>`
    ).join('');
    sel.style.display = floors.length > 1 ? '' : 'none';
  }

  function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Floors management panel (Planer tab) */
  let _editingFloorId = null;   // null = adding

  function renderFloorsPanel() {
    const list = document.getElementById('floor-list');
    if (!list) return;
    const floors = _state.floors || [];
    list.innerHTML = floors.map(f => `
      <li class="floor-item" data-id="${f.id}">
        <span class="floor-name">${escAttr(f.name)}</span>
        <span class="floor-meta">${f.image ? 'Bild' : 'ohne Bild'} · ${f.w}×${f.h}</span>
        <div class="team-actions">
          <button class="btn-floor-edit" data-id="${f.id}" title="Bearbeiten" aria-label="Etage bearbeiten">${Icons.get('edit')}</button>
          <button class="btn-floor-delete" data-id="${f.id}" title="Löschen" aria-label="Etage löschen">${Icons.get('trash')}</button>
        </div>
      </li>`).join('');
  }

  function openFloorModal(id) {
    _editingFloorId = id || null;
    const f = id ? getFloor(id) : null;
    document.getElementById('modal-floor-title').textContent = f ? 'Etage bearbeiten' : 'Etage hinzufügen';
    document.getElementById('modal-floor-name').value  = f ? f.name : '';
    document.getElementById('modal-floor-image').value = f ? (f.image || '') : '';
    document.getElementById('modal-floor-w').value     = f ? f.w : 1139;
    document.getElementById('modal-floor-h').value     = f ? f.h : 1349;
    document.getElementById('modal-floor').style.display = 'flex';
  }

  function saveFloorModal() {
    const name  = document.getElementById('modal-floor-name').value.trim();
    const image = document.getElementById('modal-floor-image').value.trim();
    const w = parseInt(document.getElementById('modal-floor-w').value, 10) || 1139;
    const h = parseInt(document.getElementById('modal-floor-h').value, 10) || 1349;
    if (!name) return toast('Bitte einen Namen angeben.', 'warn');
    if (_editingFloorId) {
      setState({ ..._state, floors: _state.floors.map(f => f.id === _editingFloorId ? { ...f, name, image, w, h } : f) });
    } else {
      const floor = { id: 'F' + Math.random().toString(36).slice(2, 9), name, image, w, h };
      setState({ ..._state, floors: [..._state.floors, floor] });
      setActiveFloor(floor.id);
    }
    _editingFloorId = null;
    document.getElementById('modal-floor').style.display = 'none';
    applyFloorBackground();
  }

  function deleteFloor(id) {
    const floors = _state.floors || [];
    if (floors.length <= 1) return toast('Die letzte Etage kann nicht gelöscht werden.', 'warn');
    const f = getFloor(id);
    const count = _state.seats.filter(s => s.floorId === id).length
                + _state.elements.filter(e => e.floorId === id).length
                + (_state.comments || []).filter(c => c.floorId === id).length;
    confirm(
      'Etage löschen',
      `„${f ? f.name : id}" wirklich löschen?` + (count ? ` ${count} Objekt(e) auf dieser Etage werden mitgelöscht.` : ''),
      () => {
        setState({
          ..._state,
          floors:   _state.floors.filter(x => x.id !== id),
          seats:    _state.seats.filter(s => s.floorId !== id),
          elements: _state.elements.filter(e => e.floorId !== id),
          comments: (_state.comments || []).filter(c => c.floorId !== id)
        });
        if (_activeFloor === id) { _activeFloor = null; applyFloorBackground(); refresh(); }
        toast('Etage gelöscht.', '', { action: { label: 'Rückgängig', fn: undo } });
      }
    );
  }

  function initFloors() {
    document.getElementById('floor-select').addEventListener('change', e => setActiveFloor(e.target.value));
    document.getElementById('btn-add-floor').addEventListener('click', () => openFloorModal(null));
    document.getElementById('modal-floor-save').addEventListener('click', saveFloorModal);
    document.getElementById('floor-list').addEventListener('click', e => {
      const edit = e.target.closest('.btn-floor-edit');
      const del  = e.target.closest('.btn-floor-delete');
      if (edit) openFloorModal(edit.dataset.id);
      else if (del) deleteFloor(del.dataset.id);
    });
  }

  /* Fill the room filter dropdown from the current seats, keeping the selection */
  function populateRoomFilter() {
    const sel = document.getElementById('filter-room-select');
    if (!sel) return;
    const current = sel.value;
    const rooms = Seats.getRooms();
    sel.innerHTML = '<option value="">Alle Räume</option>' +
      rooms.map(r => `<option value="${r.replace(/"/g, '&quot;')}">${r}</option>`).join('');
    sel.value = rooms.includes(current) ? current : '';
  }

  /* ══════════════════════════════════════════════════════════
     ZOOM / PAN
     ══════════════════════════════════════════════════════════ */
  const ZOOM_MIN = 0.2;
  const ZOOM_MAX = 3.0;
  const ZOOM_STEP = 0.15;

  let _zoom = 1;
  let _panX = 0;
  let _panY = 0;
  let _panning = false;
  let _panStart = null;

  function getZoom() { return _zoom; }
  function getTransform() { return { zoom: _zoom, panX: _panX, panY: _panY }; }

  function applyTransform() {
    const stage = document.getElementById('plan-stage');
    if (stage) {
      stage.style.transform = `translate(${_panX}px, ${_panY}px) scale(${_zoom})`;
    }
  }

  function setZoom(z, cx, cy) {
    const vp   = document.getElementById('plan-viewport');
    cx = cx ?? vp.clientWidth  / 2;
    cy = cy ?? vp.clientHeight / 2;

    const prevZoom = _zoom;
    _zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

    // Zoom toward cursor
    const ratio = _zoom / prevZoom;
    _panX = cx - ratio * (cx - _panX);
    _panY = cy - ratio * (cy - _panY);
    applyTransform();
  }

  function setPan(x, y) {
    _panX = x; _panY = y;
    applyTransform();
  }

  function initZoomPan() {
    const viewport = document.getElementById('plan-viewport');

    // Wheel: Figma/Maps style.
    //   ctrl/meta (touchpad pinch or Cmd+wheel) → smooth zoom to cursor
    //   plain two-finger scroll                 → pan
    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const k  = e.deltaMode === 1 ? 16 : 1;   // normalize line-mode deltas
      if (e.ctrlKey || e.metaKey) {
        // Clamp per-event exponent so a coarse mouse notch can't jump too far;
        // touchpad pinch sends tiny deltas → stays smooth.
        const exp = Math.max(-0.3, Math.min(0.3, -e.deltaY * k * 0.01));
        setZoom(_zoom * Math.exp(exp), cx, cy);
      } else {
        _panX -= e.deltaX * k;
        _panY -= e.deltaY * k;
        applyTransform();
      }
    }, { passive: false });

    // Touchscreen gestures: 1 finger = pan, 2 fingers = pinch-zoom.
    // Only touch pointers — mouse keeps the mousedown/move/up handlers below.
    const _touchPts = new Map();   // pointerId -> { x, y }
    let _pinchDist = 0;            // last 2-finger distance
    function _twoPts() {
      const it = _touchPts.values();
      return [it.next().value, it.next().value];
    }
    viewport.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      _touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
      if (_touchPts.size === 2) {
        const [a, b] = _twoPts();
        _pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    viewport.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch' || !_touchPts.has(e.pointerId)) return;
      e.preventDefault();
      const prev = _touchPts.get(e.pointerId);
      _touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (_touchPts.size === 1) {
        _panX += e.clientX - prev.x;
        _panY += e.clientY - prev.y;
        applyTransform();
      } else if (_touchPts.size === 2) {
        const [a, b] = _twoPts();
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (_pinchDist > 0 && dist > 0) {
          const rect = viewport.getBoundingClientRect();
          const midX = (a.x + b.x) / 2 - rect.left;
          const midY = (a.y + b.y) / 2 - rect.top;
          setZoom(_zoom * (dist / _pinchDist), midX, midY);
        }
        _pinchDist = dist;
      }
    });
    function _endPointer(e) {
      if (e.pointerType !== 'touch') return;
      _touchPts.delete(e.pointerId);
      if (_touchPts.size < 2) _pinchDist = 0;
    }
    viewport.addEventListener('pointerup', _endPointer);
    viewport.addEventListener('pointercancel', _endPointer);

    // Middle-mouse or Space+drag pan
    viewport.addEventListener('mousedown', e => {
      if (e.button === 1 || (e.button === 0 && _spaceDown)) {
        e.preventDefault();
        _panning = true;
        _panStart = { x: e.clientX - _panX, y: e.clientY - _panY };
        viewport.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', e => {
      if (!_panning) return;
      _panX = e.clientX - _panStart.x;
      _panY = e.clientY - _panStart.y;
      applyTransform();
    });

    document.addEventListener('mouseup', e => {
      if (_panning) {
        _panning = false;
        viewport.style.cursor = '';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     KEYBOARD SHORTCUTS
     ══════════════════════════════════════════════════════════ */
  let _spaceDown = false;

  function initKeyboard() {
    document.addEventListener('keydown', e => {
      // Ignore when inside input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.code === 'Space')          { e.preventDefault(); _spaceDown = true; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && e.shiftKey) { e.preventDefault(); redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === '+' || e.key === '=') setZoom(_zoom + ZOOM_STEP);
      if (e.key === '-')                setZoom(_zoom - ZOOM_STEP);
      if (e.key === '0')               resetZoom();
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape')          { document.getElementById('modal-help').style.display = 'none'; setDrawer(false); Seats.clearSelection(); Elements.clearSelection(); Seats.setHighlightTeam(''); refresh(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const af = getActiveFloor();
        Seats.selectMany(Seats.getAll().filter(s => !af || s.floorId === af).map(s => s.id));
      }
    });

    document.addEventListener('keyup', e => {
      if (e.code === 'Space') _spaceDown = false;
    });
  }

  function resetZoom() {
    _zoom = 1; _panX = 0; _panY = 0;
    applyTransform();
  }

  /* ══════════════════════════════════════════════════════════
     TOOL PALETTE  (select | room | wall | door | seat)
     ══════════════════════════════════════════════════════════ */
  let _tool = 'select';

  const TOOL_HINTS = {
    select: 'Klick = auswählen · Doppelklick = bearbeiten',
    room:   'Ziehen = Raum aufziehen · Alt = frei (kein Raster)',
    wall:   'Ziehen = Wand · rastet auf 0/45/90° · Alt = frei',
    door:   'Klick = Tür platzieren · danach drehen/bearbeiten im Auswählen-Modus',
    seat:   'Klick = Arbeitsplatz setzen',
    comment: 'Klick = Kommentar-Pin setzen'
  };

  function getTool() { return _tool; }

  function setTool(tool) {
    _tool = tool;
    document.querySelectorAll('.tool-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === tool));

    const overlay  = document.getElementById('plan-overlay');
    const viewport = document.getElementById('plan-viewport');
    if (overlay)  overlay.classList.toggle('mode-select', tool === 'select');
    if (viewport) viewport.classList.toggle('mode-draw', tool !== 'select');

    const hint = document.getElementById('toolbar-hint');
    if (hint) hint.textContent = TOOL_HINTS[tool] || '';

    // Auswahl räumen beim Werkzeugwechsel
    if (tool !== 'select') { Seats.clearSelection(); Elements.clearSelection(); }
  }

  function initToolPalette() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => setTool(btn.dataset.tool));
    });
  }

  /* Grundriss-Tab: Edit/Delete des ausgewählten Elements (Delegation) */
  function initLayoutTab() {
    const panel = document.getElementById('element-detail');
    if (!panel) return;
    panel.addEventListener('click', e => {
      if (e.target.closest('.btn-el-edit')) {
        const id = Elements.getSelectedId();
        if (id) Elements.openElementModal(id);
      }
      if (e.target.closest('.btn-el-delete')) {
        deleteSelected();
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     TABS
     ══════════════════════════════════════════════════════════ */
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab)?.classList.add('active');

        // Drawing tools live in the Planer tab — reset to select elsewhere
        if (btn.dataset.tab !== 'tab-planer' && _tool !== 'select') setTool('select');

        // Refresh stats when switching to that tab
        if (btn.dataset.tab === 'tab-stats') Stats.render();
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     MODALS
     ══════════════════════════════════════════════════════════ */
  function initModals() {
    // Close via backdrop or [data-modal] buttons
    document.addEventListener('click', e => {
      const closeTarget = e.target.closest('[data-modal]');
      if (closeTarget) {
        document.getElementById(closeTarget.dataset.modal).style.display = 'none';
      }
      if (e.target.classList.contains('modal-backdrop')) {
        e.target.style.display = 'none';
      }
    });

    // Seat modal save
    document.getElementById('modal-seat-save').addEventListener('click', () => {
      Seats.saveSeatModal();
    });

    // Show/hide sharing factor based on type
    document.getElementById('modal-seat-type').addEventListener('change', e => {
      document.getElementById('share-factor-wrap').style.display =
        e.target.value === 'flex' ? 'block' : 'none';
    });

    // Team modal save
    document.getElementById('modal-team-save').addEventListener('click', () => {
      Teams.saveEditModal();
    });

    // Element (room/wall/door) modal save
    document.getElementById('modal-element-save').addEventListener('click', () => {
      Elements.saveElementModal();
    });

    // Room name field: Enter = save, Escape = cancel
    document.getElementById('modal-el-room-label').addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); Elements.saveElementModal(); }
      if (e.key === 'Escape') { document.getElementById('modal-element').style.display = 'none'; }
    });

    // Confirm modal
    document.getElementById('confirm-ok').addEventListener('click', () => {
      if (_pendingConfirmFn) _pendingConfirmFn();
      _pendingConfirmFn = null;
      document.getElementById('modal-confirm').style.display = 'none';
    });
  }

  let _pendingConfirmFn = null;

  function confirm(title, message, fn) {
    document.getElementById('confirm-title').textContent   = title;
    document.getElementById('confirm-message').textContent = message;
    _pendingConfirmFn = fn;
    document.getElementById('modal-confirm').style.display = 'flex';
  }

  /* ══════════════════════════════════════════════════════════
     TOOLBAR / PLAN ACTIONS
     ══════════════════════════════════════════════════════════ */
  function deleteSelected() {
    // Architektur-Element hat Vorrang, wenn eines ausgewählt ist
    const elId = Elements.getSelectedId();
    if (elId) {
      const el = Elements.get(elId);
      const label = { room: 'Raum', wall: 'Wand', door: 'Tür' }[el?.kind] || 'Element';
      confirm('Element löschen', `${label} wirklich löschen?`, () => {
        Elements.deleteElements([elId]);
        toast(`${label} gelöscht.`, '', { action: { label: 'Rückgängig', fn: undo } });
      });
      return;
    }

    const ids = Seats.getSelectedIds();
    if (ids.length === 0) return;
    confirm(
      'Plätze löschen',
      `${ids.length} Platz/Plätze wirklich löschen?`,
      () => {
        Seats.deleteSeats(ids);
        toast(`${ids.length} Platz/Plätze gelöscht.`, '', { action: { label: 'Rückgängig', fn: undo } });
      }
    );
  }

  function updateSelectionUI() {
    const ids = Seats.getSelectedIds();
    const hasSeats   = ids.length > 0;
    const hasElement = !!Elements.getSelectedId();

    document.getElementById('btn-delete-selected').disabled  = !(hasSeats || hasElement);
    document.getElementById('btn-clear-assign').disabled     = !hasSeats;

    const assignActions = document.getElementById('assign-actions');
    const assignCount   = document.getElementById('assign-count');
    if (assignActions) assignActions.style.display = hasSeats ? 'flex' : 'none';
    if (assignCount)   assignCount.textContent = ids.length;

    // Share current selection with collaborators
    if (typeof Collab !== 'undefined' && Collab.enabled) {
      const el = Elements.getSelectedId();
      Collab.setSelection(el ? [...ids, el] : ids);
    }
  }

  function initToolbar() {
    document.getElementById('btn-delete-selected').addEventListener('click', deleteSelected);

    document.getElementById('btn-clear-assign').addEventListener('click', () => {
      const ids = Seats.getSelectedIds();
      if (ids.length === 0) return;
      Teams.assignSeats(ids, null);
      toast('Zuweisung aufgehoben.', '', { action: { label: 'Rückgängig', fn: undo } });
    });

    document.getElementById('btn-help').addEventListener('click', () => {
      document.getElementById('modal-help').style.display = 'flex';
    });

    // Comment pins: modal save/delete + visibility toggle
    document.getElementById('modal-comment-save').addEventListener('click', () => Comments.saveModal());
    document.getElementById('modal-comment-delete').addEventListener('click', () => Comments.deleteFromModal());
    document.getElementById('btn-toggle-comments').addEventListener('click', e => {
      const v = !Comments.isVisible();
      Comments.setVisible(v);
      e.currentTarget.setAttribute('aria-pressed', v ? 'true' : 'false');
      e.currentTarget.classList.toggle('off', !v);
    });
  }

  /* ══════════════════════════════════════════════════════════
     CANVAS LEGEND  (collapsible, state persisted)
     ══════════════════════════════════════════════════════════ */
  function initLegend() {
    const legend = document.getElementById('plan-legend');
    const toggle = document.getElementById('legend-toggle');
    if (!legend || !toggle) return;

    // Default: collapsed on narrow screens or when previously collapsed
    const stored = localStorage.getItem('legend_collapsed');
    const collapsed = stored !== null ? stored === '1' : matchMedia('(max-width: 900px)').matches;
    legend.classList.toggle('collapsed', collapsed);
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

    toggle.addEventListener('click', () => {
      const c = legend.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', c ? 'false' : 'true');
      localStorage.setItem('legend_collapsed', c ? '1' : '0');
    });
  }

  /* ══════════════════════════════════════════════════════════
     RASTER TAB
     ══════════════════════════════════════════════════════════ */
  function initRasterTab() {
    document.getElementById('btn-generate-grid').addEventListener('click', () => {
      const cols      = parseInt(document.getElementById('grid-cols').value,     10) || 8;
      const rows      = parseInt(document.getElementById('grid-rows').value,     10) || 5;
      const gapX      = parseInt(document.getElementById('grid-gap-x').value,    10) || 52;
      const gapY      = parseInt(document.getElementById('grid-gap-y').value,    10) || 52;
      const offsetX   = parseInt(document.getElementById('grid-offset-x').value, 10) || 60;
      const offsetY   = parseInt(document.getElementById('grid-offset-y').value, 10) || 60;
      const prefix    = document.getElementById('grid-prefix').value  || 'A';
      const startNum  = parseInt(document.getElementById('grid-start-num').value, 10) || 1;

      Seats.generateGrid(cols, rows, gapX, gapY, offsetX, offsetY, prefix, startNum);
      toast(`${cols * rows} Plätze erzeugt.`, 'success');
    });
  }

  /* ══════════════════════════════════════════════════════════
     TEAMS TAB
     ══════════════════════════════════════════════════════════ */
  function initTeamsTab() {
    // Add team
    document.getElementById('btn-add-team').addEventListener('click', () => {
      const name   = document.getElementById('team-name-input').value.trim();
      const color  = document.getElementById('team-color-input').value;
      const demand = document.getElementById('team-demand-input').value;
      if (!name) return toast('Bitte Teamnamen eingeben.', 'warn');
      Teams.addTeam(name, color, demand);
      document.getElementById('team-name-input').value   = '';
      document.getElementById('team-demand-input').value = '';
      toast(`Team "${name}" hinzugefügt.`, 'success');
    });

    // Team enter key
    document.getElementById('team-name-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-add-team').click();
    });

    // Add section divider
    document.getElementById('btn-add-section').addEventListener('click', () => {
      Teams.addSection();
      toast('Abschnitt eingefügt.', 'success');
    });

    const teamList = document.getElementById('team-list');

    // Team list events (edit / delete / section-delete / highlight) via delegation
    teamList.addEventListener('click', e => {
      const editBtn    = e.target.closest('.btn-team-edit');
      const deleteBtn  = e.target.closest('.btn-team-delete');
      const sectionDel = e.target.closest('.btn-section-delete');
      const nameEl     = e.target.closest('.team-name');
      if (editBtn) { Teams.openEditModal(editBtn.dataset.id); return; }
      if (deleteBtn) {
        const team = Teams.getTeam(deleteBtn.dataset.id);
        if (!team) return;
        confirm(
          'Team löschen',
          `Team "${team.name}" und alle Zuweisungen löschen?`,
          () => { Teams.deleteTeam(deleteBtn.dataset.id); toast('Team gelöscht.', '', { action: { label: 'Rückgängig', fn: undo } }); }
        );
        return;
      }
      if (sectionDel) {
        confirm('Abschnitt löschen', 'Abschnitt-Trenner löschen? (Teams bleiben erhalten.)',
          () => { Teams.deleteItem(sectionDel.dataset.id); toast('Abschnitt gelöscht.', '', { action: { label: 'Rückgängig', fn: undo } }); });
        return;
      }
      if (nameEl) {
        // Highlight this team's assigned seats on the plan (toggle)
        const id = nameEl.closest('.team-item').dataset.id;
        Seats.setHighlightTeam(id);
        refresh();
      }
    });

    // Rename a section divider inline (double-click)
    teamList.addEventListener('dblclick', e => {
      const nameEl = e.target.closest('.section-name');
      if (!nameEl) return;
      const id = nameEl.closest('.team-section').dataset.id;
      const current = nameEl.textContent;
      nameEl.contentEditable = 'true';
      nameEl.focus();
      document.getSelection().selectAllChildren(nameEl);
      const finish = (save) => {
        nameEl.contentEditable = 'false';
        nameEl.removeEventListener('blur', onBlur);
        nameEl.removeEventListener('keydown', onKey);
        const val = nameEl.textContent.trim();
        if (save && val && val !== current) Teams.renameItem(id, val);
        else refresh();
      };
      const onBlur = () => finish(true);
      const onKey = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
        else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      };
      nameEl.addEventListener('blur', onBlur);
      nameEl.addEventListener('keydown', onKey);
    });

    // Drag & drop reordering of teams + sections (delegated; HTML5 native DnD)
    let _dragId = null;
    teamList.addEventListener('dragstart', e => {
      const li = e.target.closest('[data-id]');
      if (!li) return;
      _dragId = li.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    teamList.addEventListener('dragend', e => {
      _dragId = null;
      teamList.querySelectorAll('.dragging, .drag-over-before, .drag-over-after')
        .forEach(el => el.classList.remove('dragging', 'drag-over-before', 'drag-over-after'));
    });
    teamList.addEventListener('dragover', e => {
      if (!_dragId) return;
      const li = e.target.closest('[data-id]');
      if (!li || li.dataset.id === _dragId) return;
      e.preventDefault();
      const before = (e.clientY - li.getBoundingClientRect().top) < li.offsetHeight / 2;
      teamList.querySelectorAll('.drag-over-before, .drag-over-after')
        .forEach(el => el.classList.remove('drag-over-before', 'drag-over-after'));
      li.classList.add(before ? 'drag-over-before' : 'drag-over-after');
    });
    teamList.addEventListener('drop', e => {
      if (!_dragId) return;
      const li = e.target.closest('[data-id]');
      if (!li || li.dataset.id === _dragId) return;
      e.preventDefault();
      const before = (e.clientY - li.getBoundingClientRect().top) < li.offsetHeight / 2;
      Teams.reorder(_dragId, li.dataset.id, before);
    });

    // Assign selected seats to team
    document.getElementById('btn-assign-team').addEventListener('click', () => {
      const teamId = document.getElementById('assign-team-select').value;
      const ids    = Seats.getSelectedIds();
      if (!teamId) return toast('Bitte Team wählen.', 'warn');
      if (ids.length === 0) return toast('Keine Plätze ausgewählt.', 'warn');
      Teams.assignSeats(ids, teamId);
      const team = Teams.getTeam(teamId);
      toast(`${ids.length} Platz/Plätze → ${team?.name ?? ''}`, 'success');
    });
  }

  /* ══════════════════════════════════════════════════════════
     DATA TAB  (export / import / filter / reset)
     ══════════════════════════════════════════════════════════ */
  function loadDefault() {
    if (typeof SEED_2OG_STATE === 'undefined') {
      return toast('Standard-Plan nicht verfügbar.', 'error');
    }
    confirm(
      'Standard-Plan laden',
      'Aktuelle Plätze, Räume und Teams werden durch den Standard-Plan ersetzt. Fortfahren?',
      () => {
        const def = JSON.parse(JSON.stringify(SEED_2OG_STATE));
        setState(normalizeState(def));
        applyFloorBackground();
        resetZoom();
        toast('Standard-Plan geladen.', 'success');
      }
    );
  }

  function initDataTab() {
    // Load default plan (seats + teamspaces)
    document.getElementById('btn-load-default').addEventListener('click', loadDefault);

    // Export
    document.getElementById('btn-export').addEventListener('click', () => {
      Storage.exportJSON(_state);
      toast('Export abgeschlossen.', 'success');
    });

    // Export team seat-assignment as JPG (single + batch)
    document.getElementById('btn-export-team').addEventListener('click', async () => {
      const id = document.getElementById('export-team-select').value;
      if (!id) return toast('Bitte Team wählen.', 'warn');
      await TeamExport.exportTeam(id);
      toast('Team-Export erstellt.', 'success');
    });
    document.getElementById('btn-export-all-teams').addEventListener('click', async () => {
      const n = await TeamExport.exportAll();
      toast(n ? `${n} Team-Exporte erstellt.` : 'Keine Teams vorhanden.', n ? 'success' : 'warn');
    });

    // Import
    document.getElementById('import-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const imported = await Storage.importJSON(file);
        if (!imported.seats || !imported.teams) throw new Error('Ungültiges Format.');
        confirm(
          'Daten importieren',
          'Alle aktuellen Daten werden durch den Import ersetzt. Fortfahren?',
          () => {
            setState(normalizeState(imported), true);
            applyFloorBackground();
            toast('Import erfolgreich.', 'success');
          }
        );
      } catch (err) {
        toast('Import fehlgeschlagen: ' + err.message, 'error');
      }
      e.target.value = '';
    });

    // Filter
    function applyFilter() {
      const team   = document.getElementById('filter-team-select').value;
      const status = document.getElementById('filter-status-select').value;
      const room   = document.getElementById('filter-room-select').value;
      Seats.setFilter(team, status, room);
      Seats.render();
    }

    document.getElementById('filter-team-select').addEventListener('change',   applyFilter);
    document.getElementById('filter-status-select').addEventListener('change',  applyFilter);
    document.getElementById('filter-room-select').addEventListener('change',    applyFilter);

    // Reset
    document.getElementById('btn-reset-all').addEventListener('click', () => {
      confirm(
        'Alle Daten löschen',
        'Wirklich ALLE Plätze, Teams und Zuweisungen löschen? Dieser Schritt ist nicht rückgängig zu machen.',
        () => {
          Storage.clear();
          _state = { ...DEFAULT_STATE };
          _undoStack = [];
          refresh(true);
          toast('Alle Daten gelöscht.', 'success');
        }
      );
    });
  }

  /* ══════════════════════════════════════════════════════════
     ZOOM BUTTONS
     ══════════════════════════════════════════════════════════ */
  function initHeaderButtons() {
    document.getElementById('btn-zoom-in').addEventListener('click',    () => setZoom(_zoom + ZOOM_STEP));
    document.getElementById('btn-zoom-out').addEventListener('click',   () => setZoom(_zoom - ZOOM_STEP));
    document.getElementById('btn-zoom-reset').addEventListener('click', resetZoom);
    document.getElementById('btn-undo').addEventListener('click',       undo);
    document.getElementById('btn-redo').addEventListener('click',       redo);
    document.getElementById('btn-lock').addEventListener('click',       () => setLocked(!isLocked()));
  }

  /* ══════════════════════════════════════════════════════════
     CHANGE HANDLER (called by Seats / Teams)
     ══════════════════════════════════════════════════════════ */
  function onChange(event) {
    refresh();
  }

  /* ══════════════════════════════════════════════════════════
     TOAST
     ══════════════════════════════════════════════════════════ */
  function toast(msg, type = '', opts = {}) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast-' + type : '');
    el.textContent = msg;

    const dismiss = () => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    };

    // Optional action button (e.g. "Rückgängig") — longer display time
    if (opts.action && typeof opts.action.fn === 'function') {
      const btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = opts.action.label || 'Rückgängig';
      btn.addEventListener('click', () => { opts.action.fn(); dismiss(); });
      el.appendChild(btn);
    }

    container.appendChild(el);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('show'));
    });
    setTimeout(dismiss, opts.action ? 6000 : 2500);
  }

  /* ══════════════════════════════════════════════════════════
     LIVE COLLABORATION  (Supabase) — identity, peers, cursors
     ══════════════════════════════════════════════════════════ */
  const PEER_COLORS = ['#e6582b','#1f9d8f','#7b5bd6','#d6457f','#2f7de1','#e0962a','#0e9f5a','#b4459e'];
  let _peers = [];

  function escAttr(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function initials(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
  }

  function getIdentity() {
    let id = localStorage.getItem('collab_id');
    if (!id) { id = 'u' + Math.random().toString(36).slice(2, 9); localStorage.setItem('collab_id', id); }
    let color = localStorage.getItem('collab_color');
    if (!color) { color = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]; localStorage.setItem('collab_color', color); }
    const name = localStorage.getItem('collab_name') || ('Gast-' + id.slice(1, 4));
    return { id, name, color };
  }

  function getRoomId() {
    const p = new URLSearchParams(location.search).get('room');
    return (p && p.trim()) || 'jobrad-2og';
  }

  function initCollab() {
    if (typeof Collab === 'undefined' || !window.COLLAB_CONFIG) return;
    const ident = getIdentity();
    const ok = Collab.init({
      roomId: getRoomId(),
      user: ident,
      getState,
      applyRemoteState,
      onPeers: (peers) => { _peers = peers; renderPeers(); }
    });
    if (!ok) return;

    document.getElementById('presence').style.display = 'flex';

    // Broadcast our cursor (image coordinates) while moving over the plan
    const stage = document.getElementById('plan-stage');
    document.getElementById('plan-viewport').addEventListener('mousemove', e => {
      const rect = stage.getBoundingClientRect();
      Collab.sendCursor((e.clientX - rect.left) / _zoom, (e.clientY - rect.top) / _zoom);
    });

    document.getElementById('btn-share').addEventListener('click', shareLink);
    document.getElementById('btn-name').addEventListener('click', openNameModal);
    document.getElementById('modal-name-save').addEventListener('click', saveNameModal);
    document.getElementById('modal-name-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') saveNameModal();
    });

    // Identity uses a default "Gast-…" name; user sets it via the 👤 button
    // (no forced modal on load).

    renderPeers();
  }

  function shareLink() {
    const url = location.origin + location.pathname + '?room=' + encodeURIComponent(Collab.roomId);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => toast('Plan-Link kopiert.', 'success'),
        () => toast(url, '')
      );
    } else { toast(url, ''); }
  }

  function openNameModal() {
    const inp = document.getElementById('modal-name-input');
    inp.value = localStorage.getItem('collab_name') || '';
    document.getElementById('modal-name').style.display = 'flex';
    requestAnimationFrame(() => { inp.focus(); inp.select(); });
  }
  function saveNameModal() {
    const name = document.getElementById('modal-name-input').value.trim() || 'Gast';
    localStorage.setItem('collab_name', name);
    if (typeof Collab !== 'undefined') Collab.setName(name);
    document.getElementById('modal-name').style.display = 'none';
    renderPeers();
    toast('Name gesetzt: ' + name, 'success');
  }

  /* Position of a seat/element in image coordinates (for peer overlays) */
  function entityPos(id) {
    const s = Seats.getAll().find(x => x.id === id);
    if (s) return { x: s.x, y: s.y, r: 22 };
    const el = Elements.get(id);
    if (!el) return null;
    if (el.kind === 'room') return { x: el.x, y: el.y, w: el.w, h: el.h, rect: true };
    if (el.kind === 'wall') return { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2, r: 18 };
    return { x: el.x, y: el.y, r: 22 };
  }

  function renderPeers() {
    // Presence list (self first, then peers)
    const list = document.getElementById('presence-list');
    if (list) {
      const me = getIdentity();
      let h = `<span class="presence-avatar is-me" style="background:${me.color}" title="${escAttr(me.name)} (du)">${escAttr(initials(me.name))}</span>`;
      h += _peers.map(p =>
        `<span class="presence-avatar" style="background:${p.color}" title="${escAttr(p.name)}">${escAttr(initials(p.name))}</span>`
      ).join('');
      list.innerHTML = h;
    }

    // Peer cursors + selections in the (transform-scaled) peer layer
    const layer = document.getElementById('peer-layer');
    if (!layer) return;
    let html = '';
    for (const p of _peers) {
      for (const id of (p.selection || [])) {
        const pos = entityPos(id);
        if (!pos) continue;
        if (pos.rect) {
          html += `<div class="peer-selection" style="left:${pos.x}px;top:${pos.y}px;width:${pos.w}px;height:${pos.h}px;border-color:${p.color}"></div>`;
        } else {
          const r = pos.r || 20, d = r * 2;
          html += `<div class="peer-selection" style="left:${pos.x - r}px;top:${pos.y - r}px;width:${d}px;height:${d}px;border-color:${p.color};border-radius:50%"></div>`;
        }
      }
      if (p.cursor) {
        html += `<div class="peer-cursor" style="left:${p.cursor.x}px;top:${p.cursor.y}px">`
              + `<svg viewBox="0 0 16 16" width="20" height="20"><path d="M1 1 L1 13 L4.6 9.4 L7.1 15 L9.2 14 L6.7 8.6 L11.5 8.6 Z" fill="${p.color}" stroke="#fff" stroke-width="1"/></svg>`
              + `<span class="peer-label" style="background:${p.color}">${escAttr(p.name)}</span></div>`;
      }
    }
    layer.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════ */
  function revealBranding() {
    // Brand assets carry no src until here (post-login), so they are never
    // fetched on the public lock screen — only after a successful unlock.
    document.querySelectorAll('img[data-src]').forEach(img => {
      if (img.dataset.src) img.src = img.dataset.src;
    });
  }

  /* ── Responsive sidebar drawer (<900px) ──────────────────── */
  function setDrawer(open) {
    const sb = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    const btn = document.getElementById('btn-drawer');
    if (sb) sb.classList.toggle('open', open);
    if (scrim) scrim.classList.toggle('open', open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function toggleDrawer() {
    const sb = document.getElementById('sidebar');
    setDrawer(!(sb && sb.classList.contains('open')));
  }
  function initDrawer() {
    document.getElementById('btn-drawer').addEventListener('click', toggleDrawer);
    document.getElementById('btn-drawer-close').addEventListener('click', () => setDrawer(false));
    document.getElementById('sidebar-scrim').addEventListener('click', () => setDrawer(false));
    // Reset drawer state when growing back to desktop width
    matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setDrawer(false); });
  }

  function fillIcons() {
    if (typeof Icons === 'undefined') return;
    document.querySelectorAll('[data-icon]').forEach(el => {
      el.innerHTML = Icons.get(el.dataset.icon);
      if (!el.getAttribute('aria-label') && el.title) el.setAttribute('aria-label', el.title);
    });
  }

  function boot() {
    revealBranding();
    fillIcons();
    // Load persisted state — or seed the default map on first run
    const saved = Storage.load();
    if (saved) {
      _state = normalizeState(saved);
      _zoom  = saved.view?.zoom ?? 1;
      _panX  = saved.view?.panX ?? 0;
      _panY  = saved.view?.panY ?? 0;
    } else if (typeof SEED_2OG_STATE !== 'undefined') {
      _state = normalizeState(JSON.parse(JSON.stringify(SEED_2OG_STATE)));
      _zoom  = _state.view?.zoom ?? 1;
      _panX  = _state.view?.panX ?? 0;
      _panY  = _state.view?.panY ?? 0;
      Storage.save(_state);
    } else {
      _state = normalizeState(_state);
    }
    applyFloorBackground();

    // Init modules
    Seats.init(getState, (next) => setState(next), onChange, getTool, getActiveFloor);
    Elements.init(getState, (next) => setState(next), onChange, getActiveFloor);
    Comments.init(getState, (next) => setState(next), onChange, getActiveFloor);
    Teams.init(getState, (next) => setState(next), onChange);
    Stats.init(getState);

    // Init viewport interactions
    initZoomPan();
    const viewport = document.getElementById('plan-viewport');
    const stage    = document.getElementById('plan-stage');
    Seats.initDragHandlers(viewport, getZoom);
    Seats.initLasso(viewport, stage, getTransform);
    Elements.initInteractions(viewport, stage, getTransform, getTool);

    // Click on plan: place seat (seat tool) or deselect (select tool)
    stage.addEventListener('click', e => {
      const t = e.target;
      const onSeat   = t.classList && t.classList.contains('seat');
      const onHandle = t.classList && t.classList.contains('arch-handle');
      const onEmpty  = t === stage || t.id === 'floorplan-img' || t.id === 'plan-overlay';

      if (_tool === 'seat') {
        // Single click only (e.detail>1 = part of a double-click); allow on top
        // of rooms/walls, but not on an existing seat or a handle.
        if (e.detail > 1 || onSeat || onHandle) return;
        const rect = stage.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / _zoom);
        const y = Math.round((e.clientY - rect.top)  / _zoom);
        const n = Seats.getAll().length + 1;
        Seats.addSeat(x, y, 'S' + n);
        return;
      }
      if (_tool === 'comment') {
        if (e.detail > 1 || onSeat || onHandle || t.closest('.comment-pin')) return;
        const rect = stage.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / _zoom);
        const y = Math.round((e.clientY - rect.top)  / _zoom);
        const c = Comments.add(x, y);
        if (c) Comments.openModal(c.id);
        return;
      }
      if (_tool === 'select' && onEmpty) {
        Seats.clearSelection();
        Elements.clearSelection();
        Seats.setHighlightTeam('');
      }
    });

    // Wire up UI
    initToolPalette();
    initLayoutTab();
    initTabs();
    initModals();
    initToolbar();
    initRasterTab();
    initTeamsTab();
    initDataTab();
    initHeaderButtons();
    initDrawer();
    initKeyboard();
    initLegend();
    initFloors();
    Search.init({ getZoom, setPan, refresh, getActiveFloor, setActiveFloor, getFloors: () => _state.floors || [] });

    // First render
    applyTransform();
    refresh();

    // Live collaboration (no-op if Supabase config/SDK unavailable)
    initCollab();

    console.info('[SeatPlanner] Ready.');
  }

  // app.js is the last script in the chain. When loaded statically the DOM may
  // still be parsing; when loaded dynamically after the password gate the
  // DOMContentLoaded event has already fired — so boot() must run directly.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
