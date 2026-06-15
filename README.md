# Sitzplatz-Planungsassistent

Interaktiver Planungsassistent zur Sitzplatzvergabe für Entwicklungsteams.  
Gebäudeplan: 2. Obergeschoss.

Beim ersten Start lädt automatisch die **interaktive Karte des 2. OG**: 82 aus dem
Gebäudeplan extrahierte Arbeitsplätze (Desk-Nummern `2-02 … 2-94`), positionsgenau
auf dem Plan und nach Raum gruppiert (`TS1 … TS10`, `Hinterrad 2` u.a.). Alle Plätze
starten als *frei* — bereit für die Zuweisung.

---

## Schnellstart

```
Doppelklick auf index.html — fertig.
```

Kein Build, kein Server, keine Abhängigkeiten. Läuft direkt im Browser.

---

## Projektstruktur

```
seat-planner/
├── index.html              App-Einstiegspunkt
├── css/
│   └── style.css           Vollständiges Styling
├── js/
│   ├── seed-jobrad2og.js   Default-Karte: 82 Desks aus dem Plan (Bildkoordinaten + Raum)
│   ├── storage.js          localStorage + JSON Export/Import
│   ├── teams.js            Team-CRUD, Zuweisung
│   ├── seats.js            Sitzplatz-Logik, Rendering, Drag, Lasso
│   ├── stats.js            Auslastungsberechnung, Bedarfsanzeige
│   └── app.js              Haupt-Controller, State, Zoom/Pan, Undo
├── floorplan/
│   └── JobRad-2OG.jpg      Gebäudeplan (1139 × 1349 px)
├── context-export.json     Vollständiger Projekt-Kontext für Übergabe/KI
└── README.md               Diese Datei
```

---

## Bedienung

### Navigation im Plan

| Aktion | Funktion |
|--------|----------|
| Mausrad | Zoom (zum Cursor) |
| `+` / `-` | Zoom rein / raus |
| `0` | Zoom & Position zurücksetzen |
| Leertaste + Drag | Freies Verschieben (Pan) |
| Mittelklick + Drag | Freies Verschieben (Pan) |

### Sitzplätze auswählen

| Aktion | Funktion |
|--------|----------|
| Klick auf Platz | Auswählen (ersetzt aktuelle Auswahl) |
| Strg/Cmd + Klick | Zur Auswahl hinzufügen / entfernen |
| Drag auf leerer Fläche | Lasso-Auswahl (Rechteck) |
| `Strg+A` | Alle Plätze auswählen |
| `Esc` | Auswahl aufheben |

### Sitzplätze bearbeiten

| Aktion | Funktion |
|--------|----------|
| Drag auf Platz | Platz(e) verschieben |
| Doppelklick | Platz-Details bearbeiten (Label, Status, Typ) |
| Rechtsklick | Platz-Details bearbeiten |
| `Entf` / `Backspace` | Ausgewählte Plätze löschen |

### Keyboard-Shortcuts (Übersicht)

| Shortcut | Funktion |
|----------|----------|
| `Strg+Z` | Rückgängig (bis 30 Schritte) |
| `Strg+A` | Alle auswählen |
| `Esc` | Auswahl aufheben |
| `Entf` | Auswahl löschen |
| `+` / `-` | Zoom |
| `0` | Zoom zurücksetzen |

---

## Sidebar-Tabs

### Tab: Raster

Erzeugt ein konfigurierbares Raster von Sitzplätzen auf dem Gebäudeplan.

| Feld | Bedeutung |
|------|-----------|
| Spalten / Reihen | Anzahl Plätze horizontal / vertikal |
| Abstand X / Y | Pixel-Abstand zwischen Plätzen |
| Offset X / Y | Startposition (linke obere Ecke des Rasters) |
| Präfix | BuchstabenPrefix der Platznummern (z.B. `A` → A1, A2 …) |
| Start-Nr. | Erste Nummer (default 1) |

Neue Plätze werden zu bestehenden **ergänzt** — kein Überschreiben.

Im unteren Bereich des Tabs: **Platz-Detail-Anzeige** für die aktuelle Auswahl.

### Tab: Teams

**Team anlegen:** Name eingeben, Farbe wählen, Bedarf (Soll-Anzahl Plätze) angeben → „Team hinzufügen".

**Plätze zuweisen:**
1. Plätze auf dem Plan auswählen (Klick / Lasso)
2. Im Teams-Tab erscheint der Zuweisungsbereich
3. Team aus Dropdown wählen → „Zuweisen"

Zugewiesene Plätze nehmen die **Teamfarbe** an.

**Team bearbeiten:** Stift-Icon in der Teamliste.  
**Team löschen:** ×-Icon — entfernt alle Zuweisungen des Teams.

### Tab: Statistik

**Gesamt-Karte:**
- Plätze gesamt, belegt, frei, reserviert, blockiert
- Auslastung in % (belegt / nutzbar), farbiger Fortschrittsbalken

**Pro Team:**
- Plätze gesamt, belegt, frei, reserviert, blockiert
- Effektive Kapazität (berücksichtigt Sharing-Faktor bei Flex-Plätzen)
- Soll-Ist-Vergleich mit farbigem Ampel-Badge:

| Badge | Bedeutung |
|-------|-----------|
| Gedeckt (grün) | Effektive Kapazität ≥ Bedarf |
| Überkapaz. (orange) | Mehr Plätze als Bedarf |
| Unterdeckung (rot) | Weniger Plätze als Bedarf |
| Kein Ziel (grau) | Kein Bedarf hinterlegt |

### Tab: Daten

**Export / Import:**
- „Export als JSON" → lädt `sitzplan_DATUM_UHRZEIT.json` herunter
- „Import aus JSON" → Datei auswählen (ersetzt alle aktuellen Daten nach Bestätigung)

**Filter & Suche:**
- Nach Team filtern → nicht passende Plätze werden ausgegraut
- Nach Raum / Zone filtern (`TS1`, `Hinterrad 2` …) → nur passende Plätze hervorgehoben
- Nach Status filtern (frei / belegt / reserviert / blockiert)
- Platznummer suchen → Plan springt zu Platz, Platz blinkt gold auf

**Zurücksetzen:** Löscht alle Plätze, Teams und Daten aus dem Browser-Speicher.

---

## Sitzplatz-Eigenschaften

Jeder Platz hat folgende Eigenschaften (bearbeitbar per Doppelklick):

| Eigenschaft | Werte | Beschreibung |
|-------------|-------|--------------|
| Bezeichnung | Text | Anzeigename (z.B. A1, 2-83) |
| Raum / Zone | Text | Räumliche Gruppe (z.B. `TS1`, `Hinterrad 2`); leer = keine Zone |
| Status | `frei` / `belegt` / `reserviert` / `blockiert` | Belegungszustand |
| Typ | `fest` / `flex` | Fest-Arbeitsplatz oder Desk-Sharing |
| Sharing-Faktor | Zahl ≥ 1 | Nur bei Flex: z.B. 1.5 = 3 Personen auf 2 Plätzen |

### Visuelle Kodierung

| Farbe / Stil | Bedeutung |
|---|---|
| Grün | Frei |
| Rot | Belegt |
| Orange | Reserviert |
| Grau + Schraffur | Blockiert (z.B. defekt) |
| Teamfarbe (Hintergrund/Rand) | Dem Team zugewiesen |
| Lila Punkt „F" | Flex / Desk-Sharing-Platz |
| Blauer Ring | Aktuell ausgewählt |
| Gold-Blinken | Suchergebnis |

---

## Datenspeicherung

- **Automatisch:** Jede Änderung wird sofort in `localStorage` unter dem Key `seatplanner_v1` gesichert.
- **Export:** JSON-Datei mit vollständigem State (Plätze + Teams + Zoom-Position).
- **Import:** Überschreibt alle Daten nach Bestätigungsdialog.
- **Browserübergreifend teilen:** Export auf Gerät A → Import auf Gerät B.

### JSON-Struktur (Export-Format)

```json
{
  "seats": [
    {
      "id": "S4f2k9a",
      "x": 112,
      "y": 220,
      "label": "A1",
      "teamId": "Tb3x7cd",
      "status": "free",
      "type": "fixed",
      "shareFactor": 1,
      "room": "TS1"
    }
  ],
  "teams": [
    {
      "id": "Tb3x7cd",
      "name": "Platform",
      "color": "#4f86c6",
      "demand": 10
    }
  ],
  "view": {
    "zoom": 0.85,
    "panX": 120,
    "panY": 40
  }
}
```

---

## Architektur

### Modul-Übersicht

```
app.js          Haupt-Controller
  │
  ├─ Storage    localStorage + JSON I/O
  ├─ Teams      Team-CRUD, Render, Zuweisung
  ├─ Seats      Seat-Modell, DOM-Rendering, Drag, Lasso, Filter
  └─ Stats      Berechnung + Rendering (read-only)
```

### State-Management

- Ein einziges `_state`-Objekt in `app.js` ist die einzige Source of Truth.
- `setState(next)` → speichert in localStorage + schreibt Undo-Eintrag + ruft `refresh()`.
- `refresh()` ruft alle `render()`-Methoden neu auf — vollständiges Re-Render aus State.
- Seats und Teams erhalten `getState/setState/onChange` per **Dependency Injection** (kein globales State-Objekt).

### Undo

- Jede `setState()`-Änderung legt einen JSON-Snapshot auf dem Undo-Stack ab.
- Bis zu **30 Schritte** rückgängig machbar.
- `Strg+Z` oder Header-Button ↺.

---

## Typische Workflows

### Erstkonfiguration eines Büros

1. Raster-Tab öffnen
2. Spalten/Reihen/Abstände konfigurieren (z.B. 8×5, Abstand 52px)
3. Offset so einstellen, dass das Raster auf den ersten Arbeitsbereich im Plan passt
4. „Raster erzeugen" → Plätze erscheinen auf dem Plan
5. Für weitere Raumbereiche: neues Raster mit anderem Offset + Präfix (z.B. Präfix „B")
6. Einzelne Plätze per Drag an genaue Position verschieben
7. Nicht belegbare Flächen: Plätze markieren → Status „Blockiert" setzen

### Team anlegen und Plätze zuweisen

1. Teams-Tab → Team mit Name, Farbe und Bedarf anlegen
2. Auf dem Plan Plätze per Lasso oder Strg+Klick auswählen
3. Im Teams-Tab Zuweisung erscheint → Team wählen → „Zuweisen"
4. Statistik-Tab prüfen: Ampel zeigt ob Bedarf gedeckt

### Tagesplanung (Auslastung pflegen)

1. Morgens: belegte Plätze per Rechtsklick → Status „Belegt" setzen
2. Statistik-Tab → Auslastung prüfen
3. Abends: Export als Backup

---

## Erweiterungsmöglichkeiten

- **Personen-Zuweisung:** Namen/E-Mails auf Einzelplätze
- **Raum-/Zonierung:** Named Areas als farbige Overlays
- **Mehrere Etagen:** Tab-System für verschiedene Pläne
- **Buchungssystem:** Tagesbuchungen für Flex-Plätze
- **Backend:** REST-API + Datenbank für Team-übergreifende Nutzung
- **SVG-Plan:** Schärferes Rendering bei hohem Zoom
- **Dark Mode:** CSS Custom Properties sind bereits darauf vorbereitet
- **Druckansicht / PDF-Export**

---

## Technische Hinweise

- **Kein Build-Schritt** — reine Vanilla JS/HTML/CSS-App.
- **Browser-Kompatibilität:** Alle modernen Browser (Chrome, Firefox, Safari, Edge). Kein IE.
- **localStorage-Limit:** Ca. 5 MB — bei sehr vielen Plätzen regelmäßig exportieren.
- **Kein Touch/Mobile-Support** — die App ist für Desktop ausgelegt.
- **Floorplan-Dimensionen:** 1139 × 1349 px. Die Pixel-Koordinaten der Plätze beziehen sich auf dieses Bild.
- Bei Austausch des Floorplan-Bildes (`floorplan/JobRad-2OG.jpg`) müssen die Platz-Koordinaten ggf. neu angepasst werden.

---

## Übergabe-Checkliste

- [ ] `seat-planner/` Ordner vollständig vorhanden (alle 8 Dateien)
- [ ] `index.html` im Browser getestet
- [ ] Teams angelegt und Plätze zugewiesen
- [ ] JSON-Export erstellt und als Backup gesichert
- [ ] `context-export.json` an neue Entwickler / KI weitergegeben
