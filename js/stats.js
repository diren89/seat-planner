/* ═══════════════════════════════════════════════════════════════
   stats.js  –  Auslastung & Bedarfs-Berechnung, Rendering
   ═══════════════════════════════════════════════════════════════ */

const Stats = (() => {

  let _getState;

  function init(getState) {
    _getState = getState;
  }

  /* ── Compute ───────────────────────────────────────────────── */

  /**
   * Returns effective capacity for a seat (respects sharing factor for flex).
   * A flex seat with shareFactor=1.5 counts as 1.5 persons for one physical seat.
   */
  function effectiveCapacity(seat) {
    return seat.type === 'flex' ? (parseFloat(seat.shareFactor) || 1) : 1;
  }

  function compute() {
    const { seats } = _getState();
    const teams = (typeof Teams !== 'undefined') ? Teams.getAll() : (_getState().teams || []);

    const total     = seats.length;
    const occupied  = seats.filter(s => s.status === 'occupied').length;
    const free      = seats.filter(s => s.status === 'free').length;
    const reserved  = seats.filter(s => s.status === 'reserved').length;
    const blocked   = seats.filter(s => s.status === 'blocked').length;

    // Utilization: (occupied / usable) * 100, usable = total - blocked
    const usable    = total - blocked;
    const utilPct   = usable > 0 ? Math.round((occupied / usable) * 100) : 0;

    // Per-team
    const teamStats = (teams || []).map(team => {
      const teamSeats  = seats.filter(s => s.teamId === team.id);
      const tTotal     = teamSeats.length;
      const tOccupied  = teamSeats.filter(s => s.status === 'occupied').length;
      const tFree      = teamSeats.filter(s => s.status === 'free').length;
      const tReserved  = teamSeats.filter(s => s.status === 'reserved').length;
      const tBlocked   = teamSeats.filter(s => s.status === 'blocked').length;

      // Effective capacity (sum, respecting sharing factor)
      const tEffective = teamSeats.reduce((acc, s) => acc + effectiveCapacity(s), 0);

      const demand     = team.demand || 0;
      let coverage     = 'unset'; // unset | ok | over | under
      if (demand > 0) {
        if (tEffective >= demand)       coverage = 'ok';
        else if (tEffective > demand * 0.8) coverage = 'under';
        else                            coverage = 'under';
        if (tEffective > demand)        coverage = 'over';
      }

      return {
        team, tTotal, tOccupied, tFree, tReserved, tBlocked,
        tEffective: Math.round(tEffective * 10) / 10,
        demand, coverage
      };
    });

    return { total, occupied, free, reserved, blocked, usable, utilPct, teamStats };
  }

  /* ── Render ────────────────────────────────────────────────── */
  function render() {
    const d = compute();

    setText('stat-total-seats', d.total);
    setText('stat-occupied',    d.occupied);
    setText('stat-free',        d.free);
    setText('stat-reserved',    d.reserved);
    setText('stat-blocked',     d.blocked);
    setText('stat-utilization', d.utilPct + ' %');

    const bar = document.getElementById('stat-progress');
    if (bar) {
      bar.style.width = d.utilPct + '%';
      bar.style.background =
        d.utilPct >= 90 ? 'var(--danger)' :
        d.utilPct >= 70 ? 'var(--warn)'   : 'var(--success)';
    }

    // Team cards
    const container = document.getElementById('stats-teams-list');
    if (!container) return;

    if (d.teamStats.length === 0) {
      container.innerHTML = '<p class="muted" style="margin-top:8px;">Noch keine Teams angelegt.</p>';
      return;
    }

    container.innerHTML = d.teamStats.map(ts => {
      const { team, tTotal, tOccupied, tFree, tReserved, tBlocked, tEffective, demand, coverage } = ts;

      const badgeMap = {
        ok:    { cls: 'badge-ok',    label: 'Gedeckt' },
        over:  { cls: 'badge-over',  label: 'Überkapaz.' },
        under: { cls: 'badge-under', label: 'Unterdeckung' },
        unset: { cls: 'badge-unset', label: 'Kein Ziel' }
      };
      const badge = badgeMap[coverage] || badgeMap.unset;

      const demandRow = demand > 0
        ? `<div class="stats-team-row"><span>Bedarf</span><strong>${demand} Plätze</strong></div>
           <div class="stats-team-row"><span>Effektiv verfügbar</span><strong>${tEffective}</strong></div>
           <div class="stats-team-row"><span>Differenz</span><strong style="color:${coverage === 'under' ? 'var(--danger)' : coverage === 'over' ? 'var(--warn)' : 'var(--success)'};">${tEffective - demand >= 0 ? '+' : ''}${Math.round((tEffective - demand) * 10) / 10}</strong></div>`
        : `<div class="stats-team-row"><span>Effektiv verfügbar</span><strong>${tEffective}</strong></div>`;

      return `
        <div class="stats-team-card">
          <div class="stats-team-header">
            <div class="stats-team-swatch" style="background:${team.color};"></div>
            <span class="stats-team-name">${escHtml(team.name)}</span>
            <span class="stats-team-badge ${badge.cls}">${badge.label}</span>
          </div>
          <div class="stats-team-row"><span>Plätze gesamt</span><strong>${tTotal}</strong></div>
          <div class="stats-team-row"><span>Belegt</span><strong>${tOccupied}</strong></div>
          <div class="stats-team-row"><span>Frei</span><strong>${tFree}</strong></div>
          <div class="stats-team-row"><span>Reserviert</span><strong>${tReserved}</strong></div>
          <div class="stats-team-row"><span>Blockiert</span><strong>${tBlocked}</strong></div>
          ${demandRow}
        </div>`;
    }).join('');
  }

  /* ── Helpers ──────────────────────────────────────────────── */
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init, compute, render };
})();
