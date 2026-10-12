# Prüfprotokoll – Probenplan 1.0

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
