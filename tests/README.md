# Automatisierte Tests

Die reguläre Suite verwendet ausschließlich künstliche Daten. ZIPs und Dateien in `beispiele/` werden weder gesucht noch geöffnet.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium webkit
pnpm build
pnpm test
```

`pnpm test` startet Vites Produktionsvorschau auf einem freien Loopback-Port, führt alle sechs Suites aus und beendet den Server auch bei Testfehlern. Es wird keine bereits laufende Anwendung verwendet. Einzelne Suites können zur Diagnose mit `TEST_URL` gegen einen bewusst gestarteten Testserver ausgeführt werden.

- `browser.mjs`: synthetisches Polycam-ZIP, SVG/Ressourcen, Markierungen, Zoom/Touch, Undo/Redo, Projekt-Roundtrip, PNG/JPG und Offlinebetrieb.
- `edge-cases.mjs`: unabhängig erzeugtes Projekt und Rasterbilder, ungültige Kennungen, äußere Beschriftungen, Exportfehler und Ersatzexport.
- `import-preparation.mjs`: synthetische ein-/mehrseitige PDFs, Rotation/Zuschnitt, EXIF, Kompatibilität der Projektformate, Importfehler und Offlinebetrieb.
- `scoped-pdf.mjs`: eigener Server unter `/Probenplan/`, Offline-PDF-Import und Export.
- `areas.mjs`: Geometrie, Bearbeitung, Undo/Redo, Projektformate, Legende/Exporte und Touch.
- `keyboard.mjs`: Delete/Backspace/Escape, vollständiges Undo/Redo und Eingabeschutz.

`fixtures.mjs` generiert einen ZIP-Export mit SVG, PNG, PDF, Metadaten, Ressourcenverzeichnis und ignorierten macOS-Metadaten. Der Grundriss ist frei erfunden. Die kleine WOFF-Datei enthält eigens konstruierte geometrische Testglyphen; sie ist keine übernommene Produktschrift. PNG-Daten werden mit Node/zlib erzeugt, ZIPs mit dem bestehenden fflate. Keine zusätzlichen Laufzeitabhängigkeiten.

Unter `.test-output/` liegen Suite-Logs, eine Zusammenfassung, Fehler-Stacks, Screenshots und Playwright-Traces mit Browserfehlern. Der PR-Workflow lädt diese bei Fehlschlag hoch. Traces lassen sich mit `pnpm exec playwright show-trace <trace.zip>` öffnen. Das Verzeichnis wird vor einem vollständigen Lauf geleert, damit ältere Ergebnisse keinen Erfolg vortäuschen.

Echte Exporte sind nicht Teil dieser Suite. Etwaige manuelle Kompatibilitätsprüfungen müssen ausdrücklich separat aufgesetzt werden; deren Daten und Ergebnisse gehören nicht in CI-Artefakte oder dieses Repository.
