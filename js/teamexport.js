/* ═══════════════════════════════════════════════════════════════
   teamexport.js  –  Export team seat-assignment as JPG.
   Team seats = JobRad pink, all other seats = anthracite.
   Single team + batch (one JPG per team). Read-only (no setState).
   ═══════════════════════════════════════════════════════════════ */

const TeamExport = (() => {
  'use strict';

  const W = 1139, H = 1349, HEAD = 56, SIZE = 34;
  const PINK = '#ffbcdf';      // team seats
  const DARK = '#29363c';      // other seats (anthracite)
  const BG_SRC = 'floorplan/plan-2og.jpg';

  let _bg = null;

  function _loadBg() {
    if (_bg) return Promise.resolve(_bg);
    return new Promise((resolve, reject) => {
      const cur = document.getElementById('floorplan-img');
      if (cur && cur.complete && cur.naturalWidth > 0) { _bg = cur; resolve(_bg); return; }
      const img = new Image();
      img.onload  = () => { _bg = img; resolve(_bg); };
      img.onerror = () => reject(new Error('Hintergrundbild konnte nicht geladen werden.'));
      img.src = (cur && cur.getAttribute('src')) || BG_SRC;
    });
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

  async function renderCanvas(teamId) {
    const bg = await _loadBg();
    const team = (typeof Teams !== 'undefined') ? Teams.getTeam(teamId) : null;
    const seats = (typeof Seats !== 'undefined') ? Seats.getAll() : [];
    const mine = seats.filter(s => s.teamId === teamId);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H + HEAD;
    const ctx = canvas.getContext('2d');

    // page + header band
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H + HEAD);
    ctx.drawImage(bg, 0, HEAD, W, H);

    // header text
    ctx.fillStyle = DARK;
    ctx.textBaseline = 'middle';
    ctx.font = '700 24px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((team ? team.name : 'Team') + '  —  ' + mine.length + ' Plätze', 20, HEAD / 2);

    // seats (center coords → top-left offset)
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    for (const s of seats) {
      const isMine = s.teamId === teamId;
      const x = s.x - SIZE / 2;
      const y = s.y - SIZE / 2 + HEAD;
      _roundRect(ctx, x, y, SIZE, SIZE, 4);
      ctx.fillStyle = isMine ? PINK : DARK;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.stroke();
      ctx.fillStyle = isMine ? DARK : '#ffffff';
      ctx.font = '700 9px -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(String(s.label || ''), s.x, s.y + HEAD);
    }
    return canvas;
  }

  function _safe(name) {
    return String(name || 'Team').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Team';
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

  async function exportTeam(teamId) {
    const team = (typeof Teams !== 'undefined') ? Teams.getTeam(teamId) : null;
    if (!team) return;
    const canvas = await renderCanvas(teamId);
    await _download(canvas, 'Team_' + _safe(team.name) + '.jpg');
  }

  async function exportAll() {
    const teams = (typeof Teams !== 'undefined') ? Teams.getAll() : [];
    for (const t of teams) {
      const canvas = await renderCanvas(t.id);
      await _download(canvas, 'Team_' + _safe(t.name) + '.jpg');
      await new Promise(r => setTimeout(r, 300));   // avoid browser multi-download throttle
    }
    return teams.length;
  }

  return { renderCanvas, exportTeam, exportAll };
})();
