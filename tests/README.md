# Automatisierte Tests

Die reguläre Suite verwendet ausschließlich künstliche Daten. ZIPs und Dateien in `beispiele/` werden weder gesucht noch geöffnet.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium webkit
pnpm build
pnpm test
```

`pnpm test` startet Vites Produktionsvorschau auf einem freien Loopback-Port, führt alle neunzehn Suites aus (Liste in `tests/run.mjs`) und beendet den Server auch bei Testfehlern. Es wird keine bereits laufende Anwendung verwendet. Einzelne Suites können zur Diagnose mit `TEST_URL` gegen einen bewusst gestarteten Testserver ausgeführt werden.

- `browser.mjs`: synthetisches Polycam-ZIP, SVG/Ressourcen, Markierungen, Zoom/Touch, Undo/Redo, Projekt-Roundtrip, PNG/JPG und Offlinebetrieb.
- `edge-cases.mjs`: unabhängig erzeugtes Projekt und Rasterbilder, ungültige Kennungen, äußere Beschriftungen, Exportfehler und Ersatzexport.
- `import-preparation.mjs`: synthetische ein-/mehrseitige PDFs, Rotation/Zuschnitt, EXIF, Kompatibilität der Projektformate, Importfehler und Offlinebetrieb.
- `scoped-pdf.mjs`: eigener Server unter `/Probenplan/`, Offline-PDF-Import und Export.
- `areas.mjs`: Geometrie, Bearbeitung, Undo/Redo, Projektformate, Legende/Exporte und Touch.
- `keyboard.mjs`: Delete/Backspace/Escape, vollständiges Undo/Redo und Eingabeschutz.
- `marker-pan.mjs`: Maus-/Touch-Klick und Ziehen in beiden Setzwerkzeugen, unveränderte Speicherung/History und Zoom.
- `labreport.mjs` / `lab-fixtures.mjs`: namespace-/CRLF-XML, Zeitzone/Referenzmapping, getrennte Rohwerte, positionierte und absichtlich ungeordnete PDF-Texte, transponierte Ergebnistabellen, 2–3-zeilige Beschreibungen, Tabellenfortsetzungen/Spaltenvarianten, Abweichungen und textlose PDF. Browser prüfen Review/Abbruch, Konflikte, Mouse-/Touch-/Pen-Platzierung, Projekt-/JSON-Roundtrip, Schemas 1–4 und Offlinebetrieb. Parser-Unitprüfungen nutzen einen separaten temporären Modulserver; keine Test-API wird in der App ausgeliefert.

- `lab-provenance.mjs`: stabile Berichts-IDs, isolierte History-Snapshots, XML/PDF/Kombinationsimport, P1–P9 mit drei platzierten und sechs offenen Proben, Öffnen in frischem Browserkontext, IndexedDB-Neustart und automatisch vorbelegter JSON-Export. Mehrfachberichte mit gleicher/fehlender Nummer und gleichen Dateinamen, explizites Ersetzen offener/platzierter Proben, Umnummerierung, Abbruch, Formate 1–4 und fehlerhafte Herkunftsdaten. Ausschließlich synthetische Daten.
- `vorlaeufig.mjs`: Hinweis „vorläufiger Prüfbericht“ in der Word-Anlage (unter dem Lageplan als Ergebniskarte und im Probenverzeichnis), gemeinsamer Text mit Ergebniskarte und Dialogen. Node, synthetische Daten.
- `skalen-archiv.mjs`: gemeinsame Bewertungsskalen im Archivordner (`_Spektron-Skalen.json`) – Abgleich, erstes Teilen, Löschungen anderer, Änderungen ohne Schreibrecht, kaputte Datei; gleicher Test wie in FotoKit. Node, synthetische Daten.

- `floors.mjs`: mehrere Pläne – schmale Leiste bei einem Plan (bisheriges Format), „＋ Plan“, fortlaufende Nummern und gebäudeweit eindeutige Kennungen, Wechseln per Klick und Bild↓, Umbenennen, Undo/Redo springt zum betroffenen Plan, Laborprobe auf einem Obergeschoss platzieren und beim Löschen zurückgeben, Export „Alle Pläne“, Speichern/Öffnen von Format 5 inklusive Ablehnung doppelter Kennungen und mehrseitige PDF als einzelne Pläne.
- `results.mjs`: Ergebniskarte – Messwerte aus der Labor-XML je Probe, Einfärbung nach FotoKit-Skala (grün → rot, ohne Wert grau), Skala bearbeiten mit Undo und Rückschreiben in den gemeinsamen Speicher, Parameterwechsel und „Skala anlegen“, Export als Ergebniskarte und Probenplan, Projektdatei mit Skala/Farben inklusive Ablehnung ungültiger Farben.
- `folder.mjs` (nur Chromium, Archiv im privaten Browser-Dateisystem nachgebildet): Öffnen per `?projekt=`, Projektkennung, Grundrisse aus „Pläne“, automatisches Speichern statt Download, Bildexport in „Pläne“, Probenerfassung aus LabelKit als offene Proben, Laborbericht aus „Laborergebnisse“ mit „Alle Konflikte: Aktualisieren“, erneutes Öffnen aus der Datei, Konfliktabfrage bei fremder Änderung und Sicherungskopie beim Ersetzen. Lokal unter Linux mit `LANG=C.UTF-8` ausführen (Umlaute in Ordnernamen).
- `align.mjs`: Feinausrichtung – Rechnung ohne Browser (ohne Winkel exakt wie bisher, Markierungen/Flächen/Nord bleiben auf derselben Stelle des Originals, hin und zurück, Ausschnitt, Grenzen, Format 6) und im Browser: Raster, „An Kante ausrichten“ an einer schiefen Wand, Ziehen (auch fein), Tasten, Regler/Zahl, Abbrechen, Rückgängig, Export ohne schwarze Ecken, Speichern/Öffnen und Ablehnung alter/neuerer Formate.
- `leiste.mjs`: Leiste der Projekt-Apps – Projekt und zuletzt geöffnete Projekte, Haken der Arbeitsschritte nach Ordnerstand, „Weiter“ zum nächsten Schritt, Menü bleibt bei Hintergrundaktualisierung offen.
- `layout.mjs`: Karte zuerst – Kartenanteil und keine Seitenscrollleiste bei 1366 × 658, standardmäßig eingeklappte Liste, Aufklappen bei Auswahl, Tastenkürzel (auch nicht beim Tippen), gemerkter Listenzustand und Exportkarte. Die übrigen Suites starten mit geöffneter Liste (`runtime.mjs`).

`fixtures.mjs` generiert einen ZIP-Export mit SVG, PNG, PDF, Metadaten, Ressourcenverzeichnis und ignorierten macOS-Metadaten. Der Grundriss ist frei erfunden. Die kleine WOFF-Datei enthält eigens konstruierte geometrische Testglyphen; sie ist keine übernommene Produktschrift. PNG-Daten werden mit Node/zlib erzeugt, ZIPs mit dem bestehenden fflate. Keine zusätzlichen Laufzeitabhängigkeiten.

Unter `.test-output/` liegen Suite-Logs, eine Zusammenfassung, Fehler-Stacks, Screenshots und Playwright-Traces mit Browserfehlern. Der PR-Workflow lädt diese bei Fehlschlag hoch. Traces lassen sich mit `pnpm exec playwright show-trace <trace.zip>` öffnen. Das Verzeichnis wird vor einem vollständigen Lauf geleert, damit ältere Ergebnisse keinen Erfolg vortäuschen.

Echte Exporte sind nicht Teil dieser Suite. Etwaige manuelle Kompatibilitätsprüfungen müssen ausdrücklich separat aufgesetzt werden; deren Daten und Ergebnisse gehören nicht in CI-Artefakte oder dieses Repository.

Manuelle Laborbeispiele und ihre Screenshots/Extraktionen ausschließlich im ignorierten `.manual-checks/` ablegen. Der automatisierte Runner liest diesen Ordner nicht und lädt ihn nicht als Diagnose hoch.

`lab-regressions.mjs` erweitert die isolierten Parserprüfungen um synthetische deutsche/internationale Zahlen, mehrdeutige/ungültige Eingaben, gültige numerische BG, getrennte Qualifikatoren n.n./n.b., fehlerhafte `<`-Angaben ohne Bewertung, BG ohne Nullwert, VdS-Grenzfälle und Einheiten, unveränderte Rohwerte sowie XML/PDF-Metadaten. `results.mjs` prüft außerdem Nutzungsauswahl, Undo/Redo, Projekt-Roundtrip und unveränderte FotoKit-Skalen. Ausführung in GitHub Actions; für 1.8.1 wurden lokal weder Abhängigkeiten installiert noch Builds oder Tests ausgeführt.

- `folder-safety.mjs`: synthetische Dateien im privaten Browserdateisystem; eindeutige geprüfte Sicherungen, Inhaltskonflikte bei gleicher Dateizeit, Löschung/Neuanlage, Fehler vor Sicherung bzw. bei Schreiben/Schließen, erhaltene Wiederherstellungsdateien, Zugriffsverlust, konkurrierende Tabs und das Aufräumen alter „(vorher …)“-Sicherungen (neueste 10 + je Tag die neueste; Wiederherstellungsdateien und manuelle Kopien bleiben). `folder.mjs` ergänzt UI-Rettung nach fehlgeschlagenem Schließen, Browserentwurf/Notfallkopie und erneuten Konflikt während einer Entscheidung. Kein echtes Büroarchiv und keine Host-Dateien.

Zusätzliche 1.8.2-Regressionsgruppen in `folder.mjs`: aktuelle ungespeicherte Fassung vor Konfliktwahl erhalten; fehlgeschlagene Wiederherstellungsdatei verhindert Laden/Import und Überschreiben des Browserentwurfs; kalter Start mit „Datei verwenden“; verzögertes Schließen einer expliziten Speicherung mit neueren Änderungen und ausbleibender veralteter Erfolgsnachricht. Fehler und Wartebarrieren werden nur in synthetischen Browserdateien injiziert.

`marker-size.mjs` (1.9.0) prüft die Punktgröße je Plan: Modellfaktor und Tastenschritte mit Grenzen, Tasten `<`/`>` (nicht in Eingabefeldern oder mit Strg), proportionalen Regler, Rückgängig als ein Schritt, getrennte Werte je Geschoss mit Speichern/Öffnen sowie Abweisung ungültiger Werte und unveränderte ältere Dateien (Chromium und WebKit).

`sheet-pdf.mjs` (1.10.0) prüft das maßstäbliche PDF: Messen mit Esc/Abbrechen/ungültiger Länge, Kontrollmessung, Nordpfeil mit Drehen und Rückgängig, Speichern/Öffnen und Abweisung ungültiger Werte, Blattgrößen A4/A3, automatische Hoch-/Querwahl und Maßstabswahl (1:100, 1:200, 1:250), mehrseitiges PDF für „Alle Pläne“ sowie eine Flächenlegende. Ein kleiner Leser im Test prüft xref-Tabelle und Seitengröße, entpackt das Seitenbild und misst den Abstand zweier Planlinien auf dem Blatt (Toleranz 0,2 mm). `PDF_DUMP=<Ordner>` legt die PDFs zur Sichtprüfung ab. `results.mjs` exportiert zusätzlich die Ergebniskarte als A3-PDF.

`anlage.mjs` (1.11.0) erzeugt die Word-Anlage im nachgebildeten Projektordner (nur Chromium): drei Proben im Plan, eine offene, Laborbericht, Fotos aus FotoKit (eins verändert, eins mit unbekannter Probe-Nr., eins aussortiert, eins gedreht). Ein kleiner ZIP-Leser prüft Text (Rohwerte, Einordnung, Probenblätter, Prüfprotokoll mit Prüfsummen der echten Dateien), Bilder (Planseite in Originalgröße, Fotos nur einmal gespeichert, Drehung angewendet), die Protokollzeile, dass nichts überschrieben wird und zwei Geschosse. `ANLAGE_DUMP=<Ordner>` legt die .docx zur Sichtprüfung ab.

`weiter-platzieren.mjs` (1.47.0, Node) prüft die Rechnung des Weiter-Platzierens: Raum und Geschoss der offenen Probe, Sortierung (Geschoss, Raum, ohne Raum zuletzt), nächste Probe im selben Raum vor dem nächsten Raum, Überspringen, Hinweistext und Schalter. `weiter-platzieren-browser.mjs` (Chromium und WebKit, Touch in Chromium) prüft die Oberfläche: Hinweisfeld, Weiterwählen, Raumwechsel, Überspringen, Esc/Fertig, Ende der Liste, Ziehen aus der Liste, Rückgängig, Schalter aus. Die übrigen Suites laufen mit ausgeschaltetem Schalter (`runtime.mjs`), `?weiter-default` prüft den Standard.

`probenliste.mjs` (1.48.0, Node) prüft die Rechnung der Probenliste: Titel und Zeilen aus offenen und platzierten Laborproben (auch über mehrere Pläne), Gruppen nach Geschoss und Raum, Reihenfolge im Raum, fertige Räume am Ende, Filter und Suche, „Zurück zu offen“ samt Ablehnungen. `probenliste-browser.mjs` (Chromium und WebKit) prüft die Oberfläche: Reiter und Pfeiltasten, Fortschritt, Filter-Zähler, Gruppen, Platzieren aus der Liste mit Weiter-Platzieren, zugeklappte fertige Räume, Suche, Hervorheben Liste ↔ Plan, ⋯-Menüs, Brandherde, Ziehen, Schalter aus. Die übrigen Suites laufen mit ausgeschalteter neuer Liste (`runtime.mjs`), `?liste-default` prüft den Standard.

`storno.mjs` (1.51.0, Node) prüft stornierte Proben aus LabelKit (Feld `storniert`, ab LabelKit 4.49.0): nicht in der Prüfliste, Hinweis in der Prüftabelle, offene stornierte Proben fallen bei erneuter Übernahme weg, Nummern bleiben reserviert (auch bei „Nächste freie P-Nummer“), aufgehobenes Storno wird wieder angeboten, Hinweistexte, „Behalten“ je Stornierung und Entfernen auf jedem Plan. `storno-browser.mjs` (Chromium und WebKit) prüft die Oberfläche: „Noch zu platzieren“ und Zähler ohne stornierte Proben, Hinweis „P7 ist storniert – Punkt entfernen?“ je gesetztem Punkt, Behalten, Entfernen nach Rückfrage (Abbrechen, Bestätigen, Strg+Z) und aufgehobenes Storno; im nachgebildeten Projektordner (nur Chromium) das Lesen der LabelKit-Datei ohne erneutes Übernehmen, Hinweis für eine offene Probe und eine Datei eines anderen Projekts.

`browser-kopie.mjs` (1.52.0, Chromium) prüft die Browserkopie ohne Projektordner: Vermerk zur Herkunft, Rückfrage bei einer Sicherung ohne Vermerk („Als Datei sichern“ / „Trotzdem öffnen“), Projekte aus dem Projektordner überschreiben die freie Sicherung nicht, Knopf oben „Grundriss ersetzen …“ und die Rückfrage beim Ersetzen.
