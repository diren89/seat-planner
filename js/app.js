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
    view:  { zoom: 1, panX: 0, panY: 0 }
  };

  let _state = { ...DEFAULT_STATE };
  let _undoStack = [];
  const UNDO_LIMIT = 30;

  function getState()       { return _state; }
  function setState(next, skipUndo = false) {
    if (!skipUndo) {
      _undoStack.push(JSON.stringify(_state));
      if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
    }
    _state = next;
    Storage.save(_state);
    refresh();
  }

  function undo() {
    if (_undoStack.length === 0) return toast('Nichts zum Rückgängig-Machen.', 'warn');
    _state = JSON.parse(_undoStack.pop());
    Storage.save(_state);
    refresh(true);
    toast('Rückgängig gemacht.', 'success');
  }

  /* ══════════════════════════════════════════════════════════
     REFRESH  (re-render everything from state)
     ══════════════════════════════════════════════════════════ */
  function refresh(full = false) {
    Seats.render();
    Teams.renderList();
    Teams.renderAssignSelect();
    Stats.render();
    Seats.renderDetailPanel();
    populateRoomFilter();
    updateSelectionUI();
    if (full) applyTransform();
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

    // Wheel zoom
    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom(_zoom + delta, cx, cy);
    }, { passive: false });

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.key === '+' || e.key === '=') setZoom(_zoom + ZOOM_STEP);
      if (e.key === '-')                setZoom(_zoom - ZOOM_STEP);
      if (e.key === '0')               resetZoom();
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape')          Seats.clearSelection();
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        Seats.selectMany(Seats.getAll().map(s => s.id));
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
     TABS
     ══════════════════════════════════════════════════════════ */
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab)?.classList.add('active');

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
    const ids = Seats.getSelectedIds();
    if (ids.length === 0) return;
    confirm(
      'Plätze löschen',
      `${ids.length} Platz/Plätze wirklich löschen?`,
      () => {
        Seats.deleteSeats(ids);
        toast(`${ids.length} Platz/Plätze gelöscht.`);
      }
    );
  }

  function updateSelectionUI() {
    const ids = Seats.getSelectedIds();
    const hasSelection = ids.length > 0;

    document.getElementById('btn-delete-selected').disabled  = !hasSelection;
    document.getElementById('btn-clear-assign').disabled     = !hasSelection;

    const assignActions = document.getElementById('assign-actions');
    const assignCount   = document.getElementById('assign-count');
    if (assignActions) assignActions.style.display = hasSelection ? 'flex' : 'none';
    if (assignCount)   assignCount.textContent = ids.length;
  }

  function initToolbar() {
    // Add single seat at center of viewport
    document.getElementById('btn-add-seat').addEventListener('click', () => {
      const vp = document.getElementById('plan-viewport');
      const x  = Math.round((vp.clientWidth  / 2 - _panX) / _zoom);
      const y  = Math.round((vp.clientHeight / 2 - _panY) / _zoom);
      const n  = Seats.getAll().length + 1;
      Seats.addSeat(x, y, 'S' + n);
      toast('Einzelplatz hinzugefügt.');
    });

    document.getElementById('btn-delete-selected').addEventListener('click', deleteSelected);

    document.getElementById('btn-clear-assign').addEventListener('click', () => {
      const ids = Seats.getSelectedIds();
      if (ids.length === 0) return;
      Teams.assignSeats(ids, null);
      toast('Zuweisung aufgehoben.');
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

    // Team list events (edit / delete) via delegation
    document.getElementById('team-list').addEventListener('click', e => {
      const editBtn   = e.target.closest('.btn-team-edit');
      const deleteBtn = e.target.closest('.btn-team-delete');
      if (editBtn)   Teams.openEditModal(editBtn.dataset.id);
      if (deleteBtn) {
        const team = Teams.getTeam(deleteBtn.dataset.id);
        if (!team) return;
        confirm(
          'Team löschen',
          `Team "${team.name}" und alle Zuweisungen löschen?`,
          () => { Teams.deleteTeam(deleteBtn.dataset.id); toast('Team gelöscht.'); }
        );
      }
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
     STATS TAB
     ══════════════════════════════════════════════════════════ */
  function initStatsTab() {
    document.getElementById('btn-refresh-stats').addEventListener('click', () => Stats.render());
  }

  /* ══════════════════════════════════════════════════════════
     DATA TAB  (export / import / filter / search / reset)
     ══════════════════════════════════════════════════════════ */
  function initDataTab() {
    // Export
    document.getElementById('btn-export').addEventListener('click', () => {
      Storage.exportJSON(_state);
      toast('Export abgeschlossen.', 'success');
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
            setState(imported, true);
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

    // Search & jump
    document.getElementById('btn-search').addEventListener('click', doSearch);
    document.getElementById('search-seat').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });

    function doSearch() {
      const q = document.getElementById('search-seat').value;
      if (!q) return;
      const found = Seats.jumpToSeat(q, getZoom, setPan);
      if (!found) toast(`Platz "${q}" nicht gefunden.`, 'warn');
    }

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
  function toast(msg, type = '') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast-' + type : '');
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('show'));
    });
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, 2500);
  }

  /* ══════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════ */
  function boot() {
    // Load persisted state — or seed the JobRad 2.OG default map on first run
    const saved = Storage.load();
    if (saved) {
      _state = { ...DEFAULT_STATE, ...saved };
      _zoom  = saved.view?.zoom ?? 1;
      _panX  = saved.view?.panX ?? 0;
      _panY  = saved.view?.panY ?? 0;
    } else if (typeof JOBRAD_2OG_STATE !== 'undefined') {
      _state = { ...DEFAULT_STATE, ...JSON.parse(JSON.stringify(JOBRAD_2OG_STATE)) };
      _zoom  = _state.view?.zoom ?? 1;
      _panX  = _state.view?.panX ?? 0;
      _panY  = _state.view?.panY ?? 0;
      Storage.save(_state);
    }

    // Init modules
    Seats.init(getState, (next) => setState(next), onChange);
    Teams.init(getState, (next) => setState(next), onChange);
    Stats.init(getState);

    // Init viewport interactions
    initZoomPan();
    const viewport = document.getElementById('plan-viewport');
    const stage    = document.getElementById('plan-stage');
    Seats.initDragHandlers(viewport, getZoom);
    Seats.initLasso(viewport, stage, getTransform);

    // Click on empty stage = deselect
    stage.addEventListener('click', e => {
      if (e.target === stage || e.target.id === 'floorplan-img') {
        Seats.clearSelection();
      }
    });

    // Wire up UI
    initTabs();
    initModals();
    initToolbar();
    initRasterTab();
    initTeamsTab();
    initStatsTab();
    initDataTab();
    initHeaderButtons();
    initKeyboard();

    // First render
    applyTransform();
    refresh();

    console.info('[SeatPlanner] Ready.');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
