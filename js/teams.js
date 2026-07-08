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
    return _getState().teams.find(t => t.id === id && t.kind !== 'section') || null;
  }

  /** Real teams only (sections filtered out) — used by all team logic. */
  function getAll() {
    return _getState().teams.filter(t => t.kind !== 'section');
  }

  /** Full ordered list incl. section dividers — used for the list UI + reorder. */
  function getItems() {
    return _getState().teams;
  }

  /* ── Sections (dividers stored inline in the teams array) ──── */
  function addSection(name) {
    const state = _getState();
    const section = {
      id: 'S' + Math.random().toString(36).slice(2, 9),
      kind: 'section',
      name: (name || 'Neuer Abschnitt').trim(),
      color: Colorgen.palette(1)[0]
    };
    _setState({ ...state, teams: [...state.teams, section] });
    _onChange('section-added', section);
    return section;
  }

  /** Rename a team or a section by id. */
  function renameItem(id, name) {
    const state = _getState();
    const nm = (name || '').trim();
    if (!nm) return;
    _setState({ ...state, teams: state.teams.map(t => t.id === id ? { ...t, name: nm } : t) });
    _onChange('item-renamed', id);
  }

  /** Set the color of a team or a section (one code path for both). */
  function updateItemColor(id, color) {
    const state = _getState();
    _setState({ ...state, teams: state.teams.map(t => t.id === id ? { ...t, color } : t) });
    _onChange('item-color-updated', id);
  }

  /** Generate harmonious-but-distinguishable colors for every team inside
   *  a section (from the section to the next section/end), based on the
   *  section's own color. One setState call = one undo step. */
  function generateSectionTeamColors(sectionId) {
    const state = _getState();
    const arr = state.teams;
    const from = arr.findIndex(t => t.id === sectionId);
    if (from === -1 || arr[from].kind !== 'section') return 0;
    let to = from + 1;
    while (to < arr.length && arr[to].kind !== 'section') to++;
    const memberIds = arr.slice(from + 1, to).map(t => t.id);
    if (memberIds.length === 0) return 0;

    const colors = Colorgen.shades(arr[from].color, memberIds.length);
    const colorMap = new Map(memberIds.map((id, i) => [id, colors[i]]));

    _setState({ ...state, teams: arr.map(t => colorMap.has(t.id) ? { ...t, color: colorMap.get(t.id) } : t) });
    _onChange('section-colors-generated', sectionId);
    return memberIds.length;
  }

  /** Delete a team or section by id (teams also get unassigned from seats). */
  function deleteItem(id) {
    const state = _getState();
    const item = state.teams.find(t => t.id === id);
    if (!item) return;
    if (item.kind === 'section') {
      _setState({ ...state, teams: state.teams.filter(t => t.id !== id) });
    } else {
      const seats = state.seats.map(s => s.teamId === id ? { ...s, teamId: null } : s);
      _setState({ ...state, teams: state.teams.filter(t => t.id !== id), seats });
    }
    _onChange('item-deleted', id);
  }

  /** Move item `draggedId` before/after `targetId`. Dragging a section moves
   *  the whole block (section + its teams up to the next section). */
  function reorder(draggedId, targetId, before) {
    if (draggedId === targetId) return;
    const state = _getState();
    const arr = [...state.teams];
    const from = arr.findIndex(t => t.id === draggedId);
    if (from === -1) return;

    // Block size: a section grabs its member teams until the next section.
    let count = 1;
    if (arr[from].kind === 'section') {
      let j = from + 1;
      while (j < arr.length && arr[j].kind !== 'section') j++;
      count = j - from;
    }

    // Don't drop a block onto itself.
    const toIdx = arr.findIndex(t => t.id === targetId);
    if (toIdx >= from && toIdx < from + count) return;

    const block = arr.splice(from, count);
    let to = arr.findIndex(t => t.id === targetId);
    if (to === -1) { arr.push(...block); }
    else { arr.splice(before ? to : to + 1, 0, ...block); }
    _setState({ ...state, teams: arr });
    _onChange('teams-reordered', draggedId);
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
    const items = getItems();
    const seats = _getState().seats;

    // Highlight the teams assigned to the currently selected room
    const hi = new Set();
    if (typeof Elements !== 'undefined') {
      const el = Elements.get(Elements.getSelectedId());
      if (el && el.kind === 'room') (el.teamIds || []).forEach(id => hi.add(id));
    }
    // Team whose seats are currently highlighted on the plan
    const hlTeam = (typeof Seats !== 'undefined' && Seats.getHighlightTeam) ? Seats.getHighlightTeam() : '';

    let underSection = false;   // teams after a divider are indented
    list.innerHTML = items.length
      ? items.map(t => {
          if (t.kind === 'section') {
            underSection = true;
            return `
            <li class="team-section" draggable="true" data-id="${t.id}">
              <span class="drag-handle" title="Ziehen zum Sortieren">${Icons.get('drag')}</span>
              <button class="section-swatch" data-id="${t.id}" style="background:${t.color || '#93a8b2'};" title="Abschnittsfarbe wählen" aria-label="Abschnittsfarbe wählen"></button>
              <span class="section-name">${escHtml(t.name)}</span>
              <button class="btn-section-generate" data-id="${t.id}" title="Teamfarben aus Abschnittsfarbe generieren" aria-label="Teamfarben aus Abschnittsfarbe generieren">${Icons.get('magic-wand')}</button>
              <button class="btn-section-delete" data-id="${t.id}" title="Abschnitt löschen" aria-label="Abschnitt löschen">${Icons.get('trash')}</button>
            </li>`;
          }
          const count    = seats.filter(s => s.teamId === t.id).length;
          const demand   = t.demand || 0;
          // Demand coloring: red + explicit shortfall when under, green when met
          let demandTxt = demand > 0 ? `${count}/${demand}` : `${count}`;
          let demandCls = '';
          if (demand > 0 && count < demand) { demandCls = ' demand-under'; demandTxt += ` · fehlt ${demand - count}`; }
          else if (demand > 0)              { demandCls = ' demand-met'; }
          const cls = 'team-item' + (underSection ? ' under-section' : '') + (hi.has(t.id) ? ' room-team' : '') + (t.id === hlTeam ? ' seats-highlighted' : '');
          return `
            <li class="${cls}" draggable="true" data-id="${t.id}">
              <span class="drag-handle" title="Ziehen zum Sortieren">${Icons.get('drag')}</span>
              <span class="team-swatch" style="background:${t.color};"></span>
              <span class="team-name" title="Zugewiesene Plätze markieren">${escHtml(t.name)}</span>
              <span class="team-meta${demandCls}">${demandTxt} Plätze</span>
              <div class="team-actions">
                <button class="btn-team-edit" data-id="${t.id}" title="Bearbeiten" aria-label="Team bearbeiten">${Icons.get('edit')}</button>
                <button class="btn-team-delete" data-id="${t.id}" title="Löschen" aria-label="Team löschen">${Icons.get('trash')}</button>
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
    const exportSel = document.getElementById('export-team-select');
    if (exportSel) {
      const prev = exportSel.value;
      exportSel.innerHTML = '<option value="">-- Team wählen --</option>' + opts;
      if (prev) exportSel.value = prev;
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
    const trigger = document.getElementById('modal-team-color-trigger');
    if (trigger) trigger.style.background = team.color;
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
    getItems, addSection, renameItem, deleteItem, reorder,
    updateItemColor, generateSectionTeamColors,
    assignSeats,
    renderList, renderAssignSelect,
    openEditModal, saveEditModal
  };
})();
