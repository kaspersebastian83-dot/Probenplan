# Änderungen

## 1.7.0 – 16. Oktober 2026

- **Ergebniskarte:** „Ergebnisse“ in der Kopfzeile (Taste K) färbt Probenmarker nach Bewertungskategorie; Proben ohne Wert oder Skala grau. Kleine Legende unten links im Plan.
- Der XML-Import speichert die Messwerte je Probe (Parameter, Ergebnis wie gedruckt, Einheit); bereits platzierte Proben erhalten sie durch erneuten Import mit „Aktualisieren“.
- Parameter wählbar (Standard Σ16 EPA-PAK exkl. BG); Skala je Parameter und Einheit in der Liste rechts: Kategorien mit „ab“-Wert, Farben automatisch grün → rot oder einzeln. Gemeinsame Skalen mit FotoKits Ergebnistabelle; Skala und Farben zusätzlich im Projekt.
- Export „Darstellung: Probenplan oder Ergebniskarte“, auch für alle Pläne; Legende mit Kategorien, Wertebereichen und Probennummern.
- Neue Testsuite `results`.

## 1.6.0 – 16. Oktober 2026

- **Mehrere Pläne pro Projekt** (z. B. EG, 1. OG, 2. OG): Planleiste unter dem Plan mit Vorschaubildern, „＋ Plan“, Wechsel per Klick oder Bild↑/Bild↓; Umbenennen, Verschieben und Löschen per Doppelklick, Rechtsklick oder „⋯“.
- Mehrseitige PDF: „Alle Seiten als einzelne Pläne“ übernimmt jede Seite als eigenen Plan (bis 20 Seiten).
- Proben-, Brandherd- und Flächenkennungen laufen über alle Pläne fort und sind im ganzen Projekt eindeutig.
- Laborbericht einmal importieren, offene Proben auf beliebigen Plänen platzieren; die Laborliste zeigt die Verteilung je Plan. Beim Löschen eines Plans kehren dessen Laborproben in „Noch zu platzieren“ zurück. Die Probenliste (JSON) umfasst alle Pläne.
- Rückgängig/Wiederherstellen wechselt bei Bedarf zum betroffenen Plan.
- Export: „Dieser Plan“ oder „Alle Pläne“ (je Plan ein Bild); Planname in Fußzeile und Dateiname.
- Projektformat 5 für mehrere Pläne; Projekte mit einem Plan werden weiterhin im bisherigen Format gespeichert. Neue Testsuite `floors`.

## 1.5.0 – 15. Oktober 2026

- **Karte zuerst:** Die Planfläche wächst von 38–47 % auf 87–92 % des Fensters (Liste eingeklappt) bzw. 66–77 % (Liste offen), gemessen bei 1280 × 720 bis 1920 × 1080. Keine Seitenscrollleiste mehr.
- Eine Kopfzeile statt drei Leisten: Datei-Aktionen, Laborimport, Planname, Rückgängig/Wiederherstellen, Hilfe, Export und Liste.
- Werkzeugleiste links mit Tastenkürzeln (V, P, B, E, F, G, R, Umschalt+R, C, L, +, −, 0); Drehen und Zuschneiden ebenfalls dort.
- Werkzeughinweis, nächste Probennummer und die Flächenentwurfs-Steuerung schweben über dem Plan; Zoom unten rechts, Legende unten links.
- Liste rechts (offene Laborproben oben, dann Markierungen und Flächen) standardmäßig eingeklappt, öffnet sich bei Auswahl einer vorhandenen Markierung/Fläche und nach Laborimport; Zustand wird gemerkt.
- Export als schwebende Karte über „Exportieren …“ (gleiche Felder wie bisher).
- Schmale Fenster: bis 1279 px bricht die Kopfzeile um; auf Telefonen (≤ 700 px, nur Notbetrieb) stehen Werkzeuge, Plan und Liste untereinander, ohne dass etwas den Plan verdeckt.
- Keine Änderung an Projektformat, Plan-, Marker-, Flächen- oder Exportdarstellung. Tests an die neuen Plätze angepasst; neue Suite `layout`.

## 1.4.0 – 15. Oktober 2026

- Neuer Name **PlanKit** (früher Probenplan) in Kopfzeile, Browsertitel, installierter App und lokalem Startfenster. Repository, Webadresse, `Start-Probenplan.cmd` und das Projektformat `.probenplan` bleiben unverändert.
- Aussehen wie FotoKit/LabelKit: blaue Kopfzeile mit sichtbarer Versionsnummer, Schrift IBM Plex (lokal eingebunden, SIL OFL 1.1), helle Blautöne für Leisten, Bedienelemente und Dialoge, neues Symbol in Blau.
- Reine Darstellungsänderung: keine Änderung an Funktionen, Projektdaten, Plan-, Marker-, Flächen- oder Exportfarben.

## 1.3.1 – 15. Oktober 2026

- Labor-Herkunft bleibt in `.probenplan` und IndexedDB erhalten: Prüfberichtsnummer, Labor, vollständige Auftragsreferenz, optionale Batchkennung und XML-/PDF-Dateinamen.
- Optionale `labReports` und `reportId` erweitern Projektformat 4 rückwärtskompatibel; gleiche oder fehlende Berichtsnummern werden durch stabile interne IDs getrennt. Ältere Formate 1–4 bleiben lesbar.
- Der bestehende mosaik-probenliste-JSON-Export nutzt gespeicherte Herkunft und alle offenen/platzierten Proben des gewählten Berichts, ohne Schemaänderung.
- Reimport-Konflikte verlangen eine ausdrückliche Entscheidung, auch für offene Proben. Ersetzen benennt den Herkunftswechsel; Abbruch, Überspringen und Undo/Redo bewahren konsistente Zuordnungen. Widersprüchliche XML-/PDF-Paare werden abgewiesen.
- Nur benötigte Metadaten werden gespeichert: keine Labor-Rohdateien, Analysenwerte, absoluten Dateipfade, neuen Dienste oder Uploads.
- Neue ausschließlich synthetische Modell-/Browserprüfungen für Herkunft, P1–P9-Teilplatzierung, Wiederöffnung, JSON, Mehrfachberichte, Konflikte und ältere/ungültige Dateien.

## 1.3.0 – 14. Oktober 2026

- Eurofins-XML und PDF lokal importieren, gemeinsam vergleichen und in einer bearbeitbaren Prüftabelle bestätigen.
- Offene Laborproben per Maus-/Stift-/Touch-Geste oder Auswahl + Klick/Tippen platzieren; bestehende Kennungen ausdrücklich überspringen, aktualisieren oder umnummerieren.
- Projektformat 4 mit optionalen Labordaten und offenen Proben, einschließlich Sicherung, Wiederaufnahme und Undo/Redo. Ältere Projekte bleiben lesbar.
- Gemeinsame JSON-Probenliste für andere Apps, nativer Speicherdialog mit Download-Fallback.
- Synthetische Parser-/Browserprüfungen; kein Upload, OCR-Dienst, neue Abhängigkeit oder Änderung der CSP.

## 1.2.0

- Transparente Schadensflächen und automatische Exportlegende.
- Nachfolgend: geschützte Tastaturkürzel, eigenständige synthetische Tests und Pan beim Setzen von Proben/Brandherden.

## 1.1.0

- Lokaler PDF-Grundrissimport, Rotation und Zuschnitt.
