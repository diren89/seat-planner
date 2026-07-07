/* ═══════════════════════════════════════════════════════════════
   collab.js  –  Live-Collaboration über Supabase Realtime
   ---------------------------------------------------------------
   Ein Channel `plan:<roomId>` trägt drei Dinge:
     • Presence  → wer ist da (Name/Farbe) + aktuelle Auswahl
     • Broadcast `state`  → ganzer Plan-State (gedrosselt), LWW
     • Broadcast `cursor` → Mausposition in Bildkoordinaten
   Persistenz für Nachzügler: Tabelle public.plans (jsonb state).
   Fällt sauber auf „lokal" zurück, wenn Config/SDK/Netz fehlen.
   ═══════════════════════════════════════════════════════════════ */

const Collab = (() => {
  'use strict';

  let _client = null;
  let _channel = null;
  let _roomId = null;
  let _self = null;                 // { id, name, color, selection:[] }
  let _enabled = false;
  let _getState = null;
  let _applyRemoteState = null;
  let _onPeers = null;

  const _cursors = new Map();       // id -> { x, y, t }
  const CURSOR_TTL = 12000;

  /* ── kleine Timing-Helfer ─────────────────────────────────── */
  function throttle(fn, ms) {
    let last = 0, timer = null, lastArgs = null;
    return (...args) => {
      lastArgs = args;
      const now = Date.now();
      const wait = ms - (now - last);
      if (wait <= 0) { last = now; fn(...lastArgs); }
      else if (!timer) {
        timer = setTimeout(() => { last = Date.now(); timer = null; fn(...lastArgs); }, wait);
      }
    };
  }
  function debounce(fn, ms) {
    let timer = null;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init({ roomId, user, getState, applyRemoteState, onPeers }) {
    _roomId = roomId;
    _self = { id: user.id, name: user.name, color: user.color, selection: [] };
    _getState = getState;
    _applyRemoteState = applyRemoteState;
    _onPeers = onPeers;

    const cfg = window.COLLAB_CONFIG;
    if (!cfg || !cfg.url || !cfg.anonKey || typeof window.supabase === 'undefined') {
      console.info('[Collab] disabled (no config or SDK) — running locally.');
      return false;
    }

    try {
      _client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        realtime: { params: { eventsPerSecond: 40 } }
      });
    } catch (e) {
      console.warn('[Collab] createClient failed:', e);
      return false;
    }

    _channel = _client.channel('plan:' + roomId, {
      config: { presence: { key: _self.id }, broadcast: { self: false } }
    });

    _channel
      .on('presence', { event: 'sync' }, emitPeers)
      .on('presence', { event: 'join' }, emitPeers)
      .on('presence', { event: 'leave' }, emitPeers)
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        if (payload && payload.from !== _self.id && payload.state) {
          _applyRemoteState(payload.state);
        }
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        if (!payload || payload.id === _self.id) return;
        _cursors.set(payload.id, { x: payload.x, y: payload.y, t: Date.now() });
        emitPeers();
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        _enabled = true;
        await _hydrate();
        await _channel.track(_self);
        emitPeers();
        console.info('[Collab] connected to room', roomId);
      });

    _enabled = true;   // optimistic; flips off only on hard failure
    return true;
  }

  /* Beitritt: gespeicherten State laden oder eigenen als Seed sichern */
  async function _hydrate() {
    try {
      const { data, error } = await _client
        .from('plans').select('state').eq('room_id', _roomId).maybeSingle();
      if (error) { console.warn('[Collab] load failed:', error.message); return; }
      const s = data && data.state;
      if (s && (s.seats || s.elements || s.teams)) {
        _applyRemoteState(s);
      } else {
        _upsertNow(_getState());   // erster Teilnehmer → Room mit lokalem Stand seeden
      }
    } catch (e) {
      console.warn('[Collab] hydrate error:', e);
    }
  }

  /* ── Ausgehender State (Broadcast gedrosselt + DB debounced) ─ */
  function _lean(state) {
    return {
      seats:    state.seats    || [],
      teams:    state.teams    || [],
      elements: state.elements || [],
      floors:   state.floors   || [],
      comments: state.comments || [],
      locked:   !!state.locked
    };
  }

  const _sendStateNow = (state) => {
    if (!_channel) return;
    _channel.send({ type: 'broadcast', event: 'state', payload: { from: _self.id, state: _lean(state) } });
  };
  const _sendStateThrottled = throttle(_sendStateNow, 60);

  function _upsertNow(state) {
    if (!_client) return;
    _client.from('plans').upsert({
      room_id: _roomId,
      state: _lean(state),
      updated_at: new Date().toISOString(),
      updated_by: _self.name
    }).then(({ error }) => { if (error) console.warn('[Collab] upsert failed:', error.message); });
  }
  const _upsertDebounced = debounce(_upsertNow, 800);

  function broadcastState(state) {
    if (!_enabled) return;
    _sendStateThrottled(state);
    _upsertDebounced(state);
  }

  /* ── Cursor ───────────────────────────────────────────────── */
  const _sendCursorThrottled = throttle((x, y) => {
    if (!_channel) return;
    _channel.send({ type: 'broadcast', event: 'cursor', payload: { id: _self.id, x, y } });
  }, 45);
  function sendCursor(x, y) { if (_enabled) _sendCursorThrottled(Math.round(x), Math.round(y)); }

  /* ── Auswahl (über Presence) ──────────────────────────────── */
  const _trackDebounced = debounce(() => { if (_channel) _channel.track(_self); }, 120);
  function setSelection(ids) {
    if (!_enabled) return;
    const next = (ids || []).filter(Boolean);
    if (next.join() === _self.selection.join()) return;
    _self.selection = next;
    _trackDebounced();
  }

  function setName(name, color) {
    _self.name = name;
    if (color) _self.color = color;
    try { if (_channel) _channel.track(_self); } catch (e) {}
  }

  /* ── Peers an die App melden ──────────────────────────────── */
  function emitPeers() {
    if (!_onPeers) return;
    const now = Date.now();
    const peers = [];
    if (_channel && _channel.presenceState) {
      const state = _channel.presenceState();
      for (const key in state) {
        const meta = state[key][0] || {};
        if (meta.id === _self.id) continue;            // sich selbst nicht zeichnen
        const cur = _cursors.get(meta.id);
        peers.push({
          id: meta.id,
          name: meta.name || 'Gast',
          color: meta.color || '#888',
          selection: meta.selection || [],
          cursor: (cur && now - cur.t < CURSOR_TTL) ? { x: cur.x, y: cur.y } : null
        });
      }
    }
    _onPeers(peers);
  }

  /* ── Room-level helpers (scenarios) ─────────────────────────── */
  async function listRooms(prefix) {
    if (!_client) return [];
    const { data, error } = await _client
      .from('plans').select('room_id, updated_by, updated_at')
      .like('room_id', prefix + '%')
      .order('updated_at', { ascending: false });
    if (error) { console.warn('[Collab] listRooms failed:', error.message); return []; }
    return data || [];
  }

  async function copyState(targetRoomId, state) {
    if (!_client) throw new Error('Collaboration nicht verfügbar.');
    const { error } = await _client.from('plans').upsert({
      room_id: targetRoomId,
      state: _lean(state),
      updated_at: new Date().toISOString(),
      updated_by: _self ? _self.name : null
    });
    if (error) throw new Error(error.message);
  }

  async function deleteRoom(roomId) {
    if (!_client) throw new Error('Collaboration nicht verfügbar.');
    const { error } = await _client.from('plans').delete().eq('room_id', roomId);
    if (error) throw new Error(error.message);
  }

  return {
    init, broadcastState, sendCursor, setSelection, setName,
    listRooms, copyState, deleteRoom,
    get enabled() { return _enabled; },
    get roomId() { return _roomId; }
  };
})();
