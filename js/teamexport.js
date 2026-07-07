/* ═══════════════════════════════════════════════════════════════
   teamexport.js  –  JPG exports of the plan.
   - Team export: team seats pink, all others anthracite.
   - Full-plan export: every seat in its team color + legend header.
   Floor-aware: one image per floor. Read-only (no setState).
   ═══════════════════════════════════════════════════════════════ */

const TeamExport = (() => {
  'use strict';

  const SIZE = 34;
  const PINK = '#ffbcdf';      // team seats (team export)
  const DARK = '#29363c';      // other seats (anthracite)
  const GREY = '#d0dade';      // unassigned seats (full-plan export)
  const FONT = '-apple-system, "Segoe UI", Roboto, sans-serif';

  /* Fallback floor for legacy states without floors[] */
  const FALLBACK_FLOOR = { id: 'og2', name: '2. OG', image: 'floorplan/plan-2og.jpg', w: 1139, h: 1349 };

  const _bgCache = new Map();   // url -> Image

  function _loadBg(url) {
    if (!url) return Promise.resolve(null);
    if (_bgCache.has(url)) return Promise.resolve(_bgCache.get(url));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { _bgCache.set(url, img); resolve(img); };
      img.onerror = () => reject(new Error('Hintergrundbild konnte nicht geladen werden: ' + url));
      img.src = url;
    });
  }

  function _floors() {
    // floors provided by the app via setFloors(); fallback keeps old behavior
    return (_floorsProvider ? _floorsProvider() : null) || [FALLBACK_FLOOR];
  }
  let _floorsProvider = null;
  function setFloors(fn) { _floorsProvider = fn; }

  function _seatsOf(floor) {
    const seats = (typeof Seats !== 'undefined') ? Seats.getAll() : [];
    return seats.filter(s => !s.floorId || s.floorId === floor.id);
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function _drawSeat(ctx, s, headOffset, fill, textColor) {
    _roundRect(ctx, s.x - SIZE / 2, s.y - SIZE / 2 + headOffset, SIZE, SIZE, 4);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = '700 9px ' + FONT;
    ctx.fillText(String(s.label || ''), s.x, s.y + headOffset);
  }

  /* Perceived brightness → dark or light label text */
  function _labelColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#ffffff';
    const n = parseInt(m[1], 16);
    const lum = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
    return lum > 140 ? DARK : '#ffffff';
  }

  /* ── Team export (one JPG per floor that has team seats) ────── */
  async function renderCanvas(teamId, floor) {
    floor = floor || _floors()[0];
    const HEAD = 56;
    const bg = await _loadBg(floor.image).catch(() => null);
    const team = (typeof Teams !== 'undefined') ? Teams.getTeam(teamId) : null;
    const seats = _seatsOf(floor);
    const mine = seats.filter(s => s.teamId === teamId);

    const canvas = document.createElement('canvas');
    canvas.width = floor.w;
    canvas.height = floor.h + HEAD;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, floor.w, floor.h + HEAD);
    if (bg) ctx.drawImage(bg, 0, HEAD, floor.w, floor.h);

    ctx.fillStyle = DARK;
    ctx.textBaseline = 'middle';
    ctx.font = '700 24px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText((team ? team.name : 'Team') + '  —  ' + floor.name + '  —  ' + mine.length + ' Plätze', 20, HEAD / 2);

    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    for (const s of seats) {
      const isMine = s.teamId === teamId;
      _drawSeat(ctx, s, HEAD, isMine ? PINK : DARK, isMine ? DARK : '#ffffff');
    }
    return canvas;
  }

  /* ── Full-plan export (all teams in their colors + legend) ──── */
  async function renderFullPlan(floor) {
    const bg = await _loadBg(floor.image).catch(() => null);
    const seats = _seatsOf(floor);
    const teams = (typeof Teams !== 'undefined') ? Teams.getAll() : [];
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const usedTeams = teams.filter(t => seats.some(s => s.teamId === t.id));

    // Header height: title row + wrapping legend rows
    const CHIP_H = 22, PAD = 20, TITLE_H = 44;
    const ctxMeasure = document.createElement('canvas').getContext('2d');
    ctxMeasure.font = '600 13px ' + FONT;
    let lx = PAD, rows = usedTeams.length ? 1 : 0;
    const chipPos = usedTeams.map(t => {
      const w = 16 + 6 + ctxMeasure.measureText(t.name).width + 14;
      if (lx + w > floor.w - PAD) { lx = PAD; rows++; }
      const pos = { x: lx, row: rows };
      lx += w;
      return { t, ...pos, w };
    });
    const HEAD = TITLE_H + rows * (CHIP_H + 6) + 8;

    const canvas = document.createElement('canvas');
    canvas.width = floor.w;
    canvas.height = floor.h + HEAD;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, floor.w, floor.h + HEAD);
    if (bg) ctx.drawImage(bg, 0, HEAD, floor.w, floor.h);

    // Title + date
    const date = new Date().toLocaleDateString('de-DE');
    ctx.fillStyle = DARK;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '700 24px ' + FONT;
    ctx.fillText('Gesamtplan — ' + floor.name + ' — ' + date, PAD, TITLE_H / 2 + 6);

    // Legend chips
    ctx.font = '600 13px ' + FONT;
    for (const c of chipPos) {
      const y = TITLE_H + (c.row - 1) * (CHIP_H + 6);
      ctx.fillStyle = c.t.color;
      _roundRect(ctx, c.x, y, 16, 16, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = DARK;
      ctx.fillText(c.t.name, c.x + 22, y + 9);
    }

    // Seats in team colors, unassigned light grey
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    for (const s of seats) {
      const team = s.teamId ? teamMap[s.teamId] : null;
      const fill = team ? team.color : GREY;
      _drawSeat(ctx, s, HEAD, fill, _labelColor(fill));
    }
    return canvas;
  }

  /* ── Download helpers ─────────────────────────────────────── */
  function _safe(name) {
    return String(name || 'Export').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Export';
  }

  function _download(canvas, filename) {
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      }, 'image/jpeg', 0.92);
    });
  }

  const _pause = ms => new Promise(r => setTimeout(r, ms));   // download throttle

  /* ── Public exports ───────────────────────────────────────── */
  async function exportTeam(teamId) {
    const team = (typeof Teams !== 'undefined') ? Teams.getTeam(teamId) : null;
    if (!team) return 0;
    const floors = _floors().filter(f => _seatsOf(f).some(s => s.teamId === teamId));
    const list = floors.length ? floors : [_floors()[0]];
    const multi = list.length > 1;
    for (const f of list) {
      const canvas = await renderCanvas(teamId, f);
      await _download(canvas, 'Team_' + _safe(team.name) + (multi ? '_' + _safe(f.name) : '') + '.jpg');
      if (multi) await _pause(300);
    }
    return list.length;
  }

  async function exportAll() {
    const teams = (typeof Teams !== 'undefined') ? Teams.getAll() : [];
    for (const t of teams) {
      await exportTeam(t.id);
      await _pause(300);
    }
    return teams.length;
  }

  async function exportFullPlan() {
    const floors = _floors().filter(f => _seatsOf(f).length > 0);
    const list = floors.length ? floors : [_floors()[0]];
    for (const f of list) {
      const canvas = await renderFullPlan(f);
      await _download(canvas, 'Gesamtplan_' + _safe(f.name) + '.jpg');
      if (list.length > 1) await _pause(300);
    }
    return list.length;
  }

  return { setFloors, renderCanvas, renderFullPlan, exportTeam, exportAll, exportFullPlan };
})();
