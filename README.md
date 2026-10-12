# Probenplan

Lokale Webapp für beschriftete Grundrisse nach Brandschäden. TypeScript + Vite, ohne UI-Framework, Serverdatenbank, Konten oder externe Dienste.

## Start unter Windows

1. **`Start-Probenplan.cmd` doppelklicken.** Das Fenster geöffnet lassen.
2. **http://localhost:4173** in Chrome oder Edge öffnen.
3. Warten, bis oben **„Offline bereit“** erscheint.

Die Startdatei nutzt vorhandenes Node.js oder die auf diesem PC vorhandene Codex-Laufzeit. Abhängigkeiten liegen bereits im Projekt. Auf einem neuen PC Node.js ab Version 22.12 installieren; beim ersten Start benötigt die Installation der Abhängigkeiten Internet. Danach erfolgen Start und Verarbeitung lokal.

Ist Port 4173 bereits belegt, läuft eventuell schon die Vorschau: zuerst die Adresse öffnen. Server beenden: Strg+C im Startfenster. Bitte immer dieselbe Adresse verwenden: `localhost` und `127.0.0.1` besitzen getrennte Browserspeicher.

Alternativ mit Node.js und npm:

```powershell
npm install
npm run build
npm run preview -- --port 4173 --strictPort
```

Zur Entwicklung `npm run dev`. Die Offlinefunktion ist für den **Produktionsbuild** eingerichtet; hierfür den oben beschriebenen Start oder `build` + `preview` verwenden.

## Bedienung

1. **Plan laden:** Polycam-ZIP, SVG, PNG oder JPG auswählen. Bei mehreren Dateien erscheint eine Auswahl; SVG steht oben und ist empfohlen. PDF, DXF und CSV werden ignoriert. Der Originalexport wird nicht verändert.
2. **Markieren:** „Probe setzen“ bzw. „Brandherd setzen“ wählen und in den Plan klicken/tippen. Proben bekommen P1, P2 usw., Brandherde B1, B2 usw. Die nächste Probennummer ist einstellbar. Bereits belegte Kennungen werden übersprungen. Löschen nummeriert keine anderen Marker um.
3. **Bearbeiten:** In der Liste oder im Werkzeug „Markierung bearbeiten“ einen Marker wählen. Kennung und optionale Notiz ändern. Kennungen sind projektweit eindeutig, auch bei unterschiedlicher Groß-/Kleinschreibung. Punkt ziehen, um ihn zu verschieben. „Beschriftung versetzen“ löst das Schild vom Punkt; danach Schild und Punkt separat ziehen. Eine Linie verbindet beide. „Zurück an Punkt“ verbindet sie wieder. „Löschen“ entfernt den ausgewählten Marker.
4. **Navigieren:** „Ansicht bewegen“ wählen und ziehen. Mausrad, Plus/Minus oder zwei Finger zoomen. „Einpassen“ zeigt den gesamten Plan samt Markierungen. Mausrad und Zweifinger-Zoom sind in jedem Werkzeug möglich; dabei werden keine neuen Marker gesetzt.
5. **Rückgängig:** Pfeiltasten oberhalb des Plans oder Strg/⌘+Z. Wiederherstellen mit Strg/⌘+Umschalt+Z bzw. Strg+Y. Bis zu 60 Bearbeitungsschritte, nur für die aktuelle Sitzung. Beim Öffnen eines anderen Projekts wird dieser Verlauf zurückgesetzt.
6. **Exportieren:** Optional Gutachtennummer und Datum eingeben (Datum kann geleert werden), PNG/JPG und 3.500/4.600 px wählen. Die tatsächlichen Abmessungen stehen darunter. Der Export umfasst immer den kompletten Grundriss mit Legende, auch bei starkem Zoom oder Beschriftungen außerhalb des Plans. Nach erfolgreicher Erstellung startet der Download; ein Link erlaubt erneutes Speichern.

Die SVG wird beim Export neu gerendert. Eingebettete Schriften und Rasterbilder bleiben erhalten. Eine PNG-/JPG-Vorlage bleibt dagegen eine Rastervorlage; höhere Ausgabeauflösung ergänzt dort keine Details. Beide Formate haben einen weißen Hintergrund, JPG verwendet hohe Qualität. Die Legende unterscheidet runde Probenmarker und rautenförmige Brandherdmarker auch ohne Farbe. **Notizen werden nur im Projekt gespeichert, nicht im Bild abgedruckt.**

## Projekte speichern

- Die App sichert Änderungen automatisch in IndexedDB in diesem Browser. Nach erneutem Öffnen erscheint das zuletzt gespeicherte Projekt.
- **„Projekt speichern“** lädt eine `.probenplan`-Datei herunter: Grundriss, Kennungen, Notizen, Positionen, nächste Nummern, Gutachtennummer und Datum. Die Datei enthält die Gebäudedaten vollständig und kann selbst verwahrt werden.
- **„Projekt öffnen“** lädt eine solche Datei zur weiteren Bearbeitung. Vor dem Ersetzen bietet die App das Sichern des bisherigen Projekts an.
- Exportierte PNG/JPG-Dateien sind fertige Bilder. Für weitere Bearbeitung zusätzlich eine Projektdatei aufbewahren.
- Automatische Sicherung ist browser- und adressgebunden. Gelöschte Browserdaten, privater Modus oder Speicherbereinigung können sie entfernen. Bei Speicherfehlern zeigt die App einen Hinweis; dann eine Projektdatei speichern.

## Installation und Offlinebetrieb

**Windows-PC:** Die App zunächst vollständig unter `http://localhost:4173` laden. Nach „Offline bereit“ können Chrome/Edge die App über ihre Installationsfunktion installieren. Der Offline-Test erfolgte mit deaktiviertem Browsernetzwerk einschließlich Neuladen und Bildexport. Für den regulären lokalen Start und App-Updates das Startfenster verwenden. Ein noch nicht eingerichteter Browser benötigt den laufenden lokalen Server.

**iPhone/iPad:** Für die spätere Installation ist eine vom Gerät erreichbare **HTTPS-Adresse** nötig. Diese in Safari öffnen, vollständig laden und dann **Teilen → Zum Home-Bildschirm** verwenden. `localhost` auf dem iPhone bezeichnet das iPhone selbst, nicht den Windows-PC. Eine einfache unverschlüsselte Windows-LAN-Adresse ermöglicht keine reguläre Service-Worker-Installation. Diese erste Version enthält **keine externe Bereitstellung**. Eine spätere HTTPS-Bereitstellung muss separat eingerichtet werden; importierte Pläne bleiben auch dann im jeweiligen Browser.

Offlinebereitschaft kann durch das Löschen von Browserdaten oder automatische Speicherbereinigung verloren gehen. Auf Mobilgeräten bei Exportproblemen von 4.600 auf 3.500 px wechseln. Wenn das Betriebssystem den Tab wegen Speichermangel komplett beendet, kann die App keine Fehlermeldung mehr anzeigen; Projektdateien bieten zusätzliche Sicherheit.

## Aufbau und Datenschutz

- `src/main.ts`: Oberfläche, Pointer-/Touchbedienung, Kamerasteuerung.
- `src/model.ts`: Plan-Koordinaten, Kennungen, Markersymbole, Undo/Redo.
- `src/import.ts`: ZIP-Auswahl, SVG-Bereinigung, Projektvalidierung.
- `src/export.ts`: hochauflösender Canvas-Export mit separatem Beschriftungsbereich.
- `src/storage.ts`: IndexedDB und Dateidownloads.
- `scripts/build-sw.mjs`: Service Worker mit vollständig lokalem Assetcache.
- `public/`: ausschließlich App-Icons und Manifest, **keine Beispielpläne**.

DOMPurify und eine zusätzliche Ressourcenprüfung entfernen Skripte, Ereignisattribute, Fremdinhalte und externe Referenzen aus importierten SVGs. Zulässig bleiben interne Referenzen und eingebettete Font-/Rasterdaten. Eine Content Security Policy begrenzt zusätzliche Quellen. Keine CDN-Schriften, Uploads, Analyse-Dienste oder API-Schlüssel. Nur App-Dateien werden vom lokalen Server abgerufen.

ZIP/Plan-Dateien sind auf 60 MB begrenzt, ZIP-Inhalte zusätzlich auf 100 unterstützte Dateien und 60 MB entpackte Bilddaten; Rasterbilder auf 50 Megapixel. Projektdateien akzeptieren höchstens 3.000 Marker. Die SVG-Bereinigung kann aktive oder extern verknüpfte SVG-Sonderfunktionen entfernen. Getestet wurde insbesondere der vorhandene Polycam-Export.

## Prüfung

Details siehe `PRUEFPROTOKOLL.md`. Mit laufendem Produktionsserver:

```powershell
npm test
node tests/edge-cases.mjs
```

Die Tests benötigen installierte Desktopversionen von Google Chrome und Microsoft Edge sowie die originale ZIP im Projektordner oder unter `beispiele/`. Ergebnisse liegen ausschließlich im ignorierten Ordner `.test-output/`. Die ZIP, Projektdateien, Testbilder, Abhängigkeiten und Buildausgabe sind aus Git ausgeschlossen.

**Noch ausstehend:** echte iPhone-/iPad-Geräte und Safari/WebKit, Installation über HTTPS auf diesen Geräten, reale Speichermangelsituationen. Eine mobile Chromium-Emulation ersetzt diese Tests nicht.
