/* ═══════════════════════════════════════════════════════════════
   seats.js  –  seat model, rendering, grid-gen, drag, lasso,
                selection, status, flex/sharing, filter
   ═══════════════════════════════════════════════════════════════ */

const Seats = (() => {

  /* ── uid ──────────────────────────────────────────────────── */
  function uid() {
    return 'S' + Math.random().toString(36).slice(2, 9);
  }

  /* ── State ────────────────────────────────────────────────── */
  let _getState, _setState, _onChange, _getTool;
  let _selectedIds = [];
  let _filterTeam  = '';
  let _filterStatus = '';
  let _filterRoom = '';
  let _highlightTeamId = '';   // team whose seats are highlighted via the team list

  function init(getState, setState, onChange, getTool) {
    _getState  = getState;
    _setState  = setState;
    _onChange  = onChange;
    _getTool   = getTool || (() => 'select');
  }

  /* ── Ausstattung (Arbeitsplatz-Equipment) ─────────────────── */
  const EQUIPMENT_LABEL = {
    '':          'Standard',
    'ultrawide': 'Ultrawide-Monitor',
    'dual':      'Dual-Monitor',
    'dual-uhd':  'Dual-UHD-Monitor'
  };
  const EQUIPMENT_BADGE = { 'ultrawide': 'UW', 'dual': '2M', 'dual-uhd': 'UHD' };

  /* ── Model helpers ────────────────────────────────────────── */
  function createSeat(x, y, label) {
    return {
      id:          uid(),
      x:           Math.round(x),
      y:           Math.round(y),
      label:       label || 'S',
      teamId:      null,
      status:      'free',   // free | occupied | reserved | blocked
      type:        'fixed',  // fixed | flex
      shareFactor: 1.0,
      room:        '',       // optionaler Raum / Zone (z.B. "TS1", "Hinterrad 2")
      equipment:   '',       // '' | ultrawide | dual | dual-uhd
      equipmentNote: ''      // Freitext zur Ausstattung
    };
  }

  function addSeat(x, y, label) {
    const state = _getState();
    const seat  = createSeat(x, y, label);
    _setState({ ...state, seats: [...state.seats, seat] });
    _onChange('seat-added', seat);
    return seat;
  }

  function updateSeat(id, patch) {
    const state = _getState();
    _setState({
      ...state,
      seats: state.seats.map(s => s.id === id ? { ...s, ...patch } : s)
    });
    _onChange('seat-updated', id);
  }

  function deleteSeats(ids) {
    const state = _getState();
    _setState({ ...state, seats: state.seats.filter(s => !ids.includes(s.id)) });
    _selectedIds = _selectedIds.filter(id => !ids.includes(id));
    _onChange('seats-deleted', ids);
  }

  function getAll() {
    return _getState().seats;
  }

  /* ── Grid generation ──────────────────────────────────────── */
  function generateGrid(cols, rows, gapX, gapY, offsetX, offsetY, prefix, startNum) {
    const state = _getState();
    const newSeats = [];
    let n = startNum;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * gapX;
        const y = offsetY + r * gapY;
        const label = prefix + n;
        newSeats.push(createSeat(x, y, label));
        n++;
      }
    }
    _setState({ ...state, seats: [...state.seats, ...newSeats] });
    _onChange('grid-generated', newSeats);
  }

  /* ── Selection ────────────────────────────────────────────── */
  function select(id, multi = false) {
    if (typeof Elements !== 'undefined') Elements.clearSelection(true);
    if (multi) {
      _selectedIds = _selectedIds.includes(id)
        ? _selectedIds.filter(x => x !== id)
        : [..._selectedIds, id];
    } else {
      _selectedIds = [id];
    }
    _onChange('selection-changed', _selectedIds);
  }

  function selectMany(ids) {
    _selectedIds = [...new Set([..._selectedIds, ...ids])];
    _onChange('selection-changed', _selectedIds);
  }

  function clearSelection(silent = false) {
    if (_selectedIds.length === 0) return;
    _selectedIds = [];
    if (!silent) _onChange('selection-changed', _selectedIds);
  }

  function getSelectedIds() { return _selectedIds; }

  /* ── Team highlight (toggle from the team list) ───────────── */
  function setHighlightTeam(teamId) {
    _highlightTeamId = (_highlightTeamId === teamId) ? '' : (teamId || '');
  }
  function getHighlightTeam() { return _highlightTeamId; }

  /* ── Filter ───────────────────────────────────────────────── */
  function setFilter(teamId, status, room) {
    _filterTeam   = teamId   || '';
    _filterStatus = status   || '';
    _filterRoom   = room     || '';
    _onChange('filter-changed');
  }

  function clearFilter() {
    _filterTeam = _filterStatus = _filterRoom = '';
    _onChange('filter-changed');
  }

  function passesFilter(seat) {
    if (_filterTeam   && seat.teamId !== _filterTeam) return false;
    if (_filterStatus && seat.status !== _filterStatus) return false;
    if (_filterRoom   && (seat.room || '') !== _filterRoom) return false;
    return true;
  }

  /* ── DOM rendering ────────────────────────────────────────── */
  const _seatEls = new Map(); // id -> DOM element

  function render() {
    const stage = document.getElementById('plan-stage');
    if (!stage) return;

    const seats  = getAll();
    const teams  = (typeof Teams !== 'undefined') ? Teams.getAll() : (_getState().teams || []);
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const hasFilter = !!(_filterTeam || _filterStatus || _filterRoom);

    // Remove elements for deleted seats
    for (const [id, el] of _seatEls) {
      if (!seats.find(s => s.id === id)) {
        el.remove();
        _seatEls.delete(id);
      }
    }

    for (const seat of seats) {
      let el = _seatEls.get(seat.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'seat';
        el.dataset.id = seat.id;
        stage.appendChild(el);
        _seatEls.set(seat.id, el);
        _attachSeatEvents(el);
      }

      // Position
      el.style.left = seat.x + 'px';
      el.style.top  = seat.y + 'px';

      // Status & type attributes
      el.dataset.status = seat.status;
      el.dataset.type   = seat.type;
      el.dataset.equipment = seat.equipment || '';

      // Tooltip: label + Ausstattung + Notiz
      const equipLabel = EQUIPMENT_LABEL[seat.equipment] || 'Standard';
      el.title = seat.label + ' — ' + equipLabel +
        (seat.equipmentNote ? ' · ' + seat.equipmentNote : '');

      // Team color override
      const team = seat.teamId ? teamMap[seat.teamId] : null;
      if (team && seat.status === 'free') {
        el.style.background = team.color;
      } else if (team && seat.status === 'occupied') {
        el.style.background = ''; // CSS class handles it
      } else {
        el.style.background = '';
      }
      // For team-assigned seats paint border in team color
      el.style.borderColor = team ? team.color : '';

      // Label
      el.textContent = seat.label;

      // Selected
      el.classList.toggle('selected', _selectedIds.includes(seat.id));

      // Team highlight (click on a team name in the list)
      el.classList.toggle('team-highlight', !!_highlightTeamId && seat.teamId === _highlightTeamId);

      // Filter dimming
      if (hasFilter) {
        const passes = passesFilter(seat);
        el.classList.toggle('dimmed',      !passes);
        el.classList.toggle('highlighted',  passes);
      } else {
        el.classList.remove('dimmed', 'highlighted');
      }
    }
  }

  /* ── Drag ─────────────────────────────────────────────────── */
  let _drag = null;  // { seatId, startX, startY, origX, origY }

  function _attachSeatEvents(el) {
    // Drag start
    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (_getTool() !== 'select') return;   // in Zeichen-Modi: durchreichen
      e.stopPropagation();
      const id   = el.dataset.id;
      const seat = _getState().seats.find(s => s.id === id);
      if (!seat) return;

      // If not selected, select it (keep multi if Ctrl)
      if (!_selectedIds.includes(id)) {
        select(id, e.ctrlKey || e.metaKey);
      }

      _drag = {
        ids:    _selectedIds.includes(id) ? [..._selectedIds] : [id],
        startX: e.clientX,
        startY: e.clientY,
        origPositions: _getState().seats
          .filter(s => _selectedIds.includes(s.id) || s.id === id)
          .map(s => ({ id: s.id, x: s.x, y: s.y }))
      };
    });

    // Click (select)
    el.addEventListener('click', e => {
      if (_getTool() !== 'select') return;
      e.stopPropagation();
      select(el.dataset.id, e.ctrlKey || e.metaKey || e.shiftKey);
    });

    // Double-click (edit modal)
    el.addEventListener('dblclick', e => {
      e.stopPropagation();
      openSeatModal(el.dataset.id);
    });

    // Context menu
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      openSeatModal(el.dataset.id);
    });
  }

  function initDragHandlers(viewport, getZoom) {
    viewport.addEventListener('mousemove', e => {
      if (!_drag) return;
      const zoom = getZoom();
      const dx = (e.clientX - _drag.startX) / zoom;
      const dy = (e.clientY - _drag.startY) / zoom;

      const state = _getState();
      const updatedSeats = state.seats.map(s => {
        const orig = _drag.origPositions.find(o => o.id === s.id);
        if (!orig) return s;
        return { ...s, x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) };
      });
      _setState({ ...state, seats: updatedSeats });
      render();
    });

    viewport.addEventListener('mouseup', e => {
      if (_drag) {
        _drag = null;
        _onChange('seats-moved');
      }
    });
  }

  /* ── Lasso selection ──────────────────────────────────────── */
  let _lasso = null;

  function initLasso(viewport, stage, getTransform) {
    const lassoEl = document.getElementById('lasso');

    viewport.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (_getTool() !== 'select') return;   // Lasso nur im Auswählen-Modus
      if (e.target.classList.contains('seat')) return;
      if (e.target.closest && e.target.closest('.arch, .arch-handle')) return;

      const rect   = stage.getBoundingClientRect();
      const t      = getTransform();
      const startX = (e.clientX - rect.left) / t.zoom;
      const startY = (e.clientY - rect.top)  / t.zoom;

      _lasso = { startX, startY, x: startX, y: startY, w: 0, h: 0 };
      lassoEl.style.display = 'block';
      lassoEl.style.left   = startX + 'px';
      lassoEl.style.top    = startY + 'px';
      lassoEl.style.width  = '0px';
      lassoEl.style.height = '0px';

      function onMove(me) {
        if (!_lasso) return;
        const cx = (me.clientX - rect.left) / t.zoom;
        const cy = (me.clientY - rect.top)  / t.zoom;
        const lx = Math.min(cx, _lasso.startX);
        const ly = Math.min(cy, _lasso.startY);
        const lw = Math.abs(cx - _lasso.startX);
        const lh = Math.abs(cy - _lasso.startY);
        _lasso.x = lx; _lasso.y = ly; _lasso.w = lw; _lasso.h = lh;
        lassoEl.style.left   = lx + 'px';
        lassoEl.style.top    = ly + 'px';
        lassoEl.style.width  = lw + 'px';
        lassoEl.style.height = lh + 'px';
      }

      function onUp() {
        if (!_lasso) return;
        lassoEl.style.display = 'none';
        // Find seats inside lasso rect
        const { x, y, w, h } = _lasso;
        const inside = getAll()
          .filter(s => s.x >= x && s.x <= x + w && s.y >= y && s.y <= y + h)
          .map(s => s.id);
        if (inside.length > 0) {
          if (e.ctrlKey || e.metaKey) {
            selectMany(inside);
          } else {
            _selectedIds = inside;
            _onChange('selection-changed', _selectedIds);
          }
        } else {
          if (!e.ctrlKey && !e.metaKey) clearSelection();
        }
        _lasso = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  /* ── Seat edit modal ──────────────────────────────────────── */
  let _editingSeatId = null;

  function openSeatModal(id) {
    const seat = _getState().seats.find(s => s.id === id);
    if (!seat) return;
    _editingSeatId = id;

    document.getElementById('modal-seat-label').value  = seat.label;
    document.getElementById('modal-seat-status').value = seat.status;
    document.getElementById('modal-seat-type').value   = seat.type;
    document.getElementById('modal-seat-share').value  = seat.shareFactor || 1.0;
    document.getElementById('modal-seat-room').value   = seat.room || '';
    document.getElementById('modal-seat-equipment').value = seat.equipment || '';
    document.getElementById('modal-seat-note').value      = seat.equipmentNote || '';

    const sfWrap = document.getElementById('share-factor-wrap');
    sfWrap.style.display = seat.type === 'flex' ? 'block' : 'none';

    document.getElementById('modal-seat').style.display = 'flex';
  }

  function saveSeatModal() {
    if (!_editingSeatId) return;
    const type = document.getElementById('modal-seat-type').value;
    updateSeat(_editingSeatId, {
      label:       document.getElementById('modal-seat-label').value.trim(),
      status:      document.getElementById('modal-seat-status').value,
      type:        type,
      shareFactor: parseFloat(document.getElementById('modal-seat-share').value) || 1.0,
      room:        document.getElementById('modal-seat-room').value.trim(),
      equipment:   document.getElementById('modal-seat-equipment').value,
      equipmentNote: document.getElementById('modal-seat-note').value.trim()
    });
    _editingSeatId = null;
    document.getElementById('modal-seat').style.display = 'none';
  }

  /* ── Detail panel (sidebar) ───────────────────────────────── */
  function renderDetailPanel() {
    const container = document.getElementById('seat-detail');
    if (!container) return;

    const ids = _selectedIds;
    if (ids.length === 0) {
      container.innerHTML = '<p class="muted">Kein Platz ausgewählt.</p>';
      return;
    }

    const seats  = getAll().filter(s => ids.includes(s.id));
    const teams  = _getState().teams || [];
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

    if (ids.length === 1) {
      const s = seats[0];
      const team = s.teamId ? teamMap[s.teamId] : null;
      const statusLabel = { free: 'Frei', occupied: 'Belegt', reserved: 'Reserviert', blocked: 'Blockiert' };
      container.innerHTML = `
        <div class="detail-row"><span class="detail-label">Platz</span><span class="detail-value">${escHtml(s.label)}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${statusLabel[s.status] || s.status}</span></div>
        <div class="detail-row"><span class="detail-label">Raum</span><span class="detail-value">${s.room ? escHtml(s.room) : '—'}</span></div>
        <div class="detail-row"><span class="detail-label">Typ</span><span class="detail-value">${s.type === 'flex' ? 'Flex (×' + s.shareFactor + ')' : 'Fest'}</span></div>
        <div class="detail-row"><span class="detail-label">Ausstattung</span><span class="detail-value">${escHtml(EQUIPMENT_LABEL[s.equipment] || 'Standard')}</span></div>
        ${s.equipmentNote ? `<div class="detail-row"><span class="detail-label">Notiz</span><span class="detail-value">${escHtml(s.equipmentNote)}</span></div>` : ''}
        <div class="detail-row"><span class="detail-label">Team</span><span class="detail-value">${team ? escHtml(team.name) : '—'}</span></div>
        <div class="detail-row"><span class="detail-label">Position</span><span class="detail-value">${s.x}, ${s.y}</span></div>
      `;
    } else {
      container.innerHTML = `
        <div class="detail-row"><span class="detail-label">Ausgewählt</span><span class="detail-value">${ids.length} Plätze</span></div>
        <div class="detail-row"><span class="detail-label">Doppelklick</span><span class="detail-value">Einzel bearbeiten</span></div>
      `;
    }
  }

  /* ── Jump to seat ─────────────────────────────────────────── */
  function jumpToSeat(query, getZoom, setPan) {
    const seat = getAll().find(s =>
      s.label.toLowerCase() === query.toLowerCase().trim()
    );
    if (!seat) return false;

    const vp = document.getElementById('plan-viewport');
    const vpW = vp.clientWidth;
    const vpH = vp.clientHeight;
    const zoom = getZoom();
    const panX = vpW / 2 - seat.x * zoom;
    const panY = vpH / 2 - seat.y * zoom;
    setPan(panX, panY);

    // Briefly highlight
    const el = _seatEls.get(seat.id);
    if (el) {
      el.classList.add('jump-target');
      setTimeout(() => el.classList.remove('jump-target'), 2000);
    }

    _selectedIds = [seat.id];
    _onChange('selection-changed', _selectedIds);
    return true;
  }

  /* ── Rooms ────────────────────────────────────────────────── */
  function getRooms() {
    const set = new Set();
    for (const s of getAll()) if (s.room) set.add(s.room);
    return [...set].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  }

  /* ── Utility ──────────────────────────────────────────────── */
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    init,
    addSeat, updateSeat, deleteSeats, getAll,
    generateGrid,
    select, selectMany, clearSelection, getSelectedIds,
    setHighlightTeam, getHighlightTeam,
    setFilter, clearFilter,
    render, renderDetailPanel,
    initDragHandlers, initLasso,
    openSeatModal, saveSeatModal,
    getRooms,
    jumpToSeat
  };
})();
