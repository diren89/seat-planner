/* ═══════════════════════════════════════════════════════════════
   comments.js  –  Comment pins on the plan (synced via state).
   { id, x, y, floorId, text, author, done, ts }
   ═══════════════════════════════════════════════════════════════ */

const Comments = (() => {
  'use strict';

  let _getState, _setState, _onChange, _getActiveFloor = () => null;
  let _visible = true;
  const _nodes = new Map();   // id -> pin element
  let _editingId = null;

  function uid() { return 'C' + Math.random().toString(36).slice(2, 9); }

  function init(getState, setState, onChange, getActiveFloor) {
    _getState = getState;
    _setState = setState;
    _onChange = onChange;
    _getActiveFloor = getActiveFloor || (() => null);
  }

  function getAll() { return _getState().comments || []; }
  function get(id)  { return getAll().find(c => c.id === id) || null; }

  function _author() {
    return localStorage.getItem('collab_name') || 'Gast';
  }

  /* ── CRUD ─────────────────────────────────────────────────── */
  function add(x, y) {
    const c = {
      id: uid(),
      x: Math.round(x), y: Math.round(y),
      floorId: _getActiveFloor() || undefined,
      text: '',
      author: _author(),
      done: false,
      ts: Date.now()
    };
    _setState({ ..._getState(), comments: [...getAll(), c] });
    _onChange('comment-added', c);
    return c;
  }

  function update(id, patch) {
    _setState({ ..._getState(), comments: getAll().map(c => c.id === id ? { ...c, ...patch } : c) });
    _onChange('comment-updated', id);
  }

  function remove(id) {
    _setState({ ..._getState(), comments: getAll().filter(c => c.id !== id) });
    _onChange('comment-deleted', id);
  }

  /* ── Visibility (local) ───────────────────────────────────── */
  function setVisible(v) {
    _visible = !!v;
    render();
  }
  function isVisible() { return _visible; }

  /* ── Render (diff-based, own layer) ───────────────────────── */
  function render() {
    const layer = document.getElementById('comment-layer');
    if (!layer) return;
    const comments = getAll();
    const af = _getActiveFloor();

    for (const [id, el] of _nodes) {
      if (!comments.find(c => c.id === id)) { el.remove(); _nodes.delete(id); }
    }

    for (const c of comments) {
      let el = _nodes.get(c.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'comment-pin';
        el.innerHTML = Icons.get('chat');
        el.addEventListener('click', e => {
          e.stopPropagation();
          openModal(c.id);
        });
        layer.appendChild(el);
        _nodes.set(c.id, el);
      }
      el.style.left = c.x + 'px';
      el.style.top  = c.y + 'px';
      el.style.display = (_visible && (!af || !c.floorId || c.floorId === af)) ? '' : 'none';
      el.classList.toggle('done', !!c.done);
      el.title = (c.text || 'Kommentar') + ' — ' + (c.author || '') + (c.done ? ' ✓' : '');
    }
  }

  /* ── Modal ────────────────────────────────────────────────── */
  function openModal(id) {
    const c = get(id);
    if (!c) return;
    _editingId = id;
    document.getElementById('modal-comment-text').value = c.text || '';
    document.getElementById('modal-comment-done').checked = !!c.done;
    document.getElementById('modal-comment-meta').textContent =
      (c.author || 'Gast') + ' · ' + new Date(c.ts || Date.now()).toLocaleDateString('de-DE');
    document.getElementById('modal-comment').style.display = 'flex';
    requestAnimationFrame(() => document.getElementById('modal-comment-text').focus());
  }

  function saveModal() {
    if (!_editingId) return;
    const text = document.getElementById('modal-comment-text').value.trim();
    const done = document.getElementById('modal-comment-done').checked;
    if (!text) { deleteFromModal(); return; }   // empty comment = remove
    update(_editingId, { text, done });
    _editingId = null;
    document.getElementById('modal-comment').style.display = 'none';
  }

  function deleteFromModal() {
    if (!_editingId) return;
    remove(_editingId);
    _editingId = null;
    document.getElementById('modal-comment').style.display = 'none';
  }

  return { init, getAll, get, add, update, remove, render, setVisible, isVisible, openModal, saveModal, deleteFromModal };
})();
