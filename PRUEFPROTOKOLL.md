# Prüfprotokoll – Probenplan 1.3.1

## Dauerhafte Labor-Herkunft (15. Oktober 2026)

Basis: Remote-`main` `4feae48` einschließlich PR #6. Feature-Branch `codex/fix/persist-lab-provenance`; keine automatische Zusammenführung oder Produktivveröffentlichung.

Projektformat 4 erhält optionale `labReports` und `reportId` an offenen sowie platzierten Proben. Berichtsnummer, Labor, vollständige Auftragsreferenz, optionale Batchkennung und strukturierte XML-/PDF-Dateinamen werden über Dateisicherung, IndexedDB und Undo/Redo erhalten. Gleiche/leere Berichtsnummern und gleiche Dateinamen werden über eigene interne IDs getrennt. Rohdateien, rohe Analysen und lokale Dateipfade sind nicht Teil der gespeicherten Herkunft.

Der mosaik-probenliste-JSON-Export bleibt in Schema/Version 1. Er übernimmt gespeicherte Metadaten und alle offenen/platzierten Proben des ausdrücklich ausgewählten Berichts. JSON-Metadatenkorrekturen ändern die interne Zuordnung nicht. Legacy-Proben ohne Herkunft bleiben Legacy-Proben. Neue Importe überschreiben Herkunft nur nach expliziter Ersetzen-Auswahl; Überspringen, Abbrechen und Fehler erhalten den bestehenden Zustand. Widersprüchliche XML-/PDF-Paare werden abgewiesen.

### Vollständiger lokaler Testlauf

`pnpm build` einschließlich TypeScript: erfolgreich. `pnpm test`: alle neun Suites, Exit-Code 0. Die 20 neuen Herkunfts-Prüfgruppen enthalten XML-only/PDF-only/kombiniert, P1–P9 mit P1–P3 platziert und P4–P9 offen, Dateiöffnung in frischen Browserkontexten, IndexedDB-Neustart, JSON ohne Nacherfassung, Batch, vier Berichte bei gleichen/leeren Nummern, Konflikte, Umnummerierung, Import-Abbruch und Formate 1–4. Fehlende/doppelte/ungültige Herkunft und zusätzliche Rohdatenfelder werden gesondert geprüft. Sämtliche Testdaten sind synthetisch.

| Suite | Erfolgreiche Prüfgruppen |
| --- | ---: |
| `browser` | 14 |
| `edge-cases` | 5 |
| `import-preparation` | 26 |
| `scoped-pdf` | 1 |
| `areas` | 19 |
| `keyboard` | 2 |
| `marker-pan` | 16 |
| `labreport` | 22 |
| `lab-provenance` | 20 |

Insgesamt 125 Prüfgruppen. Chromium und WebKit, einschließlich bestehender Touch-/Pen-, Bildexport-, Planwerkzeug- und Offline-Regressionsprüfungen. GitHub Actions führt dieselbe vollständige Suite im Pull Request aus; der aktuelle Lauf ist beim PR einsehbar.

### Verbleibende Grenzen

Bereits in älteren Dateien verlorene Herkunft kann nicht rekonstruiert werden und muss ergänzt werden. Alte Programmversionen kennen die zusätzlichen Felder nicht und können sie beim Speichern entfernen. PDF-Erkennung bleibt vom vorhandenen Layout und der Textschicht abhängig. Automatisches WebKit ersetzt keine Geräteprüfung von iPhone-/iPad-Dateidialogen und Speichergrenzen. Keine Änderungen an Planwerkzeugen, Probenplatzierung oder grafischem Export.

## Historischer Stand 1.3.0

# Prüfprotokoll – Probenplan 1.3.0

## Laborbericht-Import (14. Oktober 2026)

Feature-Branch `codex/feature/lab-report-import`, Basis Remote-`main` `e84a868` einschließlich des Pan-Features. Keine Änderung an Main, CSP, Hosting-Workflow oder Laufzeitabhängigkeiten.

| Bereich | Prüfung und Verhalten |
| --- | --- |
| XML | Browser-DOMParser, lokale Namen unabhängig vom Namespace, CRLF/Unbekanntes, SampleOrder, Referenz/Beschreibung/Art mit Matrix-Fallback, Labor-Nr., Bericht, Auftragsreferenz und Batch. Datumswerte mit Offset werden auf den Kalendertag in Europe/Berlin umgerechnet. DTD/Entitäten werden abgewiesen. Analysenparameter, unveränderte Result-/Unit-/LOQ-Zeichenketten sind separat im Parserergebnis verfügbar. |
| PDF | Bestehender PDF.js-Worker und lokale Ressourcen, `getTextContent()` mit transformierten x/y-Positionen. Cover und Probenanzahl, transponierte Ergebnisreferenzen mit Datum/geteilten Labor-IDs sowie Beschreibungstabelle unter „Weitere Erläuterungen“. 2–3-zeilige Beschreibungen, Fortsetzung mit/ohne Header, gebrochene Header und Varianten „Proben-Nr.“/„Probenbezeichnung“ geprüft. Keine OCR. |
| Vergleich | XML bevorzugt, Abweichungen in Bericht, Referenzen, Beschreibung und Menge als Warnung. Zusätzliche PDF-Beschreibungszeilen werden zur Prüfung ergänzt; keine Labornummern aus Lücken abgeleitet. Ergebnistabellen/Description-Abgleich in beide Richtungen. |
| Prüftabelle | Alle sechs Probenfelder und Herkunftsangaben editierbar; Ergänzen, Entfernen, ↑/↓. Abbrechen lässt das Projekt unverändert. Unbekannte Referenzen bleiben als Zeile mit leerer P-Nummer erhalten. Duplikate/ungültige Nummern verhindern Übernahme; Projektabweichung warnt ohne zu blockieren. Dateiwerte werden als Text in DOM-Elementen eingesetzt, die bestehende HTML-Marker-Liste zusätzlich mit DOMPurify bereinigt. |
| Konflikte | Explizite Entscheidung je belegter Kennung: überspringen, vorhandenen Probenmarker aktualisieren oder nächste freie P-Nummer. Updates ändern ausschließlich Notiz/Labordaten; Position, separate Beschriftung und Markerart bleiben erhalten. Offene Proben und Flächenkennungen sind reserviert. |
| Platzierung | Maus-Drag in Chromium/WebKit sowie echte Touch-/Pen-Pointer-Ereignisse in Chromium. Alternative Auswahl + Klick/Tippen. Offene Liste schrumpft, Zähler passt sich an; Import/Platzierung/Update unterstützen Undo/Redo. Die Auswahl ist an die Kennung gebunden, damit Undo keinen anderen Listeneintrag platziert. Spätere manuelle Nummern beginnen hinter der höchsten importierten Nummer. |
| Speicherung | Optionales `Marker.lab` und `Project.pending` in Format 4, ohne weitere Projektfelder. Labordaten und offene Liste werden unabhängig in Undo-Snapshots kopiert. IndexedDB-Neustart, `.probenplan`-Roundtrip, Formate 1–4 ohne Zusatzfelder und ungültige Datensätze geprüft. Drehen/Zuschneiden/Flächenbearbeitung erhalten Version 4. |
| JSON | Exakte `mosaik-probenliste`-Felder, Dateiname aus Projektnummer, UTF-8, nativer Speicherdialog (mit kontrolliertem Picker-Stub geprüft) und echter Download-Fallback. Offene und platzierte Proben des gewählten Berichts, keine doppelte Nummer. Herkunftsangaben nach Projekt-Neustart im Dialog ergänzen; externe Projektordner werden nicht geraten. |
| Offline | App neu geladen ohne Netzwerk, vorhandene offene Laborprobe per Klick platziert. Keine externen Requests bei den Labor-Browserprüfungen. Vorhandene Suite prüft weiterhin lokalen PDF-Erstimport aus dem Offlinecache. |

### Getrennte manuelle Originaldateiprüfung

Die ausdrücklich bereitgestellten Eurofins-Dateien wurden ausschließlich aus ihrem externen Originalpfad gelesen. Extraktionen und Screenshots liegen im ignorierten `.manual-checks/`, außerhalb aller automatisierten Test-/CI-Diagnosen. Keine Originaldatei, reale Probenbeschreibung oder Projektdatei wird committed.

| Import | Beobachtetes Ergebnis |
| --- | --- |
| XML-only | 9 Zeilen, P1–P9, Beschreibungen vollständig, Datum 08.10.2026. Bericht und Auftragsreferenz korrekt erkannt; keine Warnung. |
| PDF-only | 9 Zeilen, P1–P9, mehrzeilige Beschreibungen einschließlich der dreizeiligen P8 vollständig. Alle Beschreibungen und Probenfelder stimmen mit XML überein; kein Eingangstag als Probenahmedatum verwechselt. |
| XML + PDF | 9 Zeilen, keine Vergleichswarnung. Berichtsnummer, Auftragsreferenz, Referenzen, Beschreibungen und Daten stimmen überein. |

Die Kontrollwerte aus dem Auftrag (Auftragsreferenz, P8-Beschreibung und Kalendertag) wurden exakt verglichen. Prüftabelle sowie die Beschreibungstabelle der Original-PDF wurden visuell geöffnet. Nach der Sichtprüfung wurde die Labor-Nr.-Spalte verbreitert, damit die entscheidenden Endziffern sichtbar bleiben, und die Dialogaktionen beim Scrollen erreichbar gehalten.

### Grenzen und Entscheidungen

- Grundriss zuerst laden; ein Laborbericht ersetzt die Planvorlage nicht. Keine automatische chemische Beurteilung oder Schadstoffdarstellung.
- XML maximal 10 MB; PDF maximal 60 MB / 100 Seiten / 2 Millionen Textzeichen; höchstens 1000 offene und 3000 gesamte Marker/Reservierungen, Beschreibung höchstens 500 Zeichen. Unbekannte Layouts und PDFs ohne Textschicht liefern eine klare Warnung und leere manuell ergänzbare Liste.
- Nur die verlangten optionalen Projektfelder werden eingeführt. Laborname, Auftragsreferenz, Batch/Quelle und rohe Analysenwerte bleiben im aktuellen Parser-/Review-Ergebnis; nach Projekt-Neustart sind Herkunftsangaben für den gemeinsamen JSON-Export zu ergänzen. Probenfelder und Berichtsnummer bleiben vollständig gespeichert.
- Der JSON-Dialog schlägt einen Dateinamen vor und merkt sich im nativen Browserdialog die zuletzt gewählte Ablage; der externe „Laborergebnisse“-Ordner kann ohne zusätzliche Zugriffsberechtigung nicht automatisch gefunden werden. Safari nutzt bei fehlender File-System-Access-API den Download.
- Touch-/Pen-Events wurden automatisiert geprüft; echte iPhone-/iPad-Dateiauswahl, Downloads, native Ordnerauswahl und Speichermangel weiterhin manuell prüfen. Auf kleinen Displays die Auswahl-/Tipp-Alternative nutzen.

Automatisierte Nachweise: 22 Laborprüfgruppen in `tests/labreport.mjs` mit synthetischen XML/PDFs in `tests/lab-fixtures.mjs`. TypeScript und `pnpm build` erfolgreich. Der abschließende `pnpm test` bestand in allen acht Suites mit Exit-Code 0; vollständiger Nachweis unter `.test-output/summary.json`. Sämtliche bisherigen Regressionen bestanden. Nach Projekt-Neustart wird die gemeinsame JSON-Liste nach P-Nummer geordnet; solange die aktuelle Prüfung verfügbar ist, wird deren Reihenfolge berücksichtigt.

Während der Wiederholung behoben/abgeklärt: Der bestehende Offline-Test prüfte den Status unmittelbar nach Projektrestore, bevor die asynchrone Offline-Initialisierung fertig war; er wartet nun auf „Offline bereit“, ohne die Aussage abzuschwächen. Ein Playwright-WebKit-Unterprozess unter Windows blieb einmal beim Schließen hängen (leere Browserfehlerkonsole); nur der verifizierte eigene Testprozess wurde beendet. Der nachfolgende vollständige Lauf einschließlich aller 26 PDF-/Vorbereitungsprüfungen schloss erfolgreich und ohne Abbruch ab.

## Historischer Stand 1.2 und Nachprüfungen

## Nachprüfung: intuitives Verschieben in Setzwerkzeugen (14. Oktober 2026)

Feature-Branch `codex/feature/marker-pan`, Basis `aff6f50` vom aktuellen Remote-`main` einschließlich Flächen, Tastaturkürzeln und eigenständigen synthetischen Tests. Die vorhandene Kameraverschiebung wird nun auch bei Ziehen an einer freien Stelle unter „Probe setzen“/„Brandherd setzen“ verwendet. Bewegungsschwellen: 6 Bildschirm-Pixel für Maus, 8 für Touch; Bearbeitungs-/Polygonwerkzeuge behalten ihre bisherige Schwelle. Ein erkanntes Ziehen bleibt bis zum Loslassen ein Ziehen, auch bei Rückkehr zum Startpunkt. Ein Bewegungssprung erst im Freigabeereignis setzt ebenfalls keinen Punkt. Setzwerkzeug, Projektdaten, Autosicherung sowie Undo-/Redo-Verlauf bleiben beim Verschieben unverändert.

`tests/marker-pan.mjs`: 16 neue Prüfgruppen in Chromium, WebKit unter Windows und Chromium mit iPhone-Touch-Emulation. Nachgewiesen sind Klick/Tipp, kleine Bewegungen, Ziehen über der Schwelle, Rückkehr zum Start, Klick/Tipp nach Pan mit korrekten Plan-Koordinaten, weiterhin aktives Werkzeug, unveränderte Projektdatei und Undo/Redo, keine IndexedDB-Schreibvorgänge beim Pan, Marker-Auswahl, Mausrad, Zweifinger-Zoom nach Einfinger-Pan, verbleibender Finger und Touch-Abbruch. Beide Setzwerkzeuge werden separat geprüft. Der vollständige Testläufer umfasst zusätzlich sämtliche bisherigen Browser-, Randfall-, PDF-/Vorbereitungs-, Unterverzeichnis-/Offline-, Flächen- und Tastaturprüfungen. Ergebnisse und Diagnosen liegen ausschließlich unter `.test-output/`; keine realen Grundrisse oder neuen Abhängigkeiten im Commit. Echte iOS-/iPadOS-Geräte bleiben zusätzlich manuell zu prüfen.

Ergebnis: TypeScript-Prüfung und Produktionsbuild erfolgreich. Alle sieben Suites des vollständigen Testläufers bestanden (Exit-Code 0), einschließlich der 16 neuen Gestenprüfgruppen. Marker-/Polygonbearbeitung, Tastaturkürzel, Speicherung, Export und Offline-Neustart bestanden unverändert. Der Testläufer verwendete einen eigenen lokalen Server auf einem freien Port und schloss ihn nach der Prüfung; die geöffnete Benutzer-App wurde nicht für Tests verwendet.

Die folgenden Abschnitte dokumentieren den bisherigen Versionsstand; diese Änderung wird ausschließlich als separater Pull Request vorgeschlagen und nicht eigenständig gemergt oder veröffentlicht.

Prüfung: 12. Oktober 2026, Windows. Feature-Branch `codex/feature/probenplan-1-2-areas`, lokaler Produktionsbuild auf `http://127.0.0.1:4182/`.

## Ausgangspunkt und Veröffentlichungsgrenze

Der tatsächliche Remote-`main` wurde vor der Entwicklung gelesen: `fdce376`, „Probenplan 1.1: lokaler PDF-Import, Rotation und Zuschnitt (#1)“. Version 1.1 war per Squash-Merge enthalten; die Dateibäume des vorherigen 1.1-Featurestands und von `origin/main` waren identisch. Der neue Branch basiert unmittelbar auf diesem Main-Commit. Lokaler Main, Remote-Main und Pages-Workflow wurden nicht verändert; gepusht wird ausschließlich der neue Feature-Branch. Kein automatischer Merge oder manueller Deployment-Aufruf.

## Implementierung und Ergebnisse

| Bereich | Prüfung und Ergebnis |
| --- | --- |
| Build | TypeScript und Produktionsbuild erfolgreich, Version 1.2.0. Keine zusätzlichen Abhängigkeiten, Frameworks, Laufzeit-CDNs oder Uploads. Lokaler Assetcache enthält die neue App und die bisherige PDF-Verarbeitung. |
| Polygonmodell | Mindestens 3, höchstens 200 Eckpunkte pro Fläche; maximal 100 Flächen. Einfache konkave Polygone zulässig; doppelte Punkte, Kollinearität, Selbstkreuzung, Selbstberührung, ungültige/außerhalb liegende Koordinaten abgewiesen. Ein innerer Scanline-Anker platziert die Kennung auch bei konkaven Konturen innerhalb der Fläche. |
| Zeichnen | Farbe wählen, Eckpunkte setzen, letzten entfernen, abbrechen, abschließen und freie Bezeichnung speichern. Default 30 %, Bereich 5–70 %. Vorschläge sind ausschließlich manuelle Dokumentation; keine chemische Bewertung oder automatische Freigabe. |
| Editieren | Kennung/Bezeichnung/Farbe/Deckkraft ändern, Eckpunkte ziehen, ganze Fläche innerhalb des Plans verschieben und löschen. Ungültige Kontur nach Ziehen stellt die vorherige gültige Geometrie wieder her. |
| Undo/Redo | Erstellen, Umbenennen, Kennung, Farbe, Deckkraft, Eckpunkt, gesamte Verschiebung und Löschen als unabhängig wiederherstellbare Schritte geprüft. Auch Rotation/Zuschnitt mit Flächen unterstützt. Bilddaten werden weiter in History-Snapshots geteilt, Polygonpunkte unabhängig kopiert. |
| Navigation | Zoom und Pan verändern gespeicherte Geometrie nicht. Entwürfe bleiben beim Wechsel zur Navigation erhalten. Zweifinger-Zoom erzeugt keine Eckpunkte; eine zweite Berührung bricht einen laufenden Flächendrag ohne bleibende Änderung ab. Unfertige Entwürfe müssen vor Dateisicherung, Import, Vorbereitung oder Export abgeschlossen/abgebrochen werden. |
| Ebenen | Grundriss → alle transparenten Füllungen → alle Konturen → Flächenkennungen → Proben-/Brandherdmarker. DOM-Reihenfolge automatisiert geprüft, überlappende farbige Flächen sowie P/B visuell kontrolliert. |
| Legende | Nur verwendete Bezeichnungen, Gruppierung unabhängig von Groß-/Kleinschreibung und überflüssigen Leerzeichen; Name einmal je Kategorie. Unterschiedliche Farben/Deckkräfte innerhalb einer Kategorie erscheinen mit zugehörigen Kennungen. Sechs Farben, Konturmuster, lange Wörter/Bezeichnungen und nicht verwendete Kategorien geprüft. |
| Export | Weißer Legendenbereich rechts beim Hochformat und unterhalb beim Querformat. PNG mit 3500 px, JPG mit 3500/4600 px; identische Farbdarstellung anhand zahlreicher farbiger Pixel mit mittlerer JPEG-Abweichung unter 5/255 geprüft. Separate P/B-Legende, Metadaten, vollständige Flächen und lange Legendentexte in PNG/JPG visuell geöffnet. Bei übermäßiger Legendenmenge wird ein Export, dessen kleinste Legendenschrift auf A4 selbst bei optimaler Hoch-/Querformatanpassung unter 8 pt läge, verständlich abgewiesen. |
| Vorbereitung/PDF | Flächen nach Rotation und bestätigtem Zuschnitt rechnerisch/UI-seitig korrekt; Zuschnitt muss alle Eckpunkte enthalten. Lokal importierte PDF mit Flächen versehen und offline exportiert. Originalbilddaten bleiben erhalten. |
| Speicherung | Schema 3 enthält Kennung, Beschreibung, Farbe, Deckkraft, Punkte und nächsten Z-Zähler. Dateiroundtrip, IndexedDB-Neuladen und erneutes Editieren geprüft. Schema-1-/Schema-2-Dateien ohne Flächen bleiben unverändert lesbar. Fehlerhafte Schema-3-Dateien lassen das vorherige Projekt bestehen. Kennungen/IDs sind projektweit eindeutig. |
| Browser/Touch | Neue Abläufe in Chrome, Edge und Playwright-WebKit unter Windows. Mobile Chromium mit iPhone-13-Emulation: Fläche per Touch setzen/abschließen, Eckpunkt ziehen, Undo/Redo, Mehrfinger-Abbruch und Zoom, keine horizontale Überbreite. |
| Offline/Datenschutz | Neustart ohne Netz, Flächen bearbeiten, neuer lokaler PDF-Import und Export in allen drei Engines. Keine externen Requests. Reale Polycam-Unterlagen bleiben ausschließlich lokal in ignorierten Dateien. |

**Automatisierte Nachweise:** 26 neue Prüfgruppen in `tests/areas.mjs`. Der vollständige bestehende Regressionssatz wurde erneut ausgeführt: 16 Hauptnachweise, 5 Randfallprüfungen, 27 Prüfgruppen für 1.1 sowie der separate Offline-Erstimport unter `/Probenplan/`. Sämtliche Prüfungen bestanden. Nach der letzten Anpassung des weißen Abstands unter der Exportlegende wurden die 26 Flächenprüfgruppen erneut ausgeführt; der Exportpfad ohne Flächen blieb unverändert.

## Während der Prüfung behoben

- Die längere Werkzeugleiste konnte die Planfläche über die Bildschirmhöhe hinaus strecken. Die Desktopfläche behält jetzt eine passende Höhe und bleibt beim Scrollen der Werkzeugleiste sichtbar.
- Ein Werkzeugwechsel löschte vorübergehend die Auswahl eines Probenmarkers. Die bisherige Auswahl beim Wechsel zwischen Markerwerkzeugen bleibt erhalten; der vollständige PDF-/Marker-Regressionstest besteht wieder.
- Flächenkennungen wurden für die Ausgabe vergrößert, und der Markerlegende bei Projekten mit Flächen zusätzlicher weißer Abstand zugeteilt.
- WebKit rundet simulierte Mauspositionen auf Bildschirmpixel. Koordinatenprüfungen verwenden dort eine entsprechend kleine Toleranz; Transformationen und gespeicherte Geometrie werden weiterhin vollständig verglichen.

## Grenzen und echte Geräteprüfung

- Keine Polygonlöcher, Freihandkonturen, geometrische Vereinigung oder nachträgliches Hinzufügen/Entfernen einzelner Ecken einer fertigen Fläche. Komplexe Bereiche in mehrere einfache Konturen derselben Kategorie teilen. Sehr große Legenden können zugunsten der Drucklesbarkeit abgewiesen werden.
- Flächenkennungen können sich bei überlappenden Flächen bzw. unter Probenmarkern überlagern. Die Liste bleibt zur gezielten Auswahl verfügbar; Kennungen/Kategorien sind in der Legende dokumentiert.
- Echte iPhone-/iPad-Geräte, Safari/PWA-Installation, Dateien-App-Downloads und realer Speichermangel stehen weiterhin aus. Playwright-WebKit unter Windows und Chromium-Touch-Emulation sind kein Ersatz.
- Vor endgültiger Freigabe auf iPhone/iPad prüfen: über HTTPS laden/installieren, Flächen per Touch zeichnen/abschließen, bei Zoom Eckpunkte ziehen, Farbe/Deckkraft ändern, PNG/JPG mit Legende speichern, Schema-3-Datei über Dateien-App wieder öffnen, Offline-Neustart und anschließenden PDF-Import/Export. Große Exporte bei Bedarf mit 3500 px verwenden.
- Dateisicherung enthält weiterhin das vollständige ursprüngliche Planbild; ein Zuschnitt entfernt diese ursprünglichen Bilddaten nicht aus der Projektdatei. Schema 3 benötigt Version 1.2 oder neuer. Autosicherung ersetzt keine Projektdatei.

**Freigabeempfehlung:** technisch für die PR-Prüfung bereit. Vor endgültiger mobiler Freigabe die genannten echten Safari-/iOS-Tests durchführen. Der PR wird nicht selbständig gemergt.

## Wiederholung und lokale Nachweise

Mit laufendem Produktionsserver `npm test` ausführen; bei anderem Port `TEST_URL` setzen. `tests/edge-cases.mjs` folgt dem Haupttest, da es dessen Roundtrip-Datei nutzt. Der neue Flächentest braucht ausschließlich synthetische Vorlagen; die alten Tests benötigen weiterhin die lokale originale Polycam-ZIP. `.test-output/v1.2/` enthält `results.json`, PNG/JPG in Hoch-/Querformat, Offline-/PDF-Exporte und Desktop-/Touch-Screenshots. Der gesamte Ordner bleibt aus Git ausgeschlossen.

## Historische Protokolle

Die folgenden Protokolle beschreiben den jeweiligen älteren Versionsstand. Dort genannte damalige Funktionsgrenzen (z. B. kein PDF in 1.0) gelten nicht für Version 1.2.

### Prüfprotokoll – Probenplan 1.1

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
