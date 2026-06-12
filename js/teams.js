/* ═══════════════════════════════════════════════════════════════
   teams.js  –  Team CRUD, list rendering, assign-UI
   ═══════════════════════════════════════════════════════════════ */

const Teams = (() => {

  /* ── Helpers ──────────────────────────────────────────────── */
  function uid() {
    return 'T' + Math.random().toString(36).slice(2, 9);
  }

  /* ── State accessors (injected by App) ───────────────────── */
  let _getState, _setState, _onChange;

  function init(getState, setState, onChange) {
    _getState  = getState;
    _setState  = setState;
    _onChange  = onChange;
  }

  /* ── CRUD ─────────────────────────────────────────────────── */
  function addTeam(name, color, demand) {
    const state = _getState();
    const team = {
      id:     uid(),
      name:   name.trim(),
      color:  color,
      demand: parseInt(demand, 10) || 0
    };
    _setState({ ...state, teams: [...state.teams, team] });
    _onChange('team-added', team);
    return team;
  }

  function updateTeam(id, patch) {
    const state = _getState();
    _setState({
      ...state,
      teams: state.teams.map(t => t.id === id ? { ...t, ...patch } : t)
    });
    _onChange('team-updated', id);
  }

  function deleteTeam(id) {
    const state = _getState();
    // Remove team from all seats
    const seats = state.seats.map(s =>
      s.teamId === id ? { ...s, teamId: null } : s
    );
    _setState({
      ...state,
      teams: state.teams.filter(t => t.id !== id),
      seats
    });
    _onChange('team-deleted', id);
  }

  function getTeam(id) {
    return _getState().teams.find(t => t.id === id) || null;
  }

  function getAll() {
    return _getState().teams;
  }

  /* ── Assign seats to team ─────────────────────────────────── */
  function assignSeats(seatIds, teamId) {
    const state = _getState();
    const seats = state.seats.map(s =>
      seatIds.includes(s.id) ? { ...s, teamId: teamId || null } : s
    );
    _setState({ ...state, seats });
    _onChange('seats-assigned', { seatIds, teamId });
  }

  /* ── Render ───────────────────────────────────────────────── */
  function renderList() {
    const list = document.getElementById('team-list');
    if (!list) return;
    const teams = getAll();
    const seats = _getState().seats;

    list.innerHTML = teams.length
      ? teams.map(t => {
          const count    = seats.filter(s => s.teamId === t.id).length;
          const demand   = t.demand || 0;
          const demandTxt = demand > 0 ? `${count}/${demand}` : `${count}`;
          return `
            <li class="team-item" data-id="${t.id}">
              <span class="team-swatch" style="background:${t.color};"></span>
              <span class="team-name">${escHtml(t.name)}</span>
              <span class="team-meta">${demandTxt} Plätze</span>
              <div class="team-actions">
                <button class="btn-team-edit" data-id="${t.id}" title="Bearbeiten">&#9998;</button>
                <button class="btn-team-delete" data-id="${t.id}" title="Löschen">&times;</button>
              </div>
            </li>`;
        }).join('')
      : '<li class="muted" style="padding:8px 0;">Noch keine Teams angelegt.</li>';
  }

  function renderAssignSelect() {
    const sel = document.getElementById('assign-team-select');
    const filterSel = document.getElementById('filter-team-select');
    if (!sel) return;
    const teams = getAll();
    const opts = teams.map(t =>
      `<option value="${t.id}" style="background:${t.color};">${escHtml(t.name)}</option>`
    ).join('');
    sel.innerHTML = '<option value="">-- Team wählen --</option>' + opts;

    if (filterSel) {
      filterSel.innerHTML = '<option value="">Alle Teams</option>' + opts;
    }
  }

  /* ── Modal helpers ────────────────────────────────────────── */
  let _editingTeamId = null;

  function openEditModal(id) {
    const team = getTeam(id);
    if (!team) return;
    _editingTeamId = id;
    document.getElementById('modal-team-name').value   = team.name;
    document.getElementById('modal-team-color').value  = team.color;
    document.getElementById('modal-team-demand').value = team.demand || 0;
    document.getElementById('modal-team').style.display = 'flex';
  }

  function saveEditModal() {
    if (!_editingTeamId) return;
    updateTeam(_editingTeamId, {
      name:   document.getElementById('modal-team-name').value.trim(),
      color:  document.getElementById('modal-team-color').value,
      demand: parseInt(document.getElementById('modal-team-demand').value, 10) || 0
    });
    _editingTeamId = null;
    document.getElementById('modal-team').style.display = 'none';
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
    addTeam, updateTeam, deleteTeam, getTeam, getAll,
    assignSeats,
    renderList, renderAssignSelect,
    openEditModal, saveEditModal
  };
})();
