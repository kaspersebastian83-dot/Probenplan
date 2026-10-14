# Probenplan 1.2

Lokale Webapp für beschriftete Grundrisse nach Brandschäden. TypeScript + Vite, ohne UI-Framework, Serverdatenbank, Konten oder externe Dienste.

Version 1.2.0 ergänzt transparente Schadensflächen und eine automatisch gruppierte Exportlegende. PDF-Import, Seitenauswahl, Drehen und Zuschneiden aus 1.1 bleiben erhalten. Die Freigabe erfolgt über einen Pull Request; der Feature-Branch wird nicht auf die produktive Website bereitgestellt.

## Online öffnen und installieren

**https://kaspersebastian83-dot.github.io/Probenplan/**

Die App vollständig laden und auf „Offline bereit“ warten. Auf iPhone/iPad in Safari öffnen und über **Teilen → Zum Home-Bildschirm** installieren. Gebäudedaten werden im Browser verarbeitet und nicht hochgeladen. Vorhandene Projekte aus der lokalen App als `.probenplan` speichern und auf der neuen Adresse wieder öffnen: Der Browserspeicher ist an die Adresse gebunden.

## Start unter Windows

1. **`Start-Probenplan.cmd` doppelklicken.** Das Fenster geöffnet lassen.
2. **http://localhost:4173** in Chrome oder Edge öffnen.
3. Warten, bis oben **„Offline bereit“** erscheint.

Die Startdatei nutzt vorhandenes Node.js oder die auf diesem PC vorhandene Codex-Laufzeit. Abhängigkeiten liegen bereits im Projekt. Auf einem neuen PC Node.js ab Version 22.13 installieren; beim ersten Start benötigt die Installation der Abhängigkeiten Internet. Danach erfolgen Start und Verarbeitung lokal. Beim Build werden PDF.js-Worker, Fonts, CMaps und Dekoder aus dem lokal installierten Paket mitgeliefert.

Ist Port 4173 bereits belegt, läuft eventuell schon die Vorschau: zuerst die Adresse öffnen. Server beenden: Strg+C im Startfenster. Bitte immer dieselbe Adresse verwenden: `localhost` und `127.0.0.1` besitzen getrennte Browserspeicher.

Alternativ mit Node.js und npm:

```powershell
npm install
npm run build
npm run preview -- --port 4173 --strictPort
```

Zur Entwicklung `npm run dev`. Die Offlinefunktion ist für den **Produktionsbuild** eingerichtet; hierfür den oben beschriebenen Start oder `build` + `preview` verwenden.

## Bedienung

1. **Plan laden:** PDF, Polycam-ZIP, SVG, PNG oder JPG auswählen. Bei mehrseitigen PDFs mit den Pfeilen oder der Seitennummer einen Grundriss in der Vorschau wählen und „Diese Seite übernehmen“ antippen. Pro Projekt wird eine Seite verarbeitet. Bei ZIP-Dateien erscheint eine Auswahl; SVG steht oben und ist empfohlen. PDFs bitte direkt auswählen; DXF und CSV bleiben ausgeschlossen.
2. **Markieren:** „Probe setzen“ bzw. „Brandherd setzen“ wählen und in den Plan klicken/tippen. Proben bekommen P1, P2 usw., Brandherde B1, B2 usw. Die nächste Probennummer ist einstellbar. Bereits belegte Kennungen werden übersprungen. Löschen nummeriert keine anderen Marker um.
3. **Bearbeiten:** In der Liste oder im Werkzeug „Markierung bearbeiten“ einen Marker wählen. Kennung und optionale Notiz ändern. Kennungen sind projektweit eindeutig, auch bei unterschiedlicher Groß-/Kleinschreibung. Punkt ziehen, um ihn zu verschieben. „Beschriftung versetzen“ löst das Schild vom Punkt; danach Schild und Punkt separat ziehen. Eine Linie verbindet beide. „Zurück an Punkt“ verbindet sie wieder. „Löschen“ entfernt den ausgewählten Marker.
4. **Navigieren:** „Ansicht bewegen“ wählen und ziehen. Auch unter „Probe setzen“ und „Brandherd setzen“ verschiebt Ziehen an einer freien Stelle mit linker Maustaste oder einem Finger die Ansicht; ein Klick/Tipp setzt weiterhin einen Punkt. Kleine Bewegungen bis 6 Bildschirm-Pixel mit Maus bzw. 8 mit Touch zählen als Klick/Tipp. Nach erkanntem Ziehen entsteht kein Punkt, das Werkzeug bleibt aktiv. Verschieben verändert weder Projektdaten noch Undo/Redo oder Autosicherung. Mausrad, Plus/Minus oder zwei Finger zoomen. „Einpassen“ zeigt den gesamten Plan samt Markierungen. Mausrad und Zweifinger-Zoom sind in jedem Werkzeug möglich; dabei werden keine neuen Marker gesetzt.
5. **Rückgängig:** Pfeiltasten oberhalb des Plans oder Strg/⌘+Z. Wiederherstellen mit Strg/⌘+Umschalt+Z bzw. Strg+Y. Bis zu 60 Bearbeitungsschritte, nur für die aktuelle Sitzung. Beim Öffnen eines anderen Projekts wird dieser Verlauf zurückgesetzt.
6. **Exportieren:** Optional Gutachtennummer und Datum eingeben (Datum kann geleert werden), PNG/JPG und 3.500/4.600 px wählen. Die tatsächlichen Abmessungen stehen darunter. Der Export umfasst immer den kompletten Grundriss mit Legende, auch bei starkem Zoom oder Beschriftungen außerhalb des Plans. Nach erfolgreicher Erstellung startet der Download; ein Link erlaubt erneutes Speichern.

Die SVG wird beim Export neu gerendert. Eingebettete Schriften und Rasterbilder bleiben erhalten. Eine PNG-/JPG-Vorlage bleibt dagegen eine Rastervorlage; höhere Ausgabeauflösung ergänzt dort keine Details. Beide Formate haben einen weißen Hintergrund, JPG verwendet hohe Qualität. Die Legende unterscheidet runde Probenmarker und rautenförmige Brandherdmarker auch ohne Farbe. **Notizen werden nur im Projekt gespeichert, nicht im Bild abgedruckt.**

## Schadensflächen und automatische Legende

- **Zeichnen:** „Fläche zeichnen“ wählen, Farbe und Deckkraft einstellen. Im Plan mindestens drei Eckpunkte setzen, dann „Fläche abschließen“. Im Dialog die vorgeschlagene Bezeichnung frei bearbeiten und speichern. „Weiterzeichnen“ behält den Entwurf; „Abbrechen“ im Werkzeug verwirft ihn. Der letzte Eckpunkt lässt sich einzeln entfernen. Ein erneuter Tipp auf den Startpunkt ist nicht nötig: Abschließen verbindet die Kontur automatisch.
- **Navigation:** Mausrad und zwei Finger zoomen, ohne weitere Eckpunkte zu setzen. Für das Verschieben der Ansicht „Ansicht bewegen“ wählen und danach zum Zeichnen zurückkehren; der Entwurf bleibt erhalten. Vorbereitung, Dateisicherung und Export benötigen einen abgeschlossenen oder abgebrochenen Entwurf. Entwürfe werden nicht automatisch gespeichert.
- **Bearbeiten:** Fläche im Plan oder in der Flächenliste auswählen. Kennung, Bezeichnung, Farbe und Deckkraft ändern; sichtbare Eckpunkte oder die ganze Fläche ziehen. Die Kontur bleibt innerhalb des Grundrisses. Selbstkreuzende/berührende Konturen werden abgewiesen und die letzte gültige Position wiederhergestellt. Löschen sowie alle Änderungen unterstützen Undo/Redo. Überlappende Flächen lassen sich gezielt über die Liste auswählen. Marker liegen oberhalb aller Flächen und bleiben über ihr eigenes Werkzeug bearbeitbar.
- **Kennungen:** Z1, Z2 usw. werden automatisch vergeben, können geändert werden und sind zusammen mit P-/B-Kennungen projektweit eindeutig. Eine Löschung nummeriert bestehende Kennungen nicht um.
- **Transparenz:** Standard 30 %, einstellbar von 5 bis 70 %. Alle Füllungen liegen unter allen Konturen; darüber liegen Flächenkennungen und anschließend Proben-/Brandherdmarker. Für schwach gesättigte Ausdrucke haben die Farben zusätzlich unterschiedliche Konturmuster.
- **Legende:** Nur tatsächlich verwendete Bezeichnungen werden angezeigt. Gleiche Bezeichnungen nach Bereinigung der Leerzeichen und ohne Unterscheidung der Groß-/Kleinschreibung ergeben eine Kategorie. Bei unterschiedlichen Farben/Deckkräften innerhalb derselben Kategorie zeigt diese die jeweils passenden Farbfelder und Kennungen. Andere, nur vorgeschlagene Kategorien erscheinen nicht. Lange Wörter und Texte werden umbrochen. Beim Hochformat steht der weiße Legendenbereich rechts, beim Querformat unter dem Plan. Die vorhandene Markerlegende sowie Gutachtennummer/Datum bleiben erhalten. PNG und JPG enthalten dieselben Flächen.

| Farbe | Frei bearbeitbarer Vorschlag |
| --- | --- |
| Rot | Brandbereich |
| Orange | Starker Schadensbereich |
| Gelb | Verdachts- oder Untersuchungsbereich |
| Blau | Löschwasser- oder Feuchtebereich |
| Grün | Gereinigter oder freigegebener Bereich |
| Grau | Sonstiger Bereich |

**Die App bewertet keine Chemie, Belastung oder Freigabe.** Farben und Bezeichnungen dokumentieren ausschließlich Ihre Eingaben; insbesondere die grüne Kategorie stellt keine automatisch festgestellte Freigabe dar.

Grenzen: höchstens 100 Flächen mit jeweils 200 Eckpunkten; einfache, auch konkave Polygone ohne Löcher. Keine Freihandkonturen, automatische Objekterkennung, Löcher, nachträgliches Einfügen/Entfernen einzelner Eckpunkte oder geometrische Vereinigung überlappender Flächen. Zu komplexe Bereiche in mehrere einfache Flächen derselben Kategorie aufteilen. Bei einer Legende, deren kleinste Schrift auf DIN A4 selbst bei optimaler Hoch-/Querformatanpassung unter 8 pt läge, wird der Export mit einem Hinweis abgewiesen: Bezeichnungen kürzen/Kategorien zusammenfassen. Der Export ist weiterhin eine Bilddatei; die endgültige Druckgröße bestimmen Sie im Gutachten.

Auf kleinen Touchscreens zum Ziehen kleiner Ecken hineinzoomen oder zunächst über die Liste auswählen. Mehrfinger-Zoom bricht einen begonnenen Flächendrag ohne Änderung ab. Die Tests mit WebKit unter Windows und mobilem Chromium ersetzen keinen echten iPhone-/iPad-Test.

## Drehen und Zuschneiden

Am einfachsten den Plan unmittelbar nach dem Import vorbereiten, anschließend markieren:

- **Links/Rechts drehen:** je Klick 90°, zweimal ergibt 180°. Probenpunkte, Brandherde und versetzte Beschriftungen werden mitgedreht; ihre Schilder bleiben lesbar ausgerichtet.
- **Zuschneiden:** im Plan mit Maus oder einem Finger einen rechteckigen Ausschnitt aufziehen. Zum Ändern einfach einen neuen Bereich ziehen. Danach **„Zuschnitt übernehmen“** oder **„Abbrechen“**. Escape bricht ebenfalls ab.
- Bei vorhandenen Markierungen muss der Ausschnitt alle tatsächlichen Probenpunkte, Brandherde und sämtliche Flächeneckpunkte enthalten. Sonst erscheint ein Hinweis und die App wartet auf einen passenden Bereich. Flächen werden nicht still abgeschnitten. Beschriftungen dürfen weiterhin außerhalb des Bildausschnitts liegen und werden vollständig exportiert. Flächen werden bei Drehung und Zuschnitt im selben Koordinatensystem mitgeführt.
- Rotation und Zuschnitt sind mit den bestehenden Undo/Redo-Schaltflächen rückgängig machbar. Auch mehrfaches Drehen und Zuschneiden speichert nur Transformationsdaten; JPG/PNG werden dabei nicht erneut komprimiert. Die Originaldatei bleibt unverändert.
- Eine perspektivische Entzerrung fotografierter Pläne ist nicht enthalten. Schräg fotografierte Fluchtpläne möglichst frontal erneut aufnehmen.

PDF-Seiten werden zunächst als PNG gerendert: bis 4.600 Pixel an der längsten Seite und höchstens 16 Megapixel, auf Mobilgeräten oder bei wenig gemeldetem Gerätespeicher höchstens 9 Megapixel. Bei einem Renderfehler folgt ein Versuch mit bis zu 3.000 Pixeln / 6 Megapixeln. Die tatsächlichen Planabmessungen sind unter der Arbeitsfläche sichtbar. Ein späterer 4.600-px-Export kann eine begrenzte PDF-Rastervorlage hochskalieren. Für zusätzliche PDF-Seiten ein eigenes Projekt anlegen. PDFs mit Passwortschutz bitte als ungeschützte Kopie bereitstellen.

Smartphone-JPGs werden einschließlich EXIF-Ausrichtung verarbeitet, Hoch-/Querformat und Originalauflösung erhalten. Geprüft wurden unter anderem JPG und PNG mit jeweils 24 Megapixeln. Die Grenze von 50 Megapixeln / 18.000 Pixeln pro Seite schützt vor sehr großen Speicherbelegungen; sie wird nach Möglichkeit bereits anhand der Bildheader geprüft. HEIC/HEIF ist nicht Bestandteil von 1.2: als JPG exportieren oder auf dem iPhone **Einstellungen → Kamera → Formate → Maximale Kompatibilität** wählen.

## Projekte speichern

- Die App sichert Änderungen automatisch in IndexedDB in diesem Browser. Nach erneutem Öffnen erscheint das zuletzt gespeicherte Projekt.
- **„Projekt speichern“** lädt eine `.probenplan`-Datei herunter: Grundriss, Kennungen, Notizen, Positionen, nächste Nummern, Gutachtennummer und Datum. Die Datei enthält die Gebäudedaten vollständig und kann selbst verwahrt werden.
- **„Projekt öffnen“** lädt eine solche Datei zur weiteren Bearbeitung. Vor dem Ersetzen bietet die App das Sichern des bisherigen Projekts an.
- Dateien aus Probenplan 1.0 (Schema 1) bleiben lesbar. PDF-Seiten oder bearbeitete Grundrisse verwenden Schema 2 mit ausgewählter Seitennummer, Auflösung, Originalbild, Rotation und Zuschnitt. Diese Dateien benötigen zum Öffnen Probenplan 1.1 oder neuer. Projekte mit Flächen verwenden Schema 3 (Flächengeometrie, Kennung, Bezeichnung, Farbe, Deckkraft und nächste Z-Nummer) und benötigen Probenplan 1.2 oder neuer. Alte Dateien ohne Flächen bleiben ohne unnötige neue Felder im bisherigen Schema. Der PDF-Dateiinhalt wird nach dem Rendern verworfen; die gewählte Seite bleibt als eingebettetes Planbild bearbeitbar. Die Seitennummer wird zur Dokumentation gespeichert, ein späterer Seitenwechsel benötigt erneuten PDF-Import.
- **Ein Zuschnitt entfernt Ränder aus dem Bildexport. Die `.probenplan`-Datei enthält für weitere Bearbeitung und Undo weiterhin die unbeschnittene Bildvorlage bzw. vollständig gerenderte PDF-Seite.** Bei Weitergabe einer Projektdatei können diese ursprünglichen Bildinformationen eingesehen werden.
- Exportierte PNG/JPG-Dateien sind fertige Bilder. Für weitere Bearbeitung zusätzlich eine Projektdatei aufbewahren.
- Automatische Sicherung ist browser- und adressgebunden. Gelöschte Browserdaten, privater Modus oder Speicherbereinigung können sie entfernen. Bei Speicherfehlern zeigt die App einen Hinweis; dann eine Projektdatei speichern.

## Installation und Offlinebetrieb

**Windows-PC:** Die App zunächst vollständig unter `http://localhost:4173` laden. Nach „Offline bereit“ können Chrome/Edge die App über ihre Installationsfunktion installieren. Der Offline-Test erfolgte mit deaktiviertem Browsernetzwerk einschließlich Neuladen und Bildexport. Für den regulären lokalen Start und App-Updates das Startfenster verwenden. Ein noch nicht eingerichteter Browser benötigt den laufenden lokalen Server.

**iPhone/iPad:** Für die spätere Installation ist eine vom Gerät erreichbare **HTTPS-Adresse** nötig. Diese in Safari öffnen, vollständig laden und dann **Teilen → Zum Home-Bildschirm** verwenden. `localhost` auf dem iPhone bezeichnet das iPhone selbst, nicht den Windows-PC. Eine einfache unverschlüsselte Windows-LAN-Adresse ermöglicht keine reguläre Service-Worker-Installation. Die HTTPS-Bereitstellung erfolgt über GitHub Pages unter der oben genannten Adresse; importierte Pläne bleiben im jeweiligen Browser.

Offlinebereitschaft kann durch das Löschen von Browserdaten oder automatische Speicherbereinigung verloren gehen. Auf Mobilgeräten bei Exportproblemen von 4.600 auf 3.500 px wechseln. Wenn das Betriebssystem den Tab wegen Speichermangel komplett beendet, kann die App keine Fehlermeldung mehr anzeigen; Projektdateien bieten zusätzliche Sicherheit.

## Aufbau und Datenschutz

- `src/main.ts`: Oberfläche, Pointer-/Touchbedienung, Kamerasteuerung.
- `src/model.ts`: Plan-Koordinaten, Kennungen, Markersymbole, Undo/Redo.
- `src/areas.ts`: Polygonprüfung, Farben/Konturen, Flächenschilder und Legendenkategorien.
- `src/import.ts`: ZIP-Auswahl, SVG-Bereinigung, Projektvalidierung.
- `src/export.ts`: hochauflösender Canvas-Export mit separatem Beschriftungsbereich.
- `src/storage.ts`: IndexedDB und Dateidownloads.
- `src/pdf.ts`: lokaler PDF.js-Worker, Seitendarstellung, Rendergrenzen und Fehlerbehandlung.
- `src/preparation.ts`: Bildmatrix und Transformation von Punkten, Beschriftungen und Ausschnitten.
- `scripts/pdf-assets.mjs`: lokale PDF-Ressourcen aus der gesperrten Abhängigkeit für Offlinebetrieb.
- `scripts/build-sw.mjs`: Service Worker mit vollständig lokalem Assetcache.
- `public/`: App-Icons, Manifest und generierte lokale PDF-Bibliotheksressourcen, **keine Beispielpläne**.

DOMPurify und eine zusätzliche Ressourcenprüfung entfernen Skripte, Ereignisattribute, Fremdinhalte und externe Referenzen aus importierten SVGs. Zulässig bleiben interne Referenzen und eingebettete Font-/Rasterdaten. Eine Content Security Policy begrenzt zusätzliche Quellen. Keine CDN-Schriften, Uploads, Analyse-Dienste oder API-Schlüssel. Nur App-Dateien werden vom lokalen Server abgerufen.

ZIP/Plan/PDF-Dateien sind auf 60 MB begrenzt, ZIP-Inhalte zusätzlich auf 100 unterstützte Dateien und 60 MB entpackte Bilddaten; Rasterbilder auf 50 Megapixel / 18.000 px pro Seite. PDF-Dokumente dürfen höchstens 500 Seiten enthalten. Projektdateien akzeptieren höchstens 3.000 Marker und sind auf 85 MB begrenzt. Die SVG-Bereinigung kann aktive oder extern verknüpfte SVG-Sonderfunktionen entfernen. Getestet wurde insbesondere der vorhandene Polycam-Export.

PDF.js wird nur zur lokalen Seitendarstellung verwendet; JavaScript aus PDFs, Links und Dateianhänge werden nicht ausgeführt oder geöffnet. Die Content Security Policy erlaubt zusätzlich lokale Font-Blobs und WebAssembly für die gebündelten PDF-Dekoder, ohne JavaScript-`eval` freizugeben. Bei öffentlichen App-Adressen lädt der Hostinganbieter die App-Dateien aus und kann dabei normale Zugriffsdaten erhalten; importierte Pläne gelangen nicht dorthin. PDF-Ressourcen sind Teil des Offlinecaches (insgesamt ungefähr 6,6 MB App-Dateien; paketabhängig). Weitere technische Optionen sind in der [offiziellen PDF.js-Dokumentation](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) beschrieben.

## Prüfung

Details siehe `PRUEFPROTOKOLL.md`. Mit laufendem Produktionsserver:

```powershell
npm test
```

Die Tests benötigen installierte Desktopversionen von Google Chrome und Microsoft Edge sowie die originale ZIP im Projektordner oder unter `beispiele/`. Ergebnisse liegen ausschließlich im ignorierten Ordner `.test-output/`. Die ZIP, Projektdateien, Testbilder, Abhängigkeiten und Buildausgabe sind aus Git ausgeschlossen.

Die Haupttests prüfen Chrome und Edge. Zusätzlich wird eine lokale Playwright-WebKit-Testlaufzeit verwendet (`node node_modules/@playwright/test/cli.js install webkit`, falls noch nicht vorhanden). Die neuen Test-PDFs enthalten ausschließlich synthetische Geometrie und werden unter `.test-output/v1.1/` erzeugt. `tests/areas.mjs` prüft Geometrie, UI, Gruppierung, Textumbruch, Pixelvergleich PNG/JPG, PDF, Vorbereitung, Speicherung, Offline und Touch; Nachweise unter `.test-output/v1.2/`. Die ursprünglichen Tests benötigen die echte Polycam-ZIP lokal; sie wird nicht in Git aufgenommen.

**Noch ausstehend:** echte iPhone-/iPad-Geräte, Safari/PWA-Installation unter iOS/iPadOS und reale Speichermangelsituationen. WebKit unter Windows und mobile Chromium-Emulation ersetzen diese Tests nicht. Auf dem iPhone/iPad vor endgültiger Freigabe besonders Flächen zeichnen/abschließen, Eckpunkte ziehen, Farb-/Deckkraftwechsel, Legende in PNG/JPG, Projektdateien mit Flächen, PDF-Auswahl, Touch-Zuschnitt, Proben/Schilder ziehen, JPG-/PNG-Downloads, Projektdateien über die Dateien-App und Offline-Neustart mit anschließendem PDF-Import prüfen.

## GitHub Pages veröffentlichen

In den Repository-Einstellungen unter **Pages → Build and deployment → Source** die Option **GitHub Actions** auswählen. Der Workflow `.github/workflows/pages.yml` installiert die gesperrten Abhängigkeiten, prüft TypeScript, baut die App und veröffentlicht ausschließlich `dist/`. Jeder Push auf `main` aktualisiert die Website. Grundrisse, Projektdateien und Testausgaben sind ausgeschlossen.

Vite verwendet relative Assetpfade. Die App funktioniert dadurch sowohl lokal als auch im GitHub-Pages-Unterverzeichnis `/Probenplan/`.

Für Version 1.2 wird ausschließlich `codex/feature/probenplan-1-2-areas` gepusht. Ausgangspunkt ist der tatsächliche Remote-`main` mit dem Squash-Merge der Version 1.1. Der bestehende Pages-Workflow veröffentlicht nur Pushes auf `main` (oder einen ausdrücklich ausgelösten manuellen Lauf). Den Pull Request erst nach Freigabe mergen; dadurch wird die automatische Veröffentlichung ausgelöst.
