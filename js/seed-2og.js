/* ═══════════════════════════════════════════════════════════════
   seed-2og.js  –  Default-Karte: Campus Nord, 2. OG
   ---------------------------------------------------------------
   Aus dem Gebäudeplan floorplan/plan-2og.jpg automatisch
   extrahierte Desk-Positionen (Bildkoordinaten, 1139×1349).
   82 Arbeitsplätze, gruppiert nach Raum (room-Feld).
   Status bewusst durchgängig "free" (Neuplanung).
   Hinterrad 2 (2-73..2-76): Nummern im Plan nicht gedruckt,
   aus der Nummernlücke abgeleitet.
   Wird in app.js als Default geladen, wenn localStorage leer ist.
   ═══════════════════════════════════════════════════════════════ */

const SEED_2OG_STATE = {
  seats: [
    { id: "jr2-02",  x:  232, y: 1169, label: "2-02",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS8"           },
    { id: "jr2-03",  x:  232, y: 1214, label: "2-03",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS8"           },
    { id: "jr2-04",  x:  276, y: 1169, label: "2-04",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS8"           },
    { id: "jr2-05",  x:  276, y: 1214, label: "2-05",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS8"           },
    { id: "jr2-06",  x: 1076, y:  842, label: "2-06",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS5"           },
    { id: "jr2-07",  x: 1031, y:  842, label: "2-07",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS5"           },
    { id: "jr2-08",  x:  404, y: 1169, label: "2-08",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS8"           },
    { id: "jr2-09",  x:  404, y: 1214, label: "2-09",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS8"           },
    { id: "jr2-10",  x:  450, y: 1168, label: "2-10",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS8"           },
    { id: "jr2-11",  x:  450, y: 1214, label: "2-11",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS8"           },
    { id: "jr2-12",  x:  668, y: 1169, label: "2-12",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS7"           },
    { id: "jr2-13",  x:  668, y: 1214, label: "2-13",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS7"           },
    { id: "jr2-14",  x:  712, y: 1169, label: "2-14",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS7"           },
    { id: "jr2-15",  x:  712, y: 1214, label: "2-15",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS7"           },
    { id: "jr2-16",  x:  782, y: 1169, label: "2-16",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS7"           },
    { id: "jr2-17",  x:  782, y: 1214, label: "2-17",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS7"           },
    { id: "jr2-18",  x:  828, y: 1168, label: "2-18",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS7"           },
    { id: "jr2-19",  x:  828, y: 1214, label: "2-19",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS7"           },
    { id: "jr2-20",  x: 1076, y:  888, label: "2-20",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS5"           },
    { id: "jr2-21",  x: 1031, y:  888, label: "2-21",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS5"           },
    { id: "jr2-22",  x:  970, y: 1167, label: "2-22",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS6"           },
    { id: "jr2-23",  x:  970, y: 1212, label: "2-23",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS6"           },
    { id: "jr2-24",  x: 1032, y: 1168, label: "2-24",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS6"           },
    { id: "jr2-25",  x: 1032, y: 1213, label: "2-25",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS6"           },
    { id: "jr2-26",  x: 1076, y: 1168, label: "2-26",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS6"           },
    { id: "jr2-27",  x: 1076, y: 1213, label: "2-27",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS6"           },
    { id: "jr2-28",  x: 1032, y: 1075, label: "2-28",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-29",  x: 1076, y: 1075, label: "2-29",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-30",  x: 1032, y: 1029, label: "2-30",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-31",  x: 1076, y: 1029, label: "2-31",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-32",  x: 1032, y:  964, label: "2-32",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-33",  x: 1076, y:  964, label: "2-33",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-34",  x: 1031, y:  780, label: "2-34",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS4"           },
    { id: "jr2-35",  x: 1076, y:  780, label: "2-35",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS4"           },
    { id: "jr2-36",  x: 1031, y:  734, label: "2-36",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS4"           },
    { id: "jr2-37",  x: 1076, y:  734, label: "2-37",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS4"           },
    { id: "jr2-38",  x:   56, y: 1214, label: "2-38",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS9"           },
    { id: "jr2-39",  x:  100, y: 1214, label: "2-39",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS9"           },
    { id: "jr2-40",  x:  161, y: 1168, label: "2-40",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS9"           },
    { id: "jr2-41",  x:  161, y: 1214, label: "2-41",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS9"           },
    { id: "jr2-51",  x: 1086, y:  406, label: "2-51",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-52",  x: 1042, y:  406, label: "2-52",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-53",  x: 1086, y:  339, label: "2-53",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-54",  x: 1042, y:  340, label: "2-54",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-55",  x: 1086, y:  292, label: "2-55",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-56",  x: 1042, y:  292, label: "2-56",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: ""              },
    { id: "jr2-57",  x: 1085, y:  134, label: "2-57",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS3"           },
    { id: "jr2-58",  x: 1085, y:  180, label: "2-58",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS3"           },
    { id: "jr2-59",  x: 1040, y:  134, label: "2-59",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS3"           },
    { id: "jr2-60",  x: 1040, y:  180, label: "2-60",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS3"           },
    { id: "jr2-61",  x:  974, y:  134, label: "2-61",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS3"           },
    { id: "jr2-62",  x:  974, y:  180, label: "2-62",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS3"           },
    { id: "jr2-65",  x:  823, y:  134, label: "2-65",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS2"           },
    { id: "jr2-66",  x:  823, y:  180, label: "2-66",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS2"           },
    { id: "jr2-67",  x:  778, y:  134, label: "2-67",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS2"           },
    { id: "jr2-68",  x:  778, y:  180, label: "2-68",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS2"           },
    { id: "jr2-69",  x:  705, y:  134, label: "2-69",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS2"           },
    { id: "jr2-70",  x:  705, y:  180, label: "2-70",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS2"           },
    { id: "jr2-71",  x:  658, y:  134, label: "2-71",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS2"           },
    { id: "jr2-72",  x:  658, y:  180, label: "2-72",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS2"           },
    { id: "jr2-73",  x:  398, y:  134, label: "2-73",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "Hinterrad 2"   },
    { id: "jr2-74",  x:  443, y:  134, label: "2-74",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "Hinterrad 2"   },
    { id: "jr2-75",  x:  398, y:  180, label: "2-75",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "Hinterrad 2"   },
    { id: "jr2-76",  x:  443, y:  180, label: "2-76",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "Hinterrad 2"   },
    { id: "jr2-77",  x:  299, y:  134, label: "2-77",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS1"           },
    { id: "jr2-78",  x:  299, y:  180, label: "2-78",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS1"           },
    { id: "jr2-79",  x:  254, y:  134, label: "2-79",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS1"           },
    { id: "jr2-80",  x:  254, y:  180, label: "2-80",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS1"           },
    { id: "jr2-81",  x:  100, y:  134, label: "2-81",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS1"           },
    { id: "jr2-82",  x:  100, y:  180, label: "2-82",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS1"           },
    { id: "jr2-83",  x:   53, y:  134, label: "2-83",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS1"           },
    { id: "jr2-84",  x:   53, y:  180, label: "2-84",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS1"           },
    { id: "jr2-85",  x:   57, y:  461, label: "2-85",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS9"           },
    { id: "jr2-86",  x:   57, y:  414, label: "2-86",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS9"           },
    { id: "jr2-87",  x:  102, y:  460, label: "2-87",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS9"           },
    { id: "jr2-88",  x:  102, y:  414, label: "2-88",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS9"           },
    { id: "jr2-89",  x:  182, y:  461, label: "2-89",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS10"          },
    { id: "jr2-90",  x:  182, y:  414, label: "2-90",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS10"          },
    { id: "jr2-91",  x:  248, y:  460, label: "2-91",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS10"          },
    { id: "jr2-92",  x:  248, y:  414, label: "2-92",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS10"          },
    { id: "jr2-93",  x:  293, y:  460, label: "2-93",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS10"          },
    { id: "jr2-94",  x:  293, y:  414, label: "2-94",  teamId: null, status: "free", type: "fixed", shareFactor: 1, room: "TS10"          }
  ],
  teams: [],
  elements: [],
  view: { zoom: 1, panX: 0, panY: 0 }
};

/* ───────────────────────────────────────────────────────────────
   Teamspaces (TS) als beschriftete Raum-Rechtecke ableiten.
   Pro room-Label werden die Plätze in räumliche Cluster gruppiert
   (TS9 ist im Plan auf zwei Bereiche verteilt → zwei Rechtecke).
   Jedes Cluster ergibt eine Bounding-Box der Seat-Zentren + Padding.
   ─────────────────────────────────────────────────────────────── */
(() => {
  const PAD = 30;          // Platzhalbgröße (17) + Rand
  const NEAR = 200;        // Cluster-Schwelle (px)
  const ROOM_COLOR = '#b1e571';

  const byRoom = {};
  for (const s of SEED_2OG_STATE.seats) {
    if (!s.room) continue;
    (byRoom[s.room] = byRoom[s.room] || []).push(s);
  }

  function cluster(seats) {
    const groups = [];
    for (const s of seats) {
      let g = groups.find(grp => grp.some(o =>
        Math.abs(o.x - s.x) <= NEAR && Math.abs(o.y - s.y) <= NEAR));
      if (g) g.push(s); else groups.push([s]);
    }
    // zwei Durchläufe, damit transitive Nähe Cluster verschmilzt
    let merged = true;
    while (merged) {
      merged = false;
      outer:
      for (let i = 0; i < groups.length; i++)
        for (let j = i + 1; j < groups.length; j++)
          if (groups[i].some(a => groups[j].some(b =>
                Math.abs(a.x - b.x) <= NEAR && Math.abs(a.y - b.y) <= NEAR))) {
            groups[i] = groups[i].concat(groups.splice(j, 1)[0]);
            merged = true; break outer;
          }
    }
    return groups;
  }

  const rooms = [];
  let n = 0;
  for (const room of Object.keys(byRoom)) {
    for (const grp of cluster(byRoom[room])) {
      const xs = grp.map(s => s.x), ys = grp.map(s => s.y);
      const x = Math.min(...xs) - PAD, y = Math.min(...ys) - PAD;
      const w = Math.max(...xs) - Math.min(...xs) + 2 * PAD;
      const h = Math.max(...ys) - Math.min(...ys) + 2 * PAD;
      rooms.push({ id: 'jrts-' + (n++), kind: 'room', x, y, w, h, label: room, color: ROOM_COLOR });
    }
  }
  SEED_2OG_STATE.elements = rooms;
})();
