# Änderungen

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
