# Prüfprotokoll – Probenplan 1.1

Prüfung: 12. Oktober 2026, Windows. Feature-Branch `codex/feature/probenplan-1-1-import`. Lokaler Produktionsbuild auf `http://localhost:4181`; die produktive Website wird durch diesen Branch nicht geändert.

## Version 1.1: Implementierung und neue Prüfungen

| Bereich | Prüfung und Ergebnis |
| --- | --- |
| Build | TypeScript-Prüfung und Produktionsbuild einschließlich lokal gebündeltem PDF.js 6.4.299 erfolgreich. Gesamtgröße der ausgelieferten App-Dateien etwa 6,6 MB. |
| PDF-Import | Einseitige PDF direkt übernommen; mehrseitige PDF mit Vorschau, Vor-/Zurück, direkter Seiteneingabe und Abbrechen. Eine ausgewählte Seite je Projekt. |
| Auflösung | Synthetische 600 × 800-Punkte-Seite auf einem simulierten Desktop mit ausreichend Speicher als 3450 × 4600 px gerendert. Mobile Renderfläche auf höchstens 9 Megapixel begrenzt. |
| Rotation | Links/rechts jeweils 90°, zweimal 180°, Undo/Redo. Originalbilddaten bleiben unverändert. |
| Zuschnitt | Aufziehen, Abbrechen, Übernehmen, Undo/Redo. Zuschnitt mit außerhalb liegenden Probenpunkten wird abgewiesen. |
| Markertransformation | Punkte und separat versetzte Schilder nach Drehung und Zuschnitt rechnerisch geprüft; danach Proben und Brandherde setzen sowie Punkte verschieben. |
| Export | Bearbeitete PDF-Seite als PNG mit 3500 px und JPG mit 4600 px exportiert, Abmessungen kontrolliert und beide Bilder visuell geöffnet. Planzeichnung, Marker, Hinweislinie und Legende vollständig und lesbar. |
| Projektdateien | Schema 2 mit PDF-Seite, Originalbild, Rotation und Zuschnitt gespeichert, wieder geöffnet und nach Neuladen aus IndexedDB vollständig wiederhergestellt. Synthetische Schema-1-Datei einschließlich Marker, Notiz und Metadaten korrekt übernommen. |
| Offline | Chrome und Edge: Netzwerk deaktiviert, App neu geladen, weitere PDF lokal importiert und exportiert. WebKit: ebenfalls Offline-PDF-Import und PNG-Ausgabe. |
| GitHub-Pages-Pfade | Separater lokaler HTTP-Test unter `/Probenplan/`: vollständig gecachte App offline neu geladen, PDF erstmals importiert und exportiert. Worker, PDF-Chunk, Fonts und Ressourcen blieben im Unterverzeichnis; keine externen Requests. |
| Smartphone-Bilder | Synthetische JPG- und PNG-Dateien mit je 24 Megapixeln (6000 × 4000) ohne erneute Kompression übernommen; PNG gedreht. JPEG mit EXIF-Orientierung 6 korrekt als Hochformat und im Export dargestellt. |
| Fehlerfälle | Beschädigte PDF, PDF über 60 MB, HEIC und Rasterheader mit mehr als 50 Megapixeln verständlich abgewiesen; bestehendes Projekt blieb erhalten. Canvas-Fehler bei PDF-Rendering simuliert: automatischer erfolgreicher Versuch innerhalb 3000 px / 6 Megapixel. |
| Browser | Neue Abläufe in Google Chrome und Microsoft Edge automatisiert geprüft; zusätzliche Playwright-WebKit-Prüfung unter Windows. |
| Touch | Chromium mit iPhone-13-Emulation: Seitenauswahl, Drehen, Zuschnitt mit Touch-Geste und Touch-Bestätigung, genau ein Undo/Redo-Schritt sowie Probenmarker per Touch. Keine horizontale Überbreite. |
| Echte Vorlage | Originale Polycam-PDF aus der lokalen, unveränderten ZIP gerendert und als PNG exportiert; nur ignorierte lokale Testdateien. |
| Speicher | Undo-Snapshots teilen die unveränderlichen Bilddaten, statt sie bei jedem Schritt erneut zu kopieren. Vorschaubilder werden nacheinander gerendert; PDF-Worker und Render-Canvas werden nach Nutzung freigegeben. |

Die bisherigen Kernabläufe wurden zusätzlich mit den bestehenden Tests erneut geprüft: Polycam-ZIP/SVG mit eingebetteter Schrift und Grafik, PNG/JPG, P-/B-Kennungen, Löschen ohne Umnummerierung, Startnummer, Markerverschiebung und separate Beschriftung, Zoom, Undo/Redo, Gutachtennummer/Datum, Legende, Projektdatei und Autosicherung sowie Offline-Neustart. Die bestehenden Sicherheits- und Exportfehlerprüfungen bestanden ebenfalls.

## Während der Prüfung behoben

- Bei direkter Eingabe einer PDF-Seitennummer konnte ein zusätzlicher Blur-`change` die Vorschau erneut starten und den ersten Übernehmen-Klick verlieren. Derselbe Seitenindex wird nun nicht erneut geladen; Abbrechen und erneutes Öffnen sind ebenfalls geprüft.
- Die Touch-Emulation lieferte nach einer erfassten Zuschneidegeste teilweise keinen normalen Button-Klick. Bestätigung und Abbrechen verwenden bei einem abgeschlossenen Touch-Tipp eine einmalige Ersatzaktivierung, wenn der normale Klick ausbleibt. Die normale Klickbedienung bleibt erhalten; die mobile Undo-Prüfung kontrolliert, dass ein Zuschnitt nur einmal angewandt wird.

## Lokale Nachweise und Wiederholung

`.test-output/v1.1/` enthält die synthetisch erzeugten Test-PDFs, `results.json`, PNG/JPG-Exporte der bearbeiteten Seiten, Projektdateien, mobile Screenshots, EXIF-Testexporte, `real-polycam-pdf.png` und `scoped-offline.png`. Der gesamte Ordner ist aus Git ausgeschlossen. Die neue SVG-/PDF-/Bild-Testgeometrie im Testcode ist synthetisch; reale Objektunterlagen werden nicht committed. Auch der vorhandene entpackte Polycam-Ordner ist nun explizit ignoriert.

Mit laufendem Produktionsserver alle Prüfungen ausführen:

```powershell
npm test
```

Für die in diesem Arbeitslauf verwendete separate Vorschau zuerst `$env:TEST_URL='http://localhost:4181'` setzen. WebKit bei Bedarf mit `node node_modules/@playwright/test/cli.js install webkit` installieren. Der Unterverzeichnis-Test startet und beendet einen eigenen lokalen Testserver. Die ursprünglichen Regressionstests benötigen die Polycam-ZIP lokal im Projektordner oder unter `beispiele/`.

## Grenzen und iPhone-/iPad-Prüfung

- **Keine physischen iPhones/iPads getestet.** WebKit unter Windows und iPhone-Emulation in Chromium sind automatisierte Browserprüfungen, keine tatsächlichen Safari-/iOS-/iPadOS- oder Home-Bildschirm-Installationstests.
- Nach Freigabe und Installation der Version 1.1 auf einem echten Gerät: Fotoimport aus Fotos/Dateien (Hoch-/Querformat), PDF-Seitenauswahl, wiederholtes Drehen/Zuschneiden, Touch-Ziehen von Punkt und Beschriftung, Undo/Redo, PNG/JPG-Downloads und `.probenplan`-Dateien über die Dateien-App testen. Anschließend Flugmodus aktivieren, App neu starten und eine lokal verfügbare PDF importieren und exportieren.
- Reales Beenden eines Tabs durch Speichermangel wurde nicht provoziert. Die App begrenzt Renderflächen und bietet verständliche Fehler bzw. eine kleinere PDF-Renderstufe; ein vom Betriebssystem beendeter Tab kann selbst keine Meldung mehr anzeigen.
- PDFs werden als Rastervorlage übernommen. Bei technisch begrenzter Ausgangsauflösung ergänzt ein größerer Bildexport keine weiteren Details. Maximal 500 Seiten je PDF; passwortgeschützte PDFs benötigen eine ungeschützte Kopie.
- Kein HEIC/HEIF, keine perspektivische Entzerrung, kein DXF/CSV. Ein PDF-Seitenwechsel erfolgt durch erneuten Import, nicht innerhalb des bestehenden markierten Projekts.
- **Projektdateien bewahren die unbeschnittene Vorlage.** Aus einem zugeschnittenen Projekt können ursprüngliche Bildränder ausgelesen werden; fertige PNG/JPG-Dateien enthalten den bestätigten Ausschnitt und die außerhalb liegenden Marker/Legende. Alle Projekt- und Planinhalte bleiben im Browser bzw. in heruntergeladenen lokalen Dateien.
- Der Pages-Workflow veröffentlicht nur `main` oder einen bewusst ausgelösten manuellen Lauf. Dieser Feature-Branch wird ausschließlich als Pull Request zur Freigabe bereitgestellt und nicht gemergt.

---

# Historisches Prüfprotokoll – Probenplan 1.0

Erstprüfung: 12. Oktober 2026. Lokaler Produktionsbuild unter `http://localhost:4173`, Windows; zu diesem Zeitpunkt keine Veröffentlichung.

## Erfolgreich geprüft

| Bereich | Nachweis |
| --- | --- |
| Build | Strikter TypeScript-Check und Vite-Produktionsbuild erfolgreich. |
| Echter Polycam-Export | Original-ZIP eingelesen; SVG/PNG-Auswahl, SVG bevorzugt; Vektormaße 914 × 1160. Eingebettete Noto-Sans-Schrift erhalten. |
| Probenkennungen | P1/P2/P3 gesetzt; P2 gelöscht; P1/P3 unverändert; nächste Probe P4. Startnummer 20 ergibt P20. Doppelte Kennung wird abgewiesen. |
| Brandherde | Separater Modus; B1 mit Rautenform und Kennung. Gemeinsame Bearbeitungs-, Verschiebe- und Löschfunktionen. |
| Koordinaten | Projektkoordinaten vor und nach mehreren Zoomschritten identisch. |
| Bearbeitung | Notiz, getrenntes Ziehen von Punkt und Beschriftung sowie Hinweislinie; Rückgängig und Wiederherstellen geprüft. |
| Projektdatei | Herunterladen, Wiederöffnen und Vergleich aller Projektdaten. Ungültige Datei mit doppelten Kennungen abgewiesen; bisheriges Projekt bleibt erhalten. |
| Autosicherung | Neuladen stellt Grundriss, Kennungen, Notizen, Positionen und Metadaten aus IndexedDB wieder her. |
| PNG | 2512 × 3500 Pixel; vollständiger Plan, Schrift, Maßtexte, eingebettetes Polycam-Logo, Proben-/Brandherdmarker und Legende visuell geöffnet und geprüft. |
| JPG | 3301 × 4600 Pixel, weißer Hintergrund, hohe Qualität; ebenfalls geöffnet und visuell geprüft. |
| Exportausschnitt | Beide Exporte aus vergrößerter Ansicht erstellt; trotzdem kompletter Plan. Zusätzlich Beschriftungen oberhalb/links und rechts/unterhalb des Plans sowie eine lange Brandherdkennung getestet. |
| SVG-Ressourcen | Separater Test mit eingebettetem farbigem PNG und der Originalschrift: beides sichtbar im Export, inklusive Umlauten. |
| SVG-Sicherheit | Test-SVG mit Skript, Ereignisattribut und externen Bild-/CSS-Verweisen bereinigt. Keine externen Requests beim Import/Export. |
| Rasterimport | Einzelne PNG- und JPG-Dateien erfolgreich geladen. |
| Exportfehler | Canvas-Fehler simuliert: deutsche Fehlermeldung, Schaltfläche für kleinere Stufe, erfolgreicher Ersatzexport mit 3500 Pixeln. |
| Offline | Chrome **und** Edge: nach Erstladen Netzwerk im Browserkontext deaktiviert, neu geladen, Projekt wiederhergestellt und PNG exportiert. |
| Mobile Ansicht | Chromium, 390 × 844 CSS-Pixel, Touch aktiviert: keine horizontale Überbreite, Probe per Touch, Zweifinger-Zoom ohne zusätzliche Markierungen oder veränderte Planpositionen. |
| App-Dateien | Build enthält nur App-Code, CSS, Icons, Manifest und Service Worker. Originaldateien und Testartefakte nicht enthalten. |

Die vollständigen Bedienprüfungen liefen in den installierten Desktopbrowsern **Google Chrome und Microsoft Edge** automatisiert mit Playwright, jeweils mit frischem Browserkontext. Screenshots und Exporte wurden zusätzlich geöffnet. Es gab in den erfolgreichen Haupttestläufen keine JavaScript-Laufzeitfehler und keine externen HTTP-Anfragen.

## Behobener Fehler

Beim ersten Offline-Test wurden zwischengespeicherte JS-/CSS-Dateien wegen unterschiedlicher `Origin`-Anfrageheader und der `Vary: Origin`-Antwort des lokalen Vorschau-Servers nicht gefunden. Der Service Worker verwendet für die unveränderlichen, eigenen App-Dateien nun einen Cache-Abgleich ohne `Vary`. Die anschließenden Offlineprüfungen bestanden in beiden Browsern.

## Lokale Nachweise

Der aus Git und der App-Auslieferung ausgeschlossene Ordner `.test-output/` enthält:

- `results.json`, `edge-results.json`: erfolgreiche Prüfungen.
- `chrome-plan-3500.png`, `chrome-plan-4600.jpg`: echte Beispielgrundlage mit Testmarkierungen.
- Entsprechende Edge-Exporte und Offline-Exporte.
- `chrome-roundtrip.probenplan`, `msedge-roundtrip.probenplan`: geprüfte Projektdateien.
- `chrome-workspace.png`, `msedge-workspace.png`, `mobile.png`: Oberflächenansichten.
- `embedded-resources.png`: Font-/Bildtest.
- `outside-labels.png`, `fallback-3500.png`: Rand- und Fehlerfallprüfungen.

Diese Dateien enthalten teilweise Gebäudedaten. Sie bleiben lokal und werden nicht mit der App ausgeliefert. Der Original-ZIP-Export wurde nicht geändert. Sein SHA-256-Fingerabdruck lautet:

```text
E868C869B6DAF0B4312D9AA82D176C15DB73CCE55877D66A5662BBD0A0D550C7
```

## Ausstehend und Grenzen

- **Keine Tests auf echten iPhones/iPads oder in Safari/WebKit.** Mobile Chromium-Emulation ist kein Nachweis für Safari, iOS-Dateidownloads oder deren Speichergrenzen.
- Eine echte iOS-Installation über HTTPS wurde mangels Bereitstellung nicht getestet. Auch die native Installationsoberfläche von Windows wurde nicht durchgeklickt; Manifest, Icons, Service Worker und Offlinebetrieb sind vorhanden und geprüft.
- Realer Gerätespeichermangel wurde nicht provoziert; die Wiederherstellung nach einem Canvas-Exportfehler wurde simuliert. Ein vom Betriebssystem beendeter Tab kann keine Meldung anzeigen.
- Keine PDF-, DXF- oder CSV-Verarbeitung; kein Zusammenführen mehrerer Pläne. Je Projekt ein Grundriss.
- Browserdaten sind keine dauerhafte Datensicherung. Projektdateien zusätzlich speichern.

## Wiederholung

Zuerst `Start-Probenplan.cmd` ausführen. Danach mit Node.js und installierten Projektabhängigkeiten:

```powershell
node tests/browser.mjs
node tests/edge-cases.mjs
```

Die Randfalltests verwenden die Projektdateien des Haupttests und werden deshalb danach ausgeführt.

## Vorbereitung für GitHub Pages

12. Oktober 2026: Produktionsbuild mit relativen Assetpfaden erfolgreich. Die 16 Hauptprüfungen und fünf Randfallprüfungen wurden erneut unter `http://127.0.0.1:4175/Probenplan/` bestanden, einschließlich Offline-Neustart und Bildexport in Chrome und Edge. Damit wurde der Unterverzeichnisbetrieb für GitHub Pages lokal überprüft. Der Service-Worker-Cache ist auf seinen jeweiligen Anwendungspfad begrenzt. Die echten Safari-/iOS-Geräteprüfungen bleiben ausstehend.
