/* ═══════════════════════════════════════════════════════════════
   search.js  –  Global header search: seats, teams, rooms.
   Read-only (no setState) → works on locked plans too.
   ═══════════════════════════════════════════════════════════════ */

const Search = (() => {
  'use strict';

  const MAX_RESULTS = 8;
  let _getZoom, _setPan, _refresh;
  let _getActiveFloor = () => null, _setActiveFloor = () => {}, _getFloors = () => [];

  function _floorName(id) {
    const f = _getFloors().find(x => x.id === id);
    return f ? f.name : '';
  }

  /* Switch to the entity's floor before jumping/highlighting */
  function _ensureFloor(floorId) {
    if (floorId && floorId !== _getActiveFloor()) _setActiveFloor(floorId);
  }
  let _results = [];        // current result objects
  let _activeIdx = -1;      // keyboard-highlighted row

  /* ── Query over the three sources ─────────────────────────── */
  function query(q) {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];

    // Collect per source, then merge with reserved slots so seat matches
    // can't crowd out team/room hits (e.g. searching a room name).
    const multiFloor = _getFloors().length > 1;
    const seats = [], teams = [], rooms = [];
    for (const s of Seats.getAll()) {
      const hay = `${s.label} ${s.room || ''} ${s.equipmentNote || ''}`.toLowerCase();
      if (hay.includes(needle)) {
        const sub = [s.room, multiFloor ? _floorName(s.floorId) : ''].filter(Boolean).join(' · ');
        seats.push({ type: 'seat', id: s.id, name: s.label, sub, floorId: s.floorId });
      }
      if (seats.length >= MAX_RESULTS) break;
    }
    for (const t of Teams.getAll()) {
      if (t.name.toLowerCase().includes(needle)) teams.push({ type: 'team', id: t.id, name: t.name, color: t.color });
    }
    for (const el of Elements.getAll()) {
      if (el.kind === 'room' && (el.label || '').toLowerCase().includes(needle)) {
        rooms.push({ type: 'room', id: el.id, name: el.label, sub: multiFloor ? _floorName(el.floorId) : '', floorId: el.floorId });
      }
    }
    const teamsCut = teams.slice(0, 2);
    const roomsCut = rooms.slice(0, 2);
    const seatsCut = seats.slice(0, MAX_RESULTS - teamsCut.length - roomsCut.length);
    return [...teamsCut, ...roomsCut, ...seatsCut];
  }

  /* ── Result actions ───────────────────────────────────────── */
  function _panToCenter(x, y) {
    const vp = document.getElementById('plan-viewport');
    const zoom = _getZoom();
    _setPan(vp.clientWidth / 2 - x * zoom, vp.clientHeight / 2 - y * zoom);
  }

  function activate(res) {
    if (!res) return;
    if (res.type === 'seat') {
      const seat = Seats.getAll().find(s => s.id === res.id);
      if (!seat) return;
      _ensureFloor(seat.floorId);
      Seats.select(seat.id);
      Seats.jumpToSeat(seat.label, _getZoom, _setPan);
      _refresh();
    } else if (res.type === 'team') {
      if (Seats.getHighlightTeam() !== res.id) Seats.setHighlightTeam(res.id);
      _refresh();
      // Bring the Teams tab (and the row) into view
      document.querySelector('.tab-btn[data-tab="tab-teams"]')?.click();
      document.querySelector(`#team-list li[data-id="${res.id}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (res.type === 'room') {
      const el = Elements.get(res.id);
      if (!el) return;
      _ensureFloor(el.floorId);
      Elements.selectElement(el.id);
      _panToCenter(el.x + el.w / 2, el.y + el.h / 2);
      _refresh();
    }
    close();
  }

  /* ── Dropdown rendering ───────────────────────────────────── */
  const TYPE_LABEL = { seat: 'Platz', team: 'Team', room: 'Raum' };
  const TYPE_ICON  = { seat: 'add-alt', team: 'user', room: 'area' };

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderResults() {
    const ul = document.getElementById('global-search-results');
    if (!_results.length) {
      const q = document.getElementById('global-search-input').value.trim();
      ul.innerHTML = q ? '<li class="muted">Keine Treffer.</li>' : '';
      ul.hidden = !q;
      return;
    }
    ul.innerHTML = _results.map((r, i) => `
      <li role="option" data-idx="${i}" aria-selected="${i === _activeIdx}">
        ${r.color ? `<span class="result-swatch" style="background:${r.color};"></span>` : Icons.get(TYPE_ICON[r.type])}
        <span class="result-name">${_esc(r.name)}${r.sub ? ` <span class="result-type">· ${_esc(r.sub)}</span>` : ''}</span>
        <span class="result-type">${TYPE_LABEL[r.type]}</span>
      </li>`).join('');
    ul.hidden = false;
  }

  function close() {
    const ul = document.getElementById('global-search-results');
    ul.hidden = true;
    _results = [];
    _activeIdx = -1;
  }

  /* ── Init / wiring ────────────────────────────────────────── */
  function init({ getZoom, setPan, refresh, getActiveFloor, setActiveFloor, getFloors }) {
    _getZoom = getZoom; _setPan = setPan; _refresh = refresh;
    if (getActiveFloor) _getActiveFloor = getActiveFloor;
    if (setActiveFloor) _setActiveFloor = setActiveFloor;
    if (getFloors)      _getFloors = getFloors;
    const input = document.getElementById('global-search-input');
    const ul = document.getElementById('global-search-results');
    if (!input || !ul) return;

    input.addEventListener('input', () => {
      _results = query(input.value);
      _activeIdx = _results.length ? 0 : -1;
      renderResults();
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (_results.length) { _activeIdx = (_activeIdx + 1) % _results.length; renderResults(); }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (_results.length) { _activeIdx = (_activeIdx - 1 + _results.length) % _results.length; renderResults(); }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        activate(_results[_activeIdx]);
      } else if (e.key === 'Escape') {
        close();
        input.blur();
      }
    });

    ul.addEventListener('mousedown', e => {
      const li = e.target.closest('li[data-idx]');
      if (li) { e.preventDefault(); activate(_results[+li.dataset.idx]); }
    });

    // Click outside closes the dropdown
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('.global-search')) close();
    });
  }

  return { init, query, activate };
})();
