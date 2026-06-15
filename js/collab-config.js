/* ═══════════════════════════════════════════════════════════════
   collab-config.js  –  Supabase-Verbindung für Live-Collaboration
   ---------------------------------------------------------------
   Der Key ist ein ÖFFENTLICHER publishable/anon-Key — er darf im
   Client stehen und ist durch Row-Level-Security abgesichert.
   Ohne Login kann jede:r mit Link + Room-Namen mitarbeiten/-ändern
   (bewusste Leichtgewicht-Entscheidung für interne Planung).
   Leeren bzw. window.COLLAB_CONFIG = null → App läuft rein lokal.
   ═══════════════════════════════════════════════════════════════ */

window.COLLAB_CONFIG = {
  url:     'https://ayncxrttxjwusxdskglc.supabase.co',
  anonKey: 'sb_publishable_Pw3w6KgvTUcHTKdYMf0vMg_PDXK7fy1'
};
