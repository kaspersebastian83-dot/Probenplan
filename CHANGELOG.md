# Änderungen

## 1.48.0 – 29. Oktober 2026

- **Seitenleiste mit Reitern und einer Probenliste (Test, abschaltbar):** Die lange Spalte ist in drei Reiter geteilt – **Proben** (Standard), **Plan & Ausgabe** (Punktgröße, Beschriftung, Maßstab & Norden, Ergebniskarte, Flächen) und **Raumbuch**. Am Reiter „Proben“ steht die Zahl der offenen Proben.
  - **Eine Liste für offene und platzierte Laborproben:** Fortschrittsbalken („10 von 37 platziert“), Filter Offen · Platziert · Alle, Suche nach Raum oder Kennung. Gruppiert nach Geschoss, dann Raum; Gruppen lassen sich auf- und zuklappen und zeigen ihren Stand („2/3“). Fertig platzierte Räume stehen zugeklappt am Ende. Im Raum stehen offene Proben vor den platzierten.
  - **Kompakte Zeilen (rund 32 px):** Kennung als Marke (durchgezogen = platziert, gestrichelt = offen), Bauteil · Oberfläche, Probenart. Mit der Maus über einer Zeile oder einem Punkt wird der Partner in Plan bzw. Liste hervorgehoben.
  - **⋯ je Zeile statt ✕:** Im Plan zeigen · Neu platzieren · Zurück zu offen · Punkt löschen (bei offenen: Aus der Liste entfernen). „Liste leeren“ und „Prüftabelle speichern“ stehen im ⋯-Menü der Liste. Alles ist mit Rückgängig umkehrbar.
  - Eine offene Zeile anwählen startet das Platzieren (mit Weiter-Platzieren); eine platzierte wählt den Punkt aus. Ziehen aus der Liste auf den Plan platziert genau diese Probe. Brandherde und Markierungen ohne Laborbezug stehen unter „Brandherde & weitere Markierungen“.
  - Mehrere Pläne: Die Liste zeigt die Proben aller Pläne; ein Punkt auf einem anderen Plan wird beim Anwählen dorthin gewechselt. Neu platzieren, Zurück zu offen und Löschen gelten für den aktiven Plan.
  - Ausschalten: Haken „Neue Liste (Test)“ oben in der Seitenleiste (gilt je Browser). Aus = Seitenleiste wie bisher mit der alten Probenliste.
  - Projektdatei unverändert (Schalter und Auf-/Zuklappen stehen nur im Browser).
- Formen: Ein gewählter Kreis bleibt am Punkt gespeichert – beim Platzieren, bei „Zurück zu offen“ und „Neu platzieren“. Bisher bekam eine Chlorid- oder Asbestprobe, die im Prüfdialog oder von Hand auf Kreis gestellt war, wieder die Form aus dem Probentyp (Quadrat/Raute).

## 1.47.0 – 29. Oktober 2026

- **Weiter-Platzieren (Test, abschaltbar):** Nach dem Platzieren einer Laborprobe wählt PlanKit gleich die nächste offene – zuerst im selben Raum, danach im nächsten Raum (Geschoss, dann Raum; Proben ohne Raum zuletzt). Der Platziermodus bleibt, der Punkt wird nicht mehr ausgewählt, die Fläche bleibt frei. Oben auf der Fläche steht „JETZT P11 · EG Flur · Decke · Untersicht – In den Plan tippen“ mit **Überspringen** (nächste Probe, im Raum reihum) und **Fertig (Esc)**; ist ein Raum durch, nennt der Hinweis ihn. Nach der letzten offenen Probe geht es wie bisher zurück zur Ansicht. Das Feld „Nächste Probe“ ist im Platziermodus ausgeblendet.
  - Ausschalten: Haken „Weiter-Platzieren (Test)“ im Bereich Laborproben (gilt je Browser). Aus = wie bisher: eine Probe platzieren, zurück zur Ansicht, Punkt ausgewählt.
  - Aus der Liste auf den Plan ziehen platziert weiter nur die eine Probe.
  - Nummerierte Untergeschosse in der richtigen Reihenfolge: 2. UG vor 1. UG (bisher gleichrangig, 1. UG zuerst) – gilt auch für die Reihenfolge im Raumbuch.
  - Projektdatei unverändert (der Schalter steht nur im Browser).
  - Vorbereitung für die Probenliste mit Reitern (nächste Version): die Raumreihenfolge steckt im neuen Modul `weiter.ts`.

## 1.46.0 – 29. Oktober 2026

- **Exporte überschreiben nichts mehr still** (Prüfbericht 29.10.): Gibt es das PDF oder Bild in „Pläne“ schon (z. B. von Hand ergänzt), fragt PlanKit einmal – ersetzen oder die neue Fassung daneben als „… (2).pdf“ speichern; die Meldung nennt den Namen.
- Gemeinsame Skalen: Hat ein Kollege die Datei inzwischen geändert, wird nichts überschrieben; die eigene Skala bleibt „noch nicht geteilt“ und geht beim nächsten Mal mit.
- Hilfe und Meldungen nennen den tatsächlichen Ort der PlanKit-Datei („_Spektron/PlanKit“ oder „Pläne“) und der Daten von LabelKit und ResultKit.

## 1.45.1 – 29. Oktober 2026

- Gemeinsames Modul spektron-ordner.js: Beim Umzug und bei der Ortswahl zählen in „Abrechnung“ nur noch die Dateien, die BelegKit selbst schreibt (Aufwand_<Kürzel>.json, _Abrechnung.json, <Nr>_Aufwand_<Datum>.json, _BelegKit_Sicherungen) – andere JSON dort bleiben liegen. Für PlanKit ändert sich nichts.

## 1.45.0 – 28. Oktober 2026

- **Spektron-Ordner:** Seit dem Umzug liegt die PlanKit-Datei in `_Spektron/PlanKit` (neue Projekte direkt dort); Bilder und PDFs weiter in „Pläne“. Meldungen nennen den tatsächlichen Ort. Gemeinsames Modul mit Umstellung an.

## 1.44.1 – 28. Oktober 2026

- Leiste oben: die Haken für Proben, Fotos, Ergebnisse, Plan und Abrechnung finden die App-Daten auch im künftigen Ordner „_Spektron“ (spektron-ordner.js). Keine sichtbare Änderung.

## 1.44.0 – 28. Oktober 2026

- **Vorbereitung „Spektron-Ordner“:** Die App-Daten eines Projekts ziehen später in den Unterordner `_Spektron` (Bilder und PDFs des Plans bleiben in „Pläne“). PlanKit liest und schreibt die PlanKit-Datei, die Projektdaten, die Daten von FotoKit, LabelKit und ResultKit sowie das Anlagen-Protokoll jetzt über `spektron-ordner.js` – bis zum Umzug am bisherigen Ort, es ändert sich nichts.

## 1.43.0 – 28. Oktober 2026

- **Ausschnitt nach dem Laden anbieten:** Nach dem Laden eines Plans (auch „＋ Plan“) fragt PlanKit oben auf der Fläche „Nur einen Teil des Plans?“ – „✂ Ausschnitt wählen“ oder „Ganzen Plan behalten“. Mit der ersten Markierung verschwindet das Angebot; „⌗ Zuschnitt“ links bleibt wie bisher.
- **Zuschneiden einfacher:** Ausschnitt aufziehen, danach an den acht Anfassern (Ecken und Kanten) anpassen oder innen verschieben, statt neu zu zeichnen. Außerhalb ziehen (oder mittlere Maustaste) bewegt die Ansicht, Mausrad zoomt – so lässt sich ein Gebäude auf einem großen Lageplan erst heranzoomen und dann genau rahmen. „Neu aufziehen“ beginnt von vorn, Enter übernimmt, Esc bricht ab.
- Während des Zuschneidens steht die Größe des Ausschnitts in Pixeln da, dazu Hinweise, wenn Markierungen außerhalb liegen oder der Ausschnitt eines Planbilds klein ist (im Export ggf. unscharf). Der Plan wird unter der Zuschnittleiste eingepasst, damit der obere Rand erreichbar bleibt; nach dem Zuschneiden oder Abbrechen zeigt die Ansicht wieder den ganzen Plan.
- Das Angebot steht nie im Weg: Es verschwindet, sobald ein Werkzeug gewählt, in den Plan getippt oder links/rechts etwas bedient wird.

## 1.42.0 – 28. Oktober 2026

- **Ergebniskarte „Automatisch – je Probenart“** (neuer Standard): Jede Probe wird nach ihrer Art bewertet – Σ16 EPA-PAK nach der VdS-Referenz der Nutzung, Chlorid nach 5–10 µg/cm², Asbest nach dem Befund im Prüfbericht („Asbest nachgewiesen“ hellrot, sonst grün; Befundtext wie in ResultKit). PAK-, Chlorid- und Asbestproben stehen so farbig auf einer Karte; Legende, Export, Anlage und Raumbuch nennen je Probe ihren Parameter. Ein einzelner Parameter bleibt unter „Bewerteter Parameter“ wählbar. Bestehende Ergebniskarten behalten ihren Parameter – sind mehrere Probenarten im Plan, weist ein Hinweis auf „Automatisch“ hin.
- **Ergebniskarte schaltet sich selbst ein**, sobald Messwerte im Plan sind (beim Öffnen und nach „Proben übernehmen“). „Ergebnisse“/K schaltet sie wie bisher aus; das gilt dann bis zum nächsten Öffnen des Projekts.
- **Oberflächenart und Raum aus ResultKit**: Proben aus dem Prüfbericht bringen Oberflächenart und Raum aus LabelKit mit (ab ResultKit 1.5). Bereits platzierte Proben: in ResultKit einmal „Erneut übernehmen“, dann hier „Proben übernehmen …“ → Prüfbericht → „Alle Konflikte: Aktualisieren“ – leere Felder werden gefüllt, Eingaben in PlanKit bleiben. Hat keine Probe eine Oberflächenart, sagt ein Hinweis unter „Beschriftung“, woher sie kommt.
- Projektdatei: `results.parameter:"*"` für „Automatisch“; ältere PlanKit-Versionen fallen dann auf den ersten Parameter zurück.

## 1.41.0 – 28. Oktober 2026

- **Schnellskizze (Test, abschaltbar)** – schneller zum Probenplan, wenn kein Grundriss da ist:
  - **„☰ Räume aus Liste“**: Räume eintippen (einer pro Zeile, Komma geht auch), „Raster erzeugen“ – PlanKit legt sie als beschriftete Rechtecke im Raster an. Danach nur noch ziehen und anordnen; Räume rasten dabei vorrangig an der Nachbarwand ein. Neue leere Skizzen öffnen die Liste gleich.
  - **„Skizze – nicht maßstäblich“** (Standard bei neuen Skizzen): kein Maßstab, keine m² unter den Raumnamen, Stempel „SKIZZE – NICHT MASSSTÄBLICH“ unten rechts auf dem Plan. Haken raus = wie bisher mit Maßstab und m².
  - **Brandraum** je Raum: Haken beim Raum oder „Küche Brandraum“ in der Liste – Raum hell orange, „BRANDRAUM“ unter dem Namen.
  - **Raum an der Probe**: Wird eine Probe (oder ein Brandherd) in einen Skizzenraum gesetzt, steht der Raumname gleich unter „Raum“ – fürs Raumbuch. Raum aus LabelKit hat Vorrang. Raum umbenennen zieht die Proben mit.
  - Ausschalten: Haken „Schnellskizze (Test)“ in der Skizzenleiste (gilt je Browser). Aus = Skizze genau wie bisher; gesetzte Kennzeichen bleiben in der Skizze erhalten.
- Projektdatei: `plan.sketch.schematic:true` und `rooms[].fire:true` nur wenn gesetzt; ältere PlanKit-Versionen lesen die Skizze weiter, übergehen aber diese beiden Kennzeichen.

## 1.40.1 – 27. Oktober 2026

- Warnleiste „Neuerer Laborstand in ResultKit“ erschien schon, wenn der Plan nur die Probenerfassung aus LabelKit enthielt (noch keine Messwerte). Die LabelKit-Herkunft hat keine Prüfberichtsnummer und zählt jetzt nicht mehr als Laborwert – die Leiste kommt erst, wenn Werte aus einem Prüfbericht im Plan stehen. Gefunden vom neuen Integrationstest „Spektron-Kette“ (ResultKit).

## 1.40.0 – 27. Oktober 2026

- **Warnleiste „Neuerer Laborstand in ResultKit“:** Im Projektordner prüft PlanKit beim Öffnen, beim Zurückkommen ins Fenster und alle 20 Sekunden `Laborergebnisse/_Ergebnisse.json`. Stammen Werte im Plan aus einem Prüfbericht, den ResultKit inzwischen als ersetzt führt (z. B. vorläufig → endgültig), oder hat ResultKit einen Bericht übernommen, den der Plan noch nicht kennt, erscheint oben eine Leiste mit dem Knopf **„Proben übernehmen …“**. Dort wie gewohnt den Bericht wählen und „Alle Konflikte: Aktualisieren“ – platzierte Proben bleiben, wo sie sind. Nichts wird still geändert.
- Pläne nur mit LabelKit-Proben (noch keine Messwerte) melden nichts; bewusst nicht übernommene Berichte, die der Plan schon einmal kannte, auch nicht.

## 1.39.0 – 27. Oktober 2026

- **Skizze immer erreichbar**: In der Werkzeugleiste links steht jetzt immer „✎ Skizze“. Ohne Plan beginnt damit eine neue Skizze, sonst kommt eine Skizze als weiterer Plan dazu (z. B. ein Geschoss ohne Grundriss); auf einer Skizze bearbeitet „✎ Skizze“ wie bisher die Skizze. Auf der Startseite ist „✎ Kein Plan? Skizze zeichnen“ deutlicher und erklärt in einer Zeile, was eine Skizze kann.

## 1.38.0 – 26. Oktober 2026

- **Dauerhafte Kopie vor dem Ersetzen**: Wird der Plan im Projektordner ersetzt (neuer Grundriss, neue Skizze) oder nach einer Rückfrage „Meine Fassung übernehmen“ gewählt, legt PlanKit vorher eine Kopie der bisherigen Fassung als „Probenplan <Projekt> (Kopie vor dem Ersetzen …).probenplan“ in „Pläne“ an. Diese Kopien werden nie automatisch gelöscht (die Bereinigung behält weiter nur die 5 neuesten „(vorher …)“- und „(Speicherkandidat …)“-Kopien). Scheitert die Kopie, wird der Plan nicht ersetzt. Hinweistexte entsprechend berichtigt.
- **Oberflächenart am Plan** (Liste → „Beschriftung“): Der Balken an der Probenstelle – oben Untersicht, links Ansicht, unten Aufsicht – lässt sich je Plan ausschalten (Standard: an). Aus: kein Balken im Plan, in der Legende und im Export; die Oberflächenart bleibt an den Proben gespeichert und steht weiter im Wertkästchen. Projektdatei: `plan.surfaceBars:false` nur wenn ausgeschaltet; ältere PlanKit-Versionen ignorieren es.
- „Alle Konflikte: Aktualisieren“ **ergänzt** jetzt wirklich Labordaten und Messwerte, statt sie zu ersetzen: Ein erneuter Import der LabelKit-Probenerfassung behält Messwerte, Labornummer und Prüfbericht. Derselbe Prüfbericht (gleiche Nummer, z. B. vorläufig → endgültig) ersetzt Werte je Parameter und Einheit, andere bleiben. Ein anderer Prüfbericht ersetzt die Messwerte der Probe wie bisher ganz, damit die Herkunftsangabe stimmt (eine Probe hat genau einen Herkunftsbericht).
- Gemeinsame Bewertungsskalen: Wird eine Skala geändert, während eine andere gerade in den Archivordner geschrieben wird, bleibt die Änderung erhalten und wird nachgereicht (vorher fiel sie auf den alten Stand zurück).
- Anlage Probenahme: Im Herkunftsnachweis stehen nur noch die Prüfberichte, aus denen Proben im Projekt stammen, jede Datei einmal. Ersetzte vorläufige oder mehrfach importierte Berichte führen nicht mehr zur falschen Warnung „Laborbericht-Dateien nicht gefunden“.
- Schadendatum „nicht bekannt“ aus der Projektzentrale erscheint in der Anlage als „nicht bekannt“.

## 1.37.1 – 26. Oktober 2026

- Liefert das Labor denselben Parameter je Probe und je Fläche (Eurofins: „Chlorid (Cl)“ in µg/Probe und berechnet in mg/m²; die Reihenfolge in der XML wechselt von Probe zu Probe), nehmen Ergebniskarte, Raumbuch und Anlage immer den Wert je Fläche – wie ResultKit. Vorher konnte eine Probe mit dem Wert je Probe grau bleiben. Im Skalenbereich erscheint keine leere Skala mehr für „µg/Probe“.

## 1.37.0 – 26. Oktober 2026

- **Chlorid wird bewertet** – wie in ResultKit und FotoKit: VdS 2357 nennt 5–10 µg/cm² als korrosionschemisch relevante Größenordnung. Ergebniskarte, Anlage und Wandansicht färben Chlorid grün (< 5 µg/cm²), amber (5 – < 10) und rot (≥ 10), unabhängig von der gewählten Nutzung. Ältere Berichte in mg/m² werden mit umgerechneten Grenzen bewertet (1 µg/cm² = 10 mg/m²).
- Die Chlorid-Referenz lässt sich wie die PAK-Referenz im Projekt anpassen („Angepasst aus …“) und zurücksetzen.

## 1.36.0 – 26. Oktober 2026

- Laborergebnisse im Projekt kommen aus **ResultKit**: „Proben übernehmen …“ zeigt jeden dort geprüften und übernommenen Prüfbericht (`Laborergebnisse/_Ergebnisse.json`) zur Auswahl – mit „vorläufig“ und „bereits im Plan“. Danach die gewohnte Prüftabelle, „Alle Konflikte: Aktualisieren“ ergänzt die LabelKit-Proben um Labordaten und Messwerte.
- Liegen Prüfberichte im Ordner, die noch nicht in ResultKit übernommen sind, oder hat sich der Ordner seit der Übernahme geändert, steht das im Dialog – mit „🧪 ResultKit öffnen“.
- Laborberichte (XML/PDF) werden im Projekt nicht mehr direkt importiert, sondern in ResultKit. Bei einem freien Plan ohne Projektordner geht der direkte Import wie bisher. Bestehende Pläne und ihre Messwerte bleiben unverändert.
- Spektron-Leiste mit fünftem Schritt ResultKit (zwischen FotoKit und PlanKit); passt auch auf schmale Handys.

## 1.35.0 – 26. Oktober 2026

- Spektron-Leiste oben: rechts „💬 Rückmeldung“ (bei schmalem Fenster nur 💬, auf dem Handy im Projektmenü ▾). Öffnet das Rückmeldeformular in einem eigenen Fenster; Programm, Version und – bei geöffnetem Projekt – die Projektnummer sind schon eingetragen (nur die Nummer, kein Ort). Die Leiste ist in allen Apps gleich.

## 1.34.0 – 26. Oktober 2026

- Raumbuch versteht die Wischprobenbezeichnung aus dem Handbuch, von groß nach klein mit Leerzeichen wie in LabelKit („Gebäude Geschoss Raum Zusatz Bauteil“, z. B. „EG Küche Brandraum Decke“, „Haus A 1OG Bad Wand B“): Geschoss aus seinem Wort, Raum = Gebäude (falls vorhanden) + Raum bis zum ersten Wort aus dem Handbuch-Baukasten (Zusatz wie Brandraum/Referenz/Freimessung, Bauteil wie Decke/Wand/Boden, Beaufschlagung, Oberflächenart). Zusatz und Bauteil bleiben bei der Probe – alle Proben einer Küche stehen in einer Zeile, auch zusammen mit „EG Küche“. Ohne Geschoss-Wort oder ohne solches Wort wie bisher; „ · “ als Trenner wird ebenfalls verstanden.
- Kurzanleitung „Raumbuch“ nennt das.
- Ältere Raumbuch-Eingaben unter dem vollen Namen (z. B. „EG“ / „Küche Brandraum Decke“) wandern mit: Maßnahme und Bemerkung erscheinen beim Raum („Küche“), wenn dort jetzt die Proben stehen – leere Felder gefüllt, abweichende Texte mit „; “ angehängt. Keine leeren Zeilen unter dem alten Namen. Festgeschrieben wird das bei der nächsten Änderung im Raumbuch; Räume ohne Probe bleiben unverändert.

## 1.33.0 – 26. Oktober 2026

- Hilfe-Links ins Handbuch (AidKit), immer im selben Fenster und direkt am Kapitel: in der Kurzanleitung („?“) oben „📘 Handbuch – PlanKit Schritt für Schritt“; in den Wandansichten „📘 Probenbezeichnung Bohrkerne“ und „📘 Bohrkerne Schritt für Schritt“. Nur Links.
- Neuer Test „hilfe-links“: nur feste Handbuch-Adressen (AidKit `hilfe-anker.json`).

## 1.32.0 – 24. Oktober 2026

- Pflichtangabe wie in Projektzentrale, FotoKit und LabelKit: Die Bezeichnung der Anlage (Anlage Probenahme, Raumbuch, Wandansichten) ist gelb mit „Pflicht“ markiert, solange sie fehlt oder nur „Anlage“ ohne Nummer lautet. Exportieren bleibt möglich.

## 1.31.0 – 24. Oktober 2026

- Eigene Bewertungsskalen gelten fürs ganze Büro: wie in FotoKit 1.15 liegen sie im Archivordner in `_Spektron-Skalen.json` und werden beim Öffnen eines Projekts geholt; Ändern oder Löschen einer Skala wirkt bei allen. Beim ersten Mal werden die eigenen Skalen dieses Browsers übernommen. Ohne Archivordner bleibt alles wie bisher im Browser. Projekte behalten ihre eigene Kopie der Skala; VdS-Referenz unverändert.
- Neuer Test „skalen-archiv“ (gleicher Test wie in FotoKit).

## 1.30.0 – 24. Oktober 2026

- Ergebniskarte mit Werten aus einem vorläufigen Prüfbericht: „VORLÄUFIG“ in Rot im Schriftfeld (PDF, Bild und Lageplan der Word-Anlage); ist in der Legende Platz frei, steht dort zusätzlich der Hinweis mit Berichtsnummer. Aufteilung und Maßstab des Blatts ändern sich dadurch nicht.
- Gilt je Blatt nur für die dort gezeigten Werte: Proben dieses Geschosses mit dem dargestellten Parameter. Eine vorläufige Probe auf einem anderen Geschoss, noch nicht platziert oder mit einem anderen Parameter macht ein Blatt mit endgültigen Werten nicht „vorläufig“.
- Word-Anlage Probenahme: derselbe Hinweis unter dem Lageplan (als Ergebniskarte) und unter dem Probenverzeichnis; das Prüfprotokoll nennt ihn wie bisher.
- Neuer Test „vorlaeufig“.
- Tests stabiler: Touch-/Stiftplatzierung wartet, bis die neue Probe gespeichert ist; Flächenauswahl nach dem Neuladen wird bei Bedarf wiederholt.

## 1.29.0 – 24. Oktober 2026

- Neues Erscheinungsbild aller Word-Anlagen (Probenahme und Laborergebnisse, Raumbuch, Wandansichten) – passend zur Bilddokumentation aus FotoKit: Titel mit feiner blauer Linie statt Unterstreichung, Abschnitte in Firmenblau, Tabellen mit Haarlinien zwischen den Zeilen statt schwarzem Gitter, helle Kopfzeile mit blauer Linie, Bezeichnungen in Faktentabellen grau.
- Spaltenbreiten so gewählt, dass „Probe“, Datum, „Wischprobe“, „Kinderzimmer“ oder „Referenzwert“ nicht mehr mitten im Wort umbrechen; „erreicht/überschritten“ bricht am Schrägstrich.
- Wandansichten: gemeinsame Einheit steht im Spaltenkopf (z. B. „KW C10-C40 [mg/kg TS]“), die Einordnung als farbiges Kästchen vor dem Text statt vollflächig eingefärbter Zelle.
- Inhalte, Werte, Dateinamen und Speicherorte unverändert. Die Anlagen bleiben ohne Formatvorlagen, damit sie sich mit „Einfügen › Objekt › Text aus Datei“ in das Gutachten einfügen.

## 1.28.2 – 24. Oktober 2026

- Behoben: Raumbuch – wurde die Tabelle während des Tippens im Hintergrund neu gezeichnet (z. B. nach einer Sicherung oder Neuberechnung der Schilder), ging der gerade getippte Text in „Maßnahme“/„Bemerkung“ verloren. Jetzt bleiben Text, Fokus und Cursor erhalten, und der Text wird beim Verlassen des Felds gespeichert.
- Tests stabiler: Tastatur- und Flächentests warten, bis die Auswahl gezeichnet ist; neuer Testfall für das Neuzeichnen während des Tippens.

## 1.28.1 – 24. Oktober 2026

- Leiste oben in allen Apps wieder identisch (FotoKit-Projektzuordnung und offenes Menü wie in FotoKit, aktuelle Projektdaten wie in LabelKit/PlanKit); Speicherkandidaten und Kopien von PlanKit zählen nicht als Plan.

## 1.28.0 – 24. Oktober 2026

- **Vorläufiger Prüfbericht**: Eine Labor-XML mit „vorläufig“ (`IsPreliminaryReport="true"`) wird beim Import genannt und bleibt an der Herkunft vermerkt (`labReports[].vorlaeufig`). Solange Werte daraus im Projekt stehen, steht ein Hinweis in der Ergebniskarte, in den Wandansichten und als Fußnote in Raumbuch und Wandansichten; die Anlage Probenahme führt ihn im Prüfprotokoll. Nach dem Import des endgültigen Berichts („Aktualisieren“) verschwindet der Hinweis von selbst. Ältere PlanKit-Versionen öffnen die Datei und lassen den Vermerk weg.

## 1.27.0 – 24. Oktober 2026

- **Eine Skalenregel überall** (Ergebniskarte, Raumbuch, Anlage, Wandansicht): Ist eine Nutzung gewählt und gibt es für Parameter und Einheit eine VdS-Referenz, gilt sie. Sonst gilt die eigene Skala des Projekts – auch bei gewählter Nutzung (bisher blieben dann alle anderen Parameter grau, z. B. MKW oder BaP).
- **VdS-Referenz bearbeitbar**: Änderungen ergeben eine angepasste Skala nur für dieses Projekt (Hinweis „Angepasst aus …“, in der Anlage „VdS-Referenz, im Projekt angepasst“). „Zurück zur VdS-Referenz“ verwirft sie. Die eigene Skala für denselben Parameter bleibt dabei erhalten, und an FotoKit geht nichts. Projektdatei: neues Feld `results.vds`; ältere PlanKit-Versionen öffnen die Datei und verwenden die unveränderte Referenz.
- **Wandansicht: Anteil C10–C22 an C10–C40** in Prozent, wenn beide Werte gewählt sind – neben jeder Tiefenzelle, als Spalte in Tabelle und CSV. Nur aus den beiden Laborwerten gerechnet; liegt C10–C22 unter der BG, steht eine Obergrenze („< 6 %“). Keine Zuordnung zu einer Ölart.

## 1.26.0 – 24. Oktober 2026

- **Wandansichten (Bohrkerne)** (Liste → „Wandansichten (Bohrkerne) …“): je Wand, Boden und Decke eine Zeichnung mit den Bohrkernen an ihrer Lage und je Kern einer Tiefensäule T1, T2 … mit dem Messwert und der Farbe der Einordnung; Rückstellproben gemustert, fehlende Laborwerte grau. Dazu je Fläche eine Tabelle (Probe, Kern/Tiefe, Lage, Material, Geruch, zwei Werte, Einordnung).
- Quelle: die neueste LabelKit-Datei in „Laboraufträge“ (Bohrkern-ID nach AidKit, Tiefe, Material, A/R; ab LabelKit 4.38 auch Abstand zur linken Ecke, Höhe über OKFF und Wandmaße – damit maßstäblich, sonst nach Raster 1–9). Messwerte aus dem importierten Prüfbericht über die Probennummer; die Bohrkerne müssen dafür nicht im Plan platziert sein.
- Wert und Farbe: Vorschlag MKW C10–C40, C10–C22 als zweiter Wert in der Tabelle; beides wählbar. Eingeordnet wird nur mit einer vorhandenen Skala (VdS-Referenz, Skala des Projekts oder aus FotoKit), sonst steht nur der Wert – keine eigenen Grenzwerte.
- Ausgabe als Word-Anlage (je Fläche eine Seite) und als Tabelle für Excel (CSV) in „Mitteilungen“, nie überschreibend, mit Zeile im Anlagen-Protokoll. Nichts davon wird im Projekt gespeichert.

## 1.25.0 – 24. Oktober 2026

- **Bohrkern-Fotos in der Anlage**: Steht in FotoKit unter „Probe-Nr.“ die Kern-ID (z. B. „EG-WZ-B-7“, wie auf dem Schild im Bild) oder die Segment-ID („EG-WZ-B-7-T2“), ordnet die Anlage das Foto über die neueste LabelKit-Datei in „Laboraufträge“ den Proben zu: Kern-ID → alle analysierten Segmente, Segment-ID → genau dieses. Rückstellproben zählen nicht. In der Fotoliste steht die Zuordnung mit der Angabe vom Foto, z. B. „P2, P3 (EG-WZ-B-7)“. Gleiche Regel wie FotoKit 1.11.0 (Ergebnistabelle).

## 1.24.1 – 24. Oktober 2026

- Bohrkerne aus LabelKit: Beschreibung mit der vollen Segment-ID (z. B. „EG-WZ-B-7-T2“) und dem Material statt nur der Kernbezeichnung – wie auf Etikett, Schnittplan und Laborauftrag. Rückstellproben (nur gesägt und aufbewahrt) kommen nicht mehr als offene Probe in den Plan, sie bekommen keinen Laborwert; die Prüfliste nennt ihre Anzahl.
- Laborbericht: eine Referenz wie „EG-WZ-B-10“ oder „REF-1“ wird nicht mehr als Probe 10 bzw. Probe 1 gelesen. Weiterhin erkannt: „Probe 7“, „P7“ und „<Projektnummer>-7“.
- Skizze: Zähler „2 Räume · 3 Wände“ statt „Raume/Wande“.

## 1.24.0 – 24. Oktober 2026

- **Raumbuch** (Liste → „Raumbuch bearbeiten …“): eine Zeile je Raum und Geschoss mit Befund (Proben mit Messwert und Oberflächenart, Brandherd) und Bewertung nach der Skala der Ergebniskarte – beides wird aus den Proben berechnet und nie gespeichert. Eingaben je Raum: Maßnahme (mit Vorschlägen aus den zuletzt benutzten) und Bemerkung. Räume ohne Probe kommen mit Status dazu: Sichtprüfung unauffällig, Sichtprüfung auffällig, nicht begangen / nicht zugänglich. Ähnliche Schreibweisen („Kü.“ / „Küche“) werden erkannt und lassen sich zusammenführen; „Küche“ und „Kueche“ gelten ohnehin als derselbe Raum. Hinweise vor dem Export: auffällige Räume ohne Maßnahme, Proben ohne Raum, fehlende Laborwerte.
- Ausgabe als **Word-Anlage** (zum Einfügen in den Bericht) und als **Tabelle für Excel (CSV)** für die Sanierung, im Projektordner in „Mitteilungen“ (nie überschreibend, mit Zeile im Anlagen-Protokoll). Keine Flächen und Mengen: „Flächenangaben und Mengenermittlung obliegen dem ausführenden Unternehmen.“
- **Raum** je Probe und Brandherd: kommt beim „Proben übernehmen“ aus LabelKit („Raum / Ort“), sonst unter „Markierungen“ im neuen Feld „Raum“. Eine Eingabe in PlanKit bleibt auch bei erneutem Import. Das Geschoss kommt aus dem Plannamen (EG, 1. OG …) oder aus dem Anfang des Raumnamens („EG Küche“).
- Projektdatei: `raum` an Markern und offenen Proben, `raumbuch` am Projekt. Ältere PlanKit-Versionen öffnen die Datei, verlieren beim Speichern aber Raum und Raumbuch.

## 1.23.0 – 24. Oktober 2026

- **Oberflächenart** statt Testfunktion „Probenfläche“: Aufsicht, Ansicht oder Untersicht je Probe kommt beim „Proben übernehmen“ aus LabelKit (Spalte „Oberflächenart“); fehlt sie dort, unter „Markierungen“ wählbar. Eine Eingabe in PlanKit bleibt auch bei erneutem Import. Immer sichtbar: Balken unten (Aufsicht), links (Ansicht) oder oben (Untersicht), im Wertkästchen und in der Legende. Ältere Projektdateien mit der Testfunktion bleiben lesbar.
- **Nutzung aus der Projektzentrale**: Beim ersten Anlegen der Ergebniskarte wählt PlanKit die VdS-2357-Referenz nach der Nutzung in `_Projekt.json` vor (Gewerbe/Industrie und Landwirtschaft → Industrie, sonst Wohn-/Büroräume). Eine in PlanKit gewählte Referenz bleibt. Bei „Gesundheit & Labor“ nennt die Legende „Gesundheit & Labor, Referenz < 10 µg/m²“. Unter der Auswahl steht die Nutzung laut Projektdaten.

## 1.22.1 – 24. Oktober 2026

- **Aufgeräumt:** Im Ordner „Pläne“ bleiben von den automatischen Kopien („(vorher …)“ und „(Speicherkandidat …)“) nur noch die 5 neuesten je Art; ältere werden beim nächsten Speichern entfernt. Wiederherstellungsdateien und manuelle Kopien bleiben unberührt.

## 1.22.0 – 24. Oktober 2026

- **Testfunktionen** (Liste → „Testfunktionen“): neue Ideen zum Ausprobieren im echten Projekt, je Projekt ein- und ausschaltbar (rückgängig machbar). Ausgeschaltet bleiben eingegebene Angaben erhalten, werden aber weder angezeigt noch exportiert.
- Erste Testfunktion **Probenfläche**: je Probe Decke, Wand, Boden oder Sonstige (unter „Markierungen“). Am Schild bzw. an der Probenstelle ein Balken oben (Decke), links (Wand) oder unten (Boden) – auch schwarzweiß lesbar; im Wertkästchen der Ergebniskarte („Decke · hoch“) und in der Legende („Probenfläche: Decke: P1 …“). Projektdatei: `trials` am Projekt, `surface` an der Probe; ältere Versionen ignorieren beides.

## 1.21.0 – 23. Oktober 2026

- **Skizze, wenn kein Plan vorliegt**: Startseite „Kein Plan? Skizze zeichnen“ bzw. unten „＋ Skizze“ für ein weiteres Geschoss. Räume als Rechtecke aufziehen (Raster 10 cm, Räume rasten an vorhandenen Wänden ein), Name, Breite und Tiefe in Metern eintippen; freie Wände, auch schräg (Richtungen nahe 15°-Schritten werden genau ausgerichtet, Länge eintippbar); Türen (0,90 m, Aufschlag wechselbar) und Fenster (1,20 m) per Tipp auf jede Wand, auch auf schräge; freier Text wie „Treppe“ in drei Größen. Räume, Wände und Texte verschieben, Räume in der Größe ändern, löschen mit Entf; Rückgängig auch während des Zeichnens. „Skizze fertig“ schneidet die Zeichenfläche auf den Inhalt zu (1 m Rand). Ergebnis ist ein normaler Vektorplan mit Raumnamen, Fläche in m² und automatisch gesetztem Maßstab – maßstäbliches PDF, Proben, Beschriftung und Anlage funktionieren wie bei jedem Plan. „Skizze“ links bearbeitet sie später weiter; Proben bleiben an ihrer Stelle. Drehen, Zuschneiden, Ausrichten und Entzerren sind bei Skizzen gesperrt.
- „Speichern“ bleibt während des Skizzierens möglich.

## 1.20.0 – 23. Oktober 2026

- **Entzerren** (W, links in der Leiste): schräg fotografierte Pläne – etwa der Fluchtplan im Treppenhaus – über vier Ecken gerade rechnen. Ecken antippen oder ziehen, die Lupe zeigt die Ecke vergrößert; die Ansicht lässt um alle Ecken Platz. Seitenverhältnis wie im Foto (geschätzt) oder DIN quer/hoch. Ergebnis ist ein gerades Rasterbild (höchstens 4.600 px bzw. 16 Megapixel); Proben, Beschriftungen und Flächen werden mitgerechnet. Ein vorhandener Maßstab und die Nordrichtung werden entfernt (neu messen bzw. setzen). Rückgängig stellt das Foto wieder her; die Fotodatei selbst bleibt unverändert, im Projektordner zusätzlich als „(vorher …)“-Kopie des Projekts.

## 1.19.0 – 23. Oktober 2026

- **Schilder automatisch platzieren** (Liste → „Beschriftung“, je Plan, Standard an): Die Probenstelle bleibt exakt, nur das Schild weicht Raumnamen, Linien, Schraffur und anderen Schildern aus – mit kurzer Hinweislinie und weißem Rand. Freie Proben behalten ihr Schild am Punkt. Die berechnete Lage wird nicht gespeichert; ein von Hand gezogenes Schild bleibt, wo es ist. „Schilder neu anordnen“ gibt von Hand versetzte Schilder dieses Plans wieder frei (rückgängig machbar). Bildschirm, PNG/JPG, PDF und Anlage zeigen dieselbe Anordnung.
- **Messwerte am Plan** (Liste → „Beschriftung“ oder Exportkarte bei „Ergebniskarte“, je Plan, Standard aus): In der Ergebniskarte ein Wertkästchen je Probe – Kennung, Wert wie im Prüfbericht, Einheit und Kategorie in der Farbe der Skala, Hinweislinie zur farbigen Probenstelle.
- Projektdatei: Abweichungen vom Standard stehen am Plan (`autoLabels: false`, `valueLabels: true`); das Projektformat bleibt unverändert. Ältere PlanKit-Versionen ignorieren die Einstellungen.

## 1.18.0 – 23. Oktober 2026

- Projektordner „26.0123 Köln Nad“: Mit der Mitarbeiterliste der Projektzentrale (im Archivordner) steht der Ort ohne Kürzel – in der Projektanzeige und in der Word-Anlage Probenahme („Projekt … · Ort“). PlanKit liest die Liste nur; ohne Liste unverändert.

## 1.17.0 – 23. Oktober 2026

- Die Spektron-Leiste oben zeigt „Nr. Ort · zuständige Person“: Liegt im Archivordner die Mitarbeiterliste der Projektzentrale, wird das Kürzel am Ende des Projektordners erkannt und mit Namen angezeigt; eine in der Projektzentrale abweichend gewählte Person hat Vorrang.

## 1.16.1 – 20. Oktober 2026

- Projektzentrale und Spektron-Leiste übergeben Projekte jetzt über #projekt im Fragment. Sonderzeichen bleiben erhalten; alte ?projekt-Links funktionieren weiterhin und werden nach dem Laden bereinigt. Projektwechsel laden auch bereits geöffnete App-Fenster neu; eine Warnung vor ungesicherten Eingaben kann den Wechsel abbrechen. Die Anlagenaktion aktion=anlage wird ebenfalls im Fragment übergeben. Installiertes PlanKit nach einer Online-Aktualisierung vollständig schließen und erneut öffnen.

## 1.16.0 – 19. Oktober 2026

- **Form schon beim Übernehmen festlegen:** Im Dialog „Laborproben prüfen“ hat jede Zeile eine Spalte „Form“ (Kreis, Quadrat, Raute), oben „Form der Probenpunkte für alle Zeilen“. LabelKit-Proben sind nach Probenart vorbelegt. Beim Platzieren bekommt der Punkt genau diese Form; in „Noch zu platzieren“ ist sie schon zu sehen.
- **Löschen direkt in den Listen:** ✕ neben jeder Probe in „Noch zu platzieren“ entfernt sie aus der Liste, „Liste leeren“ entfernt alle noch nicht platzierten Proben (mit Rückfrage). ✕ neben einer Markierung löscht den Probenpunkt samt Punkt im Plan. Alles rückgängig mit Strg+Z.

## 1.15.1 – 19. Oktober 2026

- Behoben: Die Leiste oben zeigt jetzt das Objekt aus der Projektzentrale neben dem Projekt. Sie suchte es bisher an einer Stelle in „_Projekt.json“, an der die Projektzentrale es nicht ablegt.

## 1.15.0 – 19. Oktober 2026

- **Formen für Probenahmestellen:** Kreis, Quadrat oder Raute – jeweils mit Nummer, gemeinsame Zählung P1, P2 … (die Zuordnung „Probe 3“ = P3 bleibt). Die Form wird beim Setzen gewählt (Werkzeug „Probe“ → „Form“) und lässt sich rechts im Seitenfeld je Punkt ändern.
- **Automatisch aus LabelKit:** Proben aus der LabelKit-Probenerfassung bekommen beim Platzieren die Form ihrer Probenart: PAK Kreis, Chlorid Quadrat, Asbest Raute, Sonstige Kreis. Die Probenart bleibt erhalten, wenn später der Laborbericht die Probe ergänzt.
- **Legende:** Sobald mehr als eine Form im Plan vorkommt, zeigt der Export einen Block „Probenarten“ (z. B. „PAK (Kreis)“, „Chlorid (Quadrat)“).
- **Brandherd als roter Stern** ohne Kennung; bestehende Pläne werden automatisch so dargestellt.
- **„Proben übernehmen …“** (vorher „Laborbericht importieren …“): nimmt neben Laborberichten auch die LabelKit-Datei (`…_Daten.json`) direkt an – auch ohne Projektordner. Im Projekt werden alle LabelKit-Dateien aus „Laboraufträge“ angeboten (neueste zuerst); fehlt noch eine, steht ein Hinweis im Dialog.

## 1.14.2 – 18. Oktober 2026

- Die Leiste oben zeigt links den Namen der App-Suite „Spektron“ (die Büro-Apps Projektzentrale, LabelKit, FotoKit, PlanKit, BelegKit und SpesenKit). Sonst unverändert.

## 1.14.1 – 17. Oktober 2026

- Behoben: Das Projektmenü der Leiste oben („Anderes Projekt“) schloss sich von selbst, wenn die Leiste sich im Hintergrund aktualisierte (alle 20 Sekunden und beim Zurückkehren ins Fenster).

## 1.14.0 – 17. Oktober 2026

- **Ausrichten für fotografierte Pläne:** neues Werkzeug „Ausrichten“ (A) neben „Zuschnitt“. Ein Raster liegt fest über der Karte, der Plan dreht sich darunter: im Plan ziehen (Umschalt = zehnmal feiner), Regler, Zahlenfeld, ±0,1° oder Pfeiltasten. „An Kante ausrichten“ legt zwei angeklickte Punkte entlang einer Wand waagerecht oder senkrecht. Bis ±45°, ein Rückgängig-Schritt.
- Gespeichert wird nur der Winkel; das Original bleibt unverändert. Ecken außerhalb des Fotos werden weiß (Bildschirm, PNG/JPG, PDF, Anlage). Probenpunkte, Beschriftungen, Flächen und Nordpfeil drehen mit und bleiben auf ihrer Stelle im Bild; Maßstab und Punktgröße bleiben.
- **Projektformat 6** für Projekte mit Feinausrichtung. Ältere PlanKit-Versionen lehnen diese Dateien ab, statt den Winkel zu übergehen; Dateien aus neueren Versionen meldet PlanKit jetzt verständlich („neuere PlanKit-Version“).

## 1.13.0 – 17. Oktober 2026

- **Leiste mit Projekt und Arbeitsschritten:** Neue schmale Leiste oben, in allen vier Apps gleich: Projekt mit Wechsel zu den zuletzt geöffneten, die vier Arbeitsschritte (LabelKit, FotoKit, PlanKit, BelegKit) mit Haken bei erledigten Schritten, und ein Knopf „Weiter: …“ zum nächsten offenen Schritt – öffnet die App mit demselben Projekt. Ohne geöffnetes Projekt bietet die Leiste „Weiter mit <zuletzt geöffnetes Projekt>“ an. Die Leiste liest den Projektordner nur und schreibt nie hinein; ohne Ordnerrecht fehlen nur die Haken. In PlanKit ist sie besonders schmal und die Kopfzeile etwas niedriger, damit der Plan seine Fläche behält.

## 1.12.2 – 17. Oktober 2026

- **Projektdaten aktuell:** Ändert sich „_Projekt.json“ (Objekt, Schadendatum …) in der Projektzentrale oder bei einem Kollegen, liest PlanKit sie beim Zurückkehren ins Fenster neu. Bisher blieb das Objekt vom Öffnen des Projekts stehen und kam so in Schriftfeld, Fußzeile und Anlage.

## 1.12.1 – 17. Oktober 2026

- **Sicherungskopien in Ortszeit:** „(vorher …)“- und „(Wiederherstellung …)“-Dateien heißen jetzt z. B. „Probenplan 26.0142 Teststadt (vorher 2026-10-16 21-37-16-853 a1b2c3d4).probenplan“. Bisher stand dort die UTC-Zeit („19-37“ für eine Speicherung um 21:37), was beim Wiederherstellen verwirrte. Das Aufräumen alter Sicherungen ordnet alte (UTC) und neue Namen nach ihrem tatsächlichen Zeitpunkt.

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
