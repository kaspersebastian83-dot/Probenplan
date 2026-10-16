# PlanKit 1.9.0 (früher Probenplan)

PlanKit gehört zur Familie von LabelKit und FotoKit und sieht genauso aus. Webadresse, Repository, Startdatei und das Dateiformat `.probenplan` behalten den bisherigen Namen – bestehende Projekte, Lesezeichen und installierte Apps funktionieren unverändert weiter.

Lokale Webapp für beschriftete Grundrisse nach Brandschäden. TypeScript + Vite, ohne UI-Framework, Serverdatenbank, Konten oder externe Dienste.

Version 1.9 macht die Punktgröße je Plan einstellbar (Regler und Tasten < >). Version 1.8 arbeitet direkt im Projektordner: aus der Projektzentrale „Plan bearbeiten“ oder „📁 Projekt“ – automatisches Speichern in „Pläne“, Bilder ebenfalls dorthin, Laborberichte aus „Laborergebnisse“. Version 1.7 bringt die Ergebniskarte: Probenmarker werden nach Ihrer Bewertungsskala (dieselbe wie in FotoKits Ergebnistabelle) eingefärbt, mit Legende im Export. Version 1.6 bringt mehrere Pläne pro Projekt (z. B. EG, 1. OG, 2. OG) mit einer Vorschauleiste unter dem Plan, fortlaufenden Probennummern über alle Pläne und Export je Plan. Version 1.5 gibt dem Plan den Vorrang: eine schlanke Kopfzeile, Werkzeuge links, einklappbare Liste rechts und Export als schwebende Karte – je nach Bildschirm 87–92 % der Fläche für den Plan. Version 1.4 brachte den Namen PlanKit und das Aussehen von FotoKit/LabelKit. Version 1.3.1 bewahrt die Labor-Herkunft dauerhaft beim Speichern und Wiederöffnen. Der lokale Laborimport aus Eurofins-XML/PDF und die Platzierung offener Proben bleiben erhalten. PDF-Grundrisse, Bildvorbereitung, Schadensflächen, Tastaturkürzel und intuitives Verschieben in Setzwerkzeugen bleiben erhalten. Änderungen siehe `CHANGELOG.md`. Die Freigabe erfolgt über einen Pull Request; der Feature-Branch wird nicht auf die produktive Website bereitgestellt.

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

**Aufbau (ab 1.5):** Oben die Kopfzeile mit *Plan laden*, *Öffnen*, *Speichern*, *Laborbericht importieren*, Planname, Rückgängig/Wiederherstellen, Hilfe (**?**), **Exportieren …** und **☰ Liste**. Links die Werkzeugleiste: Ansicht (V), Probe (P), Brandherd (B), Bearbeiten (E), Fläche zeichnen (F), Fläche bearbeiten (G), Links/Rechts drehen (Umschalt+R/R) und Zuschnitt (C). Der Rest ist Plan. Über dem Plan zeigt eine schmale Leiste das aktive Werkzeug und die nächste Probennummer, beim Flächenzeichnen auch Farbe, Deckkraft und „Fläche abschließen“. Zoom und Einpassen sitzen unten rechts (+, −, 0), die Legende unten links.

**Projektordner (ab 1.8):** Aus der Projektzentrale „Plan bearbeiten → PlanKit“ (öffnet `?projekt=<Ordnername>`) oder in PlanKit „📁 Projekt“ und den Projektordner bzw. dessen „Pläne“ wählen. Der Archivordner kommt aus dem gemeinsamen Browser-Speicher (`mosaik-suite`/`archiv`, wie FotoKit); nach einem Browserneustart genügt „Zugriff erlauben“. PlanKit speichert jede Änderung automatisch als `Probenplan <Projekt>.probenplan` in „Pläne“ und zusätzlich im Browser (je Projekt). Bei abweichendem ungespeicherten Browserentwurf fragt PlanKit beim Öffnen, welche Fassung zur Prüfung geladen werden soll. Hat jemand anderes die Datei nach dem Öffnen gespeichert, wird nicht überschrieben: andere Fassung laden, eigene als Kopie sichern oder bewusst übernehmen. Wird der Plan durch einen neuen Grundriss oder eine andere Projektdatei ersetzt, bleibt die bisherige Datei als „(vorher …)“-Kopie erhalten. Exportierte Bilder heißen `Probenplan <Projekt> - <Plan> [- Ergebniskarte].png` und liegen ebenfalls in „Pläne“. Ohne Plan zeigt der Startbildschirm Grundrisse aus „Pläne“ zur direkten Auswahl; „Laborbericht importieren …“ listet XML/PDF aus „Laborergebnisse“ (gleichnamige XML+PDF gemeinsam). Im selben Dialog steht die Probenerfassung aus LabelKit (neueste `…_Daten.json` in „Laboraufträge“): LabelKits fortlaufende Nummern werden zu P-Nummern, Beschreibung/Probenart/Datum wie in der Laborübergabe – so lassen sich Proben schon vor dem Laborbericht platzieren. Beim späteren Import des Berichts übernimmt „Alle Konflikte: Aktualisieren“ Labordaten und Messwerte für alle bereits vorhandenen Proben. Gutachtennummer ist standardmäßig der Ordnername, das Objekt aus `_Projekt.json` erscheint in der Exportfußzeile. Benötigt Chrome oder Edge (Ordnerzugriff).

**Ergebniskarte (ab 1.7):** Nach dem Import einer Labor-XML speichert PlanKit die Messwerte je Probe. „Ergebnisse“ in der Kopfzeile (Taste K) färbt die Probenmarker nach Kategorie; Proben ohne Wert oder ohne Skala bleiben grau. In der Liste rechts wählen Sie den Parameter (Standard Σ16 EPA-PAK exkl. BG) und bearbeiten je Einheit die Skala: Kategorien aufsteigend mit „ab“-Wert (Qualifikatoren werden separat geführt, siehe Laborergebnisse ab 1.8.1), Farben automatisch von grün bis rot oder einzeln wählbar. Die Skalen teilt PlanKit mit FotoKit (Browser-Speicher `bu-scales` derselben Adresse); Farben und die verwendete Skala stehen zusätzlich im Projekt (`results`), damit Kollegen dieselbe Karte sehen. Im Export „Darstellung: Ergebniskarte“ wählen – Fußzeile „ERGEBNISKARTE“, Legende mit Kategorien, Wertebereichen und Probennummern, Dateiname mit „- Ergebniskarte“. Bereits platzierte Proben aus älteren Projekten erhalten ihre Werte, wenn dieselbe XML erneut importiert und „Aktualisieren“ gewählt wird. Die Bewertung ist Ihre Vorgabe, keine automatische Einstufung.

**Mehrere Pläne (ab 1.6):** Unter dem Plan liegt die Planleiste. „＋ Plan“ fügt einen weiteren Grundriss hinzu (Vorschlag: EG, 1. OG, 2. OG …); eine mehrseitige PDF kann mit „Alle Seiten als einzelne Pläne“ in einem Schritt übernommen werden (bis 20 Seiten, höchstens 40 Pläne). Klick auf ein Vorschaubild oder Bild↑/Bild↓ wechselt den Plan; Doppelklick, Rechtsklick oder „⋯“ benennt ihn um, verschiebt oder löscht ihn. Proben-, Brandherd- und Flächenkennungen sind im ganzen Projekt eindeutig und laufen über alle Pläne weiter. Ein Laborbericht wird einmal importiert; die offenen Proben gelten für alle Pläne. Wird ein Plan gelöscht, kehren dessen platzierte Laborproben in „Noch zu platzieren“ zurück. Rückgängig/Wiederherstellen wechselt bei Bedarf zum betroffenen Plan. Der Export erstellt wahlweise ein Bild des aktuellen Plans oder je Plan ein Bild; der Planname steht in der Fußzeile und im Dateinamen (`26.0123 - EG.png`). Projekte mit nur einem Plan bleiben im bisherigen Dateiformat; ab zwei Plänen (oder nach dem Umbenennen) wird Format 5 gespeichert, das ältere PlanKit-Versionen nicht öffnen.

**Punktgröße (ab 1.9):** Im Panel „Punktgröße“ (☰ Liste) oder mit den Tasten **<** und **>** werden die Probenpunkte des aktuellen Plans von 20 bis 300 % skaliert; 100 % ist die Standardgröße (1/65 der längeren Planseite). Jedes Geschoss hat seinen eigenen Wert, er wird im Projekt gespeichert und gilt auch im Export. Auf dem Bildschirm bleibt ein Punkt beim Auszoomen lesbar; verkleinerte Punkte werden dort entsprechend kleiner dargestellt.

Die **Liste** rechts (Markierungen, Laborproben, Schadensflächen mit den Detailfeldern) ist beim ersten Start eingeklappt. Sie öffnet sich von selbst, wenn eine vorhandene Markierung oder Fläche ausgewählt oder ein Laborbericht übernommen wird, und lässt sich mit **L** bzw. „☰ Liste“ ein- und ausblenden; der Zustand wird im Browser gemerkt. Tastenkürzel wirken nicht, solange in ein Feld geschrieben wird. Ausgelegt für den PC ab 1280 px Breite.

1. **Plan laden:** PDF, Polycam-ZIP, SVG, PNG oder JPG auswählen. Bei mehrseitigen PDFs mit den Pfeilen oder der Seitennummer einen Grundriss in der Vorschau wählen und „Diese Seite übernehmen“ antippen. Pro Projekt wird eine Seite verarbeitet. Bei ZIP-Dateien erscheint eine Auswahl; SVG steht oben und ist empfohlen. PDFs bitte direkt auswählen; DXF und CSV bleiben ausgeschlossen.
2. **Markieren:** „Probe setzen“ bzw. „Brandherd setzen“ wählen und in den Plan klicken/tippen. Proben bekommen P1, P2 usw., Brandherde B1, B2 usw. Die nächste Probennummer ist einstellbar. Bereits belegte Kennungen werden übersprungen. Löschen nummeriert keine anderen Marker um.
3. **Bearbeiten:** In der Liste oder im Werkzeug „Markierung bearbeiten“ einen Marker wählen. Kennung und optionale Notiz ändern. Kennungen sind projektweit eindeutig, auch bei unterschiedlicher Groß-/Kleinschreibung. Punkt ziehen, um ihn zu verschieben. „Beschriftung versetzen“ löst das Schild vom Punkt; danach Schild und Punkt separat ziehen. Eine Linie verbindet beide. „Zurück an Punkt“ verbindet sie wieder. „Löschen“ entfernt den ausgewählten Marker.
4. **Navigieren:** „Ansicht bewegen“ wählen und ziehen. Auch unter „Probe setzen“ und „Brandherd setzen“ verschiebt Ziehen an einer freien Stelle mit linker Maustaste oder einem Finger die Ansicht; ein Klick/Tipp setzt weiterhin einen Punkt. Kleine Bewegungen bis 6 Bildschirm-Pixel mit Maus bzw. 8 mit Touch zählen als Klick/Tipp. Nach erkanntem Ziehen entsteht kein Punkt, das Werkzeug bleibt aktiv. Verschieben verändert weder Projektdaten noch Undo/Redo oder Autosicherung. Mausrad, Plus/Minus oder zwei Finger zoomen. „Einpassen“ zeigt den gesamten Plan samt Markierungen. Mausrad und Zweifinger-Zoom sind in jedem Werkzeug möglich; dabei werden keine neuen Marker gesetzt.
5. **Rückgängig:** Pfeiltasten in der Kopfzeile oder Strg/⌘+Z. Wiederherstellen mit Strg/⌘+Umschalt+Z bzw. Strg+Y. Bis zu 60 Bearbeitungsschritte, nur für die aktuelle Sitzung. Beim Öffnen eines anderen Projekts wird dieser Verlauf zurückgesetzt.
6. **Exportieren:** „Exportieren …“ oben rechts öffnet die Exportkarte (Esc oder × schließt sie). Optional Gutachtennummer und Datum eingeben (Datum kann geleert werden), PNG/JPG und 3.500/4.600 px wählen. Die tatsächlichen Abmessungen stehen darunter. Der Export umfasst immer den kompletten Grundriss mit Legende, auch bei starkem Zoom oder Beschriftungen außerhalb des Plans. Nach erfolgreicher Erstellung startet der Download; ein Link erlaubt erneutes Speichern.

Die SVG wird beim Export neu gerendert. Eingebettete Schriften und Rasterbilder bleiben erhalten. Eine PNG-/JPG-Vorlage bleibt dagegen eine Rastervorlage; höhere Ausgabeauflösung ergänzt dort keine Details. Beide Formate haben einen weißen Hintergrund, JPG verwendet hohe Qualität. Die Legende unterscheidet runde Probenmarker und rautenförmige Brandherdmarker auch ohne Farbe. **Notizen werden nur im Projekt gespeichert, nicht im Bild abgedruckt.**

### Laborbericht importieren

Zuerst einen Grundriss laden. **„Laborbericht importieren …“** akzeptiert eine Eurofins-XML, eine PDF oder beide gemeinsam; Dateien lassen sich auch auf die App ziehen. XML ist die bevorzugte Quelle. Eine Prüftabelle zeigt P-Nummer, Referenz, Beschreibung, Probenart, Labor-Nr. und Probenahmedatum. Alle Texte sind bearbeitbar; Zeilen können hinzugefügt, entfernt und mit ↑/↓ sortiert werden. Änderungen werden erst mit **„Übernehmen“** ins Projekt geschrieben. Bei unbekannten Referenzen die P-Nummer ergänzen. Mengenabweichungen, Referenz-/Beschreibungsunterschiede und eine abweichende Gutachtennummer erscheinen als Warnungen. Zusätzliche PDF-Proben fehlen nicht stillschweigend, sondern bleiben zur Prüfung erhalten. Doppelte P-Nummern verhindern die Übernahme, bis sie korrigiert sind.

Bei belegten Kennungen ausdrücklich **Überspringen**, **Notiz, Labordaten und Herkunft ersetzen** (nur nach ausdrücklicher Auswahl; bestehender Probenmarker behält Position/Schild) oder **Nächste freie P-Nummer** wählen. Offene Proben und Flächenkennungen werden ebenfalls berücksichtigt. Unter **„Noch zu platzieren“** einen Eintrag mit Maus, Stift oder Touch auf den Plan ziehen. Alternativ den Eintrag wählen und in den Plan klicken/tippen; Ziehen im Plan verschiebt weiterhin die Ansicht. Der Zähler zeigt den Fortschritt. Platzierung und Übernahme unterstützen Undo/Redo. Manuelle Proben beginnen hinter der höchsten übernommenen P-Nummer; offene Nummern werden reserviert.

Projektformat **4** speichert `Marker.lab`, die offene Liste `Project.pending` und optional `Project.labReports`. Jeder übernommene Import erhält einen eigenen Bericht mit stabiler interner ID; offene und platzierte Laborproben verweisen über `reportId` darauf. Die Prüfberichtsnummer allein wird nicht als Schlüssel verwendet. Auch identische oder fehlende Nummern und gleiche Dateinamen bleiben unterscheidbar. Gespeichert werden ausschließlich Berichtsnummer, Laborname, vollständige Auftragsreferenz, optionale Batchkennung und XML-/PDF-Dateinamen ohne lokale Pfade. Quelldateinamen folgen den tatsächlichen Importdateien und sind in der Prüftabelle schreibgeschützt. Vollständige Labor-XML/PDFs werden nicht gespeichert; ab 1.7 werden die Messwerte der XML je Probe (Parameter, Ergebnis wie gedruckt, Einheit) für die Ergebniskarte im Projekt gespeichert – lokal, ohne Upload. Nach Dateiexport oder Offline-Neustart kann die Platzierung fortgesetzt werden. Ältere Formate 1–4 ohne Herkunftsstruktur bleiben lesbar; ohne Laborimport entstehen keine zusätzlichen Labordatenfelder. Beschreibung als Notiz und Labor-Metadaten bleiben im Projekt; der Bildexport enthält weiterhin ausschließlich Plan, Kennungen und Legenden. Kein Upload, OCR-Dienst oder Auswerten von Schadstoffgrenzen. XML-Analysenwerte werden als unveränderte Ergebnis-/Einheiten-Zeichenketten je Probe gespeichert (`lab.werte`) und nur für die Ergebniskarte nach Ihrer eigenen Skala verwendet.

**„Probenliste speichern“** schreibt `<Projektnummer>_Probenliste.json` im Format `mosaik-probenliste` für andere Apps. Chrome/Edge bieten den nativen Dateidialog; dort **Projektordner → Laborergebnisse** wählen. Die App kann diesen externen Ordner nicht automatisch ermitteln. Nicht unterstützende Browser verwenden den Download. Die Datei enthält ausgewählte/geprüfte Proben bzw. die offenen und platzierten Proben des gewählten Berichts. Nach einem Projekt-Neustart werden die gespeicherten Herkunftsangaben automatisch eingesetzt. Bei mehreren Berichten im Projekt den gewünschten Eintrag in „Bericht auswählen“ wählen; die Auswahl trennt auch gleiche/leere Berichtsnummern über die interne ID. Offene und platzierte Proben werden gemeinsam für genau diesen Bericht exportiert. Das JSON-Format bleibt `mosaik-probenliste`, Version 1, ohne neue Pflichtfelder oder interne IDs. Die Batchkennung bleibt als Projektmetadatum erhalten; dem bestehenden JSON-Schema wird dafür kein neues Feld hinzugefügt. Angaben lassen sich vor dem JSON-Export bearbeiten, ändern dort aber weder die gespeicherte Herkunft noch die Probenauswahl. Nur bei älteren Dateien ohne gespeicherte Herkunft sind fehlende Angaben manuell zu ergänzen; verlorene Angaben können nicht rekonstruiert werden. Die Prüftabelle kann die JSON-Datei auch vor Übernahme speichern. Ein abgebrochener Import legt keinen Bericht an. Überspringen bewahrt die bestehende Zuordnung; Umnummerieren erzeugt eine neue Probe mit neuer Herkunft, Ersetzen tauscht Labordaten und Herkunft ausdrücklich aus. Auch offene Proben können ersetzt werden; Undo/Redo stellt die gesamten Zuordnungen wieder her. Widersprüchliche Berichtsnummern oder Auftragsreferenzen in einem gemeinsam ausgewählten XML-/PDF-Paar müssen durch getrennte Importe aufgelöst werden. PDF-only speichert eine Batchkennung nur, wenn sie erkannt wurde; fehlende Werte werden nicht geraten.

Grenzen: XML maximal 10 MB; PDF maximal 60 MB / 100 Seiten / 2 Millionen Textzeichen; maximal 1000 offene bzw. 3000 gesamte Marker/Reservierungen; Beschreibung maximal 500 Zeichen. XML mit DTD/Entitäten wird abgewiesen. PDF-Erkennung benötigt eine Textschicht und eine passende Tabelle mit Probennummer, Probenart, Referenz und Beschreibung. Mehrzeilige/fortgesetzte Eurofins-Tabellen und gängige Spaltennamen werden berücksichtigt; beliebige Laborlayouts oder Scans werden nicht zuverlässig erkannt. Ohne Tabelle erscheint eine leere Prüfliste mit Hinweis zur XML bzw. manuellen Eingabe. Eingangsdatum wird nicht als Probenahmedatum übernommen; UTC-XML-Daten werden auf den Kalendertag in Europe/Berlin umgerechnet. Auf kleinen Touchscreens ist Auswahl + Tippen häufig einfacher als langes Ziehen. Echte iPhone-/iPad-Geräteprüfungen bleiben zusätzlich erforderlich.

### Gespeicherte Herkunft in Projektformat 4

`labReports` ist optional. Ein Bericht enthält `id`, `bericht`, `labor`, `auftragsreferenz`, optional `batch` und `sources` mit optionalen `xml`-/`pdf`-Dateinamen. `Marker.lab.reportId` und `Project.pending[].reportId` verweisen auf genau diese `id`. Proben ohne `reportId` bleiben ausdrücklich Altdaten; sie werden keinem Bericht anhand einer möglicherweise mehrfach verwendeten Nummer zugeordnet.

Dateien mit doppelten internen Berichts-IDs, unbekannten Verweisen, widersprüchlichen Berichtsnummern an einer zugeordneten Probe oder ungültigen Herkunftsdaten werden mit Hinweis abgewiesen, bevor das aktuelle Projekt ersetzt wird. Gleiche Berichtsnummern in unterschiedlichen Datensätzen sind zulässig. Unbekannte Zusatzfelder werden nicht weitergespeichert. Es gelten maximal 3000 Berichtsdatensätze, 160 Zeichen für Berichtsnummer/Batch, 500 für Laborname, 2000 für die vollständige Auftragsreferenz und 255 pro Quelldateiname; Überschreitungen werden nicht still abgeschnitten.

Bei erneutem Import wird eine neue interne Bericht-ID vergeben. Berichte mit gleichen Dateinamen und gleichen Nummern werden nicht automatisch zusammengelegt. Alte Programmversionen kennen die neuen optionalen Felder nicht und können sie beim erneuten Speichern verlieren; Projekte mit Herkunft daher mit Version 1.3.1 oder neuer bearbeiten.

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
- `src/labreport.ts`: XML-/PDF-Tabellenparser, Datum, Referenzmapping und Abgleich.
- `src/labui.ts`: bearbeitbare Laborprüfung, Konfliktentscheidungen, Pointer-Platzierung und JSON-Probenliste.
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

Die automatisierte Suite verwendet ausschließlich synthetische Vorlagen und Playwright-Chromium/WebKit. Sie startet und beendet einen eigenen Testserver. Details und Laufzeitinstallation siehe `tests/README.md`; keine echten ZIPs oder Laborberichte werden in Tests/CI gelesen.

**Noch ausstehend:** echte iPhone-/iPad-Geräte, Safari/PWA-Installation unter iOS/iPadOS und reale Speichermangelsituationen. WebKit unter Windows und mobile Chromium-Emulation ersetzen diese Tests nicht. Auf dem iPhone/iPad vor endgültiger Freigabe besonders Flächen zeichnen/abschließen, Eckpunkte ziehen, Farb-/Deckkraftwechsel, Legende in PNG/JPG, Projektdateien mit Flächen, PDF-Auswahl, Touch-Zuschnitt, Proben/Schilder ziehen, JPG-/PNG-Downloads, Projektdateien über die Dateien-App und Offline-Neustart mit anschließendem PDF-Import prüfen.

## GitHub Pages veröffentlichen

In den Repository-Einstellungen unter **Pages → Build and deployment → Source** die Option **GitHub Actions** auswählen. Der Workflow `.github/workflows/pages.yml` installiert die gesperrten Abhängigkeiten, prüft TypeScript, baut die App und veröffentlicht ausschließlich `dist/`. Jeder Push auf `main` aktualisiert die Website. Grundrisse, Projektdateien und Testausgaben sind ausgeschlossen.

Vite verwendet relative Assetpfade. Die App funktioniert dadurch sowohl lokal als auch im GitHub-Pages-Unterverzeichnis `/Probenplan/`.

Für Version 1.3 wird ausschließlich `codex/feature/lab-report-import` gepusht. Ausgangspunkt ist der aktuelle Remote-`main` einschließlich des Pan-Features. Der bestehende Pages-Workflow veröffentlicht nur Pushes auf `main` (oder einen ausdrücklich ausgelösten manuellen Lauf). Den Pull Request erst nach Freigabe mergen; dadurch wird die automatische Veröffentlichung ausgelöst.

## Laborergebnisse ab 1.8.1

Zahlen werden vollständig geprüft: Dezimalkomma und Dezimalpunkt, korrekt gruppierte deutsche/internationale Tausenderzahlen sowie Exponenten. Ohne Formatangabe sind `1.234` und `1,234` mehrdeutig; sie bleiben grau, statt still einen Faktor 1000 anzunehmen. Originale Ergebnisstrings und Einheiten bleiben unverändert im Projekt. Negative oder nicht erkannte Werte erhalten keine Kategorie. Qualifikatoren werden getrennt geführt: `< 0,50` wird nur mit gültiger, eindeutiger, nichtnegativer Zahl als „Unter BG“ erkannt; `unter BG` ebenfalls. `n.n.` bedeutet „Nicht nachgewiesen“, `n.b.` bedeutet „Nicht bestimmt / Bedeutung prüfen“. Beide werden ausdrücklich nicht als Unter BG interpretiert. Fehlerhafte oder mehrdeutige `<`-Angaben (z. B. `< unbekannt`, `< 1.234`, `< BG`) bleiben „Ohne Bewertung“. Karte und Export zeigen eigene Legendeneinträge für diese drei Qualifikatoren. Kein Qualifikator wird als gemessene Null behandelt oder belegt ein Unterschreiten der VdS-Referenz; das gilt auch bei einer BG über der Referenz. Originalstrings und Einheiten bleiben erhalten.

Unter „Nutzung / Referenz“ ausdrücklich „Wohn-/Büroräume“ (10 µg/m²) oder „Industrie“ (100 µg/m²) wählen. Diese VdS-2357-Hintergrundreferenzen gelten ausschließlich für Σ16 EPA-PAK auf Oberflächen, nicht als allgemeine Freigabe-/Sanierungsgrenzwerte. Quelle: [LANUV, Bericht Steinhagen vom 15.02.2023, Seite 7](https://www.lanuv.nrw.de/fileadmin/lanuv/umwelt/schadensfaelle/sondereinsatz/2023/Bericht_Steinhagen.pdf). Unterstützt werden µg/m² (auch μg/m2), µg/100 cm², mg/m² und ng/m²; die Referenz wird in die Originaleinheit umgerechnet. Bei anderen Parametern oder Einheiten bleibt die Bewertung aus. Der Export nennt Nutzung und Referenzbereiche.

Bestehende Projekte verwenden weiter ihre eigenen / FotoKit-Skalen. Die optionale Nutzung wird im bisherigen Projektformat gespeichert und kann per Undo/Redo geändert werden. Der VdS-Modus überschreibt weder eigene Skalen noch den gemeinsamen FotoKit-Speicher `bu-scales`. XML/PDF-Abgleich meldet zusätzlich fehlende oder abweichende Labor-IDs, Probenahmedaten und Probenarten. Eingangsdatum wird nicht als Probenahmedatum verwendet.

## Dateisicherheit im Büro ab 1.8.2

Produktionsumgebung ist das Windows-Büroterminal mit Chrome oder Edge. Der Mac dient der Entwicklung. PlanKit arbeitet direkt mit dem bestehenden Projektarchiv; Ordnernamen, `_Projekt.json` (nur lesen), `mosaik-suite`/`kv`/`archiv`, Labor-/LabelKit-Import und FotoKit-Skalen bleiben kompatibel. Es gibt keine OneDrive-Logik oder Cloud-Synchronisierung.

Jede Änderung wird im Browser gesichert und nach kurzer Ruhezeit in `Pläne/Probenplan <Projekt>.probenplan` geschrieben. Die Anzeige unterscheidet ungespeicherte Änderungen, Fehler und bestätigtes Speichern im Projektordner. „Gespeichert“ erscheint erst nach geschlossenem Schreibstrom und erfolgreichem Inhaltsvergleich. Änderungen während eines laufenden Schreibens bleiben als ungespeichert erkennbar und werden anschließend gespeichert. Fehlender Zugriff: „Speichern“ klicken und den Chrome-/Edge-Ordnerzugriff erneut erlauben. „Notfallkopie“ lädt die geöffnete Fassung zusätzlich als normale kompatible Projektdatei herunter.

Vor jedem Überschreiben legt PlanKit eine geprüfte Datei `(vorher <Zeit>-<eindeutige Kennung>).probenplan` und eine `(Wiederherstellung …).probenplan` mit der neuen Fassung an. Scheitert die Sicherung, wird die Hauptdatei nicht angefasst. Die Wiederherstellungsdatei wird erst nach bestätigtem Speichern entfernt. Ab 1.8.3 räumt PlanKit nach jedem bestätigten Speichern nur die `(vorher …)`-Sicherungen auf: die neuesten 10 und je Tag die neueste der letzten 30 Tage bleiben erhalten. Wiederherstellungsdateien, manuelle Kopien und die Projektdatei werden nie automatisch gelöscht.

Inhaltsprüfsummen erkennen fremde Änderungen auch bei gleicher/älterer Dateizeit, gleich großer Datei, Austausch oder Löschung. Browser-Web-Locks koordinieren PlanKit-Tabs derselben Webadresse. Bei Konflikten: abbrechen, andere Fassung laden, eigene Kopie sichern oder eigene Fassung ausdrücklich übernehmen. Ändert sich die Datei während der Entscheidung nochmals, fragt PlanKit erneut. Die übernommene fremde Fassung wird vorher gesichert. Andere Programme nehmen nicht am Browser-Lock teil; der unmittelbar vor dem Schreiben wiederholte Inhaltsvergleich reduziert dieses verbleibende Zeitfenster, ersetzt jedoch keine Betriebssystem-Transaktion mit externen Programmen.

Nach einem Abbruch bietet PlanKit abweichende Browserentwürfe und erhaltene Wiederherstellungsdateien ausdrücklich zur Prüfung an. Eine beschädigte/fehlende Hauptdatei wird nicht still mit der neuesten beliebigen Sicherung ersetzt. Wiederhergestellte Fassungen erst prüfen, dann „Speichern“ klicken. Bei ungespeicherten Änderungen warnt der Browser vor dem Schließen. Browserdaten sind eine zusätzliche Rettungsmöglichkeit, keine Garantie gegen Stromausfall; geschlossene Projekt- und Sicherungsdateien sind die dauerhafte Ablage.

Validierung erfolgt mit synthetischen Browserdateien in GitHub Actions (Chromium/OPFS und simulierte Schreib-/Berechtigungsfehler), zusätzlich zur bestehenden vollständigen Suite. Dies prüft keine reale Windows-Festplatte und keine physische Stromunterbrechung. Lokal werden keine Abhängigkeiten installiert und keine Builds ausgeführt.

### Schutz beim Versionswechsel

Bevor PlanKit bei einem Konflikt „Andere Fassung laden“ anbietet, schreibt und prüft es eine eindeutig benannte Wiederherstellungsdatei der aktuell geöffneten ungespeicherten Fassung. Derselbe Schutz greift vor einem Projekt-/Grundrissimport und beim Projektordnerwechsel; Änderungen während der Sicherung werden erneut gesichert. Schlägt diese Erhaltung fehl, bleibt das aktuelle Projekt samt Browserentwurf erhalten. Auch beim Start mit „Datei verwenden“ wird ein abweichender Browserentwurf zuerst als geprüfte Wiederherstellungsdatei erhalten. Das anschließende Laden darf erst danach die Browser-Zwischenspeicherung ersetzen.

Eine explizite Speicherbestätigung gilt nur für die aktuellste Projektänderung. Wird während eines laufenden Speicherns weitergearbeitet, bestätigt der ältere Schreibvorgang nicht die neueren Änderungen; deren Status bleibt ungespeichert, bis auch sie bestätigt geschrieben wurden. Eine vorherige Erfolgsnachricht wird bei neuen Änderungen ausgeblendet.
