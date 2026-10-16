# Automatisierte Tests

Die reguläre Suite verwendet ausschließlich künstliche Daten. ZIPs und Dateien in `beispiele/` werden weder gesucht noch geöffnet.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium webkit
pnpm build
pnpm test
```

`pnpm test` startet Vites Produktionsvorschau auf einem freien Loopback-Port, führt alle vierzehn Suites aus und beendet den Server auch bei Testfehlern. Es wird keine bereits laufende Anwendung verwendet. Einzelne Suites können zur Diagnose mit `TEST_URL` gegen einen bewusst gestarteten Testserver ausgeführt werden.

- `browser.mjs`: synthetisches Polycam-ZIP, SVG/Ressourcen, Markierungen, Zoom/Touch, Undo/Redo, Projekt-Roundtrip, PNG/JPG und Offlinebetrieb.
- `edge-cases.mjs`: unabhängig erzeugtes Projekt und Rasterbilder, ungültige Kennungen, äußere Beschriftungen, Exportfehler und Ersatzexport.
- `import-preparation.mjs`: synthetische ein-/mehrseitige PDFs, Rotation/Zuschnitt, EXIF, Kompatibilität der Projektformate, Importfehler und Offlinebetrieb.
- `scoped-pdf.mjs`: eigener Server unter `/Probenplan/`, Offline-PDF-Import und Export.
- `areas.mjs`: Geometrie, Bearbeitung, Undo/Redo, Projektformate, Legende/Exporte und Touch.
- `keyboard.mjs`: Delete/Backspace/Escape, vollständiges Undo/Redo und Eingabeschutz.
- `marker-pan.mjs`: Maus-/Touch-Klick und Ziehen in beiden Setzwerkzeugen, unveränderte Speicherung/History und Zoom.
- `labreport.mjs` / `lab-fixtures.mjs`: namespace-/CRLF-XML, Zeitzone/Referenzmapping, getrennte Rohwerte, positionierte und absichtlich ungeordnete PDF-Texte, transponierte Ergebnistabellen, 2–3-zeilige Beschreibungen, Tabellenfortsetzungen/Spaltenvarianten, Abweichungen und textlose PDF. Browser prüfen Review/Abbruch, Konflikte, Mouse-/Touch-/Pen-Platzierung, Projekt-/JSON-Roundtrip, Schemas 1–4 und Offlinebetrieb. Parser-Unitprüfungen nutzen einen separaten temporären Modulserver; keine Test-API wird in der App ausgeliefert.

- `lab-provenance.mjs`: stabile Berichts-IDs, isolierte History-Snapshots, XML/PDF/Kombinationsimport, P1–P9 mit drei platzierten und sechs offenen Proben, Öffnen in frischem Browserkontext, IndexedDB-Neustart und automatisch vorbelegter JSON-Export. Mehrfachberichte mit gleicher/fehlender Nummer und gleichen Dateinamen, explizites Ersetzen offener/platzierter Proben, Umnummerierung, Abbruch, Formate 1–4 und fehlerhafte Herkunftsdaten. Ausschließlich synthetische Daten.

- `floors.mjs`: mehrere Pläne – schmale Leiste bei einem Plan (bisheriges Format), „＋ Plan“, fortlaufende Nummern und gebäudeweit eindeutige Kennungen, Wechseln per Klick und Bild↓, Umbenennen, Undo/Redo springt zum betroffenen Plan, Laborprobe auf einem Obergeschoss platzieren und beim Löschen zurückgeben, Export „Alle Pläne“, Speichern/Öffnen von Format 5 inklusive Ablehnung doppelter Kennungen und mehrseitige PDF als einzelne Pläne.
- `results.mjs`: Ergebniskarte – Messwerte aus der Labor-XML je Probe, Einfärbung nach FotoKit-Skala (grün → rot, ohne Wert grau), Skala bearbeiten mit Undo und Rückschreiben in den gemeinsamen Speicher, Parameterwechsel und „Skala anlegen“, Export als Ergebniskarte und Probenplan, Projektdatei mit Skala/Farben inklusive Ablehnung ungültiger Farben.
- `folder.mjs` (nur Chromium, Archiv im privaten Browser-Dateisystem nachgebildet): Öffnen per `?projekt=`, Projektkennung, Grundrisse aus „Pläne“, automatisches Speichern statt Download, Bildexport in „Pläne“, Probenerfassung aus LabelKit als offene Proben, Laborbericht aus „Laborergebnisse“ mit „Alle Konflikte: Aktualisieren“, erneutes Öffnen aus der Datei, Konfliktabfrage bei fremder Änderung und Sicherungskopie beim Ersetzen. Lokal unter Linux mit `LANG=C.UTF-8` ausführen (Umlaute in Ordnernamen).
- `layout.mjs`: Karte zuerst – Kartenanteil und keine Seitenscrollleiste bei 1366 × 658, standardmäßig eingeklappte Liste, Aufklappen bei Auswahl, Tastenkürzel (auch nicht beim Tippen), gemerkter Listenzustand und Exportkarte. Die übrigen Suites starten mit geöffneter Liste (`runtime.mjs`).

`fixtures.mjs` generiert einen ZIP-Export mit SVG, PNG, PDF, Metadaten, Ressourcenverzeichnis und ignorierten macOS-Metadaten. Der Grundriss ist frei erfunden. Die kleine WOFF-Datei enthält eigens konstruierte geometrische Testglyphen; sie ist keine übernommene Produktschrift. PNG-Daten werden mit Node/zlib erzeugt, ZIPs mit dem bestehenden fflate. Keine zusätzlichen Laufzeitabhängigkeiten.

Unter `.test-output/` liegen Suite-Logs, eine Zusammenfassung, Fehler-Stacks, Screenshots und Playwright-Traces mit Browserfehlern. Der PR-Workflow lädt diese bei Fehlschlag hoch. Traces lassen sich mit `pnpm exec playwright show-trace <trace.zip>` öffnen. Das Verzeichnis wird vor einem vollständigen Lauf geleert, damit ältere Ergebnisse keinen Erfolg vortäuschen.

Echte Exporte sind nicht Teil dieser Suite. Etwaige manuelle Kompatibilitätsprüfungen müssen ausdrücklich separat aufgesetzt werden; deren Daten und Ergebnisse gehören nicht in CI-Artefakte oder dieses Repository.

Manuelle Laborbeispiele und ihre Screenshots/Extraktionen ausschließlich im ignorierten `.manual-checks/` ablegen. Der automatisierte Runner liest diesen Ordner nicht und lädt ihn nicht als Diagnose hoch.

`lab-regressions.mjs` erweitert die isolierten Parserprüfungen um synthetische deutsche/internationale Zahlen, mehrdeutige/ungültige Eingaben, gültige numerische BG, getrennte Qualifikatoren n.n./n.b., fehlerhafte `<`-Angaben ohne Bewertung, BG ohne Nullwert, VdS-Grenzfälle und Einheiten, unveränderte Rohwerte sowie XML/PDF-Metadaten. `results.mjs` prüft außerdem Nutzungsauswahl, Undo/Redo, Projekt-Roundtrip und unveränderte FotoKit-Skalen. Ausführung in GitHub Actions; für 1.8.1 wurden lokal weder Abhängigkeiten installiert noch Builds oder Tests ausgeführt.

- `folder-safety.mjs`: synthetische Dateien im privaten Browserdateisystem; eindeutige geprüfte Sicherungen, Inhaltskonflikte bei gleicher Dateizeit, Löschung/Neuanlage, Fehler vor Sicherung bzw. bei Schreiben/Schließen, erhaltene Wiederherstellungsdateien, Zugriffsverlust und konkurrierende Tabs. `folder.mjs` ergänzt UI-Rettung nach fehlgeschlagenem Schließen, Browserentwurf/Notfallkopie und erneuten Konflikt während einer Entscheidung. Kein echtes Büroarchiv und keine Host-Dateien.
