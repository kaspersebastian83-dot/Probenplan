# Änderungen

## 1.12.0 – 16. Oktober 2026

- **PNG/JPG mit Schriftfeld (Standard):** Bilder fürs Gutachten sehen jetzt aus wie das PDF – Seitenleiste mit Legende, Maßstabsleiste/Nordpfeil und Schriftfeld mit Firmenlogo, Objekt, Gutachten-Nr., Datum und „PROBENPLAN“ bzw. „ERGEBNISKARTE“; Seitenverhältnis A4 ohne Heftrand. „Mit Schriftfeld …“ abwählen ergibt das bisherige Bild (nur Plan mit Legende).
- **Ergebniskarte nur mit Bewertung:** „Darstellung“ ist immer sichtbar; ohne Laborwerte ist „Ergebniskarte (erst nach Import der Laborwerte)“ gesperrt. Ist für den gewählten Parameter keine Skala festgelegt (alle Proben wären grau), sagt der Export das und erstellt keine Ergebniskarte, die wie der Probenplan aussieht.
- **Aus der Projektzentrale direkt zur Anlage:** `?aktion=anlage` öffnet nach dem Laden den Export mit „Word · Anlage Probenahme“.

## 1.11.0 – 16. Oktober 2026

- Neu im Export: **„Word · Anlage Probenahme“** – Word-Datei zum Einfügen in den Bericht (Einfügen › Objekt › Text aus Datei): Arial, direkte Formatierung, keine Kopf-/Fußzeile, A4 mit den Rändern des Berichts.
  - Lageplan je Geschoss als Ergebniskarte bzw. Probenplan im genormten Maßstab (Planseite 159 × 192 mm, in Originalgröße eingesetzt, mit Schriftfeld, Legende, Maßstabsleiste).
  - Probenverzeichnis: Messwert in der Schreibweise des Prüfberichts, Einordnung in die Skala des Sachverständigen (Skala mit Bereichen angegeben), nicht platzierte Proben ausdrücklich genannt.
  - Je Probe ein Probenblatt: Angaben, Lageausschnitt mit Markierung, Fotos aus FotoKit (Zuordnung über die Probe-Nr., verkleinerte Kopien, FotoKit-Drehung angewendet) mit Dateiname, Aufnahmezeit und Prüfsumme, alle Laborwerte.
  - Prüfprotokoll: Vollständigkeit (Proben ohne Lage, Wert, Einordnung oder Foto; unbekannte Probe-Nr.; veränderte, fehlende oder ungeprüfte Fotos; Pläne ohne Maßstab; fehlende Laborberichtsdateien) und SHA-256 aller Quelldateien und Fotos.
  - Im Projektordner: gespeicherter Stand wird belegt (vorher gespeichert), Ablage datiert und nie überschreibend in „Mitteilungen“, Zeile in „_Anlagen-Protokoll.txt“ (wie die Anlagen der Projektzentrale). Ohne Projektordner: Download ohne Fotos.
- Word-Schreiber (`src/docx.ts`) als Kopie aus der Projektzentrale, ergänzt um Bilder in Tabellenzellen und einmalige Ablage mehrfach verwendeter Bilder.
- Test `anlage.mjs`.

## 1.10.0 – 16. Oktober 2026

- Maßstäbliches PDF für das Gutachten: Export als **PDF · A4** oder **PDF · A3** mit Rahmen, Schriftfeld (Firmenlogo, Dr. Schiffers & Partner, Planart und Geschoss, Objekt, Gutachten-Nr., Datum, Maßstab, Blatt), Legende, Maßstabsleiste und optionalem Nordpfeil. Der Plan wird im größten passenden genormten Maßstab (1:50, 1:100, 1:200 …) gedruckt; Hoch-/Querformat wählt PlanKit automatisch. „Alle Pläne“ ergibt ein PDF mit einem Blatt je Geschoss, jedes im eigenen Maßstab.
- Maßstab je Plan: „Strecke messen“ in der Liste – zwei Punkte einer bekannten Strecke anklicken und die wahre Länge eingeben. Erneutes Messen zeigt die Länge nach dem bisherigen Maßstab (zur Kontrolle). Drehen und Zuschneiden erhalten den Maßstab.
- Nordpfeil je Plan (Richtung in Grad), dreht beim Drehen des Plans mit.
- Das PDF ist ein verlustfrei komprimiertes 300-dpi-Blatt ohne Fremdbibliothek; auf dem Ausdruck stimmen Strecken auf Bruchteile eines Millimeters (Drucken mit „Tatsächliche Größe“). Ohne Kalibrierung wird auf die Blattgröße eingepasst und „ohne Maßstab“ vermerkt.
- Maßstab und Nordrichtung werden im Projekt gespeichert; ältere Dateien laden unverändert, ungültige Werte werden beim Import abgewiesen.

## 1.9.0 – 16. Oktober 2026

- Punktgröße je Plan: Bei sehr großen oder kleinen Plänen lassen sich die Probenpunkte jetzt anpassen. Regler „Punktgröße“ oben in der Liste (20–300 %) und die Tasten **<** (kleiner) und **>** (größer). Jeder Plan (Geschoss) behält seinen eigenen Wert; Export, Beschriftungen und Ergebniskarte folgen.
- Der Wert wird in der Projektdatei gespeichert (nur wenn er von 100 % abweicht); ältere Dateien laden unverändert, ungültige Werte werden beim Import abgewiesen. Mehrere Änderungen hintereinander sind ein Rückgängig-Schritt.

## 1.8.3 – 16. Oktober 2026

- Sicherungskopien „(vorher …)“ sammeln sich nicht mehr unbegrenzt im Ordner „Pläne“: PlanKit behält die neuesten 10 und je Tag die jeweils neueste der letzten 30 Tage. Wiederherstellungsdateien, manuelle Kopien und die Projektdatei werden nie gelöscht; ein Fehler beim Aufräumen lässt das Speichern nie scheitern.

## 1.8.2 – 16. Oktober 2026

- Büro-Dateisicherheit für Windows mit Chrome/Edge: Inhaltsvergleich statt Zeitstempeltoleranz, Konflikte auch bei gelöschten/ersetzten Dateien und erneute Prüfung nach der Konfliktentscheidung.
- Geprüfte, eindeutig benannte Sicherung vor jedem Überschreiben; Wiederherstellungsdatei vor dem Hauptschreiben, Erfolgsanzeige erst nach bestätigtem Speichern. Web Locks koordinieren PlanKit-Tabs.
- Projektgebundene Browserentwürfe, erneute Zugriffserlaubnis über „Speichern“, Notfallkopie, explizite Wiederherstellung bei Abbruch/beschädigter Datei und Warnung vor dem Schließen ungespeicherter Änderungen.
- Letzte Datenverlust-Sicherungen: ungespeicherte Fassungen vor Konfliktwahl, Import, Ordner-/Versionswechsel und Verwerfen eines Browserentwurfs geprüft als Wiederherstellungsdatei erhalten; Fehler verhindern den Wechsel. Speicherbestätigungen sind an die aktuellste Revision gebunden.
- Bestehendes Archiv, Projektformat und FotoKit-/LabelKit-Integration bleiben erhalten. Synthetische Browserregressionen in GitHub Actions; keine Cloud-/OneDrive- oder plattformspezifische Dateilogik.

## 1.8.1 – 16. Oktober 2026

- Sichere Zahleninterpretation für deutsche/internationale Formate; mehrdeutige und ungültige Angaben bleiben ohne Bewertung. Originalwerte und Einheiten bleiben erhalten.
- Qualifikatoren separat in Karte und Export: Unter BG nur für „unter BG“ oder `<` mit gültiger Zahl; n.n. = Nicht nachgewiesen, n.b. = Nicht bestimmt / Bedeutung prüfen. Fehlerhafte `<`-Angaben bleiben ohne Bewertung; kein Qualifikator wird als gemessene Null behandelt.
- Explizite VdS-2357-Nutzung: Wohn-/Büroräume 10 µg/m² oder Industrie 100 µg/m² für Σ16 EPA-PAK auf Oberflächen, mit passender Einheit und Referenz in der Legende. Eigene und FotoKit-Skalen bleiben erhalten.
- XML/PDF-Abgleich prüft Labor-IDs, Probenahmedaten und Probenarten. Synthetische Regressionstests für Parsing, BG, Referenzgrenzen, Projektroundtrip und FotoKit-Kompatibilität.

## 1.8.0 – 16. Oktober 2026

- **Projektordner:** Öffnen aus der Projektzentrale („Plan bearbeiten“, `?projekt=`) oder über „📁 Projekt“. Projektnummer und Ort als Kennung in der Kopfzeile.
- Automatisches Speichern als „Probenplan <Projekt>.probenplan“ im Ordner „Pläne“; „Speichern“ schreibt sofort dorthin statt herunterzuladen. Zusätzliche Browsersicherung je Projekt mit Rückfrage, falls sie neuer als die Datei ist.
- Kein stilles Überschreiben: Hat jemand anderes die Datei gespeichert, wählen Sie zwischen „Andere Fassung laden“, „Meine Fassung als Kopie sichern“ und „Meine Fassung übernehmen“. Beim Ersetzen bleibt die alte Datei als „(vorher …)“-Kopie.
- Bildexport direkt in „Pläne“ („Probenplan <Projekt> - <Plan>.png“); Objekt aus _Projekt.json in der Fußzeile; Gutachtennummer standardmäßig der Ordnername.
- Grundrisse aus „Pläne“ und Laborberichte aus „Laborergebnisse“ direkt zur Auswahl.
- **LabelKit → PlanKit:** Die Probenerfassung aus LabelKit (neueste `…_Daten.json` in „Laboraufträge“) wird vorab zu „Noch zu platzieren“ – Probe <Nr> wird P<Nr>, Beschreibung, Probenart und Datum wie in der Laborübergabe. Kommt der Laborbericht, ergänzt der neue Knopf „Alle Konflikte: Aktualisieren“ Labordaten und Messwerte in einem Schritt (auch bei bereits platzierten Proben).
- Kopfzeile kompakter („＋ Plan“, „↓ Export …“). Neue Testsuite `folder`.

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
