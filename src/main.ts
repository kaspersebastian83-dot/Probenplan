import DOMPurify from 'dompurify';
import {LabUI} from './labui';
import './style.css';
import './theme.css';
import './layout.css';
import {addMarker,addSheet,bounds,clone,createProject,escape,floorName,History,markerSize,markerSVG,moveSheet,removeSheet,renameSheet,sheetCount,sheetProject,switchSheet,validLabel,MAX_SHEETS,type Project,type Marker} from './model';
import {candidates,loadImage,readPlan,validateProject,type Candidate} from './import';
import {download,restoreLocal,saveLocal} from './storage';
import {labelkitReport} from './labelkit';
import {fileInfo,fileRevision,FolderConflict,saveFolderProject,writeProjectCopy,findSubdir,listFiles,openFolder,parseProjName,permission,pickFolder,projectDirOf,projectFileName,readProjectData,supported as folderSupported,writeFile,archiv,AUFTRAEGE,LABOR,PLAENE,type ProjectFolder} from './folder';
import {exportImage,exportLayout} from './export';
import {cropProject,planMatrix,preparation,rotateProject} from './preparation';
import type {LocalPDF} from './pdf';
import type {Plan,Rect} from './model';
import type {Area,Point} from './model';
import {hasValues,parameters,prepare,rangeText,rateMarkers,saveShared,fromShared,scaleKey,shortParameter,autoColors,units,valueOf,UNRATED,qualifierGroups,vdsScale} from './results';
import type {Scale} from './model';
import {addArea,areaSVG,cleanName,MAX_POINTS,PALETTE,palette,polygonError} from './areas';

document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<header class="header topbar"><a class="brand" href="./" aria-label="PlanKit Start"><span class="brand-icon" aria-hidden="true">⬡</span><span>PlanKit</span></a><span id="app-version" class="version-badge" title="Version"></span>
<div class="tb-group" id="file-actions"><button id="load" class="tb" title="Grundriss laden: PDF, Polycam-ZIP, SVG, PNG oder JPG">＋ Plan</button><input id="file" type="file" accept=".zip,.svg,.png,.jpg,.jpeg" hidden><button id="open-project" class="tb" title="Projektdatei (.probenplan) öffnen">Öffnen</button><button id="save-project" class="tb" title="Projekt als .probenplan-Datei speichern" disabled>Speichern</button><input id="project-file" type="file" accept=".probenplan,.json" hidden></div>
<div class="tb-doc"><span id="canvas-name">Kein Plan geladen</span><span id="file-type" class="tag">KEIN PLAN</span><span id="plan-name" hidden>Polycam-ZIP, SVG, PNG oder JPG</span></div>
<div class="history"><button id="undo" class="tb" aria-label="Rückgängig" title="Rückgängig (Strg+Z)" disabled>↶</button><button id="redo" class="tb" aria-label="Wiederherstellen" title="Wiederherstellen (Strg+Umschalt+Z)" disabled>↷</button></div>
<span class="tb-spacer"></span><span id="saved" role="status">Lokal. Vertraulich. Ohne Upload.</span><span id="offline" class="status">● Offline wird vorbereitet</span>
<button id="help" class="tb" title="Bedienung, Tastenkürzel & Offlinebetrieb">?</button><button id="results-toggle" class="tb" title="Ergebniskarte: Proben nach Bewertung einfärben (K)" aria-pressed="false" data-key="k" disabled>Ergebnisse</button><button id="export-open" class="tb export-btn" title="Bild für das Gutachten exportieren" disabled>↓ Export …</button><button id="panel-toggle" class="tb" title="Liste mit Markierungen, Laborproben und Flächen ein-/ausblenden (L)" aria-pressed="false" aria-controls="side-panel">☰ Liste</button></header>
<main class="kit-workspace">
<nav class="rail" aria-label="Werkzeuge"><div class="modes" role="group" aria-label="Werkzeug"><button data-mode="navigate" data-key="v" class="mode active" title="Ansicht bewegen – verschieben & zoomen (V)"><span class="tool-icon">↔</span><span>Ansicht<small>Verschieben & zoomen</small></span></button><button data-mode="sample" data-key="p" class="mode" title="Probe setzen – fortlaufend nummeriert (P)" disabled><span class="tool-icon sample-icon">P</span><span>Probe<small>Fortlaufend nummeriert</small></span></button><button data-mode="fire" data-key="b" class="mode" title="Brandherd setzen (B)" disabled><span class="tool-icon fire-icon">◇</span><span>Brandherd<small>Eigene Kennung & Form</small></span></button><button data-mode="edit" data-key="e" class="mode" title="Markierung bearbeiten – Punkt oder Beschriftung ziehen (E)" disabled><span class="tool-icon">↖</span><span>Bearbeiten<small>Punkt oder Beschriftung ziehen</small></span></button></div></nav>
<section class="kit-canvas" aria-label="Planarbeitsfläche"><div id="stage"><svg id="drawing" xmlns="http://www.w3.org/2000/svg" aria-label="Grundriss mit Markierungen"><image id="base-plan"/><g id="marks"></g></svg><div id="welcome"><div class="plan-illustration"><span class="mini-wall a"></span><span class="mini-wall b"></span><span class="mini-wall c"></span><span class="mini-point">P1</span></div><span class="eyebrow">VOM GRUNDRISS ZUM PROBENPLAN</span><h2>Hier beginnt Ihre<br>Dokumentation.</h2><p>Öffnen Sie einen Polycam-Export oder ein Planbild.<br>Ihre Gebäudedaten bleiben im Browser.</p><button id="welcome-load" class="primary">Grundriss auswählen <span>↗</span></button><span class="tiny">SVG bevorzugt · scharfer Export bis 4.600 px</span></div>
<div id="toolbar" class="overlay"><div id="mode-hint" hidden></div><label class="inline-field" id="next-field" title="Nummer der nächsten Probe – vergebene Kennungen bleiben bestehen">Nächste Probe<input id="next" type="number" value="1" min="1" max="999999999" disabled></label></div>
<div class="zoom-controls"><button id="zoom-out" aria-label="Verkleinern" title="Verkleinern (−)">−</button><span id="zoom-value">100 %</span><button id="zoom-in" aria-label="Vergrößern" title="Vergrößern (+)">＋</button><span class="divider"></span><button id="fit" title="Gesamten Plan anzeigen (0)">Einpassen</button></div>
<div class="canvas-footer"><span><span class="legend-circle"></span> Probe</span><span><span class="legend-diamond"></span> Brandherd</span><span id="source-info">Original bleibt unverändert</span></div></div><nav id="sheet-strip" class="sheet-strip" aria-label="Pläne des Projekts" hidden><div id="sheet-list" role="tablist" aria-label="Pläne"></div><button id="sheet-add" class="sheet-add" title="Weiteren Plan hinzufügen, z. B. ein Obergeschoss (PDF mit mehreren Seiten: alle auf einmal)">＋ Plan</button></nav></section>
<aside class="kit-panel" id="side-panel" aria-label="Markierungen, Laborproben und Flächen"><div class="panel-head"><span class="eyebrow">ÜBERSICHT</span><button id="panel-close" class="tb" title="Liste ausblenden (L)" aria-label="Liste ausblenden">»</button></div><div class="panel-scroll">
<section class="markers-section"><div class="section-heading"><h2>Markierungen</h2><span id="count" class="count">0</span></div><div id="marker-list"><p class="muted empty-list">Ihre Proben und Brandherde<br>erscheinen hier.</p></div><div id="inspector" hidden><label>Kennung<input id="label" maxlength="16" autocomplete="off"></label><label>Notiz <span class="optional">optional · nur im Projekt</span><textarea id="note" maxlength="500" rows="2" placeholder="z. B. Wischprobe, Fensterbank"></textarea></label><div class="inspector-actions"><button id="offset">Beschriftung versetzen</button><button id="recenter" title="Beschriftung auf den Probenpunkt zurücksetzen">Zurück an Punkt</button><button id="delete" class="danger">Löschen</button></div></div></section>
</div></aside></main>
<dialog id="export-dialog" class="export-card" aria-label="Export"><form method="dialog"><button class="close" aria-label="Export schließen">×</button></form><span class="eyebrow">EXPORT</span><h2>Bild fürs Gutachten</h2><p class="muted">Vollständiger Plan mit Markierungen und Legende – unabhängig von Ihrer Ansicht.</p><label>Gutachtennummer <span class="optional">optional</span><input id="report" maxlength="100" placeholder="z. B. 2026-0142" disabled></label><label>Datum <span class="optional">optional</span><input id="date" type="date" disabled></label><label id="view-field" hidden>Darstellung<select id="view"><option value="plan">Probenplan</option><option value="results">Ergebniskarte</option></select></label><label id="scope-field" hidden>Umfang<select id="scope"><option value="one">Dieser Plan</option><option value="all">Alle Pläne</option></select></label><div class="export-row"><label>Dateiformat<select id="format"><option value="png">PNG · verlustfrei</option><option value="jpeg">JPG · hohe Qualität</option></select></label><label>Auflösung<select id="quality"><option value="3500">Standard · 3.500 px</option><option value="4600">Hoch · 4.600 px</option></select></label></div><div class="export-dim"><span>Ausgabeabmessungen</span><strong id="dimensions">— × — px</strong><small>Inklusive Rand und Legende</small></div><button id="export" class="primary wide" disabled>↓ Bild exportieren</button><div id="export-result" hidden><a id="export-link">Bild erneut herunterladen</a><button id="smaller" hidden>Kleineren Export versuchen</button></div></dialog>
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
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Plan vorbereiten</h3><p>Unter „Plan vorbereiten“ jeweils 90° links/rechts drehen oder einen Bildausschnitt mit Maus/Finger aufziehen. Zuschnitt übernehmen oder abbrechen. Alle gesetzten Probenpunkte und Brandherde müssen im Ausschnitt liegen; ihre Positionen und versetzten Beschriftungen werden korrekt umgerechnet. Drehen und Zuschneiden sind rückgängig machbar. Die Originaldaten bleiben erhalten; eine perspektivische Entzerrung ist nicht enthalten.</p><p>PDF-Seiten werden lokal in hoher Auflösung gerendert (bis 4.600 px, auf Mobilgeräten/speicherarmen Geräten sinnvoll begrenzt). Bei Speicherproblemen wird eine kleinere Stufe versucht. JPG-/PNG-Originale werden beim Drehen und Zuschneiden nicht neu komprimiert. HEIC/HEIF bitte zuvor als JPG exportieren.</p>');
document.querySelector('#help-dialog')!.insertAdjacentHTML('beforeend','<h3>Laborberichte und offene Proben</h3><p>Zuerst einen Grundriss laden. Unter „Laborbericht importieren …“ XML, PDF oder beide gemeinsam auswählen oder Dateien auf die App ziehen. Die Prüftabelle vor Übernahme korrigieren, ergänzen und sortieren. Bei belegten P-Nummern das gewünschte Vorgehen ausdrücklich wählen. Offene Laborproben auf den Plan ziehen oder auswählen und in den Plan tippen. Übernahme und Platzierung unterstützen Undo/Redo; Projektdatei und Autosicherung erhalten die offene Liste.</p><p>„Probenliste speichern“ erzeugt eine JSON-Datei für andere Apps. Im Speicherdialog den Projektordner und „Laborergebnisse“ wählen; Browser ohne nativen Dialog laden die Datei herunter. Gespeicherte Herkunft bleibt nach erneutem Öffnen erhalten; bei mehreren Berichten den gewünschten Eintrag wählen. Nur bei älteren Projekten fehlende Herkunftsangaben ergänzen. PDF-Scans oder unbekannte Tabellenlayouts benötigen XML oder manuelle Eingabe. Alle Laborwerte bleiben lokal; die Ergebniskarte nutzt Ihre Skala oder die ausdrücklich gewählte VdS-Hintergrundreferenz.</p>');
input('file').accept='.zip,.svg,.png,.jpg,.jpeg,.pdf,.heic,.heif,application/pdf,image/png,image/jpeg';
$('plan-name').textContent='PDF, Polycam-ZIP, SVG, PNG oder JPG';
document.getElementById('app-version')!.textContent='v1.8.2';
const colorOptions=PALETTE.map(c=>`<option value="${c.color}">${c.title} · ${c.suggestion}</option>`).join('');
document.querySelector('.modes')!.insertAdjacentHTML('beforeend','<button data-mode="area-draw" class="mode" disabled><span class="tool-icon">⬡</span><span>Fläche zeichnen<small>Eckpunkte setzen & abschließen</small></span></button><button data-mode="area-edit" class="mode" disabled><span class="tool-icon">◇</span><span>Fläche bearbeiten<small>Ecken oder ganze Fläche ziehen</small></span></button>');
document.querySelector('.markers-section')!.insertAdjacentHTML('afterend',`<section class="areas-section"><div class="section-heading"><h2>Schadensflächen</h2><span id="area-count" class="count">0</span></div><div id="area-draft" hidden><label>Farbe<select id="draft-color">${colorOptions}</select></label><label>Deckkraft <output id="draft-opacity-value">30 %</output><input id="draft-opacity" type="range" min="5" max="70" value="30"></label><p id="draft-status" class="tiny"></p><div class="inspector-actions"><button id="area-last">Letzten Eckpunkt entfernen</button><button id="area-cancel">Abbrechen</button><button id="area-finish" class="primary">Fläche abschließen</button></div></div><div id="area-list"></div><div id="area-inspector" hidden><label>Kennung<input id="area-label" maxlength="16"></label><label>Bezeichnung<textarea id="area-name" maxlength="160" rows="3"></textarea></label><label>Farbe<select id="area-color">${colorOptions}</select></label><label>Deckkraft <output id="area-opacity-value"></output><input id="area-opacity" type="range" min="5" max="70"></label><p class="tiny">Eckpunkte oder die ganze Fläche im Plan ziehen. Die Bezeichnung bestimmt die gemeinsame Legendenkategorie.</p><button id="area-delete" class="danger wide">Fläche löschen</button></div><p class="tiny">Farben und Bezeichnungen dokumentieren Ihre Eingabe. Sie stellen keine chemische Bewertung oder Freigabe fest.</p></section>`);
document.body.insertAdjacentHTML('beforeend','<dialog id="area-dialog"><h2>Fläche benennen</h2><p>Vorschlag frei anpassen. Gleich bezeichnete Flächen werden in der Legende gemeinsam aufgeführt.</p><label>Bezeichnung<input id="new-area-name" maxlength="160"></label><div class="dialog-actions"><button id="area-dialog-cancel">Weiterzeichnen</button><button id="area-dialog-save" class="primary">Fläche speichern</button></div></dialog>');
document.querySelector('#help-dialog ol')!.insertAdjacentHTML('afterend','<h3>Schadensflächen & Legende</h3><p>„Fläche zeichnen“ wählen, Farbe und Deckkraft einstellen (Standard 30 %) und mindestens drei Eckpunkte in den Plan tippen. „Fläche abschließen“ öffnet die frei bearbeitbare Bezeichnung. „Letzten Eckpunkt entfernen“ korrigiert die Kontur; „Abbrechen“ verwirft den Entwurf. Zum Verschieben der Ansicht können Sie zwischendurch „Ansicht bewegen“ wählen. Zwei Finger und das Mausrad zoomen, ohne Eckpunkte zu setzen.</p><p>Unter „Fläche bearbeiten“ oder über die Flächenliste auswählen. Die sichtbaren Eckpunkte oder die ganze Fläche ziehen. Kennung, Bezeichnung, Farbe und Deckkraft sind nachträglich bearbeitbar. Kreuzende Konturen werden abgewiesen. Rückgängig/Wiederherstellen gilt auch für Flächen. Ein Zuschnitt muss sämtliche Eckpunkte und Probenpunkte enthalten. Unfertige Entwürfe vor Vorbereitung, Sicherung oder Export abschließen oder abbrechen.</p><p>Der Export ordnet nur verwendete Flächenbezeichnungen automatisch in einem weißen Legendenbereich an. Gleiche Bezeichnungen (unabhängig von Groß-/Kleinschreibung) erscheinen einmal; unterschiedliche Farben oder Deckkräfte werden dort mit den zugehörigen Kennungen gezeigt. Konturmuster und Kennungen helfen bei geringer Farbsättigung. Farben und Vorschlagstexte sind ausschließlich manuelle Dokumentation, keine automatische Schadstoffbewertung oder Freigabe.</p>');
input('project-file').insertAdjacentHTML('afterend',`<div id="preparation" hidden><span class="eyebrow">PLAN VORBEREITEN</span><div class="preparation-buttons"><button id="rotate-left" title="90° nach links drehen">↶ Links drehen</button><button id="rotate-right" title="90° nach rechts drehen">↷ Rechts drehen</button><button id="crop-start">⌗ Zuschneiden</button></div><p class="tiny">Bei Bedarf ausrichten und Bildränder entfernen.</p><div id="crop-actions" hidden><p>Ziehen Sie im Plan einen neuen Bildausschnitt auf. Alle Probenpunkte müssen darin liegen.</p><button id="crop-confirm" class="primary" disabled>Zuschnitt übernehmen</button><button id="crop-cancel">Abbrechen</button></div></div><div id="import-status" role="status" hidden>Plan wird geladen …</div>`);
document.body.insertAdjacentHTML('beforeend',`<dialog id="pdf-dialog"><form method="dialog"><button class="close" aria-label="PDF-Auswahl abbrechen">×</button></form><span class="eyebrow">PDF · SEITENAUSWAHL</span><h2>Welchen Grundriss übernehmen?</h2><p id="pdf-name"></p><div class="pdf-navigation"><button id="pdf-prev" aria-label="Vorherige PDF-Seite">←</button><label>Seite <input id="pdf-page" type="number" min="1" value="1"></label><span id="pdf-count"></span><button id="pdf-next" aria-label="Nächste PDF-Seite">→</button></div><div class="pdf-preview"><img id="pdf-preview" alt="Vorschau der ausgewählten PDF-Seite"><p id="pdf-status" role="status">Vorschau wird geladen …</p></div><div class="dialog-actions"><button id="pdf-cancel">Abbrechen</button><button id="pdf-all">Alle Seiten als einzelne Pläne</button><button id="pdf-use" class="primary" disabled>Diese Seite übernehmen</button></div><p class="tiny">Die gewählte Seite wird in hoher Auflösung übernommen. „Alle Seiten“ legt je Seite einen eigenen Plan an (z. B. ein Geschoss pro Seite).</p></dialog>`);
const ns='http://www.w3.org/2000/svg',planGroup=document.createElementNS(ns,'g'),clip=document.createElementNS(ns,'clipPath'),clipRect=document.createElementNS(ns,'rect');
clip.id='plan-clip';clip.append(clipRect);svg.prepend(clip);image.before(planGroup);planGroup.append(image);planGroup.setAttribute('clip-path','url(#plan-clip)');
const cropLayer=document.createElementNS(ns,'g');cropLayer.id='crop-overlay';cropLayer.setAttribute('pointer-events','none');svg.append(cropLayer);
const areaLayer=document.createElementNS(ns,'g');areaLayer.id='areas';marks.before(areaLayer);
let selectedArea:string|null=null,draftPoints:Point[]=[];
let labUI:LabUI|null=null;
let project:Project|null=null,selected:string|null=null,mode='navigate',history=new History(),busy=false;
let cropping=false,cropRect:Rect|null=null,cropDrag:{id:number;start:{x:number;y:number}}|null=null;
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
function updateCamera(){svg.setAttribute('viewBox',`${camera.x} ${camera.y} ${camera.width} ${camera.height}`);$('zoom-value').textContent=`${Math.round(fitWidth/camera.width*100)} %`;renderMarkers();renderCrop();}
function fit(){if(!project)return;const b=bounds(project),rect=svg.getBoundingClientRect(),ratio=rect.width/rect.height||1;let w=b.width*1.14,h=b.height*1.14;if(w/h<ratio)w=h*ratio;else h=w/ratio;camera={x:b.x+(b.width-w)/2,y:b.y+(b.height-h)/2,width:w,height:h};fitWidth=w;updateCamera();}
function point(e:{clientX:number;clientY:number}){const matrix=svg.getScreenCTM();if(!matrix)return{x:0,y:0};const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return{x:p.x,y:p.y};}
function zoom(factor:number,anchor?:{x:number;y:number}){if(!project)return;const ratio=Math.min(20,Math.max(.25,fitWidth/(camera.width*factor)));factor=fitWidth/(ratio*camera.width);const c=anchor||{x:camera.x+camera.width/2,y:camera.y+camera.height/2};camera={x:c.x-(c.x-camera.x)*factor,y:c.y-(c.y-camera.y)*factor,width:camera.width*factor,height:camera.height*factor};updateCamera();}
function setMode(next:string){mode=next;document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});$('stage').dataset.mode=mode;$('mode-hint').textContent=({navigate:'Ansicht bewegen · Mausrad oder zwei Finger zum Zoomen',sample:'Tippen setzt eine Probe · Ziehen verschiebt die Ansicht',fire:'Tippen setzt einen Brandherd · Ziehen verschiebt die Ansicht',edit:'Markierung wählen · Punkt oder Beschriftung ziehen','area-draw':'Eckpunkte setzen · anschließend Fläche abschließen','area-edit':'Fläche wählen · Eckpunkte oder Fläche ziehen','lab-place':'Ausgewählte Laborprobe durch Tippen platzieren · Ziehen verschiebt die Ansicht'} as Record<string,string>)[mode];}
let showResults=false;
function renderMarkers(){if(project){const fills=showResults?rateMarkers(project).fill:null;marks.innerHTML=project.markers.map(m=>markerSVG(project!,m,m.id===selected,camera.width/Math.max(1,svg.clientWidth)*12,fills?.get(m.id))).join('');renderAreas();}}
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
function dimensions(){if(!project)return;const l=exportLayout(project,Number(input('quality').value));$('dimensions').textContent=`${l.pixelWidth.toLocaleString('de-DE')} × ${l.pixelHeight.toLocaleString('de-DE')} px`;}
function renderCrop(){
  if(!cropping||!project){cropLayer.replaceChildren();return;}
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
svg.addEventListener('pointerdown',e=>{if(!cropping||!project)return;if(cropDrag||e.button>0)return;svg.setPointerCapture(e.pointerId);const start=cropPoint(e);cropDrag={id:e.pointerId,start};cropRect={...start,width:0,height:0};$<HTMLButtonElement>('crop-confirm').disabled=true;renderCrop();},{capture:true});
svg.addEventListener('pointermove',e=>{if(!cropping||!project||cropDrag?.id!==e.pointerId)return;const pt=cropPoint(e),start=cropDrag.start;cropRect={x:Math.min(start.x,pt.x),y:Math.min(start.y,pt.y),width:Math.abs(pt.x-start.x),height:Math.abs(pt.y-start.y)};$<HTMLButtonElement>('crop-confirm').disabled=cropRect.width<1||cropRect.height<1;renderCrop();},{capture:true});
svg.addEventListener('pointerup',e=>{if(cropping&&cropDrag?.id===e.pointerId)cropDrag=null;},{capture:true});
svg.addEventListener('pointercancel',e=>{if(cropping&&cropDrag?.id===e.pointerId){cropDrag=null;cropRect=null;$<HTMLButtonElement>('crop-confirm').disabled=true;renderCrop();}},{capture:true});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&cropping)endCrop();});
function render(){
  const p=project;labUI?.render(p); $('welcome').hidden=!!p;$('mode-hint').hidden=!p;if(!p){renderSheets();renderResults();}
  ['save-project','export','export-open','next','report','date'].forEach(id=>($<HTMLButtonElement>(id).disabled=!p));
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.disabled=!p&&b.dataset.mode!=='navigate');
  $<HTMLButtonElement>('undo').disabled=!history.past.length;$<HTMLButtonElement>('redo').disabled=!history.future.length;
  $('preparation').hidden=!p;
  ['rotate-left','rotate-right','crop-start'].forEach(id=>$<HTMLButtonElement>(id).disabled=busy||cropping||!p);
  ['load','open-project','save-project'].forEach(id=>$<HTMLButtonElement>(id).disabled=busy||cropping||(id==='save-project'&&!p));
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.disabled=cropping||(!p&&b.dataset.mode!=='navigate'));
  $<HTMLButtonElement>('undo').disabled=cropping||!!draftPoints.length||!history.past.length;$<HTMLButtonElement>('redo').disabled=cropping||!!draftPoints.length||!history.future.length;
  $<HTMLButtonElement>('export').disabled=$<HTMLButtonElement>('export-open').disabled=busy||cropping||!p;
  if(!p)return;
  ['rotate-left','rotate-right','crop-start','save-project','export','export-open','open-project','load'].forEach(id=>{if(draftPoints.length)$<HTMLButtonElement>(id).disabled=true;});
  $('area-list').innerHTML=(p.areas||[]).map(a=>`<button class="area-row ${a.id===selectedArea?'selected':''}" data-area-select="${a.id}"><span style="background:${a.color}">${escape(a.label)}</span><span>${escape(a.name)}</span></button>`).join('')||'<p class="tiny">Noch keine Flächen gesetzt.</p>';
  const a=selectedPolygon();$('area-inspector').hidden=!a;if(a){input('area-label').value=a.label;input('area-name').value=a.name;input('area-color').value=a.color;input('area-opacity').value=String(Math.round(a.opacity*100));$('area-opacity-value').textContent=`${Math.round(a.opacity*100)} %`;}
  const source=preparation(p.plan);image.setAttribute('href',p.plan.data);image.setAttribute('width',String(source.sourceWidth));image.setAttribute('height',String(source.sourceHeight));image.setAttribute('transform',`matrix(${planMatrix(p.plan).join(' ')})`);clipRect.setAttribute('width',String(p.plan.width));clipRect.setAttribute('height',String(p.plan.height));
  $('file-type').textContent=p.plan.vector?'SVG · VEKTOR':'RASTERBILD';$('plan-name').textContent=p.plan.name;$('canvas-name').textContent=p.plan.name.replace(/\.[^.]+$/,'');$('source-info').textContent=`${Math.round(p.plan.width)} × ${Math.round(p.plan.height)} · ${p.plan.vector?'Vektorgrundlage':'Rastergrundlage'}`;
  if(p.plan.pdf){$('file-type').textContent=`PDF · SEITE ${p.plan.pdf.page}`;$('source-info').textContent=`${Math.round(p.plan.width)} × ${Math.round(p.plan.height)} · PDF-Seite ${p.plan.pdf.page}/${p.plan.pdf.totalPages}`;}
  input('next').value=String(p.nextSample);input('report').value=p.report;input('date').value=p.date;
  $('count').textContent=String(p.markers.length);
  $('marker-list').innerHTML=DOMPurify.sanitize(p.markers.length?p.markers.map(m=>`<button class="marker-row ${m.id===selected?'selected':''}" data-select="${m.id}"><span class="marker-badge ${m.kind}">${escape(m.label)}</span><span>${m.kind==='sample'?'Probenahmestelle':'Brandherd'}${showResults&&p.results&&valueOf(m,p.results.parameter)?`<small>${escape(shortParameter(p.results.parameter))}: ${escape(valueOf(m,p.results.parameter)!.r)} ${escape(valueOf(m,p.results.parameter)!.u)}</small>`:m.note?`<small>${escape(m.note)}</small>`:''}</span><span class="row-arrow">›</span></button>`).join(''):'<p class="muted empty-list">Noch keine Markierungen gesetzt.</p>');
  const m=selectedMarker();$('inspector').hidden=!m;if(m){input('label').value=m.label;input('note').value=m.note;}let labFields=document.getElementById('marker-lab');if(!labFields){labFields=document.createElement('p');labFields.id='marker-lab';labFields.className='lab-fields';$('inspector').append(labFields);}labFields.textContent=m?.lab?['Referenz: '+m.lab.ref,'Probenart: '+(m.lab.art||'—'),'Labor-Nr.: '+(m.lab.labNr||'—'),'Probenahme: '+(m.lab.datum||'—'),'Bericht: '+(m.lab.bericht||'—')].join(' · '):'';
  renderMarkers();dimensions();renderSheets();renderResults();
}
async function install(p:Project,fromFolder=false,transition?:()=>void){await preserveUnsavedProject();transition?.();if(folder&&!fromFolder){folderDirty=true;if(!p.report)p.report=folder.name;}labUI?.reset();project=p;selected=null;selectedArea=null;draftPoints=[];history.clear();cropping=false;cropRect=null;setMode('navigate');render();fit();persist(!fromFolder);$('export-result').hidden=true;}
function saveProject(){if(project&&requireFinished()&&folder){void saveToFolder(true);return;}if(project&&requireFinished())void download(new Blob([JSON.stringify(project)],{type:'application/json'}),`${project.report||'Probenplan'}.probenplan`);}
async function allowReplace(){if(!project)return true;return new Promise<boolean>(resolve=>{const d=$<HTMLDialogElement>('replace-dialog');const text=d.querySelector('p')!;text.dataset.plain??=text.textContent||'';text.textContent=folder?`Der neue Plan ersetzt den Probenplan dieses Projekts. Die bisherige Datei bleibt in „${PLAENE}“ als „(vorher …)“-Kopie erhalten.`:text.dataset.plain;$('replace-save').hidden=!!folder;const finish=(ok:boolean)=>{d.close();resolve(ok);};$('replace-cancel').onclick=()=>finish(false);$('replace-yes').onclick=()=>finish(true);$('replace-save').onclick=()=>{saveProject();finish(true);};d.oncancel=()=>resolve(false);d.showModal();});}
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
$('marker-list').onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-select]');if(b){selectedArea=null;selected=b.dataset.select!;setMode('edit');render();}};
input('next').onchange=()=>{const n=Number(input('next').value);if(!Number.isSafeInteger(n)||n<1||n>=1e9){toast('Bitte eine ganze Startnummer zwischen 1 und 999999999 eingeben.',true);render();return;}mutate(p=>p.nextSample=n);};
input('label').onchange=()=>{const m=selectedMarker();if(!m||!project)return;const label=input('label').value.trim();if(!validLabel(project,label,m.id)){toast('Kennung bereits vergeben oder ungültig. Bitte 1–16 Zeichen (Buchstaben, Zahlen, Leerzeichen, Punkt, _ oder -) verwenden.',true);render();return;}mutate(()=>m.label=label);};
input('note').onchange=()=>{const m=selectedMarker();if(m)mutate(()=>m.note=input('note').value);};
for(const id of ['report','date'] as const)input(id).onchange=()=>mutate(p=>p[id]=input(id).value);
$('delete').onclick=()=>{if(selected)mutate(p=>{p.markers=p.markers.filter(m=>m.id!==selected);selected=null;});};
$('offset').onclick=()=>{const m=selectedMarker();if(m)mutate(p=>{m.lx=m.x+markerSize(p)*3;m.ly=m.y-markerSize(p)*3;});};
$('recenter').onclick=()=>{const m=selectedMarker();if(m)mutate(()=>{m.lx=m.x;m.ly=m.y;});};
function restored(old:Project['plan'],floor:number|undefined){if(!project)return;changed();if(old.data!==project.plan.data||old.width!==project.plan.width||old.height!==project.plan.height||floor!==project.active)fit();}
function undo(){if(project&&!cropping&&requireFinished()){const old=project.plan,floor=project.active;project=history.undo(project);restored(old,floor);}}function redo(){if(project&&!cropping&&requireFinished()){const old=project.plan,floor=project.active;project=history.redo(project);restored(old,floor);}}
$('undo').onclick=undo;$('redo').onclick=redo;
window.addEventListener('keydown',e=>{
  const editing=(target:EventTarget|null)=>target instanceof Element&&(!!target.closest('input,textarea,select,dialog,[role="dialog"],[role="textbox"]')||(target instanceof HTMLElement&&target.isContentEditable));
  if(e.defaultPrevented||e.isComposing||editing(e.target)||editing(document.activeElement)||document.querySelector('dialog:modal,[role="dialog"][aria-modal="true"]'))return;
  if(e.key==='Escape'&&(selected||selectedArea)){e.preventDefault();selected=null;selectedArea=null;render();return;}
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
  const placing=mode==='sample'||mode==='fire'||mode==='lab-place';
  // Only free-space gestures in placement tools pan; editor gestures stay unchanged.
  drag={id:e.pointerId,start:point(e),screen:{x:e.clientX,y:e.clientY},camera:{...camera},pan:mode==='navigate'||(placing&&!m),threshold:placing&&!m?(e.pointerType==='touch'?8:6):4,moved:false};
  if(mode==='area-edit'){const a=project.areas?.find(a=>a.id===target.closest('[data-area]')?.getAttribute('data-area'));if(a){selected=null;selectedArea=a.id;reveal('area-inspector');drag.area=a;drag.areaOriginal=clone(a);drag.before=clone(project);const vertex=target.closest('[data-vertex]')?.getAttribute('data-vertex');if(vertex!==null&&vertex!==undefined)drag.vertex=Number(vertex);render();}}
  if(m&&mode==='edit'){drag.marker=m;drag.original=clone(m);drag.before=clone(project);drag.part=target.closest('[data-drag]')?.getAttribute('data-drag')||'point';}
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
  else if(!d.moved&&mode==='lab-place'){labUI?.placeAt(point(e));}
  else if(!d.moved&&mode==='area-draw'){const pt=point(e);if(pt.x<0||pt.y<0||pt.x>project.plan.width||pt.y>project.plan.height){toast('Bitte innerhalb des Grundrisses zeichnen.');return;}if(draftPoints.length>=MAX_POINTS){toast(`Höchstens ${MAX_POINTS} Eckpunkte pro Fläche.`,true);return;}draftPoints.push(pt);render();}
  else if(d.marker&&d.moved&&d.before){history.push(d.before);changed();}
  else if(!d.moved&&(mode==='sample'||mode==='fire')){const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-id]');if(hit)return;const pt=point(e);if(pt.x<0||pt.y<0||pt.x>project.plan.width||pt.y>project.plan.height){toast('Bitte innerhalb des Grundrisses markieren.');return;}mutate(p=>{selected=addMarker(p,mode==='sample'?'sample':'fire',pt.x,pt.y).id;});}
}
svg.addEventListener('pointerup',e=>endPointer(e));svg.addEventListener('pointercancel',e=>endPointer(e,true));
new ResizeObserver(()=>{if(project){const rect=svg.getBoundingClientRect(),h=camera.width*rect.height/rect.width;if(Number.isFinite(h)){camera.y+=(camera.height-h)/2;camera.height=h;updateCamera();}}}).observe($('stage'));
input('quality').onchange=dimensions;
function exportName(p:Project,format:'png'|'jpeg',results=false){const floor=floorName(p);return `${`${folder?`Probenplan ${folder.name}`:p.report||'Probenplan'}${floor?` - ${floor}`:''}${results?' - Ergebniskarte':''}`.replace(/[<>:"/\\|?*]/g,'_')}.${format==='jpeg'?'jpg':'png'}`;}
async function runExport(){if(!project||busy||!requireFinished())return;busy=true;$<HTMLButtonElement>('export').disabled=true;$('export').textContent='Bild wird erstellt …';$('smaller').hidden=true;
  const resultsView=!$('view-field').hidden&&input('view').value==='results',all=sheetCount(project)>1&&input('scope').value==='all',format=input('format').value as 'png'|'jpeg',quality=Number(input('quality').value);
  try{
    if(all){const count=sheetCount(project);for(let i=0;i<count;i++){$('export').textContent=`Bild ${i+1} von ${count} wird erstellt …`;const view=clone(sheetProject(project,i));const image=await exportImage(view,quality,format,resultsView?rateMarkers(view):null,footerExtra()),name=exportName(view,format,resultsView);if(folder)await writeFile(folder.plaene,name,image);else await download(image,name);}
      $('export-result').hidden=true;toast(folder?`${count} Bilder in „${PLAENE}“ gespeichert – je Plan ein Bild.`:`${count} Bilder erstellt – je Plan ein Bild. Der Browser fragt eventuell einmal, ob mehrere Downloads erlaubt sind.`);}
    else{const blob=await exportImage(clone(project),quality,format,resultsView?rateMarkers(project):null,footerExtra());if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(blob);const a=$<HTMLAnchorElement>('export-link');a.hidden=false;a.href=exportURL;a.download=exportName(project,format,resultsView);$('export-result').hidden=false;if(folder){await writeFile(folder.plaene,a.download,blob);toast(`Bild gespeichert: ${PLAENE}/${a.download}`);}else{a.click();toast('Bild erstellt. Der Download ist bereit.');}}
  }catch(e){fail(e);$('export-result').hidden=false;$('export-link').hidden=!exportURL||all;$('smaller').hidden=quality<=3500;}finally{busy=false;$<HTMLButtonElement>('export').disabled=false;$('export').textContent='↓ Bild exportieren';render();}}
$('export').onclick=runExport;$('smaller').onclick=()=>{input('quality').value='3500';dimensions();void runExport();};$('help').onclick=()=>$<HTMLDialogElement>('help-dialog').showModal();
async function offline(){if(!('serviceWorker' in navigator)){ $('offline').textContent='○ Offline nicht verfügbar';return;}const update=()=>{$('offline').textContent=navigator.serviceWorker.controller?'● Offline bereit':'● Offline nach erneutem Öffnen bereit';$('offline').classList.add('ready');};navigator.serviceWorker.addEventListener('controllerchange',update);try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;update();}catch{if(navigator.serviceWorker.controller)update();else $('offline').textContent='○ Offline nicht eingerichtet';}}
labUI=new LabUI({project:()=>project,blocked:()=>busy||cropping||!!draftPoints.length,busy:value=>{busy=value;render();},mutate,point,mode:next=>{if(next==='lab-place'){selected=null;selectedArea=null;}setMode(next);render();},error:fail,selected:id=>{selected=id;selectedArea=null;}});
setMode('navigate');

// ---- PlanKit-Layout: Karte zuerst ----
// Kopfzeile mit Datei-Aktionen, Werkzeugleiste links, Plan in voller Größe, einklappbare Liste rechts, Export als Karte.
// Die Bedienelemente behalten ihre IDs; hier werden sie nur an ihren neuen Platz gesetzt.
function moveTo(target:Element,...ids:string[]){for(const id of ids){const e=document.getElementById(id);if(e)target.append(e);}}
const stageEl=$('stage'),panelScroll=document.querySelector('.panel-scroll')!;
moveTo(document.querySelector('.rail')!,'preparation');
moveTo(stageEl,'crop-actions','import-status');
moveTo($('toolbar'),'area-draft');
moveTo($('file-actions'),'lab-import','lab-files');
document.querySelector('.markers-section')!.before($('lab-panel'));
panelScroll.append(document.querySelector('.areas-section')!);
const railLabel=(id:string,icon:string,text:string,title:string,key?:string)=>{const b=document.getElementById(id) as HTMLButtonElement|null;if(!b)return;b.innerHTML=`<span class="tool-icon">${icon}</span><span>${text}</span>`;b.title=title;b.classList.add('mode','rail-action');if(key)b.dataset.key=key;};
railLabel('rotate-left','↶','Links','90° nach links drehen (Umschalt+R)');
railLabel('rotate-right','↷','Rechts','90° nach rechts drehen (R)','r');
railLabel('crop-start','⌗','Zuschnitt','Bildausschnitt zuschneiden (C)','c');
for(const [mode,key,text,title] of [['area-draw','f','Fläche +','Schadensfläche zeichnen (F)'],['area-edit','g','Fläche ✎','Schadensfläche bearbeiten (G)']] as const){const b=document.querySelector<HTMLButtonElement>(`[data-mode="${mode}"]`);if(!b)continue;b.dataset.key=key;b.title=title;const label=b.querySelector('span:last-child');if(label)label.firstChild!.textContent=text;}
document.querySelector('#help-dialog h2')!.insertAdjacentHTML('afterend','<h3>Tastenkürzel</h3><p><b>V</b> Ansicht · <b>P</b> Probe · <b>B</b> Brandherd · <b>E</b> Bearbeiten · <b>F</b> Fläche zeichnen · <b>G</b> Fläche bearbeiten · <b>R</b>/<b>Umschalt+R</b> drehen · <b>C</b> zuschneiden · <b>L</b> Liste ein/aus · <b>+</b>/<b>−</b> Zoom · <b>0</b> Einpassen · <b>Bild↑</b>/<b>Bild↓</b> Plan wechseln · <b>Strg+Z</b> rückgängig · <b>Entf</b> löschen · <b>Esc</b> abwählen</p>');
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
$('export-open').onclick=()=>{if(exportCard.open)exportCard.close();else{dimensions();exportCard.show();}};
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
  $<HTMLButtonElement>('sheet-add').disabled=busy||cropping||!!draftPoints.length||count>=MAX_SHEETS;
  const floor=floorName(p);document.querySelector('.markers-section h2')!.textContent=floor?`Markierungen · ${floor}`:'Markierungen';
  $('scope-field').hidden=single;if(!single){(input('scope') as unknown as HTMLSelectElement).options[0].text=`Dieser Plan (${floor})`;(input('scope') as unknown as HTMLSelectElement).options[1].text=`Alle ${count} Pläne · je ein Bild`;}
}
function showSheet(index:number){
  if(!project||busy||cropping||!requireFinished())return;const count=sheetCount(project);if(count<2||index<0||index>=count||index===(project.active??0))return;
  switchSheet(project,index);selected=null;selectedArea=null;$('export-result').hidden=true;render();fit();persist();
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
document.querySelector('.panel-scroll')!.insertAdjacentHTML('afterbegin','<section class="results-section" id="results-section" hidden><div class="section-heading"><h2>Ergebniskarte</h2></div><label>Bewerteter Parameter<select id="result-param"></select></label><label>Nutzung / Referenz<select id="result-usage"><option value="">Eigene / FotoKit-Skala</option><option value="residential">VdS 2357 · Wohn-/Büroräume · 10 µg/m²</option><option value="industrial">VdS 2357 · Industrie · 100 µg/m²</option></select></label><div id="result-scales"></div><p class="tiny">Kategorien aufsteigend: Ein Wert gehört zur letzten Kategorie, deren „ab“-Wert er erreicht; Unter BG nur bei „unter BG“ oder „&lt;“ mit gültiger Zahl. n.n.: Nicht nachgewiesen. n.b.: Nicht bestimmt / Bedeutung prüfen. Diese Angaben sind keine gemessenen Nullwerte; fehlerhafte „&lt;“-Angaben bleiben ohne Bewertung. Mehrdeutige Zahlen (z. B. 1.234) bleiben ohne Bewertung. Die Skalen gelten auch für die Ergebnistabelle in FotoKit. Farben werden im Projekt gespeichert. VdS 2357: Hintergrundreferenzen nur für Σ16 EPA-PAK auf Oberflächen, keine pauschalen Freigabe- oder Sanierungsgrenzwerte. Originalwerte und Einheiten bleiben erhalten.</p></section>');
document.querySelector('.canvas-footer')!.insertAdjacentHTML('beforeend','<span id="result-legend" hidden></span>');
let resultSignature='';
function renderResults(){
  const p=project,available=!!p&&hasValues(p);$<HTMLButtonElement>('results-toggle').disabled=!available||busy;
  if(!available&&showResults)showResults=false;
  $('results-toggle').setAttribute('aria-pressed',String(showResults));$('results-section').hidden=!showResults;
  $('view-field').hidden=!available;if(!available)input('view').value='plan';
  const legend=$('result-legend');legend.hidden=!showResults;
  if(!p||!showResults){resultSignature='';return;}
  const settings=p.results,list=parameters(p),rated=rateMarkers(p);
  legend.innerHTML=rated.groups.flatMap(g=>g.scale?g.scale.cats.map(c=>`<span><i style="background:${c.color}"></i>${escape(c.name)}</span>`):[]).join('')+qualifierGroups(rated).map(g=>`<span><i style="background:${g.color}"></i>${escape(g.name)}</span>`).join('')+(rated.unrated.length?`<span><i style="background:${UNRATED}"></i>ohne Bewertung</span>`:'');
  const signature=JSON.stringify([settings,list,rated.groups.map(g=>g.cats.map(c=>c.labels)),rated.unrated,rated.below,rated.notDetected,rated.notDetermined]);if(signature===resultSignature)return;resultSignature=signature;
  const select=input('result-param') as unknown as HTMLSelectElement;select.innerHTML=list.map(x=>`<option value="${escape(x)}">${escape(x)}</option>`).join('');select.value=settings?.parameter||'';
  (input('result-usage') as unknown as HTMLSelectElement).value=settings?.usage||'';
  const parameter=settings?.parameter||'';
  $('result-scales').innerHTML=units(p,parameter).map(unit=>{
    const key=scaleKey(parameter,unit),scale=settings?.usage?vdsScale(parameter,unit,settings.usage):settings?.scales[key],group=rated.groups.find(g=>g.key===key);
    if(settings?.usage)return `<div class="result-scale"><h3>${escape(shortParameter(parameter))} in ${escape(unit)}</h3>${scale?`<p class="tiny">${escape(scale.name)}</p>${scale.cats.map((c,i)=>`<p class="tiny">${escape(c.name)}: ${escape(rangeText(scale,i,unit))}${group?.cats[i]?.labels.length?` · ${escape(group.cats[i].labels.join(', '))}`:''}</p>`).join('')}`:'<p class="tiny">VdS-Referenz für diesen Parameter / diese Einheit nicht anwendbar.</p>'}</div>`;
    if(!scale)return `<div class="result-scale" data-key="${escape(key)}"><h3>${escape(shortParameter(parameter))} in ${escape(unit||'(ohne Einheit)')}</h3><p class="tiny">Noch keine Bewertungsskala – die Proben bleiben grau.</p><div class="inspector-actions"><button data-scale-new>Skala anlegen</button>${fromShared(key)?'<button data-scale-shared>Aus FotoKit übernehmen</button>':''}</div></div>`;
    return `<div class="result-scale" data-key="${escape(key)}"><h3>${escape(shortParameter(parameter))} in ${escape(unit||'(ohne Einheit)')}</h3><label class="scale-name">Name der Skala <span class="optional">optional</span><input data-scale-name maxlength="160" value="${escape(scale.name)}" placeholder="z. B. PAK Wischproben, Stand 10/2026"></label>
      <table class="scale-table"><thead><tr><th></th><th>Kategorie</th><th>ab ${escape(unit)}</th><th></th></tr></thead><tbody>${scale.cats.map((c,i)=>`<tr data-cat="${i}"><td><input type="color" data-cat-color value="${c.color}" aria-label="Farbe ${escape(c.name)}"></td><td><input data-cat-name maxlength="60" value="${escape(c.name)}" aria-label="Kategorie ${i+1}"></td><td><input data-cat-from type="number" step="any" min="0" value="${c.from}" ${i===0?'disabled':''} aria-label="ab-Wert Kategorie ${i+1}"></td><td>${i?`<button data-cat-del title="Kategorie entfernen" aria-label="Kategorie entfernen">×</button>`:''}</td></tr><tr class="cat-samples"><td></td><td colspan="3">${escape(rangeText(scale,i,unit))}${group?.cats[i]?.labels.length?` · ${escape(group.cats[i].labels.join(', '))}`:''}</td></tr>`).join('')}</tbody></table>
      <div class="inspector-actions"><button data-cat-add ${scale.cats.length>=12?'disabled':''}>＋ Kategorie</button><button data-scale-auto title="Farben von grün (unterste) bis rot (oberste Kategorie)">Farben automatisch</button><button data-scale-del class="danger">Skala entfernen</button></div></div>`;
  }).join('')+qualifierGroups(rated).map(g=>`<p class="tiny">${escape(g.name)}: ${escape(g.labels.join(', '))}</p>`).join('')+(rated.unrated.length?`<p class="tiny">Ohne Bewertung (grau): ${escape(rated.unrated.join(', '))}</p>`:'');
}
function setScale(key:string,scale:Scale|null){if(!project?.results)return;mutate(p=>{if(scale)p.results!.scales[key]=scale;else delete p.results!.scales[key];});saveShared(key,scale);}
function currentScale(key:string){return project?.results?.scales[key];}
function recolor(scale:Scale):Scale{const colors=autoColors(scale.cats.length);return {...scale,cats:scale.cats.map((c,i)=>({...c,color:colors[i]}))};}
$('results-toggle').onclick=()=>{if(!project||!hasValues(project))return;showResults=!showResults;if(showResults&&prepare(project))persist();render();if(showResults)reveal('results-section');};
(input('result-param') as unknown as HTMLSelectElement).onchange=()=>{const value=input('result-param').value;mutate(p=>{p.results={...p.results,parameter:value,scales:p.results?.scales||{}};prepare(p);});};
(input('result-usage') as unknown as HTMLSelectElement).onchange=()=>{const usage=input('result-usage').value;mutate(p=>{if(!p.results)return;if(usage==='residential'||usage==='industrial')p.results.usage=usage;else delete p.results.usage;});};
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
document.querySelector('#help-dialog h3')!.insertAdjacentHTML('beforebegin','<h3>Ergebniskarte</h3><p>Nach dem Import einer Labor-XML speichert PlanKit die Messwerte je Probe (nur lokal). „Ergebnisse“ in der Kopfzeile (Taste <b>K</b>) färbt die Probenmarker nach Ihrer Bewertungsskala; Proben ohne Wert oder Skala bleiben grau. Parameter (Standard Σ16 EPA-PAK) und Skala je Einheit stellen Sie in der Liste rechts ein – dieselben Skalen nutzt FotoKit für die Ergebnistabelle. Beim Export „Darstellung: Ergebniskarte“ wählen; die Legende nennt Kategorien, Wertebereiche und Probennummern. Ältere Projekte: dieselbe XML erneut importieren und „Aktualisieren“ wählen, dann erhalten bereits platzierte Proben ihre Werte.</p>');

// ---- Projektordner (Projektzentrale) ----
// Mit ?projekt=<Ordnername> oder „Projekt …“ arbeitet PlanKit direkt im Ordner „Pläne“ des Projekts:
// automatisches Speichern als „Probenplan <Projekt>.probenplan“, Bilder ebenfalls dorthin, Laborberichte aus „Laborergebnisse“.
let folder:ProjectFolder|null=null,folderRevision:string|null=null,folderDirty=false,folderTimer=0,folderBlocked=false,projectData:Record<string,unknown>={};
let folderWriting:Promise<void>=Promise.resolve();
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
document.querySelector('#app-version')!.insertAdjacentHTML('afterend','<span id="project-badge" class="project-badge" hidden></span>');
$('file-actions').insertAdjacentHTML('afterbegin','<button id="open-folder" class="tb" title="Projektordner wählen (z. B. „26.0123 Köln“) – PlanKit speichert dann direkt in dessen Ordner „Pläne“">📁 Projekt</button>');
$('open-folder').hidden=!folderSupported();
document.querySelector('#welcome-load')!.insertAdjacentHTML('afterend','<div id="folder-prompt" class="folder-prompt" hidden><p id="folder-prompt-text"></p><button id="folder-allow" class="primary">Zugriff erlauben und Projekt öffnen</button></div><div id="folder-plans" class="folder-plans" hidden></div>');
document.body.insertAdjacentHTML('beforeend','<dialog id="ask-dialog"><h2 id="ask-title"></h2><p id="ask-text"></p><div class="dialog-actions" id="ask-actions"></div></dialog><dialog id="lab-folder-dialog"><form method="dialog"><button class="close" aria-label="Schließen">×</button></form><span class="eyebrow">PROBEN ÜBERNEHMEN</span><h2>Welche Proben übernehmen?</h2><p class="muted">Laborberichte aus „Laborergebnisse“ (XML und PDF mit gleichem Namen gemeinsam) oder die Probenerfassung aus LabelKit.</p><div id="lab-folder-list"></div><div class="dialog-actions"><button id="lab-folder-other">Andere Datei …</button></div></dialog>');
function ask(title:string,text:string,choices:string[]):Promise<string>{return new Promise(resolve=>{const d=$<HTMLDialogElement>('ask-dialog');$('ask-title').textContent=title;$('ask-text').textContent=text;$('ask-actions').replaceChildren(...choices.map((c,i)=>{const b=document.createElement('button');b.textContent=c;if(i===choices.length-1)b.className='primary';b.onclick=()=>{d.close();resolve(c);};return b;}));d.oncancel=e=>{e.preventDefault();};d.showModal();});}
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
$('save-project').insertAdjacentHTML('afterend','<button id="emergency-copy" class="tb" title="Geöffnete Fassung zusätzlich als Datei herunterladen" hidden>Notfallkopie</button>');
$('emergency-copy').onclick=()=>{if(project)void download(new Blob([JSON.stringify(project)],{type:'application/json'}),`PlanKit Notfallkopie ${folder?.name||project.report||'Projekt'} ${Date.now()}.probenplan`);};
async function renderFolderPlans(){
  const box=$('folder-plans');if(!folder||project){box.hidden=true;return;}
  const files=(await listFiles(folder.plaene,/\.(pdf|svg|png|jpe?g|zip)$/i)).filter(f=>!/^Probenplan /i.test(f.name)).slice(0,8);
  box.hidden=!files.length;box.innerHTML=files.length?`<span class="eyebrow">AUS „${escape(PLAENE.toUpperCase())}“</span>`+files.map((f,i)=>`<button data-plan-file="${i}">${escape(f.name)}</button>`).join(''):'';
  box.onclick=async e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-plan-file]');if(!b)return;const f=files[Number(b.dataset.planFile)];await importFile(await f.handle.getFile());};
}
async function enterFolder(dir:Parameters<typeof openFolder>[0]){
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
  if(next&&!recovered){
   const recoveryFiles=(await listFiles(target.plaene,/\.probenplan$/i)).filter(f=>f.name!==preservedBrowserDraft&&f.name.startsWith(`Probenplan ${target.name} (Wiederherstellung `)).slice(0,30);
   const differing:typeof recoveryFiles=[];for(const candidate of recoveryFiles)if(await fileRevision(await candidate.handle.getFile())!==currentRevision)differing.push(candidate);
   if(differing.length){const choice=await ask('Unterbrochenes Speichern prüfen','Es gibt abweichende Wiederherstellungsdateien. Aktuelle Datei verwenden oder eine Fassung zur Prüfung öffnen?',['Abbrechen','Datei verwenden',...differing.map(f=>f.name)]);if(choice==='Abbrechen')return;const selected=differing.find(f=>f.name===choice);if(selected){try{next=await validateProject(JSON.parse(await(await selected.handle.getFile()).text()));recovered=true;}catch(e){fail(e);return;}}}
  }
  if(!next){
   const candidates=(await listFiles(target.plaene,/\.probenplan$/i)).filter(f=>f.name!==projectFileName(target)).slice(0,30);
   if(canonical||candidates.length){
    const choice=await ask('Projektdatei fehlt oder ist beschädigt','Bitte eine Sicherungs-/Wiederherstellungsdatei ausdrücklich auswählen. Die vorhandenen Dateien werden nicht verändert.',['Abbrechen',...candidates.map(f=>f.name)]);
    const selected=candidates.find(f=>f.name===choice);if(!selected)return;
    try{file=await selected.handle.getFile();next=await validateProject(JSON.parse(await file.text()));recovered=true;}catch(e){fail(e);return;}
   }
  }
  const metadata=await readProjectData(target),transition=()=>{folder=target;folderRevision=currentRevision;folderDirty=recovered;folderBlocked=false;projectData=metadata;};
  if(next){if(!next.report)next.report=target.name;await install(next,true,transition);$('saved').textContent=recovered?'Wiederhergestellt – bitte prüfen und „Speichern“ klicken':`✓ Aus „${PLAENE}“ geladen`;}
  else{await preserveUnsavedProject();transition();labUI?.reset();project=null;history.clear();render();$('saved').textContent=`Projekt ${target.name}`;}
  showFolder();$('folder-prompt').hidden=true;await renderFolderPlans();
  window.history.replaceState(null,'',`?projekt=${encodeURIComponent(target.name)}`);
  toast(next?`Projekt ${target.name}: Probenplan aus „${PLAENE}“ geöffnet.`:`Projekt ${target.name}: noch kein Probenplan – Grundriss wählen.`);
}
async function openFromZentrale(name:string){
  const root=await archiv();
  if(!root){toast(`Projekt „${name}“: Der Archivordner ist in diesem Browser nicht bekannt. Bitte in der Projektzentrale einmal den Archivordner wählen – oder hier „📁 Projekt …“.`,true);return;}
  const go=async()=>{try{await enterFolder(await root.getDirectoryHandle(name) as Parameters<typeof openFolder>[0]);}catch(e){toast(`Projekt „${name}“ nicht gefunden in „${root.name}“: ${e instanceof Error?e.message:''}`,true);}};
  if(await permission(root)){await go();return;}
  $('folder-prompt-text').innerHTML=`Projekt <b>${escape(name)}</b> aus der Projektzentrale`;$('folder-prompt').hidden=false;
  $('folder-allow').onclick=async()=>{if(await permission(root,true))await go();else toast('Ohne Zugriff auf den Archivordner kann das Projekt nicht geöffnet werden.',true);};
}
$('open-folder').onclick=async()=>{if(busy||cropping||!requireFinished())return;try{const dir=await pickFolder();if(!dir)return;const projectDir=await projectDirOf(dir);if(!projectDir){toast('Bitte den Projektordner (z. B. „26.0123 Köln“) oder dessen Ordner „Pläne“ wählen.',true);return;}await enterFolder(projectDir);}catch(e){fail(e);}};
// Laborbericht im Projekt: Auswahl aus „Laborergebnisse“
$('lab-import').onclick=async()=>{
  if(!folder||!project){input('lab-files').click();return;}
  const dir=await findSubdir(folder.dir,LABOR),files=dir?await listFiles(dir,/\.(xml|pdf)$/i):[];
  const auftraege=await findSubdir(folder.dir,AUFTRAEGE),erfassung=auftraege?(await listFiles(auftraege,/_Daten\.json$/i))[0]:undefined;
  if(!files.length&&!erfassung){input('lab-files').click();return;}
  const groups=new Map<string,typeof files>();for(const f of files){const key=f.name.replace(/\.(xml|pdf)$/i,'').toLowerCase();groups.set(key,[...(groups.get(key)||[]),f]);}
  const entries=[...groups.values()].map(g=>g.sort(a=>/\.xml$/i.test(a.name)?-1:1));
  const d=$<HTMLDialogElement>('lab-folder-dialog');
  $('lab-folder-list').innerHTML=(erfassung?`<button class="choice labelkit-choice" data-labelkit>Probenerfassung aus LabelKit: ${escape(erfassung.name)}<small>${escape(clock(erfassung.lastModified))} · „${escape(AUFTRAEGE)}“ – Proben vorab als „Noch zu platzieren“, Messwerte folgen mit dem Laborbericht</small></button>`:'')+entries.map((g,i)=>`<button class="choice" data-lab-file="${i}">${escape(g.map(f=>f.name).join(' + '))}<small>${escape(clock(Math.max(...g.map(f=>f.lastModified))))}</small></button>`).join('');
  $('lab-folder-list').onclick=async e=>{if(erfassung&&(e.target as HTMLElement).closest('[data-labelkit]')){d.close();try{labUI?.show(labelkitReport(await (await erfassung.handle.getFile()).text(),erfassung.name,folder!.name));}catch(err){fail(err);}return;}const b=(e.target as HTMLElement).closest<HTMLElement>('[data-lab-file]');if(!b)return;d.close();await labUI?.import(await Promise.all(entries[Number(b.dataset.labFile)].map(f=>f.handle.getFile())));};
  $('lab-folder-other').onclick=()=>{d.close();input('lab-files').click();};d.showModal();
};
document.querySelector('#help-dialog h3')!.insertAdjacentHTML('beforebegin',`<h3>Projektordner</h3><p>Aus der Projektzentrale „Plan bearbeiten“ wählen oder hier „📁 Projekt …“ und den Projektordner (z. B. „26.0123 Köln“) auswählen. PlanKit speichert dann jede Änderung automatisch als „Probenplan &lt;Projekt&gt;.probenplan“ im Ordner „${PLAENE}“; exportierte Bilder landen ebenfalls dort. Grundrisse aus „${PLAENE}“, Laborberichte aus „${LABOR}“ und die Probenerfassung aus LabelKit („${AUFTRAEGE}“) stehen direkt zur Auswahl. Mit LabelKit erfasste Proben erscheinen so schon vor dem Laborbericht unter „Noch zu platzieren“; kommt der Bericht, ergänzt „Alle Konflikte: Aktualisieren“ Labordaten und Messwerte. Hat ein Kollege den Plan zwischenzeitlich gespeichert, fragt PlanKit nach, statt zu überschreiben. Vor jedem Überschreiben bleibt die vorherige Datei als eindeutig benannte „(vorher …)“-Kopie erhalten. Eine Wiederherstellungsdatei sichert die neue Fassung bis zum bestätigten Speichern. Bei Fehlern „Speichern“ erneut versuchen und ggf. Ordnerzugriff erlauben; „Notfallkopie“ lädt die geöffnete Fassung herunter. Nach einem Abbruch Wiederherstellungs-/Browserfassung ausdrücklich auswählen, prüfen und speichern.</p>`);
const startProject=new URLSearchParams(location.search).get('projekt');
void (async()=>{if(startProject){await openFromZentrale(startProject);void offline();return;}try{const saved=await restoreLocal();if(saved){await install(await validateProject(saved));toast('Letztes Projekt wiederhergestellt.');}}catch{toast('Die letzte Browsersicherung konnte nicht geladen werden. Sie können eine Projektdatei öffnen.',true);}finally{void offline();}})();
