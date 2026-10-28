import DOMPurify from 'dompurify';
import {createProjectDataReader,projectDataWarning} from './project-data.js';
import {skalenAbgleich} from './skalen-archiv.js';
import {LabUI} from './labui';
import './style.css';
import './theme.css';
import './layout.css';
import './suite-bar';
import {labeled,shownSVG,ensureInk,inkTried,autoLabels,valueLabels,surfaceBars,type Shown} from './labels';
import {addMarker,addSheet,bounds,clone,createProject,escape,floorName,History,markerScale,markerSize,markerSVG,MARKER_SCALE,metersPerUnit,northAngle,stepMarkerScale,moveSheet,removeSheet,renameSheet,sheetCount,sheetProject,switchSheet,validLabel,MAX_SHEETS,shapeOf,typeOf,typeFromArt,SHAPES,type Shape,type Project,type Marker,trialOn,SURFACES,type Surface,allMarkers,MAX_RAUM,RAUM_STATUS,type RaumStatus} from './model';
import {raumbuchStand,setEintrag,addRaum,removeRaum,mergeRaum,pruefhinweise,raumbuchBlocks,raumbuchCSV,raumbuchName,STATUS_TEXT,FOOTNOTE_MENGEN,type RaumZeile,type RaumbuchStand} from './raumbuch';
import {build as buildDocx} from './docx';
import {vorlaeufigeBerichte,vorlaeufigText,verwendeteBerichte} from './lab-provenance';
import {kwPaar,wandStand,wandSvg,wandBlocks,wandCSV,wandName,wandHinweise,vorschlag as wandVorschlag,type WandStand,type WandBildDatei} from './wandansicht';
import {candidates,loadImage,readPlan,validateProject,type Candidate} from './import';
import {download,restoreLocal,saveLocal} from './storage';
import {labelkitReport} from './labelkit';
import {berichtAlsReport,liesErgebnisse,standKennung,planHinterResultKit,hinterText,ERGEBNIS_DATEI,type Ergebnisse} from './ergebnisse';
import {fileInfo,fileRevision,FolderConflict,saveFolderProject,writeProjectCopy,KEEP_RECENT,findSubdir,listFiles,openFolder,parseProjName,permission,pickFolder,projectDirOf,projectFileName,supported as folderSupported,writeFile,archiv,AUFTRAEGE,LABOR,PLAENE,type ProjectFolder} from './folder';
import {exportImage,exportLayout} from './export';
import {annexFileName,createAnnex,saveAnnex,saveDocument,ANNEX_DIR} from './annex-run';
import {COMPANY,PAPERS,renderSheet,sheetLayout,type Paper} from './sheet';
import {buildPdf,canvasRGB,type PdfPage} from './pdfwrite';
import {ASPECT_NAMES,initialQuad,outsideCount,perspectiveProject,quadProblem,targetSize,warpImage,type Aspect,type Quad} from './perspective';
import {extendSketch,trimSketch,addOpening,addRoom,addText,addWall,cloneSketch,emptySketch,hit,meters,moveRoom,moveText,moveWall,openingAt,removeRoom,removeWall,resizeCanvas,resizeRoom,roomFrom,setOpeningWidth,setWallLength,sketchPlan,sketchSVG,wallFrom,wallLength,parseRoomList,roomsFromList,roomAt,quickSketchOn,setQuickSketch,TEXT_SIZES,type Sketch,type SketchKind,type SketchRoom,type SketchText,type SketchWall} from './sketch';
import {alignProject,cropProject,fineAngle,MAX_ANGLE,planMatrix,preparation,rotateProject} from './preparation';
import type {LocalPDF} from './pdf';
import type {Plan,Rect} from './model';
import type {Area,Point} from './model';
import {hasValues,parameters,prepare,rangeText,rateMarkers,saveShared,fromShared,scaleFor,scaleKey,shortParameter,autoColors,units,valueOf,UNRATED,qualifierGroups,setNutzung,getNutzung,usageFromNutzung} from './results';
import type {Scale} from './model';
import {addArea,areaSVG,cleanName,MAX_POINTS,PALETTE,palette,polygonError} from './areas';

// Projektübergabe: Fragment hat Vorrang; alte Query-Links früh und ohne Anfrage bereinigen.
const PROJEKT_URL = (() => {
  const start = new URL(location.href);
  const projekt = new URLSearchParams(start.hash.slice(1)).get('projekt') ?? start.searchParams.get('projekt');
  const aktion = new URLSearchParams(start.hash.slice(1)).get('aktion') ?? start.searchParams.get('aktion');
  function setzen(name: string | null){
    const url = new URL(location.href);
    // Fremde Fragmentbestandteile (auch reine Anker wie #fotos) unverändert erhalten.
    const teile = url.hash.slice(1).split('&').filter(t => t && !new URLSearchParams(t).has('projekt'));
    if (name !== null) teile.push('projekt=' + encodeURIComponent(name));
    if (name !== null && url.searchParams.has('aktion')){
      if (!new URLSearchParams(url.hash.slice(1)).has('aktion')) teile.push('aktion=' + encodeURIComponent(url.searchParams.get('aktion')!));
      url.searchParams.delete('aktion');
    }
    url.searchParams.delete('projekt');
    url.hash = teile.join('&');
    if (url.href !== location.href) try{ window.history.replaceState(window.history.state, '', url); }catch(e){}
  }
  if (start.searchParams.has('projekt') || (projekt !== null && start.searchParams.has('aktion'))) setzen(projekt);
  return { projekt, aktion, setzen };
})();

document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<header class="header topbar"><a class="brand" href="./" aria-label="PlanKit Start"><span class="brand-icon" aria-hidden="true">⬡</span><span>PlanKit</span></a><span id="app-version" class="version-badge" title="Version"></span>
<div class="tb-group" id="file-actions"><button id="load" class="tb" title="Grundriss laden: PDF, Polycam-ZIP, SVG, PNG oder JPG">＋ Plan</button><input id="file" type="file" accept=".zip,.svg,.png,.jpg,.jpeg" hidden><button id="open-project" class="tb" title="Projektdatei (.probenplan) öffnen">Öffnen</button><button id="save-project" class="tb" title="Projekt als .probenplan-Datei speichern" disabled>Speichern</button><input id="project-file" type="file" accept=".probenplan,.json" hidden></div>
<div class="tb-doc"><span id="canvas-name">Kein Plan geladen</span><span id="file-type" class="tag">KEIN PLAN</span><span id="plan-name" hidden>Polycam-ZIP, SVG, PNG oder JPG</span></div>
<div class="history"><button id="undo" class="tb" aria-label="Rückgängig" title="Rückgängig (Strg+Z)" disabled>↶</button><button id="redo" class="tb" aria-label="Wiederherstellen" title="Wiederherstellen (Strg+Umschalt+Z)" disabled>↷</button></div>
<span class="tb-spacer"></span><span id="saved" role="status">Lokal. Vertraulich. Ohne Upload.</span><span id="offline" class="status">● Offline wird vorbereitet</span>
<button id="help" class="tb" title="Bedienung, Tastenkürzel & Offlinebetrieb">?</button><button id="results-toggle" class="tb" title="Ergebniskarte: Proben nach Bewertung einfärben (K)" aria-pressed="false" data-key="k" disabled>Ergebnisse</button><button id="export-open" class="tb export-btn" title="Bild für das Gutachten exportieren" disabled>↓ Export …</button><button id="panel-toggle" class="tb" title="Liste mit Markierungen, Laborproben und Flächen ein-/ausblenden (L)" aria-pressed="false" aria-controls="side-panel">☰ Liste</button></header>
<main class="kit-workspace">
<nav class="rail" aria-label="Werkzeuge"><div class="modes" role="group" aria-label="Werkzeug"><button data-mode="navigate" data-key="v" class="mode active" title="Ansicht bewegen – verschieben & zoomen (V)"><span class="tool-icon">↔</span><span>Ansicht<small>Verschieben & zoomen</small></span></button><button data-mode="sample" data-key="p" class="mode" title="Probe setzen – fortlaufend nummeriert (P)" disabled><span class="tool-icon sample-icon">P</span><span>Probe<small>Fortlaufend nummeriert</small></span></button><button data-mode="fire" data-key="b" class="mode" title="Brandherd setzen (B)" disabled><span class="tool-icon fire-icon">★</span><span>Brandherd<small>Roter Stern</small></span></button><button data-mode="edit" data-key="e" class="mode" title="Markierung bearbeiten – Punkt oder Beschriftung ziehen (E)" disabled><span class="tool-icon">↖</span><span>Bearbeiten<small>Punkt oder Beschriftung ziehen</small></span></button></div></nav>
<section class="kit-canvas" aria-label="Planarbeitsfläche"><div id="stage"><svg id="drawing" xmlns="http://www.w3.org/2000/svg" aria-label="Grundriss mit Markierungen"><image id="base-plan"/><g id="marks"></g></svg><div id="welcome"><div class="plan-illustration"><span class="mini-wall a"></span><span class="mini-wall b"></span><span class="mini-wall c"></span><span class="mini-point">P1</span></div><span class="eyebrow">VOM GRUNDRISS ZUM PROBENPLAN</span><h2>Hier beginnt Ihre<br>Dokumentation.</h2><p>Öffnen Sie einen Polycam-Export oder ein Planbild.<br>Ihre Gebäudedaten bleiben im Browser.</p><button id="welcome-load" class="primary">Grundriss auswählen <span>↗</span></button><button id="welcome-sketch" class="welcome-sketch">✎ Kein Plan? Skizze zeichnen</button><span class="tiny welcome-sketch-hint">Räume mit Maßen, Türen und Fenster – danach Proben setzen wie auf einem Grundriss</span><span class="tiny">SVG bevorzugt · scharfer Export bis 4.600 px</span></div>
<div id="toolbar" class="overlay"><div id="mode-hint" hidden></div><label class="inline-field" id="next-field" title="Nummer der nächsten Probe – vergebene Kennungen bleiben bestehen">Nächste Probe<input id="next" type="number" value="1" min="1" max="999999999" disabled></label><label class="inline-field" id="shape-field" title="Form der nächsten Proben – z. B. PAK Kreis, Chlorid Quadrat, Asbest Raute">Form<select id="next-shape"><option value="circle">○ Kreis</option><option value="square">□ Quadrat</option><option value="diamond">◇ Raute</option></select></label></div>
<div class="zoom-controls"><button id="zoom-out" aria-label="Verkleinern" title="Verkleinern (−)">−</button><span id="zoom-value">100 %</span><button id="zoom-in" aria-label="Vergrößern" title="Vergrößern (+)">＋</button><span class="divider"></span><button id="fit" title="Gesamten Plan anzeigen (0)">Einpassen</button></div>
<div class="canvas-footer"><span><span class="legend-circle"></span> Probe</span><span><span class="legend-star">★</span> Brandherd</span><span id="source-info">Original bleibt unverändert</span></div></div><nav id="sheet-strip" class="sheet-strip" aria-label="Pläne des Projekts" hidden><div id="sheet-list" role="tablist" aria-label="Pläne"></div><button id="sheet-add" class="sheet-add" title="Weiteren Plan hinzufügen, z. B. ein Obergeschoss (PDF mit mehreren Seiten: alle auf einmal)">＋ Plan</button><button id="sheet-sketch" class="sheet-add" title="Weiteren Plan als Skizze zeichnen (Räume mit Maßen, Türen)">＋ Skizze</button></nav></section>
<aside class="kit-panel" id="side-panel" aria-label="Markierungen, Laborproben und Flächen"><div class="panel-head"><span class="eyebrow">ÜBERSICHT</span><button id="panel-close" class="tb" title="Liste ausblenden (L)" aria-label="Liste ausblenden">»</button></div><div class="panel-scroll">
<section class="markers-section"><div class="section-heading"><h2>Markierungen</h2><span id="count" class="count">0</span></div><div id="marker-list"><p class="muted empty-list">Ihre Proben und Brandherde<br>erscheinen hier.</p></div><div id="inspector" hidden><label>Kennung<input id="label" maxlength="16" autocomplete="off"></label><label id="shape-row">Form<select id="shape"><option value="circle">○ Kreis</option><option value="square">□ Quadrat</option><option value="diamond">◇ Raute</option></select></label><label id="surface-row" hidden>Oberflächenart <span class="optional">optional · sonst aus LabelKit</span><select id="surface"><option value="">– nicht angegeben –</option><option value="floor">Aufsicht</option><option value="wall">Ansicht</option><option value="ceiling">Untersicht</option><option value="other">Sonstige</option></select></label><label id="raum-row" hidden>Raum <span class="optional">aus LabelKit oder von Hand · für das Raumbuch</span><input id="raum" list="raum-list" maxlength="80" autocomplete="off" placeholder="z. B. EG Küche"></label><datalist id="raum-list"></datalist><label>Notiz <span class="optional">optional · nur im Projekt</span><textarea id="note" maxlength="500" rows="2" placeholder="z. B. Wischprobe, Fensterbank"></textarea></label><div class="inspector-actions"><button id="offset">Beschriftung versetzen</button><button id="recenter" title="Beschriftung auf den Probenpunkt zurücksetzen">Zurück an Punkt</button><button id="delete" class="danger">Löschen</button></div></div></section>
</div></aside></main>
<dialog id="export-dialog" class="export-card" aria-label="Export"><form method="dialog"><button class="close" aria-label="Export schließen">×</button></form><span class="eyebrow">EXPORT</span><h2>Export fürs Gutachten</h2><p class="muted">Vollständiger Plan mit Markierungen und Legende – unabhängig von Ihrer Ansicht. PDF: Druckblatt mit Schriftfeld im genormten Maßstab.</p><label>Gutachtennummer <span class="optional">optional</span><input id="report" maxlength="100" placeholder="z. B. 2026-0142" disabled></label><label>Datum <span class="optional">optional</span><input id="date" type="date" disabled></label><label id="view-field" hidden>Darstellung<select id="view"><option value="plan">Probenplan</option><option value="results" id="view-results">Ergebniskarte</option></select><small id="view-note" class="muted" hidden></small></label><label id="scope-field" hidden>Umfang<select id="scope"><option value="one">Dieser Plan</option><option value="all">Alle Pläne</option></select></label><div class="export-row"><label>Dateiformat<select id="format"><option value="png">PNG · verlustfrei</option><option value="jpeg">JPG · hohe Qualität</option><option value="pdf-a4">PDF · A4</option><option value="pdf-a3">PDF · A3</option><option value="anlage">Word · Anlage Probenahme</option></select></label><label id="quality-field">Auflösung<select id="quality"><option value="3500">Standard · 3.500 px</option><option value="4600">Hoch · 4.600 px</option></select></label></div><label id="framed-field" class="export-check"><input type="checkbox" id="framed" checked> Mit Schriftfeld, Firmenlogo und Maßstabsleiste (wie PDF)</label><label id="values-field" class="export-check" hidden><input type="checkbox" id="values-export"> Messwerte am Plan (Wertkästchen je Probe)</label><div id="annex-fields" class="export-row" hidden><label>Bezeichnung der Anlage<input id="annex-title" maxlength="40" placeholder="z. B. Anlage 3"></label><label>Fotos je Probe<select id="annex-photos"><option value="0">keine</option><option value="2">bis 2</option><option value="4" selected>bis 4</option><option value="6">bis 6</option></select></label></div><div class="export-dim"><span>Ausgabeabmessungen</span><strong id="dimensions">— × — px</strong><small id="dimensions-note">Inklusive Rand und Legende</small></div><button id="export" class="primary wide" disabled>↓ Bild exportieren</button><div id="export-result" hidden><a id="export-link">Bild erneut herunterladen</a><button id="smaller" hidden>Kleineren Export versuchen</button></div></dialog>
<div id="toast" role="status" aria-live="polite" hidden></div>
<dialog id="choose-dialog"><form method="dialog"><button class="close" aria-label="Schließen">×</button></form><span class="eyebrow">PLANAUSWAHL</span><h2>Welchen Grundriss öffnen?</h2><p>SVG ist für einen scharfen Export empfohlen.</p><div id="choices"></div></dialog>
<dialog id="replace-dialog"><h2>Aktuelles Projekt ersetzen?</h2><p>Der neue Plan ersetzt die automatische Zwischenspeicherung. Speichern Sie das aktuelle Projekt, um später daran weiterzuarbeiten.</p><div class="dialog-actions"><button id="replace-cancel">Abbrechen</button><button id="replace-save">Projekt sichern & weiter</button><button id="replace-yes" class="primary">Ersetzen</button></div></dialog>
<dialog id="help-dialog"><form method="dialog"><button class="close" aria-label="Schließen">×</button></form><span class="eyebrow">KURZANLEITUNG</span><h2>In drei Schritten zum Probenplan.</h2><ol><li><b>Plan laden:</b> Polycam-ZIP oder SVG, PNG, JPG auswählen. Bei mehreren Dateien möglichst SVG verwenden.</li><li><b>Markieren:</b> „Probe setzen“ oder „Brandherd setzen“ wählen und in den Plan tippen. Unter „Markierung bearbeiten“ Punkte ziehen; nach „Beschriftung versetzen“ können Sie Punkt und Schild getrennt ziehen. Die Liste öffnet die Kennung und Notiz.</li><li><b>Exportieren:</b> Gutachtennummer und Datum ergänzen, Format und Größe wählen. Der gesamte Plan einschließlich außerhalb liegender Beschriftungen wird ausgegeben.</li></ol><h3>Navigation & Sicherung</h3><p>„Ansicht bewegen“ verschiebt den Plan. Auch unter „Probe setzen“ und „Brandherd setzen“ verschiebt Ziehen an einer freien Stelle mit linker Maustaste oder einem Finger die Ansicht; ein Klick/Tipp setzt einen Punkt. Das Setzwerkzeug bleibt aktiv, und Verschieben verändert weder Projekt noch Undo/Redo. Mausrad und zwei Finger zoomen; „Einpassen“ zeigt alles. Rückgängig: Strg/⌘+Z, Wiederherstellen: Strg/⌘+Umschalt+Z.</p><p>„Projekt speichern“ sichert Grundriss, Positionen, Kennungen und Notizen in einer .probenplan-Datei. „Projekt öffnen“ lädt diese wieder. Bildexporte enthalten keine Notizen. Die automatische Browsersicherung ersetzt keine Projektdatei und kann beim Löschen von Browserdaten verloren gehen.</p><h3>Offline installieren</h3><p>Sobald oben „Offline bereit“ steht, ist die App zwischengespeichert. Unter Windows die Installationsfunktion von Edge/Chrome verwenden. Lokal startet sie über <b>http://localhost:4173</b>; dazu zunächst den lokalen Server starten.</p><p>iPhone/iPad benötigen für die spätere PWA-Installation eine <b>HTTPS-Adresse</b>, die vom Gerät erreichbar ist: in Safari öffnen → Teilen → Zum Home-Bildschirm. Die lokale Windows-Adresse ist dort nicht erreichbar. Eine unverschlüsselte LAN-IP genügt für Offlineinstallation nicht. Die veröffentlichte App ist unter https://kaspersebastian83-dot.github.io/Probenplan/ erreichbar. Importierte Pläne bleiben im Browser.</p><p>Offline funktioniert nach dem vollständigen ersten Laden. Privates Surfen, Speichermangel oder entfernte Browserdaten können den Cache löschen. Große Exporte können auf Mobilgeräten die kleinere Qualitätsstufe erfordern.</p></dialog>`;

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>$<HTMLInputElement>(id);
const svg=$('drawing') as unknown as SVGSVGElement;
const image=$('base-plan') as unknown as SVGImageElement;
const marks=$('marks') as unknown as SVGGElement;
document.querySelector('#welcome p')!.innerHTML='Öffnen Sie eine PDF, einen Polycam-Export oder ein Planbild.<br>Ihre Gebäudedaten bleiben im Browser.';
document.querySelector('#help-dialog ol li')!.innerHTML='<b>Plan laden:</b> PDF, Polycam-ZIP, SVG, PNG oder JPG auswählen. Bei mehrseitigen PDFs eine Seite in der Vorschau wählen. Bei Polycam möglichst SVG verwenden.';
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Anlage Probenahme (Word)</h3><p>Export → „Word · Anlage Probenahme“: eine Word-Datei zum Einfügen in den Bericht (Einfügen › Objekt › Text aus Datei) mit Lageplan je Geschoss im genormten Maßstab, Probenverzeichnis mit den Messwerten in der Schreibweise des Prüfberichts und der Einordnung in Ihre Skala, je Probe ein Probenblatt mit Lage, Fotos aus FotoKit (Probe-Nr.) und allen Laborwerten sowie einem Prüfprotokoll mit SHA-256 aller Quelldateien. Im Projektordner landet sie datiert in „Mitteilungen“, ohne etwas zu überschreiben; Lücken (Proben ohne Lage, Wert oder Foto, veränderte Fotos) stehen im Prüfprotokoll.</p>');
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Ausrichten (fotografierte Pläne)</h3><p>„Ausrichten“ (A) legt ein Raster über die Karte; der Plan dreht sich darunter um seine Mitte. Im Plan ziehen dreht frei (Umschalt = zehnmal feiner), Regler, Zahlenfeld, ±0,1° oder Pfeiltasten (Umschalt = 1°) stellen genau ein. „An Kante ausrichten“: zwei Punkte entlang einer geraden Wand anklicken – der Plan wird so gedreht, dass sie waagerecht oder senkrecht liegt. „Übernehmen“ oder Enter speichert, Escape bricht ab. Bis ±45°, gespeichert wird nur der Winkel; das Original bleibt unverändert. Ecken außerhalb des Fotos werden weiß, danach bei Bedarf zuschneiden. Probenpunkte, Flächen und Nordpfeil drehen mit und bleiben auf ihrer Stelle im Plan.</p>');
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Maßstäbliches PDF</h3><p>Liste → „Maßstab &amp; Norden“ → „Strecke messen“: zwei Punkte einer bekannten Strecke anklicken und die Länge in Metern eingeben. Im Export „PDF · A4“ oder „PDF · A3“ wählen – PlanKit nimmt den größten genormten Maßstab, der aufs Blatt passt, mit Schriftfeld, Legende, Maßstabsleiste und optionalem Nordpfeil. Beim Drucken „Tatsächliche Größe“ (100 %) wählen.</p><h3>Plan vorbereiten</h3><p>Unter „Plan vorbereiten“ jeweils 90° links/rechts drehen oder einen Bildausschnitt mit Maus/Finger aufziehen. Zuschnitt übernehmen oder abbrechen. Alle gesetzten Probenpunkte und Brandherde müssen im Ausschnitt liegen; ihre Positionen und versetzten Beschriftungen werden korrekt umgerechnet. Drehen und Zuschneiden sind rückgängig machbar. Die Originaldaten bleiben erhalten; eine perspektivische Entzerrung ist nicht enthalten.</p><p>PDF-Seiten werden lokal in hoher Auflösung gerendert (bis 4.600 px, auf Mobilgeräten/speicherarmen Geräten sinnvoll begrenzt). Bei Speicherproblemen wird eine kleinere Stufe versucht. JPG-/PNG-Originale werden beim Drehen und Zuschneiden nicht neu komprimiert. HEIC/HEIF bitte zuvor als JPG exportieren.</p>');
document.querySelector('#help-dialog')!.insertAdjacentHTML('beforeend','<h3>Laborberichte und offene Proben</h3><p>Zuerst einen Grundriss laden. Im Projektordner: Laborberichte in ResultKit importieren, prüfen und übernehmen, dann hier unter „Proben übernehmen …“ den Prüfbericht wählen. Bei einem freien Plan ohne Projektordner: unter „Proben übernehmen …“ XML, PDF oder beide gemeinsam auswählen oder Dateien auf die App ziehen. Die Prüftabelle vor Übernahme korrigieren, ergänzen und sortieren. Bei belegten P-Nummern das gewünschte Vorgehen ausdrücklich wählen. Offene Laborproben auf den Plan ziehen oder auswählen und in den Plan tippen. In der Prüftabelle legt die Spalte „Form“ fest, ob der Punkt Kreis, Quadrat oder Raute wird (oben auch für alle Zeilen). ✕ neben einer offenen Probe entfernt sie aus der Liste, „Liste leeren“ alle offenen; ✕ neben einer Markierung löscht den Probenpunkt im Plan. Übernahme und Platzierung unterstützen Undo/Redo; Projektdatei und Autosicherung erhalten die offene Liste.</p><p>„Probenliste speichern“ erzeugt eine JSON-Datei für andere Apps. Im Speicherdialog den Projektordner und „Laborergebnisse“ wählen; Browser ohne nativen Dialog laden die Datei herunter. Gespeicherte Herkunft bleibt nach erneutem Öffnen erhalten; bei mehreren Berichten den gewünschten Eintrag wählen. Nur bei älteren Projekten fehlende Herkunftsangaben ergänzen. PDF-Scans oder unbekannte Tabellenlayouts benötigen XML oder manuelle Eingabe. Alle Laborwerte bleiben lokal; die Ergebniskarte nutzt Ihre Skala oder die ausdrücklich gewählte VdS-Hintergrundreferenz.</p>');
input('file').accept='.zip,.svg,.png,.jpg,.jpeg,.pdf,.heic,.heif,application/pdf,image/png,image/jpeg';
$('plan-name').textContent='PDF, Polycam-ZIP, SVG, PNG oder JPG';
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Beschriftung</h3><p>Liste → „Beschriftung“, je Plan: <b>Schilder automatisch platzieren</b> – die Probenstelle bleibt exakt, das Schild weicht Text, Linien und anderen Schildern aus (mit Hinweislinie). Ein von Hand gezogenes Schild bleibt fest; „Schilder neu anordnen“ gibt es wieder frei. <b>Messwerte am Plan</b> – in der Ergebniskarte ein Wertkästchen je Probe (Wert wie im Prüfbericht, Einheit, Kategorie), auch in der Exportkarte schaltbar.</p>');
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Wandansichten (Bohrkerne)</h3><p>Liste → „Wandansichten (Bohrkerne) …“ (Projekt aus der Projektzentrale geöffnet): je Wand, Boden und Decke eine Zeichnung mit den Bohrkernen und je Kern einer Säule T1, T2 … mit Messwert und Farbe der Einordnung, dazu eine Tabelle. Die Kerne kommen aus der neuesten LabelKit-Datei (Wandblatt: Bezeichnung, Tiefe, Material, A/R, Abstand zur Ecke und Höhe über OKFF), die Werte aus dem importierten Prüfbericht über die Probennummer. Ohne Maße steht ein Punkt nach dem Raster 1–9. Eingeordnet wird nur mit einer vorhandenen Skala (VdS, Skala des Projekts oder aus FotoKit) – sonst nur der Wert. Ausgabe als Word-Anlage und Tabelle für Excel (CSV) in „Mitteilungen“.</p>');
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Raumbuch</h3><p>Liste → „Raumbuch bearbeiten …“: je Raum Befund (Proben mit Messwert und Oberflächenart, Brandherd) und Bewertung nach der Skala der Ergebniskarte – beides berechnet. Sie tragen je Raum Maßnahme und Bemerkung ein; Räume ohne Probe kommen mit Status dazu (Sichtprüfung unauffällig / auffällig, nicht begangen). Der Raum kommt aus LabelKit („Raum / Ort“) oder steht unter „Markierungen“ im Feld „Raum“. Ähnliche Schreibweisen (z. B. „Kü.“ und „Küche“) lassen sich zusammenführen. Ausgabe als Word-Anlage und als Tabelle für Excel (CSV) in „Mitteilungen“. Keine Flächen und Mengen – die Mengenermittlung bleibt beim ausführenden Unternehmen. Der Raum kommt aus „Raum / Ort“ in LabelKit; bei der Bezeichnung nach Handbuch („EG Küche Brandraum Decke“) zählen Geschoss und Raum, Zusatz und Bauteil bleiben bei der Probe. Steht ein eigenes Bauteil dahinter („EG Wohnzimmer Schrank oben“), die Zeilen im Raumbuch zusammenführen.</p><h3>Oberflächenart</h3><p>Aufsicht, Ansicht oder Untersicht je Probe kommt beim „Proben übernehmen“ aus LabelKit (Spalte „Oberflächenart“). Fehlt sie dort, lässt sie sich unter „Markierungen“ wählen; eine Eingabe in PlanKit bleibt auch bei erneutem Import. Am Schild ein Balken unten (Aufsicht), links (Ansicht) oder oben (Untersicht), dazu im Wertkästchen der Ergebniskarte und in der Legende.</p>');
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Skizze (kein Plan vorhanden)</h3><p>Links in der Werkzeugleiste „✎ Skizze“ (ohne Plan: neue Skizze, sonst als weiterer Plan; auf einer Skizze: bearbeiten), Startseite „Kein Plan? Skizze zeichnen“ oder unten „＋ Skizze“ für ein weiteres Geschoss. <b>Raum</b>: von Ecke zu Ecke aufziehen (Raster 10 cm, Räume rasten an Wänden ein), danach Name, Breite und Tiefe in Metern eintippen. <b>Wand</b>: frei ziehen, auch schräg (15°-Schritte rasten ein, Länge eintippbar). <b>Tür</b>/<b>Fenster</b>: auf eine Wand tippen (Tür 0,90 m mit Aufschlag, Fenster 1,20 m). <b>Text</b>: antippen und eintippen, z. B. „Treppe“. <b>Auswählen</b>: Räume, Wände, Texte ziehen, Ecke unten rechts ändert die Raumgröße, Entf löscht. „Skizze fertig“ schneidet die Zeichenfläche auf die Räume zu; der Maßstab ist automatisch gesetzt. „Skizze“ links bearbeitet sie weiter; Proben bleiben an ihrer Stelle.</p><h3>Schnellskizze (Test)</h3><p>Schneller ohne Maße: „☰ Räume aus Liste“ – Räume eintippen (einer pro Zeile, „Küche Brandraum“ markiert den Brandraum), „Raster erzeugen“, dann die Räume ziehen und anordnen. „Skizze – nicht maßstäblich“ (Standard bei neuen Skizzen): kein Maßstab, keine m², Stempel auf dem Plan. Wird eine Probe in einen Raum gesetzt, steht der Raumname gleich unter „Raum“ (fürs Raumbuch). Abschalten: Haken „Schnellskizze (Test)“ in der Skizzenleiste – die Skizze verhält sich dann wie bisher.</p>');
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Entzerren (Fluchtplan fotografiert)</h3><p>„Entzerren“ (W) links in der Leiste: die vier Ecken des Plans im Foto antippen oder ziehen – 1 oben links, 2 oben rechts, 3 unten rechts, 4 unten links. Die Lupe zeigt die Ecke vergrößert. Seitenverhältnis „wie im Foto“ oder DIN quer/hoch (Fluchtpläne sind meist A3/A4). „Entzerren“ rechnet ein gerades Bild; Proben und Flächen werden mitgerechnet. Ein vorhandener Maßstab und die Nordrichtung werden dabei entfernt und sind neu zu setzen. Rückgängig stellt das Foto wieder her; die Fotodatei selbst bleibt unverändert.</p>');
document.getElementById('app-version')!.textContent='v1.41.0';
document.querySelector('#help-dialog h2')!.insertAdjacentHTML('afterend','<h3>Neu in PlanKit 1.16.1 · 20.10.2026</h3><p>Projektzentrale und Spektron-Leiste übergeben Projekte jetzt über #projekt im Fragment. Sonderzeichen bleiben erhalten; alte ?projekt-Links funktionieren weiterhin und werden nach dem Laden bereinigt. Projektwechsel laden auch bereits geöffnete App-Fenster neu; eine Warnung vor ungesicherten Eingaben kann den Wechsel abbrechen. Die Anlagenaktion aktion=anlage wird ebenfalls im Fragment übergeben. Installiertes PlanKit nach einer Online-Aktualisierung vollständig schließen und erneut öffnen.</p>');
const colorOptions=PALETTE.map(c=>`<option value="${c.color}">${c.title} · ${c.suggestion}</option>`).join('');
document.querySelector('.modes')!.insertAdjacentHTML('beforeend','<button data-mode="area-draw" class="mode" disabled><span class="tool-icon">⬡</span><span>Fläche zeichnen<small>Eckpunkte setzen & abschließen</small></span></button><button data-mode="area-edit" class="mode" disabled><span class="tool-icon">◇</span><span>Fläche bearbeiten<small>Ecken oder ganze Fläche ziehen</small></span></button>');
document.querySelector('.rail .modes')!.insertAdjacentHTML('afterend','<button id="sketch-tb" type="button"></button>');   // „✎ Skizze“: immer in der Werkzeugleiste, auch ohne Plan
document.querySelector('.markers-section')!.insertAdjacentHTML('afterend',`<section class="areas-section"><div class="section-heading"><h2>Schadensflächen</h2><span id="area-count" class="count">0</span></div><div id="area-draft" hidden><label>Farbe<select id="draft-color">${colorOptions}</select></label><label>Deckkraft <output id="draft-opacity-value">30 %</output><input id="draft-opacity" type="range" min="5" max="70" value="30"></label><p id="draft-status" class="tiny"></p><div class="inspector-actions"><button id="area-last">Letzten Eckpunkt entfernen</button><button id="area-cancel">Abbrechen</button><button id="area-finish" class="primary">Fläche abschließen</button></div></div><div id="area-list"></div><div id="area-inspector" hidden><label>Kennung<input id="area-label" maxlength="16"></label><label>Bezeichnung<textarea id="area-name" maxlength="160" rows="3"></textarea></label><label>Farbe<select id="area-color">${colorOptions}</select></label><label>Deckkraft <output id="area-opacity-value"></output><input id="area-opacity" type="range" min="5" max="70"></label><p class="tiny">Eckpunkte oder die ganze Fläche im Plan ziehen. Die Bezeichnung bestimmt die gemeinsame Legendenkategorie.</p><button id="area-delete" class="danger wide">Fläche löschen</button></div><p class="tiny">Farben und Bezeichnungen dokumentieren Ihre Eingabe. Sie stellen keine chemische Bewertung oder Freigabe fest.</p></section>`);
document.body.insertAdjacentHTML('beforeend','<dialog id="area-dialog"><h2>Fläche benennen</h2><p>Vorschlag frei anpassen. Gleich bezeichnete Flächen werden in der Legende gemeinsam aufgeführt.</p><label>Bezeichnung<input id="new-area-name" maxlength="160"></label><div class="dialog-actions"><button id="area-dialog-cancel">Weiterzeichnen</button><button id="area-dialog-save" class="primary">Fläche speichern</button></div></dialog>');
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Schadensflächen & Legende</h3><p>„Fläche zeichnen“ wählen, Farbe und Deckkraft einstellen (Standard 30 %) und mindestens drei Eckpunkte in den Plan tippen. „Fläche abschließen“ öffnet die frei bearbeitbare Bezeichnung. „Letzten Eckpunkt entfernen“ korrigiert die Kontur; „Abbrechen“ verwirft den Entwurf. Zum Verschieben der Ansicht können Sie zwischendurch „Ansicht bewegen“ wählen. Zwei Finger und das Mausrad zoomen, ohne Eckpunkte zu setzen.</p><p>Unter „Fläche bearbeiten“ oder über die Flächenliste auswählen. Die sichtbaren Eckpunkte oder die ganze Fläche ziehen. Kennung, Bezeichnung, Farbe und Deckkraft sind nachträglich bearbeitbar. Kreuzende Konturen werden abgewiesen. Rückgängig/Wiederherstellen gilt auch für Flächen. Ein Zuschnitt muss sämtliche Eckpunkte und Probenpunkte enthalten. Unfertige Entwürfe vor Vorbereitung, Sicherung oder Export abschließen oder abbrechen.</p><p>Der Export ordnet nur verwendete Flächenbezeichnungen automatisch in einem weißen Legendenbereich an. Gleiche Bezeichnungen (unabhängig von Groß-/Kleinschreibung) erscheinen einmal; unterschiedliche Farben oder Deckkräfte werden dort mit den zugehörigen Kennungen gezeigt. Konturmuster und Kennungen helfen bei geringer Farbsättigung. Farben und Vorschlagstexte sind ausschließlich manuelle Dokumentation, keine automatische Schadstoffbewertung oder Freigabe.</p>');
input('project-file').insertAdjacentHTML('afterend',`<div id="preparation" hidden><span class="eyebrow">PLAN VORBEREITEN</span><div class="preparation-buttons"><button id="rotate-left" title="90° nach links drehen">↶ Links drehen</button><button id="rotate-right" title="90° nach rechts drehen">↷ Rechts drehen</button><button id="crop-start">⌗ Zuschneiden</button><button id="align-start">∡ Ausrichten</button><button id="warp-start">⏢ Entzerren</button><button id="sketch-edit" hidden>✎ Skizze bearbeiten</button></div><p class="tiny">Bei Bedarf ausrichten und Bildränder entfernen.</p><div id="crop-actions" hidden><p>Ziehen Sie im Plan einen neuen Bildausschnitt auf. Alle Probenpunkte müssen darin liegen.</p><button id="crop-confirm" class="primary" disabled>Zuschnitt übernehmen</button><button id="crop-cancel">Abbrechen</button></div><div id="align-actions" hidden><p>Plan drehen, bis Wände am Raster liegen: im Plan ziehen (Umschalt = fein), Regler, ±0,1° oder Pfeiltasten. Oder „An Kante ausrichten“ und zwei Punkte entlang einer Wand anklicken.</p><div class="align-row"><button id="align-minus" title="0,1° gegen den Uhrzeigersinn (←, Umschalt = 1°)">−0,1°</button><input id="align-range" type="range" min="-${45}" max="${45}" step="0.1" value="0" aria-label="Drehwinkel in Grad"><button id="align-plus" title="0,1° im Uhrzeigersinn (→, Umschalt = 1°)">+0,1°</button><label class="align-num"><input id="align-angle" type="number" min="-45" max="45" step="0.1" value="0" aria-label="Drehwinkel in Grad">°</label></div><div class="align-row"><button id="align-edge" title="Zwei Punkte entlang einer Wand anklicken: der Plan wird so gedreht, dass sie waagerecht oder senkrecht liegt">⟋ An Kante ausrichten</button><button id="align-reset" title="Feinausrichtung auf 0° zurücksetzen">0°</button></div><div class="align-row"><button id="align-cancel">Abbrechen</button><button id="align-confirm" class="primary">Ausrichtung übernehmen</button></div></div></div><div id="import-status" role="status" hidden>Plan wird geladen …</div>`);
document.body.insertAdjacentHTML('beforeend',`<dialog id="pdf-dialog"><form method="dialog"><button class="close" aria-label="PDF-Auswahl abbrechen">×</button></form><span class="eyebrow">PDF · SEITENAUSWAHL</span><h2>Welchen Grundriss übernehmen?</h2><p id="pdf-name"></p><div class="pdf-navigation"><button id="pdf-prev" aria-label="Vorherige PDF-Seite">←</button><label>Seite <input id="pdf-page" type="number" min="1" value="1"></label><span id="pdf-count"></span><button id="pdf-next" aria-label="Nächste PDF-Seite">→</button></div><div class="pdf-preview"><img id="pdf-preview" alt="Vorschau der ausgewählten PDF-Seite"><p id="pdf-status" role="status">Vorschau wird geladen …</p></div><div class="dialog-actions"><button id="pdf-cancel">Abbrechen</button><button id="pdf-all">Alle Seiten als einzelne Pläne</button><button id="pdf-use" class="primary" disabled>Diese Seite übernehmen</button></div><p class="tiny">Die gewählte Seite wird in hoher Auflösung übernommen. „Alle Seiten“ legt je Seite einen eigenen Plan an (z. B. ein Geschoss pro Seite).</p></dialog>`);
const ns='http://www.w3.org/2000/svg',planGroup=document.createElementNS(ns,'g'),clip=document.createElementNS(ns,'clipPath'),clipRect=document.createElementNS(ns,'rect');
clip.id='plan-clip';clip.append(clipRect);svg.prepend(clip);image.before(planGroup);planGroup.append(image);planGroup.setAttribute('clip-path','url(#plan-clip)');
// Weißer Grund hinter fein gedrehten Plänen: die Ecken außerhalb des Originals erscheinen weiß wie im Export.
const planBack=document.createElementNS(ns,'rect');planBack.id='plan-back';planBack.setAttribute('fill','#fff');planGroup.prepend(planBack);
const cropLayer=document.createElementNS(ns,'g');cropLayer.id='crop-overlay';cropLayer.setAttribute('pointer-events','none');svg.append(cropLayer);
const sketchLayer=document.createElementNS(ns,'g');sketchLayer.id='sketch-overlay';sketchLayer.setAttribute('pointer-events','none');svg.append(sketchLayer);
const warpLayer=document.createElementNS(ns,'g');warpLayer.id='warp-overlay';svg.append(warpLayer);planGroup.id='plan-view';
const alignLayer=document.createElementNS(ns,'g');alignLayer.id='align-overlay';alignLayer.setAttribute('pointer-events','none');svg.append(alignLayer);
const areaLayer=document.createElementNS(ns,'g');areaLayer.id='areas';marks.before(areaLayer);
let selectedArea:string|null=null,draftPoints:Point[]=[],measurePoints:Point[]=[];
let labUI:LabUI|null=null;
let project:Project|null=null,selected:string|null=null,mode='navigate',history=new History(),busy=false;
let cropping=false,cropRect:Rect|null=null,cropDrag:{id:number;start:{x:number;y:number}}|null=null;
// Ausrichten: Vorschau dreht nur die Darstellung um delta Grad; erst „Übernehmen“ ändert das Projekt (ein Rückgängig-Schritt).
// Während des Ausrichtens ist cropping ebenfalls gesetzt: alles, was beim Zuschneiden gesperrt ist, ist auch hier gesperrt.
let aligning:{start:number;delta:number;drag:{id:number;prev:number}|null;edge:Point[]|null}|null=null;
/** Entzerren: vier Ecken im angezeigten Plan; erst „Entzerren“ ändert das Projekt (ein Rückgängig-Schritt). Auch hier ist cropping gesetzt. */
let warping:{q:Quad;drag:{id:number;i:number}|null;busy:boolean}|null=null;
/** Skizze: Arbeitskopie s; Änderungen werden je abgeschlossener Aktion als ein Rückgängig-Schritt übernommen. Auch hier ist cropping gesetzt. */
type SketchTool='room'|'wall'|'door'|'window'|'text'|'select';
let sketching:{s:Sketch;tool:SketchTool;sel:{type:SketchKind;id:string}|null;drag:{id:number;kind:'draw'|'move'|'resize'|'pan';start:Point;screen:{x:number;y:number};room?:SketchRoom;wall?:SketchWall;text?:SketchText;cam?:typeof camera;moved:boolean}|null;draft:SketchRoom|null;draftWall:SketchWall|null}|null=null;
let camera={x:0,y:0,width:1000,height:1000},fitWidth=1000,saveRevision=0,exportURL='';
let saveQueue:Promise<void>=Promise.resolve();
let toastTimer=0,savedToastRevision:number|null=null;
function toast(message:string,error=false){savedToastRevision=null;$('toast').textContent=message;$('toast').className=error?'error':'';$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('toast').hidden=true,error?12000:4500);}
function fail(e:unknown){toast(e instanceof Error?e.message:'Die Aktion konnte nicht abgeschlossen werden.',true);}
function persist(toFolder=true){
 if(!project)return;const target=folder,p=clone(project),revision=++saveRevision,savedAt=Date.now();
 if(target&&toFolder){folderDirty=true;if(savedToastRevision!==null){$('toast').hidden=true;clearTimeout(toastTimer);savedToastRevision=null;}scheduleFolderSave();}
 const dirty=folderDirty,baseRevision=folderRevision;
 $('saved').textContent=target?(dirty?'Änderungen noch nicht im Projektordner gespeichert':'✓ Aus „Pläne“ geladen'):'Wird lokal gesichert …';
 saveQueue=saveQueue.catch(()=>{}).then(()=>saveLocal(p)).then(()=>target?saveLocal({savedAt,project:p,dirty,baseRevision},folderKey(target)):undefined).then(()=>{if(revision===saveRevision&&!folder)$('saved').textContent='✓ Lokal gesichert';}).catch(()=>{
  if(revision===saveRevision&&target===folder){$('saved').textContent='⚠ Browsersicherung fehlgeschlagen';toast('Browserspeicher nicht verfügbar oder voll. Bitte das Projekt als Datei sichern.',true);}
 });
}
function changed(){render();persist();}
function mutate(fn:(p:Project)=>void){if(!project)return;history.push(project);fn(project);changed();}
function selectedMarker(){return project?.markers.find(m=>m.id===selected);}
function updateCamera(){svg.setAttribute('viewBox',`${camera.x} ${camera.y} ${camera.width} ${camera.height}`);$('zoom-value').textContent=`${Math.round(fitWidth/camera.width*100)} %`;renderMarkers();renderCrop();if(aligning)renderAlign();if(warping)renderWarp();if(sketching)renderSketch();}
function fit(){if(!project)return;const b=bounds(labeledView(project)),rect=svg.getBoundingClientRect(),ratio=rect.width/rect.height||1;let w=b.width*1.14,h=b.height*1.14;if(w/h<ratio)w=h*ratio;else h=w/ratio;camera={x:b.x+(b.width-w)/2,y:b.y+(b.height-h)/2,width:w,height:h};fitWidth=w;updateCamera();}
function point(e:{clientX:number;clientY:number}){const matrix=svg.getScreenCTM();if(!matrix)return{x:0,y:0};const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return{x:p.x,y:p.y};}
function zoom(factor:number,anchor?:{x:number;y:number}){if(!project)return;const ratio=Math.min(20,Math.max(.25,fitWidth/(camera.width*factor)));factor=fitWidth/(ratio*camera.width);const c=anchor||{x:camera.x+camera.width/2,y:camera.y+camera.height/2};camera={x:c.x-(c.x-camera.x)*factor,y:c.y-(c.y-camera.y)*factor,width:camera.width*factor,height:camera.height*factor};updateCamera();}
function setMode(next:string){mode=next;document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});$('stage').dataset.mode=mode;if(next!=='measure'&&measurePoints.length){measurePoints=[];renderMeasure();}$('mode-hint').textContent=({measure:'Strecke messen: ersten Punkt anklicken · Ziehen verschiebt die Ansicht · Esc bricht ab',navigate:'Ansicht bewegen · Mausrad oder zwei Finger zum Zoomen',sample:'Tippen setzt eine Probe · Ziehen verschiebt die Ansicht',fire:'Tippen setzt einen Brandherd · Ziehen verschiebt die Ansicht',edit:'Markierung wählen · Punkt oder Beschriftung ziehen','area-draw':'Eckpunkte setzen · anschließend Fläche abschließen','area-edit':'Fläche wählen · Eckpunkte oder Fläche ziehen','lab-place':'Ausgewählte Laborprobe durch Tippen platzieren · Ziehen verschiebt die Ansicht'} as Record<string,string>)[mode];}
let showResults=false;
/** Angezeigte Marker (Schilder ggf. automatisch versetzt, Wertkästchen) – für Ziehen an einem automatisch versetzten Schild. */
let shown=new Map<string,Shown>();
function labeledView(p:Project){return labeled(p,showResults?rateMarkers(p):null);}
function renderMarkers(){if(project){const rated=showResults?rateMarkers(project):null,view=labeled(project,rated);shown=new Map(view.markers.map(m=>[m.id,m as Shown]));marks.innerHTML=view.markers.map(m=>shownSVG(view,m,m.id===selected,camera.width/Math.max(1,svg.clientWidth)*12*Math.min(1,markerScale(project!)),rated?.fill.get(m.id))).join('');
  if(!inkTried(project.plan)){const plan=project.plan;void ensureInk(plan).then(()=>{if(project&&project.plan===plan)renderMarkers();});}renderAreas();renderMeasure();}}
function selectedPolygon(){return project?.areas?.find(a=>a.id===selectedArea);}
function renderAreas(){
  if(!project)return;
  const size=camera.width/Math.max(1,svg.clientWidth)*12;
  areaLayer.setAttribute('pointer-events',mode==='area-edit'?'auto':'none');
  areaLayer.innerHTML=areaSVG(project.areas||[],project.plan,{selected:selectedArea,interactive:true,handles:mode==='area-edit',minSize:size});
  if(draftPoints.length){const color=input('draft-color').value;areaLayer.innerHTML+=`<g pointer-events="none"><polyline points="${draftPoints.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${draftPoints.length>2?color:'none'}" fill-opacity="${Number(input('draft-opacity').value)/100}" stroke="${palette(color).outline}" stroke-width="${size*.15}" stroke-dasharray="${size*.4} ${size*.25}"/>${draftPoints.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${size*.35}" fill="white" stroke="${palette(color).outline}" stroke-width="${size*.15}"/>`).join('')}</g>`;}
  $('area-draft').hidden=mode!=='area-draw'&&!draftPoints.length;
  $('draft-status').textContent=`${draftPoints.length} Eckpunkte · mindestens 3 zum Abschließen`;
  $<HTMLButtonElement>('area-finish').disabled=draftPoints.length<3;
  $<HTMLButtonElement>('area-last').disabled=!draftPoints.length;
  $('area-count').textContent=String(project.areas?.length||0);
}
function requireFinished(){if(!draftPoints.length)return true;toast('Bitte die gezeichnete Fläche zuerst abschließen oder abbrechen.',true);return false;}
function exportFormat(){return input('format').value as 'png'|'jpeg'|'pdf-a4'|'pdf-a3'|'anlage';}
function dimensions(){if(!project)return;const format=exportFormat(),pdf=format.startsWith('pdf');
  const annex=format==='anlage';$('annex-fields').hidden=!annex;$('scope-field').style.display=annex?'none':'';
  if(annex){$('quality-field').hidden=true;const label='↓ Anlage erstellen';if(!busy&&$('export').textContent!==label)$('export').textContent=label;
    if(!input('annex-title').value)input('annex-title').value=annexTitle();
    const n=collectCount(project),floors=sheetCount(project);$('dimensions').textContent='Word-Datei (.docx)';
    $('dimensions-note').textContent=`${n} Probe${n===1?'':'n'} · ${floors} Planseite${floors===1?'':'n'} · ${folder?`gespeichert in „${ANNEX_DIR}“ mit Fotos aus FotoKit`:'ohne Projektordner: ohne Fotos, als Download'}`;return;}
  // Beschriftung nur bei Änderung und nie während eines Exports setzen: WebKit verwirft einen Klick, wenn der Text
  // unter dem Mauszeiger zwischen Drücken und Loslassen ersetzt wird (z. B. Neuzeichnen nach Verlassen eines Feldes).
  $('quality-field').hidden=pdf;const label=pdf?'↓ PDF exportieren':'↓ Bild exportieren';if(!busy&&$('export').textContent!==label)$('export').textContent=label;
  $('framed-field').hidden=pdf;
  const resultsSel=!$('view-field').hidden&&input('view').value==='results',valuesBox=$('values-field');valuesBox.hidden=!resultsSel;input('values-export').checked=valueLabels(project.plan);
  const problem=resultsSel?resultsProblem(project):'';$('view-note').hidden=!problem;$('view-note').textContent=problem;
  if(!pdf&&framed()){try{const q=Number(input('quality').value),l=sheetLayout(project,'bild',resultsSel?rateMarkers(project):null),f=q/Math.max(l.width,l.height);
      $('dimensions').textContent=`${Math.round(l.width*f).toLocaleString('de-DE')} × ${Math.round(l.height*f).toLocaleString('de-DE')} px · ${l.landscape?'quer':'hoch'}`;
      $('dimensions-note').textContent='Wie das PDF: Schriftfeld mit Firmenlogo, Objekt, Gutachten-Nr. und Datum, Legende'+(l.ratio?', Maßstabsleiste':'')+(northAngle(project.plan)!==null?', Nordpfeil':'');}
    catch(e){$('dimensions').textContent='—';$('dimensions-note').textContent=e instanceof Error?e.message:'';}return;}
  if(!pdf){const l=exportLayout(project,Number(input('quality').value));$('dimensions').textContent=`${l.pixelWidth.toLocaleString('de-DE')} × ${l.pixelHeight.toLocaleString('de-DE')} px`;$('dimensions-note').textContent='Nur Plan mit Legende, ohne Schriftfeld';return;}
  if(!$<HTMLDialogElement>('export-dialog').open)return;
  const resultsView=!$('view-field').hidden&&input('view').value==='results',all=sheetCount(project)>1&&input('scope').value==='all';
  try{const l=sheetLayout(project,format.slice(4) as Paper,resultsView?rateMarkers(project):null);$('dimensions').textContent=`${PAPERS[l.paper].label} ${l.landscape?'quer':'hoch'} · ${l.ratio?`M 1:${l.ratio.toLocaleString('de-DE')}`:'ohne Maßstab'}`;
    $('dimensions-note').textContent=!metersPerUnit(project.plan)?'Plan nicht kalibriert: Liste → „Strecke messen“ für einen echten Maßstab.':!l.ratio?'Plan zu groß für 1:5.000 – auf Blattgröße eingepasst.':all?'Dieser Plan; jedes Blatt erhält seinen eigenen Maßstab.':'Schriftfeld, Legende, Maßstabsleiste'+(northAngle(project.plan)!==null?', Nordpfeil':'');}
  catch(e){$('dimensions').textContent='—';$('dimensions-note').textContent=e instanceof Error?e.message:'';}
}
function renderCrop(){
  if(!cropping||aligning||warping||sketching||!project){cropLayer.replaceChildren();return;}
  const w=project.plan.width,h=project.plan.height,c=cropRect||{x:0,y:0,width:0,height:0},stroke=camera.width/Math.max(1,svg.clientWidth)*2;
  cropLayer.innerHTML=`<path d="M0 0H${w}V${h}H0Z M${c.x} ${c.y}V${c.y+c.height}H${c.x+c.width}V${c.y}Z" fill="#17392c" fill-opacity=".48" fill-rule="evenodd"/><rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" fill="none" stroke="white" stroke-width="${stroke*2}"/><rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" fill="none" stroke="#1c7457" stroke-width="${stroke}" stroke-dasharray="${stroke*4} ${stroke*3}"/>`;
}
function endCrop(){cropping=false;cropRect=null;cropDrag=null;$('crop-actions').hidden=true;setMode('navigate');renderCrop();render();}
function cropPoint(e:PointerEvent){const p=point(e);return {x:Math.min(project!.plan.width,Math.max(0,p.x)),y:Math.min(project!.plan.height,Math.max(0,p.y))};}
$('rotate-left').onclick=()=>{if(project&&!busy&&!cropping){mutate(p=>rotateProject(p,-1));fit();}};
$('rotate-right').onclick=()=>{if(project&&!busy&&!cropping){mutate(p=>rotateProject(p,1));fit();}};
$('crop-start').onclick=()=>{if(!project||busy)return;cropping=true;cropRect=null;selected=null;setMode('navigate');fit();$('stage').dataset.mode='crop';$('mode-hint').textContent='Zuschneiden · Bildausschnitt mit Maus oder Finger aufziehen';$('crop-actions').hidden=false;$<HTMLButtonElement>('crop-confirm').disabled=true;render();renderCrop();};
$('crop-cancel').onclick=endCrop;
$('crop-confirm').onclick=()=>{if(!project||!cropRect)return;try{const next=clone(project);cropProject(next,cropRect);history.push(project);project=next;endCrop();fit();persist();toast('Plan zugeschnitten. Rückgängig stellt den vorherigen Ausschnitt wieder her.');}catch(e){fail(e);}};
// Preserve normal button clicks. If a touch engine omits the compatibility click
// immediately after a captured drag, activate a completed tap once as a fallback.
for(const id of ['crop-confirm','crop-cancel']){
  const button=$<HTMLButtonElement>(id);let tap:{id:number;x:number;y:number}|null=null,clicks=0;
  button.addEventListener('click',()=>clicks++,{capture:true});
  button.onpointerdown=e=>{if(e.pointerType==='touch')tap={id:e.pointerId,x:e.clientX,y:e.clientY};};
  button.onpointercancel=()=>{tap=null;};
  button.onpointerup=e=>{const start=tap;tap=null;if(start?.id!==e.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>=10)return;const rect=cropRect,seen=clicks;setTimeout(()=>{if(cropping&&cropRect===rect&&clicks===seen&&!button.disabled)button.click();},80);};
}
svg.addEventListener('pointerdown',e=>{if(!cropping||aligning||warping||sketching||!project)return;if(cropDrag||e.button>0)return;svg.setPointerCapture(e.pointerId);const start=cropPoint(e);cropDrag={id:e.pointerId,start};cropRect={...start,width:0,height:0};$<HTMLButtonElement>('crop-confirm').disabled=true;renderCrop();},{capture:true});
svg.addEventListener('pointermove',e=>{if(!cropping||!project||cropDrag?.id!==e.pointerId)return;const pt=cropPoint(e),start=cropDrag.start;cropRect={x:Math.min(start.x,pt.x),y:Math.min(start.y,pt.y),width:Math.abs(pt.x-start.x),height:Math.abs(pt.y-start.y)};$<HTMLButtonElement>('crop-confirm').disabled=cropRect.width<1||cropRect.height<1;renderCrop();},{capture:true});
svg.addEventListener('pointerup',e=>{if(cropping&&cropDrag?.id===e.pointerId)cropDrag=null;},{capture:true});
svg.addEventListener('pointercancel',e=>{if(cropping&&cropDrag?.id===e.pointerId){cropDrag=null;cropRect=null;$<HTMLButtonElement>('crop-confirm').disabled=true;renderCrop();}},{capture:true});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&cropping&&!aligning&&!warping&&!sketching)endCrop();});
/* ---------- Ausrichten (Feinausrichtung) ----------
   Raster fest über der Karte, der Plan dreht sich darunter um seine Mitte. Ziehen dreht (Umschalt = zehnmal feiner),
   Regler/Zahl/±0,1°/Pfeiltasten stellen genau ein, „An Kante ausrichten“ legt zwei angeklickte Punkte waagerecht oder senkrecht.
   Gespeichert wird nur der Winkel (alignProject); das Original bleibt unverändert. */
$('stage').insertAdjacentHTML('beforeend','<div id="align-grid" hidden aria-hidden="true"></div>');
const deg=(n:number)=>`${n.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:2})}°`;
function alignTotal(){return aligning?Math.round((aligning.start+aligning.delta)*100)/100:0;}
function setAlignTotal(total:number){if(!aligning||!Number.isFinite(total))return;const t=Math.max(-MAX_ANGLE,Math.min(MAX_ANGLE,Math.round(total*100)/100));aligning.delta=Math.round((t-aligning.start)*100)/100;renderAlign();}
function renderAlign(){
  const on=!!aligning&&!!project;$('align-grid').hidden=!on;$('align-actions').hidden=!on;$('stage').classList.toggle('aligning',on);
  for(const layer of [planGroup,areaLayer,marks])if(on&&aligning!.delta)layer.setAttribute('transform',`rotate(${aligning!.delta} ${project!.plan.width/2} ${project!.plan.height/2})`);else layer.removeAttribute('transform');
  if(!on){alignLayer.replaceChildren();return;}
  const a=aligning!,total=alignTotal();input('align-range').value=String(total);if(document.activeElement!==input('align-angle'))input('align-angle').value=String(total);
  $<HTMLButtonElement>('align-confirm').textContent=a.delta?`Ausrichtung übernehmen (${deg(total)})`:'Ausrichtung übernehmen';
  $('align-edge').classList.toggle('active',!!a.edge);
  $('mode-hint').textContent=a.edge?(a.edge.length?'Zweiten Punkt auf derselben Wand anklicken':'Ersten Punkt auf einer geraden Wand oder Kante anklicken'):`Ausrichten · ${deg(total)} · Plan am Raster ausrichten`;
  const k=camera.width/Math.max(1,svg.clientWidth),pts=a.edge||[];
  alignLayer.innerHTML=pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${k*6}" fill="#c0392b" stroke="white" stroke-width="${k*2}"/>`).join('')+(pts.length===2?`<line x1="${pts[0].x}" y1="${pts[0].y}" x2="${pts[1].x}" y2="${pts[1].y}" stroke="#c0392b" stroke-width="${k*2}"/>`:'');
}
function endAlign(){aligning=null;cropping=false;setMode('navigate');renderAlign();render();fit();}
$('align-start').onclick=()=>{if(!project||busy||cropping||!requireFinished())return;aligning={start:fineAngle(preparation(project.plan)),delta:0,drag:null,edge:null};cropping=true;selected=null;selectedArea=null;setMode('navigate');$('stage').dataset.mode='align';render();fit();renderAlign();};
$('align-cancel').onclick=endAlign;
$('align-confirm').onclick=()=>{if(!project||!aligning)return;const {delta}=aligning,total=alignTotal();if(!delta){endAlign();return;}
  try{const next=clone(project);alignProject(next,delta);history.push(project);project=next;endAlign();persist();toast(`Plan um ${deg(delta)} gedreht (Ausrichtung jetzt ${deg(total)}). Rückgängig stellt die vorherige Lage wieder her.`);}catch(e){fail(e);}};
$('align-minus').onclick=()=>setAlignTotal(alignTotal()-.1);
$('align-plus').onclick=()=>setAlignTotal(alignTotal()+.1);
$('align-reset').onclick=()=>setAlignTotal(0);
input('align-range').oninput=()=>setAlignTotal(Number(input('align-range').value));
input('align-angle').onchange=()=>{const v=Number(input('align-angle').value.replace(',','.'));if(Number.isFinite(v))setAlignTotal(v);else renderAlign();};
$('align-edge').onclick=()=>{if(!aligning)return;aligning.edge=aligning.edge?null:[];renderAlign();};
/** Mitte des Plans auf dem Bildschirm (Drehpunkt der Vorschau). */
function alignCenter(){const m=svg.getScreenCTM();if(!m||!project)return {x:0,y:0};const p=new DOMPoint(project.plan.width/2,project.plan.height/2).matrixTransform(m);return {x:p.x,y:p.y};}
svg.addEventListener('pointerdown',e=>{
  if(!aligning||!project||e.button>0)return;e.preventDefault();
  if(aligning.edge){
    const pt=point(e);aligning.edge.push(pt);
    if(aligning.edge.length===2){
      const [a,b]=aligning.edge,len=Math.hypot(b.x-a.x,b.y-a.y)/(camera.width/Math.max(1,svg.clientWidth));
      if(len<20){aligning.edge=[a];toast('Die beiden Punkte liegen zu nah beieinander. Bitte weiter auseinander anklicken.',true);renderAlign();return;}
      const theta=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,target=Math.round(theta/90)*90;renderAlign();
      const edge=aligning;setTimeout(()=>{if(aligning===edge){edge.edge=null;setAlignTotal(alignTotal()+target-theta);}},350);
    }else renderAlign();
    return;
  }
  if(aligning.drag)return;svg.setPointerCapture(e.pointerId);const c=alignCenter();aligning.drag={id:e.pointerId,prev:Math.atan2(e.clientY-c.y,e.clientX-c.x)};
},{capture:true});
svg.addEventListener('pointermove',e=>{
  if(!aligning?.drag||aligning.drag.id!==e.pointerId)return;const c=alignCenter();if(Math.hypot(e.clientX-c.x,e.clientY-c.y)<16)return;
  const now=Math.atan2(e.clientY-c.y,e.clientX-c.x);let step=(now-aligning.drag.prev)*180/Math.PI;aligning.drag.prev=now;step=((step+540)%360)-180;
  aligning.delta+=step*(e.shiftKey?.1:1);const t=Math.max(-MAX_ANGLE,Math.min(MAX_ANGLE,aligning.start+aligning.delta));aligning.delta=t-aligning.start;renderAlign();
},{capture:true});
const alignDrop=(e:PointerEvent)=>{if(aligning?.drag?.id===e.pointerId){aligning.drag=null;setAlignTotal(alignTotal());}};
svg.addEventListener('pointerup',alignDrop,{capture:true});svg.addEventListener('pointercancel',alignDrop,{capture:true});
window.addEventListener('keydown',e=>{
  if(!aligning||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Escape'){e.preventDefault();if(aligning.edge){aligning.edge=null;renderAlign();}else endAlign();return;}
  const t=e.target;if(t instanceof Element&&t.closest('input,textarea,select'))return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setAlignTotal(alignTotal()+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?1:.1));}
  else if(e.key==='Enter'&&!(t instanceof HTMLButtonElement)){e.preventDefault();$('align-confirm').click();}
});
/* ---------- Entzerren (ab 1.20) ----------
   Schräg fotografierter Plan (Fluchtplan im Treppenhaus): vier Ecken antippen oder ziehen, Lupe zeigt die Ecke vergrößert.
   „Entzerren“ rechnet ein neues gerades Bild; Markierungen und Flächen werden mitgerechnet. Original: Rückgängig bzw. Fotodatei. */
$('stage').insertAdjacentHTML('beforeend',`<div id="warp-actions" hidden><p>Ecken des Plans antippen oder ziehen: <b>1</b> oben links · <b>2</b> oben rechts · <b>3</b> unten rechts · <b>4</b> unten links</p><div class="align-row"><label>Seitenverhältnis<select id="warp-aspect">${(Object.keys(ASPECT_NAMES) as Aspect[]).map(a=>`<option value="${a}">${ASPECT_NAMES[a]}</option>`).join('')}</select></label><span id="warp-info" class="tiny"></span><span class="warp-buttons"><button id="warp-cancel">Abbrechen</button><button id="warp-confirm" class="primary">Entzerren ✓</button></span></div></div><div id="warp-loupe" hidden aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg"><use href="#plan-view"/><path class="cross"/></svg></div>`);
const WARP_ORDER=['oben links','oben rechts','unten rechts','unten links'];
function renderWarp(){
  const on=!!warping&&!!project;$('warp-actions').hidden=!on;$('stage').classList.toggle('warping',on);if(!on){warpLayer.replaceChildren();$('warp-loupe').hidden=true;return;}
  const w=warping!,k=camera.width/Math.max(1,svg.clientWidth),q=w.q,problem=quadProblem(q,project!.plan);
  warpLayer.innerHTML=`<polygon points="${q.map(p=>`${p.x},${p.y}`).join(' ')}" fill="rgba(232,145,45,.08)" stroke="#e8912d" stroke-width="${k*2.5}" stroke-dasharray="${k*10} ${k*6}" pointer-events="none"/>`
    +q.map((p,i)=>`<g data-corner="${i}" style="cursor:move"><circle cx="${p.x}" cy="${p.y}" r="${k*22}" fill="transparent"/><circle cx="${p.x}" cy="${p.y}" r="${k*13}" fill="#fff" stroke="#e8912d" stroke-width="${k*3.5}"/><text x="${p.x}" y="${p.y+k*5}" text-anchor="middle" font-family="Arial" font-weight="700" font-size="${k*14}" fill="#c06a12" pointer-events="none">${i+1}</text></g>`).join('');
  const size=targetSize(q,input('warp-aspect').value as Aspect);
  $('warp-info').textContent=problem||`Ergebnis ${size.width.toLocaleString('de-DE')} × ${size.height.toLocaleString('de-DE')} px`;$('warp-info').classList.toggle('error',!!problem);
  $<HTMLButtonElement>('warp-confirm').disabled=!!problem||w.busy;$<HTMLButtonElement>('warp-cancel').disabled=w.busy;
  $('mode-hint').textContent=w.busy?'Entzerren …':`Entzerren · Ecken ${WARP_ORDER.join(', ')} · Enter übernimmt, Esc bricht ab`;
}
function warpLoupe(i:number|null){
  const l=$('warp-loupe');if(!warping||i===null){l.hidden=true;return;}
  const p=warping.q[i],m=svg.getScreenCTM(),stage=$('stage').getBoundingClientRect();if(!m)return;
  const s=new DOMPoint(p.x,p.y).matrixTransform(m),size=150,zoom=3,span=camera.width/Math.max(1,svg.clientWidth)*size/zoom;
  const svgEl=l.querySelector('svg')!;svgEl.setAttribute('viewBox',`${p.x-span/2} ${p.y-span/2} ${span} ${span}`);
  l.querySelector('path')!.setAttribute('d',`M${p.x-span/2} ${p.y}H${p.x+span/2}M${p.x} ${p.y-span/2}V${p.y+span/2}`);l.querySelector('path')!.setAttribute('stroke-width',String(span/150));
  // Lupe neben die Ecke, nicht unter den Finger
  const left=s.x-stage.left+(i===1||i===2?-size-40:40),top=s.y-stage.top+(i>=2?-size-40:40);
  l.style.left=`${Math.max(4,Math.min(stage.width-size-4,left))}px`;l.style.top=`${Math.max(4,Math.min(stage.height-size-4,top))}px`;l.hidden=false;
}
/** Ansicht so, dass der ganze Plan mit Rand unter der Leiste liegt – alle vier Ecken frei greifbar. */
function warpFit(){if(!project)return;const r=svg.getBoundingClientRect(),top=$('warp-actions').offsetHeight+70,availH=Math.max(120,r.height-top-24),W=project.plan.width,H=project.plan.height;
  const k=Math.max(W/(r.width*.9),H/(availH*.9));camera={x:W/2-r.width*k/2,y:-(top*k)-(availH*k-H)/2,width:r.width*k,height:r.height*k};updateCamera();}
function endWarp(){warping=null;cropping=false;setMode('navigate');renderWarp();warpLoupe(null);render();fit();}
$('warp-start').onclick=()=>{if(!project||busy||cropping||!requireFinished())return;warping={q:initialQuad(project.plan),drag:null,busy:false};cropping=true;$('toast').hidden=true;selected=null;selectedArea=null;setMode('navigate');$('stage').dataset.mode='warp';render();renderWarp();warpFit();renderWarp();
  };
$('warp-cancel').onclick=()=>{if(!warping?.busy)endWarp();};
input('warp-aspect').onchange=()=>renderWarp();
$('warp-confirm').onclick=async()=>{
  if(!project||!warping||warping.busy)return;const q=warping.q.map(p=>({...p})) as Quad,problem=quadProblem(q,project.plan);if(problem){toast(problem,true);return;}
  const outside=outsideCount(project,q);if(outside){toast(`${outside} Markierung(en) oder Fläche(n) liegen außerhalb der vier Ecken. Bitte die Ecken so setzen, dass alles darin liegt.`,true);return;}
  const target=project,size=targetSize(q,input('warp-aspect').value as Aspect);warping.busy=true;busy=true;renderWarp();
  try{const image=await warpImage(target.plan,q,size,t=>{$('mode-hint').textContent=t;});
    if(project!==target||!warping)return;
    const next=clone(project),lost=perspectiveProject(next,q,image);history.push(project);project=next;busy=false;endWarp();persist();
    toast(`Plan entzerrt (${size.width.toLocaleString('de-DE')} × ${size.height.toLocaleString('de-DE')} px).${lost.calibration?' Maßstab bitte neu messen (Liste → „Strecke messen“).':''}${lost.north?' Nordrichtung bitte neu setzen.':''} Rückgängig stellt das Foto wieder her.`,lost.calibration);}
  catch(e){fail(e);}finally{busy=false;if(warping){warping.busy=false;renderWarp();}render();}
};
svg.addEventListener('pointerdown',e=>{
  if(!warping||!project||e.button>0||warping.busy)return;const corner=(e.target as Element).closest('[data-corner]');
  e.preventDefault();e.stopPropagation();const pt=point(e);
  // Antippen: nächste Ecke springt an die Stelle (bequem auf dem Tablet); Ziehen an einer Ecke verschiebt sie
  const i=corner?Number(corner.getAttribute('data-corner')):warping.q.reduce((best,p,j)=>Math.hypot(p.x-pt.x,p.y-pt.y)<Math.hypot(warping!.q[best].x-pt.x,warping!.q[best].y-pt.y)?j:best,0);
  if(!corner)warping.q[i]={x:Math.min(project.plan.width,Math.max(0,pt.x)),y:Math.min(project.plan.height,Math.max(0,pt.y))};
  svg.setPointerCapture(e.pointerId);warping.drag={id:e.pointerId,i};renderWarp();warpLoupe(i);
},{capture:true});
svg.addEventListener('pointermove',e=>{
  if(!warping?.drag||warping.drag.id!==e.pointerId||!project)return;e.stopPropagation();const pt=point(e),i=warping.drag.i;
  warping.q[i]={x:Math.min(project.plan.width,Math.max(0,pt.x)),y:Math.min(project.plan.height,Math.max(0,pt.y))};renderWarp();warpLoupe(i);
},{capture:true});
const warpDrop=(e:PointerEvent)=>{if(warping?.drag?.id===e.pointerId){warping.drag=null;warpLoupe(null);renderWarp();}};
svg.addEventListener('pointerup',warpDrop,{capture:true});svg.addEventListener('pointercancel',warpDrop,{capture:true});
window.addEventListener('keydown',e=>{
  if(!warping||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Escape'){e.preventDefault();if(!warping.busy)endWarp();return;}
  const t=e.target;if(t instanceof Element&&t.closest('input,textarea,select'))return;
  if(e.key==='Enter'&&!(t instanceof HTMLButtonElement)){e.preventDefault();$('warp-confirm').click();}
});
/* ---------- Skizze (ab 1.21) ----------
   Kein Plan vorhanden: Räume als Rechtecke mit Maßen (Raster 10 cm, Einrasten an Wänden), freie auch schräge Wände,
   Türen und Fenster auf jeder Wand, freier Text. Ergebnis ist ein normaler SVG-Plan mit Maßstab; die Skizze bleibt am Plan. */
const SKETCH_TOOLS:[SketchTool,string][]=[['room','▭ Raum'],['wall','╱ Wand'],['door','◠ Tür'],['window','▭▭ Fenster'],['text','T Text'],['select','↖ Auswählen']];
$('stage').insertAdjacentHTML('beforeend',`<div id="sketch-actions" hidden><div class="align-row"><span class="sketch-tools" role="group" aria-label="Werkzeug">${SKETCH_TOOLS.map(([t,l])=>`<button data-sketch-tool="${t}" aria-pressed="${t==='room'}">${l}</button>`).join('')}</span><button id="sketch-done" class="primary">Skizze fertig ✓</button></div>
<div class="align-row" id="sketch-quick-row"><button id="sketch-list-open" title="Räume als Liste eintippen – PlanKit legt sie im Raster an, danach nur noch anordnen">☰ Räume aus Liste</button><label id="sketch-schematic-row" title="Ohne Maßstab und ohne m²; auf dem Plan steht „Skizze – nicht maßstäblich“"><input type="checkbox" id="sketch-schematic"> Skizze – nicht maßstäblich</label><label class="sketch-switch" title="Testfunktion: Räume aus Liste, „nicht maßstäblich“, Brandraum und Raum an der Probe. Aus = Skizze wie bisher."><input type="checkbox" id="sketch-quick"> Schnellskizze (Test)</label></div>
<div id="sketch-list-panel" hidden><label for="sketch-list">Räume – einer pro Zeile (Komma geht auch)</label><textarea id="sketch-list" rows="5" maxlength="4000" placeholder="Flur&#10;Küche Brandraum&#10;Wohnzimmer&#10;Bad"></textarea><p class="tiny">„Brandraum“ hinter dem Namen markiert den Raum. Danach Räume ziehen und anordnen – sie rasten aneinander ein.</p><div class="align-row"><button id="sketch-list-make" class="primary">Raster erzeugen</button><button id="sketch-list-cancel">Abbrechen</button></div></div>
<p id="sketch-hint" class="tiny"></p>
<div class="align-row" id="sketch-room-fields" hidden><label>Name<input id="sketch-name" maxlength="60"></label><label>Breite<input id="sketch-w" inputmode="decimal" size="5"> m</label><label>Tiefe<input id="sketch-h" inputmode="decimal" size="5"> m</label><label id="sketch-fire-row"><input type="checkbox" id="sketch-fire"> Brandraum</label><button id="sketch-room-delete" class="danger">Raum löschen</button></div>
<div class="align-row" id="sketch-wall-fields" hidden><label>Wandlänge<input id="sketch-wl" inputmode="decimal" size="5"> m</label><span class="tiny" id="sketch-wall-angle"></span><button id="sketch-wall-delete" class="danger">Wand löschen</button></div>
<div class="align-row" id="sketch-opening-fields" hidden><label><span id="sketch-ow-label">Breite</span><input id="sketch-ow" inputmode="decimal" size="5"> m</label><button id="sketch-door-flip">Aufschlag wechseln</button><button id="sketch-opening-delete" class="danger">Löschen</button></div>
<div class="align-row" id="sketch-text-fields" hidden><label>Text<input id="sketch-text" maxlength="80"></label><label>Größe<select id="sketch-text-size">${TEXT_SIZES.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><button id="sketch-text-delete" class="danger">Text löschen</button></div>
<div class="align-row" id="sketch-canvas-fields"><label>Zeichenfläche<input id="sketch-cw" inputmode="decimal" size="5"> ×<input id="sketch-ch" inputmode="decimal" size="5"> m</label><span class="tiny" id="sketch-count"></span></div></div>`);
const metersIn=(id:string)=>Number(input(id).value.replace(/\s/g,'').replace(',','.'))*100;
function fitBelow(panel:string){if(!project)return;const r=svg.getBoundingClientRect(),top=$(panel).offsetHeight+70,availH=Math.max(120,r.height-top-24),W=project.plan.width,H=project.plan.height;
  const k=Math.max(W/(r.width*.92),H/(availH*.92));camera={x:W/2-r.width*k/2,y:-(top*k)-(availH*k-H)/2,width:r.width*k,height:r.height*k};updateCamera();}
/** Vorschau der Arbeitskopie im Planbild (ohne Projektänderung). */
function previewSketch(){if(!sketching)return;image.setAttribute('href','data:image/svg+xml;charset=utf-8,'+encodeURIComponent(sketchSVG(sketching.s)));}
/** Arbeitskopie übernehmen: ein Rückgängig-Schritt, Plan neu aus der Skizze (Maßstab bleibt). */
function commitSketch(also?:(p:Project)=>void){if(!project||!sketching)return;const s=cloneSketch(sketching.s);mutate(p=>{p.plan=sketchPlan(s,p.plan);also?.(p);});sketching.s=cloneSketch(project.plan.sketch!);renderSketch();}
const pick=<T extends {id:string}>(list:T[],type:SketchKind)=>sketching?.sel?.type===type?list.find(x=>x.id===sketching!.sel!.id):undefined;
const selRoom=()=>pick(sketching?.s.rooms||[],'room'),selWall=()=>pick(sketching?.s.walls||[],'wall'),selOpening=()=>pick(sketching?.s.openings||[],'opening'),selText=()=>pick(sketching?.s.texts||[],'text');
const HINTS:Record<SketchTool,string>={room:'Raum aufziehen – Ecke zu Ecke. Räume rasten aneinander ein (Raster 10 cm).',wall:'Wand ziehen – von Punkt zu Punkt, auch schräg. Enden rasten an Ecken ein, Richtungen nahe 15°-Schritten werden genau ausgerichtet.',door:'Auf eine Wand tippen: Tür 0,90 m, Aufschlag zur angetippten Seite.',window:'Auf eine Wand tippen: Fenster 1,20 m.',text:'Antippen setzt einen Text, z. B. „Treppe“ oder „Garage“.',select:'Antippen wählt aus; Raum, Wand oder Text ziehen verschiebt (Raum: Ecke unten rechts = Größe). Leere Fläche ziehen: Ansicht bewegen. Entf löscht.'};
function renderSketch(){
  const on=!!sketching&&!!project;$('sketch-actions').hidden=!on;$('stage').classList.toggle('sketching',on);if(!on){sketchLayer.replaceChildren();return;}
  const sk=sketching!,s=sk.s,k=camera.width/Math.max(1,svg.clientWidth);
  let g='';for(let x=0;x<=s.width;x+=100)g+=`M${x} 0V${s.height}`;for(let y=0;y<=s.height;y+=100)g+=`M0 ${y}H${s.width}`;
  let out=`<path d="${g}" stroke="#9fb6cf" stroke-opacity=".45" stroke-width="${k}"/><rect width="${s.width}" height="${s.height}" fill="none" stroke="#3f74b5" stroke-width="${k*1.5}" stroke-dasharray="${k*8} ${k*5}"/>`;
  const label=(x:number,y:number,t:string,color:string,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial" font-weight="700" font-size="${k*13}" fill="${color}" stroke="#fff" stroke-width="${k*3}" paint-order="stroke">${t}</text>`;
  const dims=(r:SketchRoom,color:string)=>label(r.x+r.w/2,r.y-k*8,`${meters(r.w)} m`,color)+label(r.x+r.w+k*8,r.y+r.h/2,`${meters(r.h)} m`,color,'start');
  const wallDims=(w:SketchWall,color:string)=>label((w.x1+w.x2)/2,(w.y1+w.y2)/2-k*12,`${meters(wallLength(w))} m`,color);
  const room=selRoom(),wall=selWall(),op=selOpening(),text=selText();
  if(room)out+=`<rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="rgba(63,116,181,.08)" stroke="#3f74b5" stroke-width="${k*3}"/>${dims(room,'#2c5a93')}<rect x="${room.x+room.w-k*9}" y="${room.y+room.h-k*9}" width="${k*18}" height="${k*18}" fill="#fff" stroke="#3f74b5" stroke-width="${k*3}"/>`;
  if(wall)out+=`<line x1="${wall.x1}" y1="${wall.y1}" x2="${wall.x2}" y2="${wall.y2}" stroke="#3f74b5" stroke-opacity=".5" stroke-width="${Math.max(k*10,18)}" stroke-linecap="round"/>${wallDims(wall,'#2c5a93')}`;
  if(op)out+=`<g transform="translate(${op.x} ${op.y}) rotate(${op.a})"><rect x="${-op.w/2}" y="${-k*10}" width="${op.w}" height="${k*20}" fill="rgba(63,116,181,.18)" stroke="#3f74b5" stroke-width="${k*2.5}"/></g>`;
  if(text){const hw=Math.max(20,text.size*.3*text.text.length);out+=`<rect x="${text.x-hw}" y="${text.y-text.size*.7}" width="${hw*2}" height="${text.size*1.4}" fill="rgba(63,116,181,.1)" stroke="#3f74b5" stroke-width="${k*2}" stroke-dasharray="${k*5} ${k*3}"/>`;}
  if(sk.draft)out+=`<rect x="${sk.draft.x}" y="${sk.draft.y}" width="${sk.draft.w}" height="${sk.draft.h}" fill="rgba(232,145,45,.1)" stroke="#e8912d" stroke-width="${k*3}" stroke-dasharray="${k*9} ${k*5}"/>${dims(sk.draft,'#b8650f')}`;
  if(sk.draftWall){const w=sk.draftWall;out+=`<line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="#e8912d" stroke-width="12" stroke-linecap="square" stroke-opacity=".8"/>${wallDims(w,'#b8650f')}`;}
  sketchLayer.innerHTML=out;
  document.querySelectorAll<HTMLButtonElement>('[data-sketch-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sketchTool===sk.tool)));
  $('sketch-hint').textContent=HINTS[sk.tool];
  $('sketch-room-fields').hidden=!room;$('sketch-wall-fields').hidden=!wall;$('sketch-opening-fields').hidden=!op;$('sketch-text-fields').hidden=!text;$('sketch-canvas-fields').hidden=!!(room||wall||op||text);
  const set=(id:string,v:string)=>{if(document.activeElement!==input(id))input(id).value=v;};
  if(room){set('sketch-name',room.name);set('sketch-w',meters(room.w));set('sketch-h',meters(room.h));}
  if(wall){set('sketch-wl',meters(wallLength(wall)));const a=((Math.atan2(wall.y2-wall.y1,wall.x2-wall.x1)*180/Math.PI)%180+180)%180;$('sketch-wall-angle').textContent=`Richtung ${a.toLocaleString('de-DE',{maximumFractionDigits:1})}°`;}
  if(op){set('sketch-ow',meters(op.w));$('sketch-ow-label').textContent=op.kind==='door'?'Türbreite':'Fensterbreite';$('sketch-door-flip').hidden=op.kind!=='door';}
  if(text){set('sketch-text',text.text);$<HTMLSelectElement>('sketch-text-size').value=String(TEXT_SIZES.reduce((b,[v])=>Math.abs(v-text.size)<Math.abs(b-text.size)?v:b,30));}
  set('sketch-cw',meters(s.width));set('sketch-ch',meters(s.height));
  const doors=s.openings.filter(o=>o.kind==='door').length,windows=s.openings.length-doors;
  $('sketch-count').textContent=`${s.rooms.length} ${s.rooms.length===1?'Raum':'Räume'} · ${s.walls.length} ${s.walls.length===1?'Wand':'Wände'} · ${doors} Tür${doors===1?'':'en'} · ${windows} Fenster · ${s.texts.length} Text${s.texts.length===1?'':'e'}`;
  const quick=quickSketchOn();input('sketch-quick').checked=quick;$('sketch-list-open').hidden=!quick;$('sketch-schematic-row').hidden=!quick;$('sketch-fire-row').hidden=!quick;if(!quick)$('sketch-list-panel').hidden=true;
  input('sketch-schematic').checked=!!s.schematic;if(room)input('sketch-fire').checked=!!room.fire;
  $('mode-hint').textContent='Skizze';
}
function startSketch(){if(!project?.plan.sketch||busy||cropping||!requireFinished())return;sketching={s:extendSketch(project.plan.sketch),tool:project.plan.sketch.rooms.length||project.plan.sketch.walls.length?'select':'room',sel:null,drag:null,draft:null,draftWall:null};cropping=true;selected=null;selectedArea=null;$('toast').hidden=true;setMode('navigate');$('stage').dataset.mode='sketch';const sk0=project.plan.sketch,leer=!sk0.rooms.length&&!sk0.walls.length&&!sk0.texts.length;$('sketch-list-panel').hidden=!(leer&&quickSketchOn());render();renderSketch();fitBelow('sketch-actions');renderSketch();if(!$('sketch-list-panel').hidden)focusField('sketch-list');}
function endSketch(){if(!sketching)return;
  // Zeichenfläche auf den Inhalt zuschneiden (1 m Rand); Proben und Flächen wandern mit – ein Rückgängig-Schritt, nur wenn sich etwas ändert.
  const {sketch,dx,dy}=trimSketch(sketching.s);if(project?.plan.sketch&&(dx||dy||sketch.width!==project.plan.width||sketch.height!==project.plan.height))mutate(p=>{p.plan=sketchPlan(sketch,p.plan);for(const m of p.markers){m.x-=dx;m.y-=dy;m.lx-=dx;m.ly-=dy;}for(const a of p.areas||[])a.points=a.points.map(q=>({x:q.x-dx,y:q.y-dy}));});
  sketching=null;cropping=false;$('sketch-list-panel').hidden=true;setMode('navigate');renderSketch();render();fit();}
async function newSketch(asSheet:boolean){
  if(busy||cropping||!requireFinished())return;const empty=emptySketch();if(quickSketchOn())empty.schematic=true;const plan=sketchPlan(empty);plan.name='Skizze';
  if(asSheet&&project){if(sheetCount(project)>=MAX_SHEETS){toast(`Höchstens ${MAX_SHEETS} Pläne pro Projekt.`,true);return;}mutate(p=>addSheet(p,plan));}
  else{if(!await allowReplace())return;await install(createProject(plan));}
  startSketch();
}
$('welcome-sketch').onclick=()=>void newSketch(false);
$('sheet-sketch').onclick=()=>void newSketch(true);
$('sketch-edit').onclick=startSketch;
// „✎ Skizze“ in der Werkzeugleiste, immer erreichbar: ohne Plan eine neue Skizze, sonst eine Skizze als weiteren Plan
// (auf einer Skizze übernimmt „✎ Skizze“ aus „Plan vorbereiten“ das Bearbeiten).
$('sketch-tb').onclick=()=>{if(!project)void newSketch(false);else if(project.plan.sketch)startSketch();else void newSketch(true);};
$('sketch-done').onclick=()=>{const s=sketching?.s,n=s?s.rooms.length+s.walls.length:0;endSketch();toast(n?'Skizze fertig. Jetzt Proben setzen (P). „Skizze“ links bearbeitet sie weiter.':'Die Skizze ist noch leer. „Skizze“ links öffnet sie wieder.');};
document.querySelectorAll<HTMLButtonElement>('[data-sketch-tool]').forEach(b=>b.onclick=()=>{if(!sketching)return;sketching.tool=b.dataset.sketchTool as SketchTool;sketching.draft=null;sketching.draftWall=null;renderSketch();});
const sketchTry=(fn:()=>void,also?:(p:Project)=>void)=>{try{fn();previewSketch();commitSketch(also);}catch(e){if(sketching&&project?.plan.sketch)sketching.s=extendSketch(project.plan.sketch);previewSketch();renderSketch();toast(e instanceof Error?e.message:String(e),true);}};
const focusField=(id:string)=>setTimeout(()=>{input(id).focus();input(id).select();},0);
input('sketch-name').onchange=()=>{const r=selRoom(),v=input('sketch-name').value.replace(/\s+/g,' ').trim().slice(0,60);if(r&&v&&v!==r.name){const old=r.name;sketchTry(()=>{r.name=v;},quickSketchOn()?p=>{for(const m of p.markers)if(m.raum===old)m.raum=v;}:undefined);}else renderSketch();};   // Schnellskizze: Proben mit dem alten Raumnamen ziehen mit
const roomSize=()=>{const r=selRoom();if(r)sketchTry(()=>resizeRoom(sketching!.s,r.id,metersIn('sketch-w'),metersIn('sketch-h')));};
input('sketch-w').onchange=roomSize;input('sketch-h').onchange=roomSize;
input('sketch-wl').onchange=()=>{const w=selWall();if(w)sketchTry(()=>setWallLength(sketching!.s,w.id,metersIn('sketch-wl')));};
input('sketch-ow').onchange=()=>{const o=selOpening();if(o)sketchTry(()=>setOpeningWidth(sketching!.s,o.id,metersIn('sketch-ow')));};
$('sketch-door-flip').onclick=()=>{const o=selOpening();if(o)sketchTry(()=>{o.side=o.side===1?-1:1;});};
input('sketch-text').onchange=()=>{const t=selText(),v=input('sketch-text').value.replace(/\s+/g,' ').trim().slice(0,80);if(t&&v&&v!==t.text)sketchTry(()=>{t.text=v;});else renderSketch();};
$<HTMLSelectElement>('sketch-text-size').onchange=()=>{const t=selText();if(t)sketchTry(()=>{t.size=Number($<HTMLSelectElement>('sketch-text-size').value);});};
const removeSel=()=>{const sk=sketching;if(!sk?.sel)return;const {type,id}=sk.sel;sk.sel=null;sketchTry(()=>{
  if(type==='room')removeRoom(sk.s,id);else if(type==='wall')removeWall(sk.s,id);else if(type==='opening')sk.s.openings=sk.s.openings.filter(o=>o.id!==id);else sk.s.texts=sk.s.texts.filter(t=>t.id!==id);});};
for(const id of ['sketch-room-delete','sketch-wall-delete','sketch-opening-delete','sketch-text-delete'])$(id).onclick=removeSel;
const canvasSize=()=>{if(sketching)sketchTry(()=>resizeCanvas(sketching!.s,metersIn('sketch-cw'),metersIn('sketch-ch')));};
input('sketch-cw').onchange=canvasSize;input('sketch-ch').onchange=canvasSize;
// Schnellskizze (ab 1.41): Räume aus Liste, nicht maßstäblich, Brandraum – abschaltbar, Einstellung je Browser
input('sketch-quick').onchange=()=>{setQuickSketch(input('sketch-quick').checked);renderSketch();};
input('sketch-schematic').onchange=()=>{const on=input('sketch-schematic').checked;if(sketching)sketchTry(()=>{if(on)sketching!.s.schematic=true;else delete sketching!.s.schematic;});};
input('sketch-fire').onchange=()=>{const r=selRoom(),on=input('sketch-fire').checked;if(r)sketchTry(()=>{if(on)r.fire=true;else delete r.fire;});};
$('sketch-list-open').onclick=()=>{const panel=$('sketch-list-panel');panel.hidden=!panel.hidden;renderSketch();if(!panel.hidden)focusField('sketch-list');};
$('sketch-list-cancel').onclick=()=>{$('sketch-list-panel').hidden=true;renderSketch();};
$('sketch-list-make').onclick=()=>{const sk=sketching;if(!sk)return;const list=parseRoomList($<HTMLTextAreaElement>('sketch-list').value);let made=0;
  sketchTry(()=>{made=roomsFromList(sk.s,list).length;sk.sel=null;sk.tool='select';sk.draft=null;sk.draftWall=null;});
  if(!made)return;$<HTMLTextAreaElement>('sketch-list').value='';$('sketch-list-panel').hidden=true;renderSketch();fitBelow('sketch-actions');renderSketch();
  toast(`${made} ${made===1?'Raum':'Räume'} angelegt. Jetzt ziehen und anordnen – Räume rasten aneinander ein.`);};
svg.addEventListener('pointerdown',e=>{
  if(!sketching||!project||e.button>0)return;e.preventDefault();e.stopPropagation();const sk=sketching,pt=point(e),k=camera.width/Math.max(1,svg.clientWidth);
  const base={id:e.pointerId,start:pt,screen:{x:e.clientX,y:e.clientY},moved:false};
  if(sk.tool==='room'||sk.tool==='wall'){sk.drag={...base,kind:'draw'};}
  else if(sk.tool==='door'||sk.tool==='window'){const o=openingAt(sk.s,pt,sk.tool,Math.max(40,k*18));if(!o){toast('Bitte auf eine Wand tippen.',true);return;}sketchTry(()=>{addOpening(sk.s,o);sk.sel={type:'opening',id:o.id};});return;}
  else if(sk.tool==='text'){if(pt.x<0||pt.y<0||pt.x>sk.s.width||pt.y>sk.s.height)return;let t:SketchText|null=null;sketchTry(()=>{t=addText(sk.s,pt);sk.sel={type:'text',id:t.id};sk.tool='select';});if(t)focusField('sketch-text');return;}
  else{const r=selRoom();
    if(r&&Math.abs(pt.x-(r.x+r.w))<k*14&&Math.abs(pt.y-(r.y+r.h))<k*14)sk.drag={...base,kind:'resize',room:{...r}};
    else{const h=hit(sk.s,pt,Math.max(15,k*10));sk.sel=h;
      if(h?.type==='room')sk.drag={...base,kind:'move',room:{...sk.s.rooms.find(x=>x.id===h.id)!}};
      else if(h?.type==='wall')sk.drag={...base,kind:'move',wall:{...sk.s.walls.find(x=>x.id===h.id)!}};
      else if(h?.type==='text')sk.drag={...base,kind:'move',text:{...sk.s.texts.find(x=>x.id===h.id)!}};
      else if(!h)sk.drag={...base,kind:'pan',cam:{...camera}};}
    renderSketch();}
  svg.setPointerCapture(e.pointerId);
},{capture:true});
svg.addEventListener('pointermove',e=>{
  const sk=sketching;if(!sk?.drag||sk.drag.id!==e.pointerId||!project)return;e.stopPropagation();const d=sk.drag;
  if(Math.hypot(e.clientX-d.screen.x,e.clientY-d.screen.y)>4)d.moved=true;if(!d.moved)return;
  if(d.kind==='pan'){const rect=svg.getBoundingClientRect();camera={...d.cam!,x:d.cam!.x-(e.clientX-d.screen.x)/rect.width*d.cam!.width,y:d.cam!.y-(e.clientY-d.screen.y)/rect.height*d.cam!.height};updateCamera();return;}
  const pt=point(e),dx=pt.x-d.start.x,dy=pt.y-d.start.y;
  if(d.kind==='draw'){if(sk.tool==='wall')sk.draftWall=wallFrom(sk.s,d.start,pt);else sk.draft=roomFrom(sk.s,d.start,pt);renderSketch();return;}
  if(d.kind==='move'){if(d.room)moveRoom(sk.s,d.room.id,dx,dy,d.room,quickSketchOn());else if(d.wall)moveWall(sk.s,d.wall.id,dx,dy,d.wall);else if(d.text)moveText(sk.s,d.text.id,dx,dy,d.text);}
  if(d.kind==='resize'&&d.room){try{resizeRoom(sk.s,d.room.id,d.room.w+dx,d.room.h+dy);}catch{/* weiterziehen */}}
  previewSketch();renderSketch();
},{capture:true});
const sketchDrop=(e:PointerEvent)=>{
  const sk=sketching;if(!sk?.drag||sk.drag.id!==e.pointerId)return;const d=sk.drag;sk.drag=null;
  if(d.kind==='draw'){
    if(sk.tool==='wall'){const w=sk.draftWall;sk.draftWall=null;if(w&&d.moved){sketchTry(()=>{addWall(sk.s,w);sk.sel={type:'wall',id:w.id};});}else renderSketch();return;}
    const r=sk.draft;sk.draft=null;if(r&&d.moved){sketchTry(()=>{addRoom(sk.s,r);sk.sel={type:'room',id:r.id};sk.tool='select';});focusField('sketch-name');}else renderSketch();return;}
  if((d.kind==='move'||d.kind==='resize')&&d.moved)sketchTry(()=>{});else renderSketch();
};
svg.addEventListener('pointerup',sketchDrop,{capture:true});svg.addEventListener('pointercancel',e=>{if(sketching?.drag?.id===e.pointerId){sketching.drag=null;sketching.draft=null;sketching.draftWall=null;if(project?.plan.sketch)sketching.s=extendSketch(project.plan.sketch);previewSketch();renderSketch();}},{capture:true});
window.addEventListener('keydown',e=>{
  if(!sketching||e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t instanceof Element&&t.closest('input,textarea,select'))return;
  if(e.key==='Escape'){e.preventDefault();if(sketching.draft||sketching.draftWall||sketching.sel){sketching.draft=null;sketching.draftWall=null;sketching.sel=null;renderSketch();}else $('sketch-done').click();}
  else if((e.key==='Delete'||e.key==='Backspace')&&sketching.sel){e.preventDefault();removeSel();}
});
function render(){
  const p=project;labUI?.render(p);resultkitHinweisZeigen(); $('welcome').hidden=!!p;$('mode-hint').hidden=!p;if(!p){renderSheets();renderResults();updateSizeUI();updateLabelUI();updateTrialUI();updateRaumbuchUI();updateScaleUI();}
  ['save-project','export','export-open','next','report','date'].forEach(id=>($<HTMLButtonElement>(id).disabled=!p));
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.disabled=!p&&b.dataset.mode!=='navigate');
  $<HTMLButtonElement>('undo').disabled=!history.past.length;$<HTMLButtonElement>('redo').disabled=!history.future.length;
  $('preparation').hidden=!p;
  ['rotate-left','rotate-right','crop-start','align-start','warp-start'].forEach(id=>$<HTMLButtonElement>(id).disabled=busy||cropping||!p||!!p.plan.sketch);   // Skizzen werden über „Skizze“ bearbeitet
  $('sketch-edit').hidden=!p?.plan.sketch;$<HTMLButtonElement>('sketch-edit').disabled=busy||cropping;
  {const b=$<HTMLButtonElement>('sketch-tb');b.hidden=!!p?.plan.sketch;b.disabled=busy||cropping;b.title=!p?'Kein Plan vorhanden? Skizze zeichnen: Räume mit Maßen, Türen und Fenster':'Skizze als weiteren Plan zeichnen (z. B. ein Geschoss ohne Grundriss)';}
  ['load','open-project','save-project'].forEach(id=>$<HTMLButtonElement>(id).disabled=busy||(cropping&&!(id==='save-project'&&sketching&&!sketching.drag))||(id==='save-project'&&!p));   // Skizze: jeder Schritt ist schon übernommen, Speichern bleibt möglich
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.disabled=cropping||(!p&&b.dataset.mode!=='navigate'));
  $<HTMLButtonElement>('undo').disabled=!undoable()||!!draftPoints.length||!history.past.length;$<HTMLButtonElement>('redo').disabled=!undoable()||!!draftPoints.length||!history.future.length;
  $<HTMLButtonElement>('export').disabled=$<HTMLButtonElement>('export-open').disabled=busy||cropping||!p;
  if(!p)return;
  ['rotate-left','rotate-right','crop-start','align-start','warp-start','save-project','export','export-open','open-project','load'].forEach(id=>{if(draftPoints.length)$<HTMLButtonElement>(id).disabled=true;});
  $('area-list').innerHTML=(p.areas||[]).map(a=>`<button class="area-row ${a.id===selectedArea?'selected':''}" data-area-select="${a.id}"><span style="background:${a.color}">${escape(a.label)}</span><span>${escape(a.name)}</span></button>`).join('')||'<p class="tiny">Noch keine Flächen gesetzt.</p>';
  const a=selectedPolygon();$('area-inspector').hidden=!a;if(a){input('area-label').value=a.label;input('area-name').value=a.name;input('area-color').value=a.color;input('area-opacity').value=String(Math.round(a.opacity*100));$('area-opacity-value').textContent=`${Math.round(a.opacity*100)} %`;}
  const source=preparation(p.plan);image.setAttribute('href',p.plan.data);image.setAttribute('width',String(source.sourceWidth));image.setAttribute('height',String(source.sourceHeight));image.setAttribute('transform',`matrix(${planMatrix(p.plan).join(' ')})`);clipRect.setAttribute('width',String(p.plan.width));clipRect.setAttribute('height',String(p.plan.height));planBack.setAttribute('width',String(p.plan.width));planBack.setAttribute('height',String(p.plan.height));planBack.style.display=fineAngle(source)||aligning?'':'none';
  $('file-type').textContent=p.plan.vector?'SVG · VEKTOR':'RASTERBILD';$('plan-name').textContent=p.plan.name;$('canvas-name').textContent=p.plan.name.replace(/\.[^.]+$/,'');$('source-info').textContent=`${Math.round(p.plan.width)} × ${Math.round(p.plan.height)} · ${p.plan.vector?'Vektorgrundlage':'Rastergrundlage'}`;
  if(p.plan.pdf){$('file-type').textContent=`PDF · SEITE ${p.plan.pdf.page}`;$('source-info').textContent=`${Math.round(p.plan.width)} × ${Math.round(p.plan.height)} · PDF-Seite ${p.plan.pdf.page}/${p.plan.pdf.totalPages}`;}
  input('next').value=String(p.nextSample);input('report').value=p.report;input('date').value=p.date;
  $('count').textContent=String(p.markers.length);
  $('marker-list').innerHTML=DOMPurify.sanitize(p.markers.length?p.markers.map(m=>`<div class="marker-item"><button class="marker-row ${m.id===selected?'selected':''}" data-select="${m.id}"><span class="marker-badge ${m.kind} ${m.kind==='sample'?shapeOf(m):''}">${escape(m.label)}</span><span>${m.kind==='sample'?(typeOf(m)?`Probenahmestelle · ${escape(typeOf(m))}`:'Probenahmestelle'):'Brandherd'}${showResults&&p.results&&valueOf(m,p.results.parameter)?`<small>${escape(shortParameter(p.results.parameter))}: ${escape(valueOf(m,p.results.parameter)!.r)} ${escape(valueOf(m,p.results.parameter)!.u)}</small>`:m.note?`<small>${escape(m.note)}</small>`:''}</span><span class="row-arrow">›</span></button><button class="row-del" data-del="${m.id}" title="${escape(m.label)} löschen (Punkt wird aus dem Plan entfernt)" aria-label="${escape(m.label)} löschen">✕</button></div>`).join(''):'<p class="muted empty-list">Noch keine Markierungen gesetzt.</p>');
  const m=selectedMarker();$('inspector').hidden=!m;if(m){input('label').value=m.label;input('note').value=m.note;$('shape-row').hidden=m.kind!=='sample';$<HTMLSelectElement>('shape').value=shapeOf(m);$('surface-row').hidden=m.kind!=='sample';$<HTMLSelectElement>('surface').value=m.surface||'';$('raum-row').hidden=false;if(document.activeElement!==input('raum'))input('raum').value=m.raum||'';}let labFields=document.getElementById('marker-lab');if(!labFields){labFields=document.createElement('p');labFields.id='marker-lab';labFields.className='lab-fields';$('inspector').append(labFields);}labFields.textContent=m?.lab?['Referenz: '+m.lab.ref,'Probenart: '+(m.lab.art||'—'),'Labor-Nr.: '+(m.lab.labNr||'—'),'Probenahme: '+(m.lab.datum||'—'),'Bericht: '+(m.lab.bericht||'—')].join(' · '):'';
  renderMarkers();dimensions();renderSheets();renderResults();updateSizeUI();updateLabelUI();updateTrialUI();updateRaumbuchUI();updateScaleUI();
}
async function install(p:Project,fromFolder=false,transition?:()=>void){await preserveUnsavedProject();transition?.();if(folder&&!fromFolder){folderDirty=true;if(!p.report)p.report=folder.name;}labUI?.reset();project=p;selected=null;selectedArea=null;draftPoints=[];history.clear();cropping=false;cropRect=null;aligning=null;renderAlign();setMode('navigate');render();fit();persist(!fromFolder);$('export-result').hidden=true;}
function saveProject(){if(project&&requireFinished()&&folder){void saveToFolder(true);return;}if(project&&requireFinished())void download(new Blob([JSON.stringify(project)],{type:'application/json'}),`${project.report||'Probenplan'}.probenplan`);}
/** Vor dem Ersetzen des Plans im Projektordner: dauerhafte Kopie der bisherigen Fassung („(Kopie vor dem Ersetzen …)“) –
 *  die automatische Bereinigung entfernt nur „(vorher …)“- und „(Speicherkandidat …)“-Kopien, diese nie. */
const ERSETZEN_KOPIE='Kopie vor dem Ersetzen';
async function allowReplace(){if(!project)return true;const ok=await confirmReplace();if(!ok||!folder||!project)return ok;
 try{await writeProjectCopy(folder,ERSETZEN_KOPIE,JSON.stringify(clone(project)));return true;}
 catch(e){toast(`Der Plan wurde nicht ersetzt: Die Kopie der bisherigen Fassung konnte nicht angelegt werden (${e instanceof Error?e.message:'unbekannter Fehler'}).`,true);return false;}}
function confirmReplace(){return new Promise<boolean>(resolve=>{const d=$<HTMLDialogElement>('replace-dialog');const text=d.querySelector('p')!;text.dataset.plain??=text.textContent||'';text.textContent=folder?`Der neue Plan ersetzt den Probenplan dieses Projekts. Die bisherige Fassung bleibt in „${PLAENE}“ als „(${ERSETZEN_KOPIE} …)“ erhalten und wird nie automatisch gelöscht.`:text.dataset.plain;$('replace-save').hidden=!!folder;const finish=(ok:boolean)=>{d.close();resolve(ok);};$('replace-cancel').onclick=()=>finish(false);$('replace-yes').onclick=()=>finish(true);$('replace-save').onclick=()=>{saveProject();finish(true);};d.oncancel=()=>resolve(false);d.showModal();});}
async function choose(items:Candidate[]):Promise<Candidate|null>{if(items.length===1)return items[0];return new Promise(resolve=>{const d=$<HTMLDialogElement>('choose-dialog');$('choices').replaceChildren();items.forEach((item,i)=>{const b=document.createElement('button');b.className='choice';b.textContent=`${/\.svg$/i.test(item.name)?'◇ SVG · empfohlen':'▧ Bild'} — ${item.name}`;b.onclick=()=>{d.close();resolve(item);};$('choices').append(b);if(i===0)b.autofocus=true;});d.onclose=()=>resolve(null);d.showModal();});}
async function choosePDF(pdf:LocalPDF):Promise<number|'all'|null>{
  if(pdf.pages===1)return 1;
  return new Promise(resolve=>{
    const d=$<HTMLDialogElement>('pdf-dialog');let number=0,closed=false,revision=0,queue:Promise<void>=Promise.resolve();
    $('pdf-name').textContent=pdf.name;$('pdf-count').textContent=`von ${pdf.pages}`;input('pdf-page').max=String(pdf.pages);
    const show=(n:number)=>{n=Math.max(1,Math.min(pdf.pages,n));input('pdf-page').value=String(n);if(n===number)return;number=n;$<HTMLButtonElement>('pdf-prev').disabled=number===1;$<HTMLButtonElement>('pdf-next').disabled=number===pdf.pages;$<HTMLButtonElement>('pdf-use').disabled=true;$('pdf-status').hidden=false;$('pdf-status').textContent='Vorschau wird geladen …';const current=++revision,page=number;
      queue=queue.catch(()=>{}).then(async()=>{if(closed||current!==revision)return;try{const data=await pdf.preview(page);if(closed||current!==revision)return;$<HTMLImageElement>('pdf-preview').src=data;$('pdf-status').hidden=true;$<HTMLButtonElement>('pdf-use').disabled=false;}catch(e){if(current===revision)$('pdf-status').textContent=e instanceof Error?e.message:'Vorschau konnte nicht geladen werden.';}});
    };
    const finish=(value:number|'all'|null)=>{if(closed)return;closed=true;d.close();void queue.finally(()=>{ $<HTMLImageElement>('pdf-preview').removeAttribute('src');resolve(value);});};
    $('pdf-prev').onclick=()=>show(number-1);$('pdf-next').onclick=()=>show(number+1);input('pdf-page').onchange=()=>{const n=Number(input('pdf-page').value);show(Number.isInteger(n)?n:number);};$('pdf-use').onclick=()=>finish(number);$('pdf-all').hidden=pdf.pages>MAX_PDF_PAGES;$('pdf-all').textContent=`Alle ${pdf.pages} Seiten als einzelne Pläne`;$('pdf-all').onclick=()=>finish('all');$('pdf-cancel').onclick=()=>finish(null);d.querySelector<HTMLButtonElement>('.close')!.onclick=e=>{e.preventDefault();finish(null);};d.oncancel=e=>{e.preventDefault();finish(null);};d.showModal();show(1);
  });
}
const MAX_PDF_PAGES=20;
async function importFile(file:File,isProject=false,asSheet=false){if(busy||cropping||!requireFinished())return;if(asSheet&&project&&sheetCount(project)>=MAX_SHEETS){toast(`Höchstens ${MAX_SHEETS} Pläne pro Projekt.`,true);return;}busy=true;$('import-status').hidden=false;$('import-status').textContent=/\.pdf$/i.test(file.name)?'PDF wird lokal verarbeitet …':'Plan wird geladen …';render();let pdf:LocalPDF|null=null;
  try{if(file.size>85*1024*1024)throw Error('Die Datei ist zu groß. Bitte eine kleinere Datei verwenden.');let plans:{plan:Plan;name?:string}[]=[];let next:Project|null=null;
    if(isProject){try{next=await validateProject(JSON.parse(await file.text()));}catch(e){if(e instanceof SyntaxError)throw Error('Die Projektdatei enthält keine gültigen Projektdaten.');throw e;}}
    else if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){if(file.size>60*1024*1024)throw Error('Die PDF ist zu groß (maximal 60 MB). Bitte nur die benötigten Seiten als eigene PDF speichern.');const {openPDF}=await import('./pdf');pdf=await openPDF(file.name,new Uint8Array(await file.arrayBuffer()));const page=await choosePDF(pdf);if(page===null)return;
      const pages=page==='all'?Array.from({length:pdf.pages},(_,i)=>i+1):[page];
      if(asSheet&&project&&sheetCount(project)+pages.length>MAX_SHEETS)throw Error(`Höchstens ${MAX_SHEETS} Pläne pro Projekt.`);
      for(const n of pages){$('import-status').textContent=pages.length>1?`Seite ${n} von ${pages.length} wird in hoher Auflösung gerendert …`:`Seite ${n} wird in hoher Auflösung gerendert …`;plans.push({plan:await pdf.plan(n),...(pages.length>1?{name:`Seite ${n}`}:{})});}}
    else{const c=await choose(await candidates(file));if(!c)return;plans=[{plan:await readPlan(c.name,c.bytes)}];}
    if(asSheet&&project){mutate(p=>{for(const item of plans)addSheet(p,item.plan,item.name);});selected=null;selectedArea=null;labUI?.render(project);render();fit();
      toast(plans.length>1?`${plans.length} Pläne hinzugefügt. Doppelklick auf einen Plan unten benennt ihn um.`:`Plan „${floorName(project)}“ hinzugefügt. Doppelklick unten benennt ihn um.`);return;}
    if(!next){next=createProject(plans[0].plan);if(plans.length>1){for(const item of plans.slice(1))addSheet(next,item.plan,item.name);renameSheet(next,0,plans[0].name||'Seite 1');switchSheet(next,0);}}
    if(!await allowReplace())return;await install(next);toast(sheetCount(next)>1&&!isProject?`${sheetCount(next)} Pläne angelegt. Unten zwischen den Plänen wechseln.`:next.plan.pdf?`PDF-Seite ${next.plan.pdf.page} geladen (${next.plan.width} × ${next.plan.height} px). Bei Bedarf drehen oder zuschneiden.`:'Plan geladen. Bei Bedarf drehen oder zuschneiden.');
  }catch(e){fail(e);}finally{if(pdf)await pdf.close().catch(()=>{});busy=false;$('import-status').hidden=true;render();}}
$('load').onclick=$('welcome-load').onclick=()=>input('file').click();
input('file').onchange=()=>{const f=input('file').files?.[0];if(f)void importFile(f);input('file').value='';};
$('open-project').onclick=()=>input('project-file').click();input('project-file').onchange=()=>{const f=input('project-file').files?.[0];if(f)void importFile(f,true);input('project-file').value='';};
$('save-project').onclick=saveProject;
document.querySelectorAll<HTMLElement>('[data-mode]').forEach(b=>b.onclick=()=>{if(b.dataset.mode!.startsWith('area-'))selected=null;else selectedArea=null;setMode(b.dataset.mode!);render();});
$('area-list').onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-area-select]');if(b){selectedArea=b.dataset.areaSelect!;selected=null;setMode('area-edit');render();}};
$('area-last').onclick=()=>{draftPoints.pop();render();};
$('area-cancel').onclick=()=>{draftPoints=[];setMode('navigate');render();};
input('draft-color').onchange=renderAreas;
input('draft-opacity').oninput=()=>{$('draft-opacity-value').textContent=`${input('draft-opacity').value} %`;renderAreas();};
$('area-finish').onclick=()=>{if(!project)return;const error=polygonError(draftPoints,project.plan);if(error){toast(error,true);return;}input('new-area-name').value=palette(input('draft-color').value).suggestion;$<HTMLDialogElement>('area-dialog').showModal();};
$('area-dialog-cancel').onclick=()=>$<HTMLDialogElement>('area-dialog').close();
$('area-dialog-save').onclick=()=>{if(!project)return;try{const next=clone(project),a=addArea(next,draftPoints,input('draft-color').value,Number(input('draft-opacity').value)/100,input('new-area-name').value);history.push(project);project=next;draftPoints=[];selected=null;selectedArea=a.id;$<HTMLDialogElement>('area-dialog').close();setMode('area-edit');changed();}catch(e){fail(e);}};
input('area-label').onchange=()=>{const a=selectedPolygon(),value=input('area-label').value.trim();if(!a||!project)return;if(!validLabel(project,value,a.id)){toast('Kennung ungültig oder bereits vergeben.',true);render();return;}mutate(()=>a.label=value);};
input('area-name').onchange=()=>{const a=selectedPolygon(),name=cleanName(input('area-name').value);if(!a)return;if(!name){toast('Bitte eine Bezeichnung eingeben.',true);render();return;}mutate(()=>a.name=name);};
input('area-color').onchange=()=>{const a=selectedPolygon();if(a)mutate(()=>a.color=input('area-color').value);};
input('area-opacity').oninput=()=>{$('area-opacity-value').textContent=`${input('area-opacity').value} %`;};
input('area-opacity').onchange=()=>{const a=selectedPolygon();if(a)mutate(()=>a.opacity=Number(input('area-opacity').value)/100);};
$('area-delete').onclick=()=>{if(selectedArea)mutate(p=>{p.areas=p.areas?.filter(a=>a.id!==selectedArea);selectedArea=null;});};
$('marker-list').onclick=e=>{const del=(e.target as HTMLElement).closest<HTMLElement>('[data-del]');if(del){const id=del.dataset.del!,m=project?.markers.find(x=>x.id===id);if(m&&!busy&&!cropping)mutate(p=>{p.markers=p.markers.filter(x=>x.id!==id);if(selected===id)selected=null;});if(m)toast(`${m.label} gelöscht – rückgängig mit Strg+Z.`);return;}const b=(e.target as HTMLElement).closest<HTMLElement>('[data-select]');if(b){selectedArea=null;selected=b.dataset.select!;setMode('edit');render();}};
input('next').onchange=()=>{const n=Number(input('next').value);if(!Number.isSafeInteger(n)||n<1||n>=1e9){toast('Bitte eine ganze Startnummer zwischen 1 und 999999999 eingeben.',true);render();return;}mutate(p=>p.nextSample=n);};
input('label').onchange=()=>{const m=selectedMarker();if(!m||!project)return;const label=input('label').value.trim();if(!validLabel(project,label,m.id)){toast('Kennung bereits vergeben oder ungültig. Bitte 1–16 Zeichen (Buchstaben, Zahlen, Leerzeichen, Punkt, _ oder -) verwenden.',true);render();return;}mutate(()=>m.label=label);};
input('note').onchange=()=>{const m=selectedMarker();if(m)mutate(()=>m.note=input('note').value);};
/** Räume des Projekts als Vorschlag (gleiche Schreibweise = gleicher Raum im Raumbuch). */
function raumVorschlaege(){if(!project)return;const seen=new Set<string>(),out:string[]=[];for(const r of [...allMarkers(project),...(project.pending||[])]){const v=(r.raum||'').trim();if(v&&!seen.has(v)){seen.add(v);out.push(v);}}
  $('raum-list').replaceChildren(...out.sort((a,b)=>a.localeCompare(b,'de',{numeric:true})).map(v=>{const o=document.createElement('option');o.value=v;return o;}));}
input('raum').addEventListener('focus',raumVorschlaege);
input('raum').onchange=()=>{const m=selectedMarker(),v=input('raum').value.trim().slice(0,MAX_RAUM);if(m&&(m.raum||'')!==v)mutate(()=>{if(v)m.raum=v;else delete m.raum;});};
$<HTMLSelectElement>('surface').onchange=()=>{const m=selectedMarker(),v=$<HTMLSelectElement>('surface').value as Surface|'';if(m&&m.kind==='sample')mutate(()=>{if(v&&SURFACES.includes(v))m.surface=v;else delete m.surface;});};
$<HTMLSelectElement>('shape').onchange=()=>{const m=selectedMarker(),v=$<HTMLSelectElement>('shape').value as Shape;if(m&&m.kind==='sample'&&SHAPES.includes(v))mutate(()=>{if(v==='circle'&&!typeFromArt(m.lab?.art))delete m.shape;else m.shape=v;});};
for(const id of ['report','date'] as const)input(id).onchange=()=>mutate(p=>p[id]=input(id).value);
$('delete').onclick=()=>{if(selected)mutate(p=>{p.markers=p.markers.filter(m=>m.id!==selected);selected=null;});};
$('offset').onclick=()=>{const m=selectedMarker();if(m)mutate(p=>{m.lx=m.x+markerSize(p)*3;m.ly=m.y-markerSize(p)*3;});};
$('recenter').onclick=()=>{const m=selectedMarker();if(m)mutate(()=>{m.lx=m.x;m.ly=m.y;});};
function restored(old:Project['plan'],floor:number|undefined){if(!project)return;changed();if(old.data!==project.plan.data||old.width!==project.plan.width||old.height!==project.plan.height||floor!==project.active)fit();}
function undoable(){return !cropping||(!!sketching&&!sketching.drag);}
/** Rückgängig während der Skizze: Arbeitskopie neu aus dem Projekt; ohne Skizze (z. B. Plan entfernt) endet der Skizzenmodus. */
function resyncSketch(){if(!sketching)return;if(project?.plan.sketch){sketching.s=extendSketch(project.plan.sketch);sketching.sel=null;sketching.draft=null;sketching.draftWall=null;renderSketch();}else endSketch();}
function undo(){if(project&&undoable()&&requireFinished()){const old=project.plan,floor=project.active;project=history.undo(project);restored(old,floor);resyncSketch();}}function redo(){if(project&&undoable()&&requireFinished()){const old=project.plan,floor=project.active;project=history.redo(project);restored(old,floor);resyncSketch();}}
$('undo').onclick=undo;$('redo').onclick=redo;
window.addEventListener('keydown',e=>{
  const editing=(target:EventTarget|null)=>target instanceof Element&&(!!target.closest('input,textarea,select,dialog,[role="dialog"],[role="textbox"]')||(target instanceof HTMLElement&&target.isContentEditable));
  if(e.defaultPrevented||e.isComposing||editing(e.target)||editing(document.activeElement)||document.querySelector('dialog:modal,[role="dialog"][aria-modal="true"]'))return;
  if(e.key==='Escape'&&mode==='measure'){e.preventDefault();setMode('navigate');toast('Messen abgebrochen.');return;}
  if(e.key==='Escape'&&(selected||selectedArea)){e.preventDefault();selected=null;selectedArea=null;render();return;}
  if((e.key==='<'||e.key==='>')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&project&&!cropping){e.preventDefault();setMarkerScale(stepMarkerScale(markerScale(project),e.key==='>'?1:-1));toast(`Punktgröße ${Math.round(markerScale(project)*100)} %`);return;}
  if((e.key==='Delete'||e.key==='Backspace')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    // Backspace must not navigate away from the plan, even without a selection.
    e.preventDefault();
    if(busy||cropping)return;
    const button=selectedMarker()?$('delete'):selectedPolygon()?$('area-delete'):null;
    if(button)button.click();
    return;
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
});
$('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);$('fit').onclick=fit;
svg.addEventListener('wheel',e=>{if(!project)return;e.preventDefault();if(cropDrag)return;zoom(Math.exp(e.deltaY*.0015),point(e));},{passive:false});
const pointers=new Map<number,{clientX:number;clientY:number}>();
type Drag={id:number;start:{x:number;y:number};screen:{x:number;y:number};camera:typeof camera;marker?:Marker;part?:string;original?:Marker;before?:Project;area?:Area;areaOriginal?:Area;vertex?:number;pan:boolean;threshold:number;moved:boolean};
let drag:Drag|null=null,pinch:{distance:number;camera:typeof camera;anchor:{x:number;y:number}}|null=null;
svg.addEventListener('pointerdown',e=>{if(!project||cropping||e.button>0)return;svg.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});if(pointers.size===2){if(drag?.before&&drag.original&&drag.marker)Object.assign(drag.marker,drag.original);if(drag?.area&&drag.areaOriginal)Object.assign(drag.area,drag.areaOriginal);drag=null;const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),camera:{...camera},anchor:point({clientX:(a.clientX+b.clientX)/2,clientY:(a.clientY+b.clientY)/2})};renderMarkers();return;}
  const target=e.target as Element,m=project.markers.find(m=>m.id===target.closest('[data-id]')?.getAttribute('data-id'));
  if(m&&['sample','fire','edit'].includes(mode)){selected=m.id;render();reveal('inspector');}
  const placing=mode==='sample'||mode==='fire'||mode==='lab-place'||mode==='measure';
  // Only free-space gestures in placement tools pan; editor gestures stay unchanged.
  drag={id:e.pointerId,start:point(e),screen:{x:e.clientX,y:e.clientY},camera:{...camera},pan:mode==='navigate'||(placing&&!m),threshold:placing&&!m?(e.pointerType==='touch'?8:6):4,moved:false};
  if(mode==='area-edit'){const a=project.areas?.find(a=>a.id===target.closest('[data-area]')?.getAttribute('data-area'));if(a){selected=null;selectedArea=a.id;reveal('area-inspector');drag.area=a;drag.areaOriginal=clone(a);drag.before=clone(project);const vertex=target.closest('[data-vertex]')?.getAttribute('data-vertex');if(vertex!==null&&vertex!==undefined)drag.vertex=Number(vertex);render();}}
  if(m&&mode==='edit'){drag.marker=m;drag.original=clone(m);drag.before=clone(project);drag.part=target.closest('[data-drag]')?.getAttribute('data-drag')||'point';
    // Automatisch versetztes Schild: Ziehen beginnt an der angezeigten Stelle und legt es danach fest (wie von Hand versetzt).
    const s=shown.get(m.id);if(drag.part==='label'&&s?.auto){drag.original.lx=s.lx;drag.original.ly=s.ly;}}
});
svg.addEventListener('pointermove',e=>{if(!project||!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});if(pinch&&pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),rect=svg.getBoundingClientRect();const width=Math.min(fitWidth*4,Math.max(fitWidth/20,pinch.camera.width*pinch.distance/Math.max(1,distance)));const height=width*rect.height/rect.width;camera={width,height,x:pinch.anchor.x-((a.clientX+b.clientX)/2-rect.left)/rect.width*width,y:pinch.anchor.y-((a.clientY+b.clientY)/2-rect.top)/rect.height*height};updateCamera();return;}
  if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.screen.x,dy=e.clientY-drag.screen.y;if(Math.hypot(dx,dy)>drag.threshold)drag.moved=true;if(!drag.moved)return;
  if(drag.pan){const rect=svg.getBoundingClientRect();camera={...drag.camera,x:drag.camera.x-dx/rect.width*drag.camera.width,y:drag.camera.y-dy/rect.height*drag.camera.height};updateCamera();}
  else if(drag.area&&drag.areaOriginal){const pos=point(e),o=drag.areaOriginal,clamp=(v:number,max:number)=>Math.min(max,Math.max(0,v));
    if(drag.vertex!==undefined){drag.area.points[drag.vertex]={x:clamp(pos.x,project.plan.width),y:clamp(pos.y,project.plan.height)};}
    else{const xs=o.points.map(p=>p.x),ys=o.points.map(p=>p.y),dx=Math.max(-Math.min(...xs),Math.min(project.plan.width-Math.max(...xs),pos.x-drag.start.x)),dy=Math.max(-Math.min(...ys),Math.min(project.plan.height-Math.max(...ys),pos.y-drag.start.y));drag.area.points=o.points.map(p=>({x:p.x+dx,y:p.y+dy}));}renderAreas();
  }
  else if(drag.marker&&drag.original){const pos=point(e),ox=pos.x-drag.start.x,oy=pos.y-drag.start.y,m=drag.marker,o=drag.original;
    if(drag.part==='label'){m.lx=o.lx+ox;m.ly=o.ly+oy;}else{m.x=Math.min(project.plan.width,Math.max(0,o.x+ox));m.y=Math.min(project.plan.height,Math.max(0,o.y+oy));if(Math.hypot(o.x-o.lx,o.y-o.ly)<=.01){m.lx=m.x;m.ly=m.y;}}
    renderMarkers();
  }
});
function endPointer(e:PointerEvent,cancel=false){if(cropping)return;pointers.delete(e.pointerId);if(pinch){if(pointers.size===0)pinch=null;drag=null;return;}if(!drag||drag.id!==e.pointerId||!project)return;const d=drag;drag=null;if(cancel){if(d.marker&&d.original)Object.assign(d.marker,d.original);if(d.area&&d.areaOriginal)Object.assign(d.area,d.areaOriginal);renderMarkers();return;}
  // Some devices deliver the last movement only on release. It must not become a tap.
  if(d.pan&&Math.hypot(e.clientX-d.screen.x,e.clientY-d.screen.y)>d.threshold)d.moved=true;
  if(d.area&&d.areaOriginal&&d.before){const error=polygonError(d.area.points,project.plan);if(error){Object.assign(d.area,d.areaOriginal);render();toast(error,true);}else if(d.moved){history.push(d.before);changed();}}
  else if(!d.moved&&mode==='measure'){measureClick(point(e));}
  else if(!d.moved&&mode==='lab-place'){labUI?.placeAt(point(e));}
  else if(!d.moved&&mode==='area-draw'){const pt=point(e);if(pt.x<0||pt.y<0||pt.x>project.plan.width||pt.y>project.plan.height){toast('Bitte innerhalb des Grundrisses zeichnen.');return;}if(draftPoints.length>=MAX_POINTS){toast(`Höchstens ${MAX_POINTS} Eckpunkte pro Fläche.`,true);return;}draftPoints.push(pt);render();}
  else if(d.marker&&d.moved&&d.before){history.push(d.before);changed();}
  else if(!d.moved&&(mode==='sample'||mode==='fire')){const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-id]');if(hit)return;const pt=point(e);if(pt.x<0||pt.y<0||pt.x>project.plan.width||pt.y>project.plan.height){toast('Bitte innerhalb des Grundrisses markieren.');return;}mutate(p=>{const m=addMarker(p,mode==='sample'?'sample':'fire',pt.x,pt.y),f=$<HTMLSelectElement>('next-shape').value as Shape;if(m.kind==='sample'&&f!=='circle'&&SHAPES.includes(f))m.shape=f;if(p.plan.sketch&&quickSketchOn()){const r=roomAt(p.plan.sketch,pt);if(r)m.raum=r.name;}selected=m.id;});}
}
svg.addEventListener('pointerup',e=>endPointer(e));svg.addEventListener('pointercancel',e=>endPointer(e,true));
new ResizeObserver(()=>{if(project){const rect=svg.getBoundingClientRect(),h=camera.width*rect.height/rect.width;if(Number.isFinite(h)){camera.y+=(camera.height-h)/2;camera.height=h;updateCamera();}}}).observe($('stage'));
input('quality').onchange=dimensions;input('format').addEventListener('change',dimensions);input('view').addEventListener('change',dimensions);input('scope').addEventListener('change',dimensions);
function exportName(p:Project,format:'png'|'jpeg'|'pdf',results=false,allFloors=false){const floor=allFloors?'':floorName(p);return `${`${folder?`Probenplan ${folder.name}`:p.report||'Probenplan'}${floor?` - ${floor}`:''}${results?' - Ergebniskarte':''}`.replace(/[<>:"/\\|?*]/g,'_')}.${format==='jpeg'?'jpg':format}`;}
/** Ein Druckblatt rendern; bei Speichermangel automatisch mit 200 statt 300 dpi. */
async function sheetPage(view:Project,paper:Paper,rated:ReturnType<typeof rateMarkers>|null,page:number,pages:number):Promise<PdfPage>{
  const layout=sheetLayout(view,paper,rated),info={objekt:String(projectData.objekt||'').trim(),page,pages};
  for(const dpi of [300,200]){let canvas:HTMLCanvasElement|null=null;
    try{canvas=await renderSheet(view,layout,rated,info,dpi);return {widthMm:layout.width,heightMm:layout.height,pixelWidth:canvas.width,pixelHeight:canvas.height,rgb:canvasRGB(canvas)};}
    catch(e){if(dpi===200)throw Error(`${e instanceof Error?e.message:'PDF-Erstellung fehlgeschlagen.'} Bitte A4 wählen oder andere Apps schließen.`);}
    finally{if(canvas){canvas.width=1;canvas.height=1;}}
  }
  throw Error('PDF-Erstellung fehlgeschlagen.');
}
/** Ergebniskarte nur, wenn wenigstens eine Probe nach einer Skala eingefärbt wird – sonst sähe sie aus wie der Probenplan. */
function resultsProblem(view:Project):string{const r=rateMarkers(view),param=r.parameter||'Σ16 EPA-PAK';
  if(!r.groups.length)return `Keine Probe dieses Plans hat einen Wert für „${param}“ – die Ergebniskarte wäre grau. Parameter in der Liste unter „Ergebniskarte“ prüfen.`;
  if(!r.groups.some(g=>g.scale))return `Für „${param}“ (${[...new Set(r.groups.map(g=>g.unit))].join(', ')}) ist keine Bewertungsskala festgelegt – alle Proben blieben grau. In der Liste unter „Ergebniskarte“ eine Skala anlegen oder die VdS-Referenz wählen.`;
  return '';}
const framed=()=>input('framed').checked;
try{input('framed').checked=localStorage.getItem('plankit-bild-schriftfeld')!=='0';}catch{/* ohne Speicher */}
input('framed').addEventListener('change',()=>{try{localStorage.setItem('plankit-bild-schriftfeld',framed()?'1':'0');}catch{/* ohne Speicher */}dimensions();});
input('view').addEventListener('change',()=>dimensions());
/** Bild (PNG/JPG) mit Schriftfeld: dasselbe Blatt wie das PDF, Seitenverhältnis A4 ohne Heftrand, längste Seite = gewählte Auflösung. */
async function framedImage(view:Project,longSide:number,format:'png'|'jpeg',rated:ReturnType<typeof rateMarkers>|null,page=1,pages=1):Promise<Blob>{
  const layout=sheetLayout(view,'bild',rated),dpi=longSide/(Math.max(layout.width,layout.height)/25.4);
  let canvas:HTMLCanvasElement|null=null;
  try{canvas=await renderSheet(view,layout,rated,{objekt:String(projectData.objekt||'').trim(),page,pages},dpi);const c=canvas;
    return await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b&&b.size>100?resolve(b):reject(Error('Der Browser konnte das Bild nicht speichern.')),`image/${format}`,0.96));}
  catch(e){throw Error(`${e instanceof Error?e.message:'Bildexport fehlgeschlagen.'} Bitte die kleinere Exportstufe (3.500 px) wählen oder andere Apps schließen.`);}
  finally{if(canvas){canvas.width=1;canvas.height=1;}}
}
async function runPdf(paper:Paper,resultsView:boolean,all:boolean){
  if(!project)return;const views=all?Array.from({length:sheetCount(project)},(_,i)=>clone(sheetProject(project!,i))):[clone(project)],pages:PdfPage[]=[];
  for(const [i,view] of views.entries()){$('export').textContent=views.length>1?`Blatt ${i+1} von ${views.length} wird erstellt …`:'PDF wird erstellt …';pages.push(await sheetPage(view,paper,resultsView?rateMarkers(view):null,i+1,views.length));}
  const name=exportName(project,'pdf',resultsView,all),blob=buildPdf(pages,{title:name.replace(/\.pdf$/,''),subject:[project.report&&`Gutachten ${project.report}`,String(projectData.objekt||'').trim()].filter(Boolean).join(' · '),author:COMPANY.name});
  if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(blob);const a=$<HTMLAnchorElement>('export-link');a.hidden=false;a.href=exportURL;a.download=name;a.textContent='PDF erneut herunterladen';$('export-result').hidden=false;
  const uncalibrated=views.filter(v=>!metersPerUnit(v.plan)).length,hint=uncalibrated?` ${uncalibrated===views.length?'Ohne':'Teilweise ohne'} Maßstab – Plan in der Liste kalibrieren („Strecke messen“).`:'';
  if(folder){await writeFile(folder.plaene,name,blob);toast(`PDF gespeichert: ${PLAENE}/${name}.${hint}`,!!uncalibrated);}else{a.click();toast(`PDF erstellt (${pages.length} ${pages.length===1?'Blatt':'Blätter'}). Der Download ist bereit.${hint}`,!!uncalibrated);}
}
function annexKey(){return `plankit-anlage-titel:${folder?.name||''}`;}
function annexTitle(){try{return localStorage.getItem(annexKey())||'Anlage';}catch{return 'Anlage';}}
function collectCount(p:Project){return [...p.markers,...(p.sheets||[]).filter((_,i)=>i!==(p.active??0)).flatMap(s=>s.markers||[])].filter(m=>m.kind==='sample').length+(p.pending?.length||0);}
async function runAnnex(){
  if(!project)return;const title=input('annex-title').value.trim()||'Anlage';try{localStorage.setItem(annexKey(),title);}catch{/* ohne Speicher */}
  if(folder&&!await flushFolder())throw Error(`Der Plan ist noch nicht in „${PLAENE}“ gespeichert. Bitte „Speichern“ und erneut versuchen – die Anlage soll den gespeicherten Stand belegen.`);
  const app=`PlanKit ${$('app-version').textContent?.replace(/^v/,'')}`,resultsView=hasValues(project);   // Lageplan als Ergebniskarte, sobald Messwerte da sind
  for(let i=0;i<sheetCount(project);i++)await ensureInk(sheetProject(project,i).plan);
  const r=await createAnnex(project,folder,{title,maxPhotos:Number(input('annex-photos').value),results:resultsView,objekt:String(projectData.objekt||'').trim(),projectData,projectDataSource:projectReader.state.file,projectDataStale:projectReader.state.stale,app,progress:t=>{$('export').textContent=t;}});
  const hint=r.warnings?` · ${r.warnings} Hinweis${r.warnings===1?'':'e'} im Prüfprotokoll`:'';
  const blob=new Blob([r.bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  if(folder){const saved=await saveAnnex(folder,title,r.bytes,r.source,app,r.created);$('export-result').hidden=true;toast(`Anlage gespeichert: ${ANNEX_DIR}/${saved.name}${hint}. In Word: Einfügen › Objekt › Text aus Datei.`,!!r.warnings);}
  else{const d=new Date(),z=(n:number)=>String(n).padStart(2,'0'),name=annexFileName(project.report||'Probenplan',title,`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`,[]);
    if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(blob);const a=$<HTMLAnchorElement>('export-link');a.hidden=false;a.href=exportURL;a.download=name;a.textContent='Anlage erneut herunterladen';$('export-result').hidden=false;a.click();toast(`Anlage erstellt (ohne Fotos – dafür das Projekt aus der Projektzentrale öffnen)${hint}.`,!!r.warnings);}
}
async function runExport(){if(!project||busy||!requireFinished())return;
  const exporting=project,origin=folder;busy=true;$<HTMLButtonElement>('export').disabled=true;
  try{if(!await projectDataForExport()||project!==exporting||folder!==origin)return;
    // Schilder werden anhand des Planbilds platziert: vor Layout und Zeichnen für alle Pläne laden, damit Maße und Bild übereinstimmen.
    for(let i=0;i<sheetCount(project);i++)await ensureInk(sheetProject(project,i).plan);}finally{busy=false;$<HTMLButtonElement>('export').disabled=false;}
  if(exportFormat()==='anlage'){busy=true;$<HTMLButtonElement>('export').disabled=true;try{await runAnnex();}catch(e){fail(e);}finally{busy=false;$<HTMLButtonElement>('export').disabled=false;dimensions();render();}return;}
  busy=true;$<HTMLButtonElement>('export').disabled=true;$('smaller').hidden=true;
  const resultsView=!$('view-field').hidden&&input('view').value==='results',all=sheetCount(project)>1&&input('scope').value==='all',chosen=exportFormat(),pdf=chosen.startsWith('pdf'),format=chosen as 'png'|'jpeg',quality=Number(input('quality').value);
  if(resultsView){const views=all?Array.from({length:sheetCount(project)},(_,i)=>sheetProject(project!,i)):[project];const problem=views.map(resultsProblem).find(Boolean);if(problem){busy=false;$<HTMLButtonElement>('export').disabled=false;toast(problem,true);return;}}
  $('export').textContent=pdf?'PDF wird erstellt …':'Bild wird erstellt …';$('export-link').textContent='Bild erneut herunterladen';
  try{
    if(pdf)await runPdf(chosen.slice(4) as Paper,resultsView,all);else
    if(all){const count=sheetCount(project);for(let i=0;i<count;i++){$('export').textContent=`Bild ${i+1} von ${count} wird erstellt …`;const view=clone(sheetProject(project,i));const image=framed()?await framedImage(view,quality,format,resultsView?rateMarkers(view):null,i+1,count):await exportImage(view,quality,format,resultsView?rateMarkers(view):null,footerExtra()),name=exportName(view,format,resultsView);if(folder)await writeFile(folder.plaene,name,image);else await download(image,name);}
      $('export-result').hidden=true;toast(folder?`${count} Bilder in „${PLAENE}“ gespeichert – je Plan ein Bild.`:`${count} Bilder erstellt – je Plan ein Bild. Der Browser fragt eventuell einmal, ob mehrere Downloads erlaubt sind.`);}
    else{const blob=framed()?await framedImage(clone(project),quality,format,resultsView?rateMarkers(project):null):await exportImage(clone(project),quality,format,resultsView?rateMarkers(project):null,footerExtra());if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(blob);const a=$<HTMLAnchorElement>('export-link');a.hidden=false;a.href=exportURL;a.download=exportName(project,format,resultsView);$('export-result').hidden=false;if(folder){await writeFile(folder.plaene,a.download,blob);toast(`Bild gespeichert: ${PLAENE}/${a.download}`);}else{a.click();toast('Bild erstellt. Der Download ist bereit.');}}
  }catch(e){fail(e);$('export-result').hidden=false;$('export-link').hidden=!exportURL||all||pdf;$('smaller').hidden=pdf||quality<=3500;}finally{busy=false;$<HTMLButtonElement>('export').disabled=false;dimensions();render();}}
$('export').onclick=runExport;$('smaller').onclick=()=>{input('quality').value='3500';dimensions();void runExport();};$('help').onclick=()=>$<HTMLDialogElement>('help-dialog').showModal();
async function offline(){if(!('serviceWorker' in navigator)){ $('offline').textContent='○ Offline nicht verfügbar';return;}const update=()=>{$('offline').textContent=navigator.serviceWorker.controller?'● Offline bereit':'● Offline nach erneutem Öffnen bereit';$('offline').classList.add('ready');};navigator.serviceWorker.addEventListener('controllerchange',update);try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;update();}catch{if(navigator.serviceWorker.controller)update();else $('offline').textContent='○ Offline nicht eingerichtet';}}
labUI=new LabUI({project:()=>project,labelkitProject:()=>folder?.name||project?.report||null,resultkit:()=>folder?.name||null,blocked:()=>busy||cropping||!!draftPoints.length,busy:value=>{busy=value;render();},mutate,point,mode:next=>{if(next==='lab-place'){selected=null;selectedArea=null;}setMode(next);render();},error:fail,selected:id=>{selected=id;selectedArea=null;}});
setMode('navigate');

// ---- PlanKit-Layout: Karte zuerst ----
// Kopfzeile mit Datei-Aktionen, Werkzeugleiste links, Plan in voller Größe, einklappbare Liste rechts, Export als Karte.
// Die Bedienelemente behalten ihre IDs; hier werden sie nur an ihren neuen Platz gesetzt.
function moveTo(target:Element,...ids:string[]){for(const id of ids){const e=document.getElementById(id);if(e)target.append(e);}}
const stageEl=$('stage'),panelScroll=document.querySelector('.panel-scroll')!;
moveTo(document.querySelector('.rail')!,'preparation');
moveTo(stageEl,'crop-actions','align-actions','import-status');
moveTo($('toolbar'),'area-draft');
moveTo($('file-actions'),'lab-import','lab-files');
document.querySelector('.markers-section')!.before($('lab-panel'));
panelScroll.append(document.querySelector('.areas-section')!);
const railLabel=(id:string,icon:string,text:string,title:string,key?:string)=>{const b=document.getElementById(id) as HTMLButtonElement|null;if(!b)return;b.innerHTML=`<span class="tool-icon">${icon}</span><span>${text}</span>`;b.title=title;b.classList.add('mode','rail-action');if(key)b.dataset.key=key;};
railLabel('rotate-left','↶','Links','90° nach links drehen (Umschalt+R)');
railLabel('rotate-right','↷','Rechts','90° nach rechts drehen (R)','r');
railLabel('crop-start','⌗','Zuschnitt','Bildausschnitt zuschneiden (C)','c');
railLabel('align-start','∡','Ausrichten','Plan fein drehen und am Raster ausrichten (A)','a');
railLabel('warp-start','⏢','Entzerren','Schräg fotografierten Plan über vier Ecken gerade rechnen (W)','w');
railLabel('sketch-edit','✎','Skizze','Skizze bearbeiten: Räume und Türen');
railLabel('sketch-tb','✎','Skizze','Kein Plan vorhanden? Skizze zeichnen: Räume mit Maßen, Türen und Fenster');
for(const [mode,key,text,title] of [['area-draw','f','Fläche +','Schadensfläche zeichnen (F)'],['area-edit','g','Fläche ✎','Schadensfläche bearbeiten (G)']] as const){const b=document.querySelector<HTMLButtonElement>(`[data-mode="${mode}"]`);if(!b)continue;b.dataset.key=key;b.title=title;const label=b.querySelector('span:last-child');if(label)label.firstChild!.textContent=text;}
document.querySelector('#help-dialog h2')!.insertAdjacentHTML('afterend','<h3>Tastenkürzel</h3><p><b>V</b> Ansicht · <b>P</b> Probe · <b>B</b> Brandherd · <b>E</b> Bearbeiten · <b>F</b> Fläche zeichnen · <b>G</b> Fläche bearbeiten · <b>R</b>/<b>Umschalt+R</b> drehen · <b>C</b> zuschneiden · <b>A</b> ausrichten · <b>L</b> Liste ein/aus · <b>+</b>/<b>−</b> Zoom · <b>0</b> Einpassen · <b>&lt;</b>/<b>&gt;</b> Punktgröße · <b>Bild↑</b>/<b>Bild↓</b> Plan wechseln · <b>Strg+Z</b> rückgängig · <b>Entf</b> löschen · <b>Esc</b> abwählen</p>');
const PANEL_KEY='plankit:panel';
function setPanel(open:boolean,remember=true){document.body.classList.toggle('panel-open',open);$('panel-toggle').setAttribute('aria-pressed',String(open));if(remember){try{localStorage.setItem(PANEL_KEY,open?'open':'closed');}catch{/* privates Fenster */}}}
function reveal(id:string){const wasOpen=document.body.classList.contains('panel-open');setPanel(true);if(!wasOpen||matchMedia('(min-width:701px)').matches){const target=document.getElementById(id);const box=target?.getBoundingClientRect(),view=panelScroll.getBoundingClientRect();if(target&&box&&(box.top<view.top||box.top>view.bottom-40))target.scrollIntoView({block:'nearest'});}}
let storedPanel:string|null=null;try{storedPanel=localStorage.getItem(PANEL_KEY);}catch{/* privates Fenster */}
setPanel(storedPanel==='open',false);
$('panel-toggle').onclick=()=>setPanel(!document.body.classList.contains('panel-open'));
$('panel-close').onclick=()=>setPanel(false);
$('marker-list').addEventListener('click',()=>reveal('inspector'));
$('area-list').addEventListener('click',()=>reveal('area-inspector'));
document.addEventListener('plankit:reveal',e=>reveal((e as CustomEvent<string>).detail));
const exportCard=$<HTMLDialogElement>('export-dialog');
$('export-open').onclick=()=>{if(exportCard.open)exportCard.close();else{exportCard.show();dimensions();}};
window.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
  const editing=(t:EventTarget|null)=>t instanceof Element&&(!!t.closest('input,textarea,select,[role="textbox"]')||(t instanceof HTMLElement&&t.isContentEditable));
  if(editing(e.target)||editing(document.activeElement)||document.querySelector('dialog:modal,[role="dialog"][aria-modal="true"]'))return;
  if(e.key==='Escape'&&exportCard.open&&!selected&&!selectedArea&&!cropping){exportCard.close();return;}
  const key=e.key.toLowerCase(),click=(b:HTMLElement|null)=>{if(b&&!(b as HTMLButtonElement).disabled){e.preventDefault();b.click();}};
  if(key==='r'&&e.shiftKey)return click($('rotate-left'));
  if(e.shiftKey&&key!=='+')return;
  const tool=document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  if(tool)return click(tool);
  if(key==='l'){e.preventDefault();setPanel(!document.body.classList.contains('panel-open'));return;}
  if(key==='+'||key==='=')return click($('zoom-in'));
  if(key==='-')return click($('zoom-out'));
  if(key==='0')return click($('fit'));
});

// ---- Mehrere Pläne (Geschosse) ----
// Leiste unter dem Plan: Vorschaubilder zum Wechseln, „＋ Plan“, Doppelklick/Rechtsklick/⋯ zum Umbenennen, Verschieben und Löschen.
document.body.insertAdjacentHTML('beforeend','<dialog id="sheet-dialog"><form method="dialog"><button class="close" aria-label="Schließen">×</button></form><span class="eyebrow">PLAN</span><h2>Plan bearbeiten</h2><label>Name <span class="optional">z. B. EG, 1. OG, Keller</span><input id="sheet-name" maxlength="40" autocomplete="off"></label><div class="dialog-actions"><button id="sheet-left">← Nach links</button><button id="sheet-right">Nach rechts →</button><button id="sheet-delete" class="danger">Plan löschen</button><button id="sheet-ok" class="primary">Fertig</button></div><p class="tiny">Beim Löschen kehren platzierte Laborproben in „Noch zu platzieren“ zurück. Rückgängig mit Strg+Z.</p></dialog>');
const thumbs=new Map<string,string>(),thumbsLoading=new Set<string>();
function thumbKey(plan:Plan){return `${plan.data.length}:${plan.data.slice(-48)}:${plan.width}x${plan.height}:${JSON.stringify(plan.preparation||'')}`;}
function thumb(plan:Plan){const key=thumbKey(plan),done=thumbs.get(key);if(done!==undefined)return done;
  if(!thumbsLoading.has(key)){thumbsLoading.add(key);void (async()=>{try{const img=await loadImage(plan.data),scale=Math.min(128/plan.width,76/plan.height),c=document.createElement('canvas');c.width=Math.max(1,Math.round(plan.width*scale));c.height=Math.max(1,Math.round(plan.height*scale));const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.scale(scale,scale);ctx.transform(...planMatrix(plan));const src=preparation(plan);ctx.drawImage(img,0,0,src.sourceWidth,src.sourceHeight);thumbs.set(key,c.toDataURL('image/png'));}catch{thumbs.set(key,'');}finally{thumbsLoading.delete(key);renderSheets();}})();}
  return '';}
let sheetSignature='';
function renderSheets(){
  const strip=$('sheet-strip'),p=project;strip.hidden=!p;if(!p){sheetSignature='';return;}
  const count=sheetCount(p),active=p.active??0,single=count<2;strip.classList.toggle('single',single);
  const items=(p.sheets||[{id:'',name:'EG'}]).map((sh,i)=>{const view=i===active?p:sheetProject(p,i),samples=view.markers.filter(m=>m.kind==='sample').length,fires=view.markers.length-samples;
    return {i,name:sh.name,src:single?'':thumb(view.plan),info:[samples?`${samples} Probe${samples===1?'':'n'}`:'',fires?`${fires} Brandherd${fires===1?'':'e'}`:''].filter(Boolean).join(' · ')||'leer'};});
  const signature=JSON.stringify([active,items,busy,cropping,draftPoints.length>0]);if(signature===sheetSignature)return;sheetSignature=signature;
  $('sheet-list').innerHTML=items.map(it=>`<div class="sheet${it.i===active?' active':''}"><button class="sheet-main" role="tab" aria-selected="${it.i===active}" data-sheet="${it.i}" title="${escape(it.name)}${it.i===active?' – Doppelklick zum Umbenennen':' – anzeigen'}"><span class="sheet-thumb">${it.src?`<img src="${it.src}" alt="">`:''}</span><span class="sheet-text"><b>${escape(it.name)}</b><small>${escape(it.info)}</small></span></button>${it.i===active?`<button class="sheet-more" data-sheet-menu="${it.i}" title="Plan umbenennen, verschieben oder löschen" aria-label="Plan ${escape(it.name)} bearbeiten">⋯</button>`:''}</div>`).join('');
  $<HTMLButtonElement>('sheet-add').disabled=$<HTMLButtonElement>('sheet-sketch').disabled=busy||cropping||!!draftPoints.length||count>=MAX_SHEETS;
  const floor=floorName(p);document.querySelector('.markers-section h2')!.textContent=floor?`Markierungen · ${floor}`:'Markierungen';
  $('scope-field').hidden=single;if(!single){(input('scope') as unknown as HTMLSelectElement).options[0].text=`Dieser Plan (${floor})`;(input('scope') as unknown as HTMLSelectElement).options[1].text=`Alle ${count} Pläne · je ein Bild`;}
}
function showSheet(index:number){
  if(!project||busy||cropping||!requireFinished())return;const count=sheetCount(project);if(count<2||index<0||index>=count||index===(project.active??0))return;
  if(mode==='measure')setMode('navigate');switchSheet(project,index);selected=null;selectedArea=null;$('export-result').hidden=true;render();fit();persist();
}
let menuIndex=0;
function openSheetMenu(index:number){if(!project||busy||cropping||!requireFinished())return;if(index!==(project.active??0))showSheet(index);menuIndex=project.active??0;const d=$<HTMLDialogElement>('sheet-dialog'),count=sheetCount(project);input('sheet-name').value=project.sheets?.[menuIndex]?.name||'EG';$<HTMLButtonElement>('sheet-left').disabled=menuIndex===0;$<HTMLButtonElement>('sheet-right').disabled=menuIndex>=count-1;$<HTMLButtonElement>('sheet-delete').disabled=count<2;if(!d.open)d.showModal();input('sheet-name').select();}
function commitSheetName(){if(!project)return true;const name=input('sheet-name').value,current=project.sheets?.[menuIndex]?.name||'EG';if(name.trim()===current)return true;try{const test=clone(project);renameSheet(test,menuIndex,name);mutate(p=>renameSheet(p,menuIndex,name));return true;}catch(e){fail(e);return false;}}
$('sheet-list').addEventListener('click',e=>{const t=e.target as HTMLElement,menu=t.closest<HTMLElement>('[data-sheet-menu]');if(menu){openSheetMenu(Number(menu.dataset.sheetMenu));return;}const b=t.closest<HTMLElement>('[data-sheet]');if(b)showSheet(Number(b.dataset.sheet));});
$('sheet-list').addEventListener('dblclick',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-sheet]');if(b)openSheetMenu(Number(b.dataset.sheet));});
$('sheet-list').addEventListener('contextmenu',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-sheet],[data-sheet-menu]');if(b){e.preventDefault();openSheetMenu(Number(b.dataset.sheet??b.dataset.sheetMenu));}});
input('sheet-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('sheet-ok').click();}});
$('sheet-ok').onclick=()=>{if(commitSheetName())$<HTMLDialogElement>('sheet-dialog').close();};
for(const [id,step] of [['sheet-left',-1],['sheet-right',1]] as const)$(id).onclick=()=>{if(!project||!commitSheetName())return;const to=menuIndex+step;mutate(p=>moveSheet(p,menuIndex,to));openSheetMenu(project.active??0);};
$('sheet-delete').onclick=()=>{if(!project||sheetCount(project)<2)return;const name=project.sheets![menuIndex].name;let back=0;mutate(p=>{back=(removeSheet(p,menuIndex).markers||[]).filter(m=>m.lab).length;});selected=null;selectedArea=null;$<HTMLDialogElement>('sheet-dialog').close();fit();toast(`Plan „${name}“ gelöscht${back?`; ${back} Laborprobe${back===1?'':'n'} wieder in „Noch zu platzieren“`:''}. Rückgängig mit Strg+Z.`);};
$('sheet-add').onclick=()=>{if(project&&!busy)input('sheet-file').click();};
input('file').insertAdjacentHTML('afterend','<input id="sheet-file" type="file" hidden>');input('sheet-file').accept=input('file').accept;
input('sheet-file').onchange=()=>{const f=input('sheet-file').files?.[0];if(f)void importFile(f,false,true);input('sheet-file').value='';};
window.addEventListener('keydown',e=>{
  if(e.key!=='PageUp'&&e.key!=='PageDown')return;if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||!project)return;
  const editing=(t:EventTarget|null)=>t instanceof Element&&!!t.closest('input,textarea,select,[role="textbox"]');if(editing(e.target)||editing(document.activeElement)||document.querySelector('dialog:modal'))return;
  e.preventDefault();showSheet((project.active??0)+(e.key==='PageDown'?1:-1));
});
document.querySelector('#help-dialog h3')!.insertAdjacentHTML('beforebegin','<h3>Mehrere Pläne (Geschosse)</h3><p>Ein Projekt kann mehrere Pläne enthalten, z. B. EG, 1. OG und 2. OG. „＋ Plan“ unten fügt einen weiteren Grundriss hinzu; eine mehrseitige PDF kann mit „Alle Seiten als einzelne Pläne“ in einem Schritt übernommen werden. Ein Klick auf das Vorschaubild wechselt den Plan, <b>Bild↑</b>/<b>Bild↓</b> ebenfalls. Doppelklick, Rechtsklick oder „⋯“ benennt den Plan um, verschiebt oder löscht ihn.</p><p>Proben werden über alle Pläne fortlaufend nummeriert; jede Kennung gibt es im Projekt nur einmal. Ein Laborbericht wird einmal importiert – die offenen Proben gelten für alle Pläne: zum passenden Plan wechseln und die Probe dort platzieren. Rückgängig wechselt bei Bedarf zum betroffenen Plan. Der Export erstellt wahlweise ein Bild des aktuellen Plans oder je Plan ein Bild; der Planname steht im Bild und im Dateinamen.</p>');

// ---- Ergebniskarte ----
// „Ergebnisse“ färbt Probenmarker nach Bewertungskategorie (Skalen wie in FotoKit, Farben im Projekt).
// Einstellungen in der Liste rechts; Export wahlweise als Probenplan oder Ergebniskarte.
// Punktgröße je Plan: Regler im Seitenfenster, Tasten < und > (ohne Seitenfenster nutzbar)
document.querySelector('.panel-scroll')!.insertAdjacentHTML('afterbegin','<section class="size-section" id="size-section" hidden><div class="section-heading"><h2>Punktgröße</h2><span id="size-value" class="size-value">100 %</span></div><input id="marker-size" type="range" min="20" max="300" step="5" value="100" aria-label="Punktgröße dieses Plans in Prozent"><div class="size-row"><button id="size-reset" class="tb" title="Auf 100 % zurücksetzen">100 %</button><p class="tiny">Gilt nur für diesen Plan. Tasten: <b>&lt;</b> kleiner · <b>&gt;</b> größer.</p></div></section>');
let sizeUndoAt=0,sizeTimer=0;
// ---- Beschriftung (ab 1.19) ----
// Schilder automatisch platzieren und Messwerte am Plan: je Plan schaltbar, gespeichert im Plan (nur Abweichungen vom Standard).
document.getElementById('size-section')!.insertAdjacentHTML('afterend','<section class="size-section" id="label-section" hidden><div class="section-heading"><h2>Beschriftung</h2></div><label class="check-row"><input type="checkbox" id="auto-labels"> Schilder automatisch platzieren</label><p class="tiny">Die Probenstelle bleibt exakt; nur das Schild weicht Text, Linien und anderen Schildern aus (mit Hinweislinie). Von Hand gezogene Schilder bleiben, wo sie sind.</p><label class="check-row"><input type="checkbox" id="surface-bars"> Oberflächenart am Plan</label><p class="tiny">Balken an der Probenstelle: oben Untersicht, links Ansicht, unten Aufsicht – auch in Legende und Export.</p><label class="check-row"><input type="checkbox" id="value-labels"> Messwerte am Plan</label><p class="tiny" id="value-labels-note">In der Ergebniskarte: Wertkästchen je Probe mit Wert wie im Prüfbericht, Einheit und Kategorie.</p><div class="size-row"><button id="labels-reset" class="tb" title="Alle von Hand versetzten Schilder dieses Plans wieder automatisch platzieren">Schilder neu anordnen</button></div></section>');
/** Die Oberflächenart (früher Testfunktion „Probenfläche“) ist seit 1.23 Standard; weitere Testfunktionen gibt es derzeit nicht. */
function updateTrialUI(){}
/* ---------- Raumbuch (ab 1.24) ----------
   Je Raum Befund und Bewertung aus den Proben (berechnet, nie gespeichert), dazu Maßnahme und Bemerkung des Sachverständigen.
   Räume ohne Probe mit Status (Sichtprüfung unauffällig/auffällig, nicht begangen). Keine Flächen, keine Mengen. */
document.getElementById('label-section')!.insertAdjacentHTML('afterend','<section class="size-section" id="raumbuch-section" hidden><div class="section-heading"><h2>Raumbuch</h2></div><p class="tiny" id="raumbuch-summary"></p><button type="button" id="raumbuch-open">Raumbuch bearbeiten …</button></section>');
document.body.insertAdjacentHTML('beforeend','<dialog id="raumbuch-dialog" aria-labelledby="raumbuch-title"><span class="eyebrow">RAUMBUCH</span><h2 id="raumbuch-title">Räume, Befund und Maßnahmen</h2><p class="tiny">Befund und Bewertung kommen aus den Proben und der Skala der Ergebniskarte. Ihre Eingaben: Maßnahme und Bemerkung je Raum, Räume ohne Probe mit Status. Keine Flächen und Mengen – '+escape(FOOTNOTE_MENGEN)+'</p><div id="raumbuch-hints"></div><div class="raumbuch-table-wrap"><table class="raumbuch-table"><thead><tr><th>Geschoss</th><th>Raum</th><th>Befund</th><th>Bewertung</th><th>Status</th><th>Maßnahme</th><th>Bemerkung</th><th></th></tr></thead><tbody id="raumbuch-rows"></tbody></table></div><form id="raumbuch-add" class="raumbuch-add"><input id="raumbuch-add-floor" list="raumbuch-floors" maxlength="40" placeholder="Geschoss" aria-label="Geschoss"><input id="raumbuch-add-name" maxlength="80" placeholder="Raum ohne Probe, z. B. HWR" aria-label="Raum ohne Probe"><button type="submit">Raum hinzufügen</button></form><datalist id="raumbuch-floors"></datalist><datalist id="raumbuch-massnahmen"></datalist><label class="raumbuch-title">Bezeichnung der Anlage<input id="raumbuch-anlage" maxlength="60" placeholder="z. B. Anlage 5"></label><div class="dialog-actions"><button type="button" class="primary" id="raumbuch-word">Word-Anlage speichern</button><button type="button" id="raumbuch-csv">Tabelle für Excel (CSV)</button><button type="button" id="raumbuch-close">Schließen</button></div></dialog>');
let raumbuchRows:RaumZeile[]=[];
const MASSNAHMEN_KEY='plankit-raumbuch-massnahmen';
function massnahmenVorschlaege():string[]{try{const v=JSON.parse(localStorage.getItem(MASSNAHMEN_KEY)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,30):[];}catch{return [];}}
function merkeMassnahme(v:string){const t=v.trim();if(!t)return;try{localStorage.setItem(MASSNAHMEN_KEY,JSON.stringify([t,...massnahmenVorschlaege().filter(x=>x!==t)].slice(0,30)));}catch{/* ohne Speicher */}}
function raumbuchKey(){return `plankit-raumbuch-anlage:${folder?.name||''}`;}
let raumbuchTimer=0;
/** Zusammenfassung verzögert berechnen – render() läuft auch beim Ziehen von Markern. */
function updateRaumbuchUI(){$('raumbuch-section').hidden=!project;clearTimeout(raumbuchTimer);raumbuchTimer=window.setTimeout(raumbuchSummary,250);}
function raumbuchSummary(){
  if(!project)return;
  const st=raumbuchStand(project),auff=st.rows.filter(r=>r.auffaellig).length,h=pruefhinweise(st).length;
  $('raumbuch-summary').textContent=st.rows.length?`${st.rows.length} ${st.rows.length===1?'Raum':'Räume'}${auff?`, ${auff} auffällig`:''}${h?` · ${h} Hinweis${h===1?'':'e'}`:''}`:'Noch keine Räume: „Raum“ an den Proben angeben (kommt aus LabelKit) oder Räume ohne Probe hinzufügen.';
  if($<HTMLDialogElement>('raumbuch-dialog').open)renderRaumbuch();
}
function renderRaumbuch(){
  if(!project)return;
  // Wird neu gezeichnet, während jemand tippt (z. B. Sicherung im Hintergrund), bleiben Fokus, getippter Text und Cursor erhalten.
  const active=document.activeElement as HTMLElement|null,focus=active?.closest('#raumbuch-rows')?{k:active.dataset.k,f:active.dataset.f,value:(active as HTMLInputElement).value,a:(active as HTMLInputElement).selectionStart,b:(active as HTMLInputElement).selectionEnd}:null;
  const st:RaumbuchStand=raumbuchStand(project);raumbuchRows=st.rows;
  const hints=pruefhinweise(st),merges=st.doppelt.map(([a,b])=>{const [von,nach]=a.probes.length>b.probes.length||(a.probes.length===b.probes.length&&a.name.length>=b.name.length)?[b,a]:[a,b];return {von,nach};});
  $('raumbuch-hints').replaceChildren(...hints.map(h=>{const p=document.createElement('p');p.className='tiny raumbuch-hint';p.textContent=h.text+(h.detail?`: ${h.detail}`:'');return p;}),
    ...merges.map(({von,nach},i)=>{const b=document.createElement('button');b.type='button';b.className='raumbuch-merge';b.dataset.merge=String(i);b.textContent=`„${von.name}“ als „${nach.name}“ zusammenführen${von.floor?` (${von.floor})`:''}`;b.onclick=()=>{if(!project||busy)return;mutate(p=>mergeRaum(p,von,nach));};return b;}));
  const el=(tag:string,attrs:Record<string,string>={},text='')=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e;};
  const rows=st.rows.map((r,i)=>{
    const tr=el('tr',{'data-row':String(i)});if(r.auffaellig)tr.classList.add('auffaellig');
    tr.append(el('td',{},r.floor||'–'),el('td',{class:'raum'},r.name));
    const bef=el('td',{class:'befund'});for(const line of [...r.probes.map(x=>`${x.label}${x.wert?` ${x.wert}`:' (Wert ausstehend)'}${x.flaeche?` · ${x.flaeche}`:''}${x.placed?'':' (nicht im Plan)'}`),...(r.brandherd?['Brandherd']:[])]){bef.append(el('div',{},line));}
    if(!bef.childNodes.length)bef.textContent='–';
    tr.append(bef,el('td',{},r.bewertung||'–'));
    const stTd=el('td');
    if(r.sampled)stTd.textContent='beprobt';
    else{const sel=el('select',{'data-k':r.key,'data-f':'status','aria-label':`Status ${r.name}`}) as HTMLSelectElement;for(const s of RAUM_STATUS){const o=el('option',{value:s},STATUS_TEXT[s]) as HTMLOptionElement;sel.append(o);}if(r.brandherd){sel.prepend(el('option',{value:''},'– (Brandherd)'));}sel.value=r.status||'';stTd.append(sel);}
    const mass=el('input',{'data-k':r.key,'data-f':'massnahme',list:'raumbuch-massnahmen',maxlength:'500','aria-label':`Maßnahme ${r.name}`,placeholder:r.auffaellig?'Maßnahme eintragen':''}) as HTMLInputElement;mass.value=r.massnahme;if(r.auffaellig&&!r.massnahme)mass.classList.add('missing');
    const bem=el('input',{'data-k':r.key,'data-f':'bemerkung',maxlength:'500','aria-label':`Bemerkung ${r.name}`}) as HTMLInputElement;bem.value=r.bemerkung;
    const tdM=el('td');tdM.append(mass);const tdB=el('td');tdB.append(bem);const tdX=el('td');
    if(!r.sampled&&!r.brandherd){const x=el('button',{type:'button','data-remove':String(i),'aria-label':`${r.name} entfernen`,title:'Raum entfernen'},'✕');tdX.append(x);}
    tr.append(stTd,tdM,tdB,tdX);return tr;
  });
  $('raumbuch-rows').replaceChildren(...rows);
  if(!rows.length){const tr=el('tr');tr.append(el('td',{colspan:'8',class:'tiny'},'Noch keine Räume. „Raum“ steht an den Proben (aus LabelKit oder im Feld „Raum“ unter Markierungen).'));$('raumbuch-rows').append(tr);}
  const floors=[...new Set([...Array.from({length:sheetCount(project)},(_,i)=>floorName(project!,i)),...st.rows.map(r=>r.floor)].filter(Boolean))];
  $('raumbuch-floors').replaceChildren(...floors.map(f=>el('option',{value:f})));
  $('raumbuch-massnahmen').replaceChildren(...[...new Set([...massnahmenVorschlaege(),'keine Maßnahme erforderlich'])].map(v=>el('option',{value:v})));
  if(focus){const t=$('raumbuch-rows').querySelector<HTMLInputElement>(`[data-k="${CSS.escape(focus.k||'')}"][data-f="${focus.f}"]`);
    if(t){if(t instanceof HTMLInputElement&&typeof focus.value==='string'&&t.value!==focus.value){t.value=focus.value;t.classList.remove('missing');t.dataset.nachgetragen='1';}t.focus();if(t instanceof HTMLInputElement&&focus.a!=null)try{t.setSelectionRange(focus.a,focus.b??focus.a);}catch{/* select */}}}
}
// Nach dem Neuzeichnen übernommener Text gilt für den Browser nicht als Eingabe: beim Verlassen des Felds selbst speichern.
$('raumbuch-rows').addEventListener('focusout',e=>{const t=e.target as HTMLInputElement;if(t.dataset?.nachgetragen){delete t.dataset.nachgetragen;t.dispatchEvent(new Event('change',{bubbles:true}));}});
$('raumbuch-rows').addEventListener('input',e=>{const t=e.target as HTMLInputElement;if(t.dataset?.nachgetragen)delete t.dataset.nachgetragen;});
$('raumbuch-rows').addEventListener('change',e=>{
  const t=e.target as HTMLInputElement|HTMLSelectElement;if(!project||!t.dataset.f)return;
  const row=raumbuchRows.find(r=>r.key===t.dataset.k);if(!row)return;
  const v=t.value;if(t.dataset.f==='massnahme')merkeMassnahme(v);
  mutate(p=>setEintrag(p,row,t.dataset.f==='status'?{status:(v||undefined) as RaumStatus|undefined}:{[t.dataset.f!]:v}));
});
$('raumbuch-rows').addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');if(!b||!project)return;const r=raumbuchRows[Number(b.dataset.remove)];if(r)mutate(p=>removeRaum(p,r.floor,r.name));});
$('raumbuch-add').addEventListener('submit',e=>{e.preventDefault();if(!project)return;try{const f=input('raumbuch-add-floor').value,n=input('raumbuch-add-name').value;addRaum(clone(project),f,n);mutate(p=>addRaum(p,f,n));input('raumbuch-add-name').value='';input('raumbuch-add-name').focus();}catch(err){toast((err as Error).message,true);}});
$('raumbuch-open').onclick=()=>{if(!project)return;try{input('raumbuch-anlage').value=localStorage.getItem(raumbuchKey())||'';}catch{/* ohne Speicher */}renderRaumbuch();$<HTMLDialogElement>('raumbuch-dialog').showModal();};
$('raumbuch-close').onclick=()=>$<HTMLDialogElement>('raumbuch-dialog').close();
async function raumbuchExport(kind:'docx'|'csv'){
  if(!project||busy)return;const title=input('raumbuch-anlage').value.trim()||'Anlage';try{localStorage.setItem(raumbuchKey(),title);}catch{/* ohne Speicher */}
  busy=true;const buttons=[$<HTMLButtonElement>('raumbuch-word'),$<HTMLButtonElement>('raumbuch-csv')];buttons.forEach(b=>b.disabled=true);
  try{
    if(folder&&!await flushFolder())throw Error(`Der Plan ist noch nicht in „${PLAENE}“ gespeichert. Bitte „Speichern“ und erneut versuchen.`);
    const st=raumbuchStand(project);if(!st.rows.length)throw Error('Das Raumbuch ist noch leer.');
    const hints=pruefhinweise(st),created=new Date().toISOString(),app=`PlanKit ${$('app-version').textContent?.replace(/^v/,'')}`;
    const source=folder?`${PLAENE}/${projectFileName(folder)}`:'PlanKit-Projekt (nicht im Projektordner)';
    const bytes=kind==='docx'?buildDocx({title:`${title}: Raumbuch`,author:app,application:app,created,blocks:raumbuchBlocks(st,{title,nr:folder?.nr||project.report||'',ort:folder?.ort||'',projectData,created,app,source,hinweis:vorlaeufigText(vorlaeufigeBerichte(project))})}):new TextEncoder().encode(raumbuchCSV(st));
    const d=new Date(),z=(n:number)=>String(n).padStart(2,'0'),date=`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`,nr=folder?.nr||project.report||'Probenplan';
    const hint=hints.length?` · ${hints.length} Hinweis${hints.length===1?'':'e'}: ${hints.map(h=>h.text).join('; ')}`:'';
    if(folder){const saved=await saveDocument(folder,taken=>raumbuchName(nr,kind,date,taken),bytes,source,app,created);toast(`Raumbuch gespeichert: ${ANNEX_DIR}/${saved.name}${hint}`,!!hints.length);}
    else{await download(new Blob([bytes],{type:kind==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'text/csv;charset=utf-8'}),raumbuchName(nr,kind,date,[]));toast(`Raumbuch erstellt${hint}`,!!hints.length);}
  }catch(e){fail(e);}finally{busy=false;buttons.forEach(b=>b.disabled=false);}
}
$('raumbuch-word').onclick=()=>void raumbuchExport('docx');
$('raumbuch-csv').onclick=()=>void raumbuchExport('csv');

/* Wandansichten der Bohrkerne (ab 1.26): Kerne aus der neuesten LabelKit-Datei, Werte aus dem Projekt über die P-Nummer.
   Nichts davon wird im Projekt gespeichert – die Ansicht wird jedes Mal neu berechnet. */
document.getElementById('raumbuch-open')!.insertAdjacentHTML('afterend','<button type="button" id="wand-open" title="Bohrkerne je Wand mit Tiefenprofil – aus LabelKit (Wandblatt) und den Laborwerten">Wandansichten (Bohrkerne) …</button>');
document.body.insertAdjacentHTML('beforeend','<dialog id="wand-dialog" aria-labelledby="wand-title"><span class="eyebrow">BOHRKERNE</span><h2 id="wand-title">Wandansichten</h2><p class="tiny" id="wand-quelle"></p><div class="wand-optionen"><label>Farbe und Wert<select id="wand-p1"></select></label><label>Zweiter Wert (nur Tabelle)<select id="wand-p2"></select></label><label>Bezeichnung der Anlage<input id="wand-anlage" maxlength="60" placeholder="z. B. Anlage 6"></label></div><div id="wand-hinweise"></div><div id="wand-vorschau" class="wand-vorschau"></div><div class="dialog-actions"><button type="button" class="primary" id="wand-word">Word-Anlage speichern</button><button type="button" id="wand-csv">Tabelle für Excel (CSV)</button><button type="button" id="wand-close">Schließen</button></div></dialog>');
let wandDaten:{st:WandStand;datei:string}|null=null,wandUrls:string[]=[];
function wandKey(){return `plankit-wand-anlage:${folder?.name||''}`;}
async function wandLaden(){
  if(!project)throw Error('Kein Projekt geöffnet.');
  if(!folder)throw Error('Die Wandansichten brauchen den Projektordner (Bohrkerne aus LabelKit). Bitte das Projekt aus der Projektzentrale öffnen.');
  const dir=await findSubdir(folder.dir,AUFTRAEGE),f=dir?(await listFiles(dir,/_Daten\.json$/i))[0]:undefined;
  if(!f)throw Error(`In „${AUFTRAEGE}“ liegt keine LabelKit-Datei (…_Daten.json).`);
  let daten:unknown;try{daten=JSON.parse(await (await f.handle.getFile()).text());}catch{throw Error(`„${AUFTRAEGE}/${f.name}“ ist nicht lesbar.`);}
  return {st:wandStand(daten,project),datei:`${AUFTRAEGE}/${f.name}`};
}
function wandFreigeben(){for(const u of wandUrls)URL.revokeObjectURL(u);wandUrls=[];}
function renderWand(){
  if(!project||!wandDaten)return;const {st,datei}=wandDaten;
  const sel=(id:string,opts:string[],value:string,leer:string)=>{const s=$<HTMLSelectElement>(id);s.replaceChildren(...[leer,...opts].map((v,i)=>{const o=document.createElement('option');o.value=i?v:'';o.textContent=i?shortParameter(v):v;return o;}));s.value=opts.includes(value)?value:'';};
  const [v1,v2]=wandVorschlag(st.parameter,project.results?.parameter||''),p1=$<HTMLSelectElement>('wand-p1').dataset.wahl??v1,p2=$<HTMLSelectElement>('wand-p2').dataset.wahl??v2;
  sel('wand-p1',st.parameter,p1,st.parameter.length?'– kein Wert –':'– noch keine Laborwerte –');sel('wand-p2',st.parameter.filter(x=>x!==$<HTMLSelectElement>('wand-p1').value),p2,'– keiner –');
  const n=st.waende.reduce((a,w)=>a+w.kerne.length,0);
  $('wand-quelle').textContent=st.waende.length?`${st.waende.length} ${st.waende.length===1?'Fläche':'Flächen'} mit ${n} ${n===1?'Bohrkern':'Bohrkernen'} aus ${datei}. Messwerte aus dem Plan (Prüfbericht importiert, über die Probennummer).`:`In ${datei} gibt es keine Bohrkerne mit Bezeichnung nach AidKit (z. B. EG-WZ-B-7-T2).`;
  const parameter=$<HTMLSelectElement>('wand-p1').value;
  $('wand-hinweise').replaceChildren(...[vorlaeufigText(vorlaeufigeBerichte(project)),...wandHinweise(st,parameter)].filter(Boolean).map(h=>{const p=document.createElement('p');p.className='tiny raumbuch-hint';p.textContent=h;return p;}));
  wandFreigeben();
  $('wand-vorschau').replaceChildren(...st.waende.map(w=>{const b=wandSvg(project!,w,parameter,{anteil:kwPaar(parameter,$<HTMLSelectElement>('wand-p2').value)}),u=URL.createObjectURL(new Blob([b.svg],{type:'image/svg+xml'}));wandUrls.push(u);const img=document.createElement('img');img.src=u;img.alt=`Wandansicht ${w.key}`;img.width=b.width;img.height=b.height;return img;}));
  $<HTMLButtonElement>('wand-word').disabled=$<HTMLButtonElement>('wand-csv').disabled=!st.waende.length&&!st.referenz.length;
}
for(const id of ['wand-p1','wand-p2'])$(id).addEventListener('change',()=>{$(id).dataset.wahl=$<HTMLSelectElement>(id).value;renderWand();});
$('wand-open').onclick=async()=>{
  if(!project||busy)return;
  try{wandDaten=await wandLaden();}catch(e){fail(e);return;}
  delete $('wand-p1').dataset.wahl;delete $('wand-p2').dataset.wahl;
  try{input('wand-anlage').value=localStorage.getItem(wandKey())||'';}catch{/* ohne Speicher */}
  renderWand();$<HTMLDialogElement>('wand-dialog').showModal();
};
$('wand-close').onclick=()=>$<HTMLDialogElement>('wand-dialog').close();
$('wand-dialog').addEventListener('close',()=>{wandFreigeben();$('wand-vorschau').replaceChildren();});
/** SVG → PNG (doppelte Auflösung) für die Word-Anlage. */
async function svgPng(svg:string,w:number,h:number,scale=2):Promise<WandBildDatei>{
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));let c:HTMLCanvasElement|null=document.createElement('canvas');
  try{const img=new Image();img.src=url;await img.decode();c.width=w*scale;c.height=h*scale;const g=c.getContext('2d');if(!g)throw Error('Kein Bildspeicher verfügbar.');g.drawImage(img,0,0,c.width,c.height);
    const blob=await new Promise<Blob>((res,rej)=>c!.toBlob(b=>b?res(b):rej(Error('Der Browser konnte das Bild nicht erzeugen.')),'image/png'));
    return {data:new Uint8Array(await blob.arrayBuffer()),ext:'png',widthPx:c.width,heightPx:c.height};}
  finally{URL.revokeObjectURL(url);if(c){c.width=1;c.height=1;}c=null;}
}
async function wandExport(kind:'docx'|'csv'){
  if(!project||busy)return;const title=input('wand-anlage').value.trim()||'Anlage';try{localStorage.setItem(wandKey(),title);}catch{/* ohne Speicher */}
  busy=true;const buttons=[$<HTMLButtonElement>('wand-word'),$<HTMLButtonElement>('wand-csv')];buttons.forEach(b=>b.disabled=true);
  try{
    if(folder&&!await flushFolder())throw Error(`Der Plan ist noch nicht in „${PLAENE}“ gespeichert. Bitte „Speichern“ und erneut versuchen.`);
    wandDaten=await wandLaden();const {st,datei}=wandDaten,p1=$<HTMLSelectElement>('wand-p1').value,p2=$<HTMLSelectElement>('wand-p2').value;
    if(!st.waende.length&&!st.referenz.length)throw Error('Keine Bohrkerne zum Darstellen.');
    const created=new Date().toISOString(),app=`PlanKit ${$('app-version').textContent?.replace(/^v/,'')}`,source=folder?`${PLAENE}/${projectFileName(folder)}`:'PlanKit-Projekt';
    let bytes:Uint8Array;
    if(kind==='docx'){const bilder=new Map<string,WandBildDatei>();for(const w of st.waende){const b=wandSvg(project,w,p1,{titel:false,anteil:kwPaar(p1,p2)});bilder.set(w.key,await svgPng(b.svg,b.width,b.height));}
      bytes=buildDocx({title:`${title}: Bohrkerne – Wandansichten`,author:app,application:app,created,blocks:wandBlocks(project,st,bilder,p1,p2,{title,nr:folder?.nr||project.report||'',ort:folder?.ort||'',projectData,created,app,source,labelkit:datei,hinweis:vorlaeufigText(vorlaeufigeBerichte(project))})});}
    else bytes=new TextEncoder().encode(wandCSV(project,st,p1,p2));
    const d=new Date(),z=(n:number)=>String(n).padStart(2,'0'),date=`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`,nr=folder?.nr||project.report||'Probenplan';
    const hints=wandHinweise(st,p1),hint=hints.length?` · ${hints.length} Hinweis${hints.length===1?'':'e'}`:'';
    const saved=await saveDocument(folder!,taken=>wandName(nr,kind,date,taken),bytes,source,app,created);
    toast(`Wandansichten gespeichert: ${ANNEX_DIR}/${saved.name}${hint}`,!!hints.length);renderWand();
  }catch(e){fail(e);}finally{busy=false;buttons.forEach(b=>b.disabled=false);}
}
$('wand-word').onclick=()=>void wandExport('docx');
$('wand-csv').onclick=()=>void wandExport('csv');
function updateLabelUI(){const s=$('label-section');s.hidden=!project;if(!project)return;input('auto-labels').checked=autoLabels(project.plan);input('value-labels').checked=valueLabels(project.plan);input('surface-bars').checked=surfaceBars(project.plan);
  const manual=project.markers.filter(m=>m.kind==='sample'&&Math.hypot(m.x-m.lx,m.y-m.ly)>.01).length;$<HTMLButtonElement>('labels-reset').disabled=!manual;$('labels-reset').textContent=manual?`Schilder neu anordnen (${manual} von Hand)`:'Schilder neu anordnen';
  $('value-labels-note').textContent=hasValues(project)?'In der Ergebniskarte: Wertkästchen je Probe mit Wert wie im Prüfbericht, Einheit und Kategorie.':'Erst nach dem Import von Messwerten sichtbar (Ergebniskarte).';}
function setLabelOption(kind:'auto'|'values'|'surface',on:boolean){if(!project||cropping)return;
  mutate(p=>{if(kind==='surface'){if(on)delete p.plan.surfaceBars;else p.plan.surfaceBars=false;}else if(kind==='auto'){if(on)delete p.plan.autoLabels;else p.plan.autoLabels=false;}else{if(on)p.plan.valueLabels=true;else delete p.plan.valueLabels;}});
  if(kind==='values'&&on&&!showResults&&hasValues(project))toast('Messwerte erscheinen in der Ergebniskarte („Ergebnisse“, Taste K) und im Export „Ergebniskarte“.');}
input('auto-labels').onchange=()=>setLabelOption('auto',input('auto-labels').checked);
input('value-labels').onchange=()=>setLabelOption('values',input('value-labels').checked);
input('surface-bars').onchange=()=>setLabelOption('surface',input('surface-bars').checked);
input('values-export').onchange=()=>setLabelOption('values',input('values-export').checked);
$('labels-reset').onclick=()=>{if(!project)return;const n=project.markers.filter(m=>m.kind==='sample'&&Math.hypot(m.x-m.lx,m.y-m.ly)>.01).length;if(!n)return;
  mutate(p=>{for(const m of p.markers)if(m.kind==='sample'){m.lx=m.x;m.ly=m.y;}});toast(`${n} Schild${n===1?'':'er'} wieder automatisch platziert. Rückgängig mit Strg+Z.`);};
function updateSizeUI(){const s=$('size-section');s.hidden=!project;if(!project)return;const pct=Math.round(markerScale(project)*100);input('marker-size').value=String(pct);$('size-value').textContent=`${pct} %`;}
/** Ändert die Punktgröße des aktuellen Plans. Aufeinanderfolgende Änderungen (Ziehen, Tastenwiederholung) ergeben einen Rückgängig-Schritt. */
function setMarkerScale(value:number){
  if(!project||cropping)return;const v=Math.min(MARKER_SCALE.max,Math.max(MARKER_SCALE.min,Math.round(value*20)/20));if(v===markerScale(project))return;
  if(Date.now()-sizeUndoAt>1200)history.push(project);sizeUndoAt=Date.now();
  if(v===1)delete project.plan.markerScale;else project.plan.markerScale=v;
  renderMarkers();updateSizeUI();clearTimeout(sizeTimer);sizeTimer=window.setTimeout(()=>{if(project)changed();},300);
}
input('marker-size').addEventListener('input',()=>setMarkerScale(Number(input('marker-size').value)/100));
// Nach dem Ziehen den Fokus abgeben, damit < > und Strg+Z sofort wieder funktionieren (Tastaturbedienung per Pfeiltasten bleibt möglich).
input('marker-size').addEventListener('pointerup',()=>input('marker-size').blur());
$('size-reset').onclick=()=>setMarkerScale(1);
// Maßstab je Plan (zwei Punkte + wahre Länge) und optionaler Nordpfeil für das maßstäbliche PDF.
$('size-section').insertAdjacentHTML('afterend','<section class="size-section" id="scale-section" hidden><div class="section-heading"><h2>Maßstab &amp; Norden</h2><span id="scale-value" class="size-value">–</span></div><p class="tiny" id="scale-status"></p><div class="size-row"><button id="measure-start" class="tb" title="Zwei Punkte einer bekannten Strecke anklicken, dann die Länge eingeben">📏 Strecke messen …</button><button id="scale-clear" class="tb" hidden>Maßstab entfernen</button></div><label class="check-row"><input type="checkbox" id="north-on"> Nordpfeil im PDF</label><div class="size-row" id="north-controls" hidden><button id="north-left" class="tb" title="15° gegen den Uhrzeigersinn">↺</button><input id="north-angle" type="number" min="0" max="359" step="1" aria-label="Nordrichtung in Grad (0 = oben, 90 = rechts)"><span>°</span><button id="north-right" class="tb" title="15° im Uhrzeigersinn">↻</button><svg id="north-preview" viewBox="-12 -12 24 24" width="28" height="28" aria-hidden="true"><circle r="11" fill="none" stroke="currentColor" stroke-width="1"/><g id="north-needle"><path d="M0-9 3 6 0 3Z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M0-9-3 6 0 3Z" fill="currentColor"/></g></svg></div><p class="tiny">Gilt je Plan. Norden: 0° = oben, 90° = rechts; beim Drehen des Plans dreht der Pfeil mit.</p></section>');
document.body.insertAdjacentHTML('beforeend','<dialog id="measure-dialog" aria-labelledby="measure-title"><form method="dialog" id="measure-form"><span class="eyebrow">MASSSTAB</span><h2 id="measure-title">Wie lang ist diese Strecke in Wirklichkeit?</h2><label>Länge in Metern<input id="measure-length" inputmode="decimal" autocomplete="off" placeholder="z. B. 4,85"></label><p class="tiny" id="measure-info"></p><p class="tiny error-text" id="measure-error" hidden></p><div class="dialog-actions"><button value="ok" class="primary" id="measure-ok">Maßstab übernehmen</button><button value="cancel" id="measure-cancel">Abbrechen</button></div></form></dialog>');
const measureLayer=document.createElementNS(ns,'g');measureLayer.id='measure-layer';measureLayer.setAttribute('pointer-events','none');svg.append(measureLayer);
const deNum=(n:number,digits=2)=>n.toLocaleString('de-DE',{maximumFractionDigits:digits});
/** Deutsche oder internationale Dezimalzahl (4,85 oder 4.85), ohne Tausendertrennzeichen. */
function parseMeters(text:string){const t=text.trim().replace(/\s*m$/i,'');if(!/^\d{1,6}([.,]\d{1,4})?$/.test(t))return null;const v=Number(t.replace(',','.'));return v>0&&v<=100_000?v:null;}
function renderMeasure(){
  if(!measurePoints.length){measureLayer.innerHTML='';return;}
  const r=camera.width/Math.max(1,svg.clientWidth)*6,[a,b]=measurePoints;
  measureLayer.innerHTML=`${b?`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="white" stroke-width="${r*.9}"/><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#c0392b" stroke-width="${r*.4}" stroke-dasharray="${r*1.5} ${r}"/>`:''}${measurePoints.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="white" stroke="#c0392b" stroke-width="${r*.4}"/>`).join('')}`;
}
function measureClick(pt:Point){
  if(!project)return;if(pt.x<0||pt.y<0||pt.x>project.plan.width||pt.y>project.plan.height){toast('Bitte innerhalb des Grundrisses messen.');return;}
  if(measurePoints.length>=2)measurePoints=[];measurePoints.push(pt);renderMeasure();
  if(measurePoints.length===1){$('mode-hint').textContent='Strecke messen: zweiten Punkt anklicken · Esc bricht ab';return;}
  const units=Math.hypot(measurePoints[1].x-measurePoints[0].x,measurePoints[1].y-measurePoints[0].y);
  if(units<Math.max(project.plan.width,project.plan.height)/200){measurePoints=[pt];renderMeasure();toast('Die Punkte liegen zu dicht beieinander. Bitte eine möglichst lange bekannte Strecke wählen.');return;}
  const mpu=metersPerUnit(project.plan);input('measure-length').value=mpu?deNum(units*mpu):'';
  $('measure-info').textContent=mpu?`Nach dem bisherigen Maßstab: ${deNum(units*mpu)} m. Zum Prüfen einfach abbrechen.`:'Je länger die Strecke, desto genauer der Maßstab – z. B. eine ganze Wand statt einer Tür.';
  $('measure-error').hidden=true;$<HTMLDialogElement>('measure-dialog').showModal();input('measure-length').select();
}
$('measure-form').addEventListener('submit',e=>{const submitter=(e as SubmitEvent).submitter as HTMLButtonElement|null;if(submitter?.value==='cancel')return;if(parseMeters(input('measure-length').value)===null){e.preventDefault();$('measure-error').textContent='Bitte eine Länge in Metern eingeben, z. B. 4,85.';$('measure-error').hidden=false;}});
$('measure-dialog').addEventListener('close',()=>{
  const dialog=$<HTMLDialogElement>('measure-dialog'),meters=parseMeters(input('measure-length').value);
  if(dialog.returnValue==='ok'&&meters!==null&&project&&measurePoints.length===2){const units=Math.hypot(measurePoints[1].x-measurePoints[0].x,measurePoints[1].y-measurePoints[0].y);
    mutate(p=>{p.plan.calibration={units,meters};});const b=bounds(project),mpu=meters/units;setMode('navigate');toast(`Maßstab gesetzt: Plan ca. ${deNum(b.width*mpu,1)} × ${deNum(b.height*mpu,1)} m. Rückgängig mit Strg+Z.`);}
  else{measurePoints=[];renderMeasure();if(mode==='measure')$('mode-hint').textContent='Strecke messen: ersten Punkt anklicken · Esc bricht ab';}
  dialog.returnValue='';
});
$('measure-start').onclick=()=>{if(!project||busy||cropping)return;setMode('measure');measurePoints=[];renderMeasure();toast('Zwei Punkte einer bekannten Strecke anklicken.');};
$('scale-clear').onclick=()=>{if(project?.plan.calibration)mutate(p=>{delete p.plan.calibration;});};
function setNorth(value:number|null){if(!project)return;const v=value===null?null:((Math.round(value)%360)+360)%360;if(v===northAngle(project.plan))return;mutate(p=>{if(v===null)delete p.plan.north;else p.plan.north=v;});}
input('north-on').addEventListener('change',()=>setNorth(input('north-on').checked?0:null));
input('north-angle').addEventListener('change',()=>{const v=Number(input('north-angle').value);if(Number.isFinite(v))setNorth(v);else updateScaleUI();});
$('north-left').onclick=()=>setNorth((northAngle(project!.plan)??0)-15);$('north-right').onclick=()=>setNorth((northAngle(project!.plan)??0)+15);
function updateScaleUI(){
  const sec=$('scale-section');sec.hidden=!project;if(!project)return;const plan=project.plan,mpu=metersPerUnit(plan),north=northAngle(plan);
  $('scale-value').textContent=mpu?'kalibriert':'–';$('scale-clear').hidden=!mpu;
  if(mpu){const b=bounds(project);$('scale-status').textContent=`Gemessen: ${deNum(plan.calibration!.meters)} m. Plan ca. ${deNum(b.width*mpu,1)} × ${deNum(b.height*mpu,1)} m. Prüfen: erneut messen, der bisherige Wert wird angezeigt.`;}
  else $('scale-status').textContent='Nicht kalibriert. Für maßstäbliche PDFs eine bekannte Strecke messen, z. B. eine Wandlänge.';
  input('north-on').checked=north!==null;$('north-controls').hidden=north===null;if(north!==null&&document.activeElement!==$('north-angle'))input('north-angle').value=String(Math.round(north));
  $('north-needle').setAttribute('transform',`rotate(${north??0})`);
}
document.querySelector('.panel-scroll')!.insertAdjacentHTML('afterbegin','<section class="results-section" id="results-section" hidden><div class="section-heading"><h2>Ergebniskarte</h2></div><label>Bewerteter Parameter<select id="result-param"></select></label><label>Nutzung / Referenz<select id="result-usage"><option value="">Eigene / FotoKit-Skala</option><option value="residential">VdS 2357 · Wohn-/Büroräume · 10 µg/m²</option><option value="industrial">VdS 2357 · Industrie · 100 µg/m²</option></select></label><p class="tiny" id="result-usage-hint" hidden></p><p class="tiny result-vorlaeufig" id="result-vorlaeufig" hidden></p><div id="result-scales"></div><p class="tiny">Kategorien aufsteigend: Ein Wert gehört zur letzten Kategorie, deren „ab“-Wert er erreicht; Unter BG nur bei „unter BG“ oder „&lt;“ mit gültiger Zahl. n.n.: Nicht nachgewiesen. n.b.: Nicht bestimmt / Bedeutung prüfen. Diese Angaben sind keine gemessenen Nullwerte; fehlerhafte „&lt;“-Angaben bleiben ohne Bewertung. Mehrdeutige Zahlen (z. B. 1.234) bleiben ohne Bewertung. Die Skalen gelten auch für die Ergebnistabelle in FotoKit. Farben werden im Projekt gespeichert. VdS 2357: Hintergrundreferenzen nur für Σ16 EPA-PAK auf Oberflächen, keine pauschalen Freigabe- oder Sanierungsgrenzwerte. Originalwerte und Einheiten bleiben erhalten.</p></section>');
document.querySelector('.canvas-footer')!.insertAdjacentHTML('beforeend','<span id="result-legend" hidden></span>');
let resultSignature='';
/** Ergebniskarte angelegt, bevor _Projekt.json gelesen war: die Nutzung wählt die Referenz nach, solange niemand selbst gewählt hat. */
let autoUsageFor='';
function renderResults(){
  const p=project,available=!!p&&hasValues(p);$<HTMLButtonElement>('results-toggle').disabled=!available||busy;
  if(!available&&showResults)showResults=false;
  $('results-toggle').setAttribute('aria-pressed',String(showResults));$('results-section').hidden=!showResults;
  $('view-field').hidden=!p;const opt=$<HTMLOptionElement>('view-results');opt.disabled=!available;opt.textContent=available?'Ergebniskarte':'Ergebniskarte (erst nach Import der Laborwerte)';if(!available)input('view').value='plan';
  const legend=$('result-legend');legend.hidden=!showResults;
  if(!p||!showResults){resultSignature='';return;}
  const settings=p.results,list=parameters(p),rated=rateMarkers(p);
  legend.innerHTML=rated.groups.flatMap(g=>g.scale?g.scale.cats.map(c=>`<span><i style="background:${c.color}"></i>${escape(c.name)}</span>`):[]).join('')+qualifierGroups(rated).map(g=>`<span><i style="background:${g.color}"></i>${escape(g.name)}</span>`).join('')+(rated.unrated.length?`<span><i style="background:${UNRATED}"></i>ohne Bewertung</span>`:'');
  const signature=JSON.stringify([getNutzung(),settings,list,rated.groups.map(g=>g.cats.map(c=>c.labels)),rated.unrated,rated.below,rated.notDetected,rated.notDetermined]);if(signature===resultSignature)return;resultSignature=signature;
  const select=input('result-param') as unknown as HTMLSelectElement;select.innerHTML=list.map(x=>`<option value="${escape(x)}">${escape(x)}</option>`).join('');select.value=settings?.parameter||'';
  (input('result-usage') as unknown as HTMLSelectElement).value=settings?.usage||'';
  {const n=getNutzung(),u=usageFromNutzung(n),hint=$('result-usage-hint');hint.hidden=!n;hint.textContent=n?`Nutzung laut Projektdaten: ${n}${u&&u!==settings?.usage?' – passende Referenz: '+(u==='industrial'?'Industrie':'Wohn-/Büroräume'):''}`:'';}
  {const t=vorlaeufigText(vorlaeufigeBerichte(p)),el=$('result-vorlaeufig');el.hidden=!t;el.textContent=t?`⚠ ${t}`:'';}
  const parameter=settings?.parameter||'';
  $('result-scales').innerHTML=units(p,parameter).map(unit=>{
    const key=scaleKey(parameter,unit),eff=scaleFor(settings,parameter,unit),scale=eff.scale,group=rated.groups.find(g=>g.key===key);
    const herkunft=eff.vds?(eff.angepasst?`<p class="tiny">Angepasst aus „${escape(eff.vds.name)}“ – gilt nur in diesem Projekt.</p>`:`<p class="tiny">VdS-Referenz „${escape(eff.vds.name)}“. Änderungen hier ergeben eine angepasste Skala für dieses Projekt.</p>`):settings?.usage?'<p class="tiny">Keine VdS-Referenz für diesen Parameter / diese Einheit – es gilt die eigene Skala.</p>':'';
    if(!scale)return `<div class="result-scale" data-key="${escape(key)}"><h3>${escape(shortParameter(parameter))} in ${escape(unit||'(ohne Einheit)')}</h3>${herkunft}<p class="tiny">Noch keine Bewertungsskala – die Proben bleiben grau.</p><div class="inspector-actions"><button data-scale-new>Skala anlegen</button>${fromShared(key)?'<button data-scale-shared>Aus FotoKit übernehmen</button>':''}</div></div>`;
    return `<div class="result-scale" data-key="${escape(key)}"><h3>${escape(shortParameter(parameter))} in ${escape(unit||'(ohne Einheit)')}</h3>${herkunft}<label class="scale-name">Name der Skala <span class="optional">optional</span><input data-scale-name maxlength="160" value="${escape(scale.name)}" placeholder="z. B. PAK Wischproben, Stand 10/2026"></label>
      <table class="scale-table"><thead><tr><th></th><th>Kategorie</th><th>ab ${escape(unit)}</th><th></th></tr></thead><tbody>${scale.cats.map((c,i)=>`<tr data-cat="${i}"><td><input type="color" data-cat-color value="${c.color}" aria-label="Farbe ${escape(c.name)}"></td><td><input data-cat-name maxlength="60" value="${escape(c.name)}" aria-label="Kategorie ${i+1}"></td><td><input data-cat-from type="number" step="any" min="0" value="${c.from}" ${i===0?'disabled':''} aria-label="ab-Wert Kategorie ${i+1}"></td><td>${i?`<button data-cat-del title="Kategorie entfernen" aria-label="Kategorie entfernen">×</button>`:''}</td></tr><tr class="cat-samples"><td></td><td colspan="3">${escape(rangeText(scale,i,unit))}${group?.cats[i]?.labels.length?` · ${escape(group.cats[i].labels.join(', '))}`:''}</td></tr>`).join('')}</tbody></table>
      <div class="inspector-actions"><button data-cat-add ${scale.cats.length>=12?'disabled':''}>＋ Kategorie</button><button data-scale-auto title="Farben von grün (unterste) bis rot (oberste Kategorie)">Farben automatisch</button>${eff.vds?(eff.angepasst?'<button data-scale-del>Zurück zur VdS-Referenz</button>':''):'<button data-scale-del class="danger">Skala entfernen</button>'}</div></div>`;
  }).join('')+qualifierGroups(rated).map(g=>`<p class="tiny">${escape(g.name)}: ${escape(g.labels.join(', '))}</p>`).join('')+(rated.unrated.length?`<p class="tiny">Ohne Bewertung (grau): ${escape(rated.unrated.join(', '))}</p>`:'');
}
const keyParts=(key:string)=>{const i=key.lastIndexOf('|');return [key.slice(0,i),key.slice(i+1)] as const;};
/** Skala speichern. Bei einer VdS-Referenz wird daraus eine angepasste Skala (nur im Projekt, nicht für FotoKit); null führt zur Referenz zurück. */
function setScale(key:string,scale:Scale|null){if(!project?.results)return;const [parameter,unit]=keyParts(key),vds=!!scaleFor(project.results,parameter,unit).vds;
  mutate(p=>{const r=p.results!;
    if(vds){const v={...r.vds};if(scale)v[key]=scale;else delete v[key];if(Object.keys(v).length)r.vds=v;else delete r.vds;}
    else if(scale)r.scales[key]=scale;else delete r.scales[key];});
  if(!vds)saveShared(key,scale);}
function currentScale(key:string){const [parameter,unit]=keyParts(key);return scaleFor(project?.results,parameter,unit).scale;}
function recolor(scale:Scale):Scale{const colors=autoColors(scale.cats.length);return {...scale,cats:scale.cats.map((c,i)=>({...c,color:colors[i]}))};}
$('results-toggle').onclick=()=>{if(!project||!hasValues(project))return;showResults=!showResults;const fresh=!project.results;if(showResults&&prepare(project))persist();if(fresh&&project.results&&!project.results.usage&&!getNutzung()&&folder)autoUsageFor=folder.name;render();if(showResults)reveal('results-section');};
(input('result-param') as unknown as HTMLSelectElement).onchange=()=>{const value=input('result-param').value;mutate(p=>{p.results={...p.results,parameter:value,scales:p.results?.scales||{}};prepare(p);});};
(input('result-usage') as unknown as HTMLSelectElement).onchange=()=>{autoUsageFor='';const usage=input('result-usage').value;mutate(p=>{if(!p.results)return;if(usage==='residential'||usage==='industrial')p.results.usage=usage;else delete p.results.usage;});};
$('result-scales').addEventListener('click',e=>{
  const t=e.target as HTMLElement,box=t.closest<HTMLElement>('[data-key]');if(!box||!project?.results)return;const key=box.dataset.key!,scale=currentScale(key);
  if(t.closest('[data-scale-new]')){const s:Scale={name:'',cats:[{name:'unauffällig',from:0,color:''},{name:'auffällig',from:1,color:''}]};setScale(key,recolor(s));toast('Skala angelegt – „ab“-Werte und Namen bitte an Ihre Vorgaben anpassen.');}
  else if(t.closest('[data-scale-shared]')){const s=fromShared(key);if(s)setScale(key,s);}
  else if(!scale)return;
  else if(t.closest('[data-cat-add]')){const last=scale.cats[scale.cats.length-1];setScale(key,recolor({...scale,cats:[...scale.cats,{name:`Kategorie ${scale.cats.length+1}`,from:last.from>0?last.from*2:1,color:''}]}));}
  else if(t.closest('[data-cat-del]')){const i=Number(t.closest<HTMLElement>('[data-cat]')!.dataset.cat);setScale(key,recolor({...scale,cats:scale.cats.filter((_,j)=>j!==i)}));}
  else if(t.closest('[data-scale-auto]'))setScale(key,recolor(scale));
  else if(t.closest('[data-scale-del]'))setScale(key,null);
});
$('result-scales').addEventListener('change',e=>{
  const t=e.target as HTMLInputElement,box=t.closest<HTMLElement>('[data-key]');if(!box||!project?.results)return;const key=box.dataset.key!,scale=currentScale(key);if(!scale)return;
  if(t.matches('[data-scale-name]')){setScale(key,{...scale,name:t.value.trim().slice(0,160)});return;}
  const i=Number(t.closest<HTMLElement>('[data-cat]')?.dataset.cat);if(!Number.isInteger(i))return;const cats=scale.cats.map(c=>({...c}));
  if(t.matches('[data-cat-color]')){if(/^#[0-9a-f]{6}$/i.test(t.value))cats[i].color=t.value.toLowerCase();}
  else if(t.matches('[data-cat-name]')){const name=t.value.trim().slice(0,60);if(!name){toast('Bitte einen Namen für die Kategorie eingeben.',true);resultSignature='';render();return;}cats[i].name=name;}
  else if(t.matches('[data-cat-from]')){const v=Number(t.value);if(!Number.isFinite(v)||v<0){toast('Bitte einen Zahlenwert ≥ 0 eingeben.',true);resultSignature='';render();return;}cats[i].from=v;cats.sort((a,b)=>a.from-b.from);cats[0].from=0;}
  setScale(key,{...scale,cats});
});
document.querySelector('#help-dialog h3')!.insertAdjacentHTML('beforebegin','<h3>Ergebniskarte</h3><p>Chlorid wird nach VdS 2357 bewertet (5–10 µg/cm² korrosionschemisch relevante Größenordnung: grün unter 5, amber 5 bis unter 10, rot ab 10 µg/cm²) – unabhängig von der Nutzung; anpassbar wie die PAK-Referenz. Nach dem Import einer Labor-XML speichert PlanKit die Messwerte je Probe (nur lokal). „Ergebnisse“ in der Kopfzeile (Taste <b>K</b>) färbt die Probenmarker nach Ihrer Bewertungsskala; Proben ohne Wert oder Skala bleiben grau. Ist eine Nutzung gewählt und gibt es für den Parameter eine VdS-Referenz, gilt sie; sonst Ihre eigene Skala. Beide lassen sich bearbeiten (eine geänderte VdS-Referenz gilt nur in diesem Projekt). Parameter (Standard Σ16 EPA-PAK) und Skala je Einheit stellen Sie in der Liste rechts ein – dieselben Skalen nutzt FotoKit für die Ergebnistabelle. Beim Export „Darstellung: Ergebniskarte“ wählen; die Legende nennt Kategorien, Wertebereiche und Probennummern. Ältere Projekte: dieselbe XML erneut importieren und „Aktualisieren“ wählen, dann erhalten bereits platzierte Proben ihre Werte.</p>');

// ---- Projektordner (Projektzentrale) ----
// Mit ?projekt=<Ordnername> oder „Projekt …“ arbeitet PlanKit direkt im Ordner „Pläne“ des Projekts:
// automatisches Speichern als „Probenplan <Projekt>.probenplan“, Bilder ebenfalls dorthin, Laborberichte aus „Laborergebnisse“.
let folder:ProjectFolder|null=null,folderRevision:string|null=null,folderDirty=false,folderTimer=0,folderBlocked=false,projectData:Record<string,unknown>={};
let folderWriting:Promise<void>=Promise.resolve();
let folderOpening=0;
const projectReader=createProjectDataReader(projectDataChanged);
(window as any).SpektronProjectData=(name:string)=>folder?.name===name?projectReader.state:null;
/** No replacement may overwrite the only browser draft of unsaved folder work. */
async function preserveUnsavedProject(){
 while(folder&&project&&folderDirty){
  const f=folder,generation=saveRevision;
  await writeProjectCopy(f,'Wiederherstellung',JSON.stringify(clone(project)));
  if(folder===f&&saveRevision===generation)return;
 }
}
const folderKey=(f:ProjectFolder)=>`projekt:${f.name}`;
const clock=(t:number)=>new Date(t).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
document.querySelector('#app-version')!.insertAdjacentHTML('afterend','<button id="project-badge" class="project-badge" type="button" aria-label="Gemeinsame Projektdaten neu einlesen" hidden></button>');
$('file-actions').insertAdjacentHTML('afterbegin','<button id="open-folder" class="tb" title="Projektordner wählen (z. B. „26.0123 Köln“) – PlanKit speichert dann direkt in dessen Ordner „Pläne“">📁 Projekt</button>');
$('open-folder').hidden=!folderSupported();
document.querySelector('.topbar')!.insertAdjacentHTML('afterend','<div id="project-data-warning" class="project-data-warning" role="alert" hidden><span id="project-data-warning-text"></span><button id="project-data-retry">Erneut einlesen</button></div><div id="resultkit-warning" class="project-data-warning" role="status" hidden><span id="resultkit-warning-text"></span><button id="resultkit-warning-go">Proben übernehmen …</button></div>');
// ---- Plan hinter ResultKit? „Laborergebnisse/_Ergebnisse.json“ beim Öffnen, beim Zurückkommen ins Fenster und alle 20 s lesen;
// die Warnleiste vergleicht sie bei jedem Zeichnen mit den Prüfberichten, aus denen der Plan Werte zeigt. Nur Hinweis – nichts wird still geändert.
let resultkitStand:{folder:ProjectFolder;e:Ergebnisse}|null=null;
async function resultkitLesen(){
  const f=folder;if(!f){resultkitStand=null;resultkitHinweisZeigen();return;}
  let e:Ergebnisse|null=null;
  try{const dir=await findSubdir(f.dir,LABOR),datei=dir?await fileInfo(dir,ERGEBNIS_DATEI):null;if(datei)e=liesErgebnisse(await datei.text());}catch{e=null;}   // unlesbar: meldet „Proben übernehmen …“ selbst
  if(folder!==f)return;
  resultkitStand=e&&(!e.projekt||e.projekt===f.nr)?{folder:f,e}:null;resultkitHinweisZeigen();
}
function resultkitHinweisZeigen(){
  const leiste=document.getElementById('resultkit-warning');if(!leiste)return;
  const st=resultkitStand,text=st&&project&&st.folder===folder?hinterText(planHinterResultKit(verwendeteBerichte(project),project.labReports||[],st.e)):'';
  leiste.hidden=!text;if(text&&$('resultkit-warning-text').textContent!==`⚠ ${text}`)$('resultkit-warning-text').textContent=`⚠ ${text}`;
}
for(const id of ['project-badge','project-data-retry'])$(id).onclick=()=>void refreshProjectData(true);
document.querySelector('#welcome-load')!.insertAdjacentHTML('afterend','<div id="folder-prompt" class="folder-prompt" hidden><p id="folder-prompt-text"></p><button id="folder-allow" class="primary">Zugriff erlauben und Projekt öffnen</button></div><div id="folder-plans" class="folder-plans" hidden></div>');
document.body.insertAdjacentHTML('beforeend','<dialog id="ask-dialog"><h2 id="ask-title"></h2><p id="ask-text"></p><div class="dialog-actions" id="ask-actions"></div></dialog><dialog id="lab-folder-dialog"><form method="dialog"><button class="close" aria-label="Schließen">×</button></form><span class="eyebrow">PROBEN ÜBERNEHMEN</span><h2>Welche Proben übernehmen?</h2><p class="muted">Die Probenerfassung aus LabelKit oder ein in ResultKit geprüfter Prüfbericht mit Messwerten.</p><div id="lab-folder-list"></div><div class="dialog-actions"><button id="lab-folder-other">Andere Datei …</button></div></dialog>');
function ask(title:string,text:string,choices:string[]):Promise<string>{return new Promise(resolve=>{const d=$<HTMLDialogElement>('ask-dialog');$('ask-title').textContent=title;$('ask-text').textContent=text;$('ask-actions').replaceChildren(...choices.map((c,i)=>{const b=document.createElement('button');b.textContent=c;if(i===choices.length-1)b.className='primary';b.onclick=()=>{d.close();resolve(c);};return b;}));d.oncancel=e=>{e.preventDefault();};d.showModal();});}
/** No silent 30-file cutoff: all readable versions remain reachable, in pages of 20. */
async function chooseStoredVersion(target:ProjectFolder,revision:string|null,hasMain:boolean,exclude:string|null){
 const versions:{name:string;handle:FileSystemFileHandle;revision:string|null}[]=[],seen=new Set<string>(),invalid:string[]=[];
 for(const candidate of await listFiles(target.plaene,/\.probenplan$/i)){
  if(candidate.name===projectFileName(target)||candidate.name===exclude)continue;
  try{
   const file=await candidate.handle.getFile(),hash=await fileRevision(file);
   if(hasMain&&hash===revision||hash&&seen.has(hash))continue;
   await validateProject(JSON.parse(await file.text()));if(hash)seen.add(hash);versions.push({name:candidate.name,handle:candidate.handle,revision:hash});
  }catch{invalid.push(candidate.name);}
 }
 if(!versions.length&&!invalid.length&&!(!hasMain&&revision))return undefined;
 let page=0;
 for(;;){
  const names=versions.slice(page*20,(page+1)*20).map(x=>x.name),pages=Math.max(1,Math.ceil(versions.length/20));
  const choice=await ask(hasMain?'Gespeicherte Fassungen prüfen':'Projektdatei fehlt oder ist beschädigt',`${versions.length} abweichende Fassung(en), Seite ${page+1} von ${pages}. Sie können von früheren, parallelen oder unterbrochenen Speicherungen stammen. Eine Fassung nur zur Prüfung öffnen; keine automatische Zusammenführung und kein Überschreiben.${invalid.length?` ${invalid.length} unlesbare/beschädigte Datei(en) bleiben unverändert: ${invalid.join(', ')}.`:''}`,['Abbrechen',...(hasMain?['Datei verwenden']:[]),...names,...(page?['Vorherige Seite']:[]),...(page+1<pages?['Weitere Fassungen']:[])]);
  if(choice==='Abbrechen')return null;
  if(choice==='Datei verwenden')return undefined;
  if(choice==='Weitere Fassungen'){page++;continue;}if(choice==='Vorherige Seite'){page--;continue;}
  const selected=versions.find(x=>x.name===choice);if(!selected)return undefined;
  const file=await selected.handle.getFile();if(await fileRevision(file)!==selected.revision)throw Error('Die gewählte Sicherungsfassung wurde während der Auswahl verändert. Bitte den Projektordner erneut öffnen und die Fassungen prüfen.');
  return validateProject(JSON.parse(await file.text()));
 }
}
function footerExtra(){const o=String(projectData.objekt||'').trim();return o?`Objekt ${o}`:'';}
function showFolder(){$('emergency-copy').hidden=!folder;const b=$('project-badge');b.hidden=!folder;document.body.classList.toggle('in-project',!!folder);if(folder){b.innerHTML=`<b>${escape(folder.nr)}</b> ${escape(folder.ort)}`;b.title=`Projektordner „${folder.name}“ – PlanKit speichert in „${PLAENE}“`;document.title=`${folder.name} · PlanKit`;}}
function scheduleFolderSave(){clearTimeout(folderTimer);$('saved').textContent=`Wird in „${PLAENE}“ gespeichert …`;folderTimer=window.setTimeout(()=>void saveToFolder(false),700);}
async function flushFolder(){if(folderTimer){clearTimeout(folderTimer);folderTimer=0;await saveToFolder(false);}await folderWriting.catch(()=>{});await saveQueue.catch(()=>{});return !folderDirty;}
function saveToFolder(explicit:boolean){
 clearTimeout(folderTimer);folderTimer=0;const f=folder;if(!f||!project||(folderBlocked&&!explicit))return folderWriting;
 // Request permission while still in the Save button's user gesture.
 const access=permission(f.dir,explicit),snapshot=clone(project),generation=saveRevision;
 folderWriting=folderWriting.catch(()=>{}).then(async()=>{
  if(folder!==f||generation!==saveRevision||(folderBlocked&&!explicit))return;
  try{
   if(!await access)throw Error('Schreibzugriff fehlt. Bitte „Speichern“ klicken und Zugriff erlauben.');
   let expected=folderRevision;
   for(;;){
    try{
     const result=await saveFolderProject(f,JSON.stringify(snapshot),expected);folderRevision=result.revision;folderBlocked=false;
     if(folder===f&&generation===saveRevision){folderDirty=false;$('saved').textContent=`✓ In „${PLAENE}“ gespeichert`;
      saveQueue=saveQueue.catch(()=>{}).then(async()=>{if(folder===f&&generation===saveRevision)await saveLocal({savedAt:Date.now(),project:snapshot,dirty:false,baseRevision:result.revision},folderKey(f));}).catch(()=>{if(folder===f&&generation===saveRevision)toast('Projektdatei gespeichert; die zusätzliche Browsersicherung ist fehlgeschlagen.',true);});
     }
     if(explicit&&folder===f&&generation===saveRevision){toast(`Gespeichert: ${PLAENE}/${projectFileName(f)}`);savedToastRevision=generation;}return;
    }catch(e){
     if(!(e instanceof FolderConflict))throw e;
     folderBlocked=true;$('saved').textContent='⚠ Datei wurde andernorts geändert';
     await preserveUnsavedProject(); // Verified recovery exists before offering a destructive choice.
     const choice=await ask('Plan wurde zwischenzeitlich geändert',`„${projectFileName(f)}“ wurde an anderer Stelle gespeichert, ersetzt oder gelöscht. Was soll mit Ihren Änderungen geschehen?`,['Abbrechen','Andere Fassung laden','Meine Fassung als Kopie sichern','Meine Fassung übernehmen']);
     if(choice==='Abbrechen')return;
     if(choice==='Andere Fassung laden'){await reloadFromFolder();return;}
     if(choice==='Meine Fassung als Kopie sichern'){const copy=await writeProjectCopy(f,'Kopie',JSON.stringify(snapshot));await reloadFromFolder();toast(`Ihre Fassung liegt als „${copy}“ in „${PLAENE}“.`);return;}
     // Die Fassung des Kollegen wird gleich überschrieben: vorher dauerhaft sichern (nie automatisch gelöscht)
     // frisch lesen (eine File-Momentaufnahme wird ungültig, sobald die Datei erneut geändert wurde); hat sie sich inzwischen
     // wieder geändert, fragt die nächste Runde ohnehin erneut – gesichert wird genau die Fassung, die überschrieben wird
     {const cur=await fileInfo(f.plaene,projectFileName(f));if(cur&&await fileRevision(cur)===e.revision)await writeProjectCopy(f,ERSETZEN_KOPIE,await cur.text());}
     expected=e.revision; // If changed again while deciding, ask again; never silently overwrite it.
    }
   }
  }catch(e){if(folder===f){folderBlocked=true;$('saved').textContent=`⚠ Nicht im Projektordner gespeichert`;toast(`Speichern in „${PLAENE}“ fehlgeschlagen: ${e instanceof Error?e.message:'unbekannter Fehler'}. Änderungen bleiben geöffnet. Bitte „Speichern“ erneut versuchen oder eine Notfallkopie herunterladen.`,true);}}
 });return folderWriting;
}
async function reloadFromFolder(){
 if(!folder)return false;
 try{const file=await fileInfo(folder.plaene,projectFileName(folder));if(!file)throw Error('Projektdatei fehlt. Ihre Änderungen bleiben geöffnet.');
  const next=await validateProject(JSON.parse(await file.text())),revision=await fileRevision(file);await install(next,true,()=>{folderRevision=revision;folderDirty=false;folderBlocked=false;});$('saved').textContent=`✓ Aus „${PLAENE}“ geladen`;return true;
 }catch(e){fail(e);return false;}
}
// Browser data is saved continuously; an unload warning covers writes still in flight.
window.addEventListener('beforeunload',e=>{if(folder&&folderDirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&folderDirty&&!folderBlocked)void saveToFolder(false);});
/** Projektdaten (_Projekt.json: Objekt, Schadendatum …) ändern sich auch in Projektzentrale oder bei Kollegen – beim Zurückkehren ins Fenster neu lesen,
 *  sonst steht im Schriftfeld, in der Fußzeile und in der Anlage das alte Objekt. Eine kurz leere/halb geschriebene Datei ersetzt vorhandene Angaben nicht. */
function projectDataChanged(){
  const status=projectReader.state,before=getNutzung();projectData=status.data;setNutzung(projectData.nutzung);
  if(autoUsageFor&&autoUsageFor===folder?.name&&project?.results&&!project.results.usage){const usage=usageFromNutzung();if(usage){autoUsageFor='';mutate(p=>{if(p.results&&!p.results.usage)p.results.usage=usage;});}}
  else if(getNutzung()!==before&&showResults){resultSignature='';renderResults();}
  const warning=$('project-data-warning'),text=$('project-data-warning-text'),button=$<HTMLButtonElement>('project-badge');
  warning.hidden=!folder||!status.stale;text.textContent=projectDataWarning(status);
  button.disabled=status.checking;button.setAttribute('aria-busy',String(status.checking));
  button.title=(status.status==='missing'&&!status.stale?'Keine _Projekt.json im erreichbaren Projektordner vorhanden. ':projectDataWarning(status)+' ')+'Gemeinsame Projektdaten ausdrücklich neu einlesen';
  button.dataset.status=status.status;button.dataset.stale=String(status.stale);
  try{(window as any).MosaikLeiste?.aktualisieren();}catch{/* Anzeige wird beim nächsten Leistenlauf erneuert. */}
}
async function refreshProjectData(request=false){projectReader.select(folder);void skalenAbgleich();   // gemeinsame Bewertungsskalen des Büros (Archivordner)
  return projectReader.refresh(request);}
async function projectDataForExport(){
  const f=folder;if(!f)return true;
  if(!await refreshProjectData()||folder!==f)return false;
  if(!projectReader.state.stale)return true;
  const status=projectReader.state;
  const choice=await ask('Gemeinsame Projektdaten möglicherweise veraltet',projectDataWarning(status),['Abbrechen','Für diesen Export ausdrücklich verwenden']);
  return folder===f&&projectReader.state===status&&choice==='Für diesen Export ausdrücklich verwenden';
}
window.addEventListener('focus',()=>{void refreshProjectData();void resultkitLesen();});
setInterval(()=>{if(!document.hidden&&!busy&&folder&&!projectReader.state.checking)void refreshProjectData();if(!document.hidden&&folder)void resultkitLesen();},20000);
$('resultkit-warning-go').onclick=()=>$('lab-import').click();
$('save-project').insertAdjacentHTML('afterend','<button id="emergency-copy" class="tb" title="Geöffnete Fassung zusätzlich als Datei herunterladen" hidden>Notfallkopie</button>');
$('emergency-copy').onclick=()=>{if(project)void download(new Blob([JSON.stringify(project)],{type:'application/json'}),`PlanKit Notfallkopie ${folder?.name||project.report||'Projekt'} ${Date.now()}.probenplan`);};
async function renderFolderPlans(){
  const box=$('folder-plans');if(!folder||project){box.hidden=true;return;}
  const files=(await listFiles(folder.plaene,/\.(pdf|svg|png|jpe?g|zip)$/i)).filter(f=>!/^Probenplan /i.test(f.name)).slice(0,8);
  box.hidden=!files.length;box.innerHTML=files.length?`<span class="eyebrow">AUS „${escape(PLAENE.toUpperCase())}“</span>`+files.map((f,i)=>`<button data-plan-file="${i}">${escape(f.name)}</button>`).join(''):'';
  box.onclick=async e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-plan-file]');if(!b)return;const f=files[Number(b.dataset.planFile)];await importFile(await f.handle.getFile());};
}
async function enterFolder(dir:Parameters<typeof openFolder>[0]){
  const entering=++folderOpening;
  if(!await permission(dir,true)){toast('Ohne Schreibrecht auf den Projektordner kann PlanKit dort nicht speichern.',true);return;}
  let opened=await openFolder(dir,false);
  if(opened==='no-plaene'){if(await ask(`Ordner „${PLAENE}“ anlegen?`,`Im Projekt „${dir.name}“ gibt es noch keinen Unterordner „${PLAENE}“.`,['Abbrechen','Anlegen'])!=='Anlegen')return;opened=await openFolder(dir,true) as ProjectFolder;}
  const target=opened;if(!await flushFolder()){if(await ask('Ungespeicherte Änderungen','Vor dem Wechsel muss eine geprüfte Wiederherstellungsdatei Ihrer aktuellen Fassung angelegt werden.',['Abbrechen','Sichern und wechseln'])!=='Sichern und wechseln')return;await preserveUnsavedProject();}
  if(project&&!folder&&!await allowReplace())return;
  const canonical=await fileInfo(target.plaene,projectFileName(target));let file=canonical,next:Project|null=null,recovered=false,preservedBrowserDraft:string|null=null;
  if(file){try{next=await validateProject(JSON.parse(await file.text()));}catch{/* Offer explicit recovery below; never overwrite a damaged file automatically. */}}
  const local=await restoreLocal(folderKey(target)).catch(()=>null) as {savedAt:number;project:Project;dirty?:boolean;baseRevision?:string|null}|null;
  const currentRevision=await fileRevision(canonical);
  const localDiffers=local?.project&&JSON.stringify(local.project)!==JSON.stringify(next);
  if(localDiffers&&(local?.dirty||local?.baseRevision===undefined||!next)){
   const choice=await ask('Ungespeicherte Browser-Fassung',`Für „${target.name}“ liegt eine abweichende Browsersicherung vor. Sie kann von einem unterbrochenen Speichern stammen.`,['Abbrechen','Datei verwenden','Browser-Fassung verwenden']);
   if(choice==='Abbrechen')return;
   if(choice==='Datei verwenden'){try{preservedBrowserDraft=await writeProjectCopy(target,'Wiederherstellung',JSON.stringify(local!.project));}catch(e){fail(e);return;}}
   if(choice==='Browser-Fassung verwenden'){try{next=await validateProject(local!.project);recovered=true;}catch(e){fail(e);return;}}
  }
  if(!recovered){
   const selected=await chooseStoredVersion(target,currentRevision,!!next,preservedBrowserDraft);if(selected===null)return;
   if(selected){next=selected;recovered=true;}
  }
  const transition=()=>{if(entering!==folderOpening)throw Error('Ein neuerer Projektwechsel ist bereits aktiv.');folder=target;folderRevision=currentRevision;folderDirty=recovered;folderBlocked=false;projectReader.select(target);};
  if(entering!==folderOpening)return;
  if(next){if(!next.report)next.report=target.name;await install(next,true,transition);$('saved').textContent=recovered?'Wiederhergestellt – bitte prüfen und „Speichern“ klicken':`✓ Aus „${PLAENE}“ geladen`;}
  else{await preserveUnsavedProject();transition();labUI?.reset();project=null;history.clear();render();$('saved').textContent=`Projekt ${target.name}`;}
  showFolder();void refreshProjectData();resultkitStand=null;void resultkitLesen();$('folder-prompt').hidden=true;await renderFolderPlans();
  PROJEKT_URL.setzen(target.name);
  (window as any).MosaikLeiste?.aktualisieren();
  toast(next?`Projekt ${target.name}: Probenplan aus „${PLAENE}“ geöffnet.`:`Projekt ${target.name}: noch kein Probenplan – Grundriss wählen.`);
}
async function openFromZentrale(name:string){
  const root=await archiv();
  if(!root){toast(`Projekt „${name}“: Der Archivordner ist in diesem Browser nicht bekannt. Bitte in der Projektzentrale einmal den Archivordner wählen – oder hier „📁 Projekt …“.`,true);return;}
  const go=async()=>{try{await enterFolder(await root.getDirectoryHandle(name) as Parameters<typeof openFolder>[0]);startAction();}catch(e){toast(`Projekt „${name}“ nicht gefunden in „${root.name}“: ${e instanceof Error?e.message:''}`,true);}};
  if(await permission(root)){await go();return;}
  $('folder-prompt-text').innerHTML=`Projekt <b>${escape(name)}</b> aus der Projektzentrale`;$('folder-prompt').hidden=false;
  $('folder-allow').onclick=async()=>{if(await permission(root,true))await go();else toast('Ohne Zugriff auf den Archivordner kann das Projekt nicht geöffnet werden.',true);};
}
$('open-folder').onclick=async()=>{if(busy||cropping||!requireFinished())return;try{const dir=await pickFolder();if(!dir)return;const projectDir=await projectDirOf(dir);if(!projectDir){toast('Bitte den Projektordner (z. B. „26.0123 Köln“) oder dessen Ordner „Pläne“ wählen.',true);return;}await enterFolder(projectDir);}catch(e){fail(e);}};
// Laborbericht im Projekt: Auswahl aus „Laborergebnisse“
$('lab-import').onclick=async()=>{
  if(!folder||!project){input('lab-files').click();return;}
  // Im Projekt kommen Messwerte nur noch aus ResultKit („Laborergebnisse/_Ergebnisse.json“); LabelKit-Probenerfassung wie bisher.
  const target=folder,dir=await findSubdir(target.dir,LABOR),files=dir?await listFiles(dir,/\.(xml|pdf)$/i):[];
  const auftraege=await findSubdir(target.dir,AUFTRAEGE),erfassungen=auftraege?(await listFiles(auftraege,/_Daten\.json$/i)).sort((a,b)=>b.lastModified-a.lastModified):[];
  let ergebnisse:Ergebnisse|null=null,ergebnisFehler='',veraltet=false;
  if(dir)try{const datei=await fileInfo(dir,ERGEBNIS_DATEI);if(datei){ergebnisse=liesErgebnisse(await datei.text());
   const stand=await Promise.all([...files.map(async f=>({name:f.name,file:await f.handle.getFile()})),...(erfassungen[0]?[{name:`${AUFTRAEGE}/${erfassungen[0].name}`,file:await erfassungen[0].handle.getFile()}]:[])]);
   veraltet=ergebnisse.stand!==standKennung(stand.map(x=>({name:x.name,size:x.file.size,t:x.file.lastModified})));}}catch(e){ergebnisFehler=e instanceof Error?e.message:String(e);}
  if(folder!==target)return;
  // Datei aus einem anderen Projekt (kopiert oder liegen geblieben): nichts davon anbieten.
  if(ergebnisse&&ergebnisse.projekt&&ergebnisse.projekt!==target.nr){ergebnisFehler=`„${ERGEBNIS_DATEI}“ gehört zu Projekt ${ergebnisse.projekt}, geöffnet ist ${target.nr}. Bitte in ResultKit im richtigen Projekt übernehmen.`;ergebnisse=null;}
  const entries=ergebnisse?.berichte||[],im=new Set((project.labReports||[]).map(r=>`${r.bericht}|${r.vorlaeufig?1:0}`));
  const resultkit=`../resultkit/#projekt=${encodeURIComponent(target.name)}`;
  const stand=ergebnisFehler?`<p class="lab-resultkit warn">${escape(ergebnisFehler)}</p>`:!ergebnisse?`<p class="lab-resultkit${files.length?' warn':''}">${files.length?`In „${escape(LABOR)}“ liegen Prüfberichte, die noch nicht in ResultKit geprüft und übernommen sind.`:'Noch keine Laborergebnisse aus ResultKit.'} Laborberichte werden in ResultKit importiert und geprüft – danach stehen sie hier zur Auswahl.</p>`
   :`<p class="lab-resultkit${veraltet?' warn':''}">${veraltet?'Seit der Übernahme in ResultKit hat sich der Ordner geändert – bitte dort prüfen und erneut übernehmen. Bis dahin gilt der übernommene Stand:':`Aus ResultKit übernommen am ${escape(clock(Date.parse(ergebnisse.uebernommen)))}${ergebnisse.vollstaendig?'':' (Zwischenstand – noch nicht alle Proben)'}:`}</p>`;
  const d=$<HTMLDialogElement>('lab-folder-dialog');
  $('lab-folder-list').innerHTML=(erfassungen.length?erfassungen.map((f,i)=>`<button class="choice labelkit-choice" data-labelkit="${i}">Probenerfassung aus LabelKit: ${escape(f.name)}<small>${escape(clock(f.lastModified))} · „${escape(AUFTRAEGE)}“${i===0&&erfassungen.length>1?' · neueste':''} – Proben vorab als „Noch zu platzieren“, Messwerte folgen aus ResultKit</small></button>`).join(''):`<p class="muted tiny" id="labelkit-missing">Noch keine Probenerfassung aus LabelKit in „${escape(AUFTRAEGE)}“ – zuerst in LabelKit im Projekt speichern.</p>`)
   +stand+entries.map((b,i)=>`<button class="choice" data-ergebnis="${i}">Prüfbericht ${escape(b.bericht||b.sources.xml||'ohne Nummer')}${b.vorlaeufig?' · vorläufig':''}<small>${b.proben.length} Probe${b.proben.length===1?'':'n'} mit Messwerten · ${escape([b.sources.xml,b.sources.pdf].filter(Boolean).join(' + '))}${im.has(`${b.bericht}|${b.vorlaeufig?1:0}`)?' · bereits im Plan':''}</small></button>`).join('')
   +`<p class="lab-resultkit-link"><a class="hilfe-link" href="${escape(resultkit)}" target="resultkit" rel="noopener" title="Laborergebnisse des Projekts in ResultKit prüfen, importieren und übernehmen">🧪 ResultKit öffnen</a></p>`;
  $('lab-folder-list').onclick=async e=>{const lk=(e.target as HTMLElement).closest<HTMLElement>('[data-labelkit]');if(lk){const erfassung=erfassungen[Number(lk.dataset.labelkit)],target=folder,active=project;d.close();try{const text=await (await erfassung.handle.getFile()).text();if(!target||folder!==target||project!==active)throw Error('LabelKit-Import abgebrochen: Das aktive Projekt wurde während des Lesens gewechselt. Bitte die Datei erneut auswählen.');labUI?.show(labelkitReport(text,erfassung.name,target.name,message=>window.confirm(message)));}catch(err){fail(err);}return;}const b=(e.target as HTMLElement).closest<HTMLElement>('[data-ergebnis]');if(!b)return;d.close();if(folder!==target||!project){fail(Error('Abgebrochen: Das aktive Projekt wurde gewechselt.'));return;}labUI?.show(berichtAlsReport(entries[Number(b.dataset.ergebnis)]));};
  $('lab-folder-other').onclick=()=>{d.close();input('lab-files').click();};d.showModal();
};
document.querySelector('#help-dialog h3')!.insertAdjacentHTML('beforebegin',`<h3>Projektordner</h3><p>Aus der Projektzentrale „Plan bearbeiten“ wählen oder hier „📁 Projekt …“ und den Projektordner (z. B. „26.0123 Köln“) auswählen. PlanKit speichert dann jede Änderung automatisch als „Probenplan &lt;Projekt&gt;.probenplan“ im Ordner „${PLAENE}“; exportierte Bilder landen ebenfalls dort. Grundrisse aus „${PLAENE}“, die Probenerfassung aus LabelKit („${AUFTRAEGE}“) und die in ResultKit geprüften Prüfberichte („${LABOR}/_Ergebnisse.json“) stehen direkt zur Auswahl. Mit LabelKit erfasste Proben erscheinen so schon vor dem Laborbericht unter „Noch zu platzieren“; liegt der Bericht in ResultKit vor, ergänzt „Alle Konflikte: Aktualisieren“ Labordaten und Messwerte. Laborberichte (XML/PDF) werden im Projekt nur in ResultKit importiert. Hat ein Kollege den Plan zwischenzeitlich gespeichert, fragt PlanKit nach, statt zu überschreiben. Vor jedem Überschreiben bleibt die vorherige Datei als eindeutig benannte „(vorher …)“-Kopie erhalten, dazu ein geprüfter „(Speicherkandidat …)“ der neuen Fassung; von beiden behält PlanKit die jeweils ${KEEP_RECENT} neuesten. Wird der Plan ersetzt (neuer Grundriss, neue Skizze, „Meine Fassung übernehmen“), bleibt die bisherige Fassung als „(${ERSETZEN_KOPIE} …)“ – diese Kopien werden nie automatisch gelöscht. Beim Öffnen können Sie gespeicherte Fassungen seitenweise prüfen; es wird nichts automatisch zusammengeführt. Bei Fehlern „Speichern“ erneut versuchen und ggf. Ordnerzugriff erlauben; „Notfallkopie“ lädt die geöffnete Fassung herunter. Nach einem Abbruch Wiederherstellungs-/Browserfassung ausdrücklich auswählen, prüfen und speichern.</p>`);
const startProject=PROJEKT_URL.projekt;
/** ?aktion=anlage (aus der Projektzentrale): nach dem Öffnen gleich den Export „Word · Anlage Probenahme“ zeigen. */
const startAktion=PROJEKT_URL.aktion;   // vor dem Öffnen merken – die Adresse wird dabei umgeschrieben
function startAction(){if(startAktion!=='anlage')return;
  if(!project){toast('Anlage Probenahme: In diesem Projekt gibt es noch keinen Plan – zuerst einen Grundriss laden und die Proben setzen.',true);return;}
  input('format').value='anlage';if(!exportCard.open)exportCard.show();dimensions();}
void (async()=>{if(startProject){await openFromZentrale(startProject);void offline();return;}try{const saved=await restoreLocal();if(saved){await install(await validateProject(saved));toast('Letztes Projekt wiederhergestellt.');}}catch{toast('Die letzte Browsersicherung konnte nicht geladen werden. Sie können eine Projektdatei öffnen.',true);}finally{void offline();}})();
/* Pflichtangabe in den Word-Exporten (wie Projektzentrale/FotoKit): die Bezeichnung der Anlage mit Nummer – „Anlage“ allein gilt als leer. Nie blockierend. */
const PFLICHT_ANLAGE=['annex-title','raumbuch-anlage','wand-anlage'];
const anlageFehlt=(v:string)=>!v.trim()||/^anlage$/i.test(v.trim());
function pflichtAnlagen(){for(const id of PFLICHT_ANLAGE){const el=document.getElementById(id) as HTMLInputElement|null,l=el?.closest('label');if(!el||!l)continue;
  if(!l.querySelector('.pflicht-tag')){const t=document.createElement('span');t.className='pflicht-tag';t.textContent='Pflicht';const text=[...l.childNodes].find(n=>n.nodeType===3&&n.textContent!.trim());
    if(text){const kopf=document.createElement('span');kopf.textContent=text.textContent;kopf.append(t);text.replaceWith(kopf);}else el.before(t);}
  l.classList.toggle('pflicht-offen',anlageFehlt(el.value));el.title=anlageFehlt(el.value)?'Pflichtangabe: Nummer der Anlage, z. B. „Anlage 5“':'';}}
document.addEventListener('input',e=>{if(PFLICHT_ANLAGE.includes((e.target as HTMLElement).id))pflichtAnlagen();});
{const beob=new MutationObserver(()=>requestAnimationFrame(pflichtAnlagen));for(const id of ['export-dialog','raumbuch-dialog','wand-dialog','annex-fields']){const el=document.getElementById(id);if(el)beob.observe(el,{attributes:true,attributeFilter:['open','hidden']});}pflichtAnlagen();}

/* Hilfe-Links ins Handbuch (ab 1.33): feste Kapiteladressen aus AidKit (hilfe-anker.json), immer dasselbe Fenster „aidkit“.
   Am Dateiende, damit der Verweis in der Kurzanleitung direkt unter der Überschrift steht. Nur Links, keine Daten. */
const handbuchLink=(anker:'app-plankit'|'bohrkern'|'bohrkern-ablauf',text:string,titel:string)=>`<a class="hilfe-link" href="../aidkit/#${anker}" target="aidkit" rel="noopener" title="${titel} – öffnet das Handbuch (AidKit) in einem eigenen Fenster">📘 ${text}</a>`;
document.querySelector('#help-dialog h2')!.insertAdjacentHTML('afterend',`<p class="hilfe-verweis">Ausführlich mit Übungen: ${handbuchLink('app-plankit','Handbuch – PlanKit Schritt für Schritt','Handbuch: PlanKit Schritt für Schritt')}</p>`);
document.getElementById('wand-title')!.insertAdjacentHTML('afterend',`<p class="hilfe-verweis">${handbuchLink('bohrkern','Probenbezeichnung Bohrkerne','Handbuch: Probenbezeichnung Bohrkerne mit ID-Baukasten')} ${handbuchLink('bohrkern-ablauf','Bohrkerne Schritt für Schritt','Handbuch: Bohrkerne von der Begehung bis zum Labor')}</p>`);
