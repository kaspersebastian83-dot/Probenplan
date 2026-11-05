// PlanKit 2.0 – einfache Oberfläche (Spektron Schritt 3): Kopfband (Leiste v3) · drei Schritte auf der Karte · rechte Spalte je Schritt ·
// Hinweiskarte · Fußleiste mit „Mehr …“, Stand und einer Hauptaktion. Nur Oberfläche: Alle Bedienelemente behalten ihre IDs und Handler;
// hier werden sie an neue Plätze gesetzt. Was nicht mehr im ersten Blick steht, liegt unsichtbar in #pk-alt und wird per click() ausgelöst.
// Zustand bleibt `mode` in main.ts – die Schritte sind nur Ansichten (body[data-pk-schritt]); nachRender() hält alles aktuell.
import type {LabUI} from './labui';
import type {Project} from './model';
import {allMarkers,sheetCount} from './model';
import {naechste,weiterOn,setWeiter,jetztText} from './weiter';
import {ANNEX_DIR} from './annex-run';
import {PLAENE} from './folder';

export type Schritt='1'|'2'|'3'|'f';
export interface PkHooks{
 project():Project|null; mode():string; setMode(m:string):void; render():void; fit():void;
 blocked():boolean; cropping():boolean; folder():string|null; labUI():LabUI|null;
 showSheet(i:number):void; openSheetMenu(i:number):void; deselect():void; selectedId():string|null;
 exportCard:HTMLDialogElement; dimensions():void; folderSupported():boolean;
 toast(text:string,error?:boolean):void;
}
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const h=<K extends keyof HTMLElementTagNameMap>(tag:K,attrs:Record<string,string>={},text=''):HTMLElementTagNameMap[K]=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e;};
const moveTo=(target:Element,...ids:string[])=>{for(const id of ids){const e=document.getElementById(id);if(e)target.append(e);}};
const SCHRITTE:[Schritt,string][]=[['1','Plan laden'],['2','Proben setzen'],['3','Plan ausgeben']];
const FORMAT_KEY='plankit-format';
/** Abschnitt → Schritt, in dem er steht (für „anzeigen“ nach Import oder Punktwahl). Ergebniskarte: nur, wenn ③ schon offen ist. */
const SCHRITT_VON:Record<string,Schritt>={'inspector':'2','proben-section':'2','lab-panel':'2','size-section':'3','label-section':'3','raumbuch-section':'3','scale-section':'1','area-inspector':'f','area-list':'f'};
/** Tastenkürzel, deren Knopf in einem anderen Schritt liegt: erst dorthin wechseln, nie still in einem unsichtbaren Schritt auslösen. */
const KUERZEL:Record<string,Schritt>={p:'2',b:'2',e:'2',f:'f',g:'f',r:'1',c:'1',a:'1',w:'1'};
const MEHR_ICON='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';

export class Oberflaeche{
 private schritt:Schritt='1';private vorFlaechen:Schritt='2';
 private autoStart=false;private letzteProbe:string|null=null;private offenVorher=-1;
 private formatGesetzt=false;private ausgabeStand:string|null=null;private ausgabeFormat='';
 private hatteProjekt=false;
 constructor(private hooks:PkHooks){this.aufbauen();}

 get aktuell(){return this.schritt;}

 private aufbauen(){
  document.body.classList.add('pk2');
  const app=$('app'),stage=$('stage'),panel=$('side-panel'),scroll=panel.querySelector('.panel-scroll')!;
  // ---- unsichtbarer Behälter für die alte Navigation (Zustand und Handler bleiben) ----
  const alt=h('div',{id:'pk-alt',hidden:'','aria-hidden':'true'});app.append(alt);
  alt.append(document.querySelector('.topbar')!,document.querySelector('.rail')!);
  moveTo(alt,'panel-tabs','export-open','lab-panel','toolbar');
  // ---- Schritte, Werkzeuge und Plan-Chips schweben auf der Karte ----
  const oben=h('div',{id:'pk-oben'});
  const schritte=h('nav',{id:'pk-schritte','aria-label':'Arbeitsschritte in PlanKit'});
  SCHRITTE.forEach(([s,name],i)=>{if(i)schritte.append(h('span',{class:'pk-strich','aria-hidden':'true'}));const b=h('button',{type:'button',class:'pk-schritt','data-pk-step':s});b.append(h('span',{class:'pk-kreis'},s),h('span',{class:'pk-sname'},name));b.onclick=()=>this.zeige(s);schritte.append(b);});
  const flaechenTitel=h('span',{id:'pk-flaechen-titel',class:'pk-flaechen-titel'},'Schadensflächen');schritte.append(flaechenTitel);
  const werkzeuge=h('div',{id:'pk-werkzeuge',role:'group','aria-label':'Werkzeug'});
  const wz=(id:string,text:string,title:string,fn:()=>void)=>{const b=h('button',{type:'button',id,class:'pk-wz',title},text);b.onclick=fn;werkzeuge.append(b);return b;};
  wz('pk-w-setzen','Proben setzen','Nächste offene Probe setzen – ein Tipp in den Plan setzt sie (P: Probe von Hand)',()=>this.setzen());
  wz('pk-w-brand','Brandherd','Brandherd setzen – in den Plan tippen (B)',()=>this.altModus('fire'));
  wz('pk-w-schieben','Punkte verschieben','Punkt oder Schild ziehen, antippen zeigt die Probe (E)',()=>this.altModus('edit'));
  wz('pk-w-fzeichnen','Fläche zeichnen','Schadensfläche zeichnen: Eckpunkte setzen und abschließen (F)',()=>this.altModus('area-draw'));
  wz('pk-w-fbearbeiten','Fläche bearbeiten','Fläche wählen, Eckpunkte oder ganze Fläche ziehen (G)',()=>this.altModus('area-edit'));
  wz('pk-w-ffertig','Fertig','Zurück zum vorherigen Schritt',()=>this.flaechenFertig());
  oben.append(schritte,werkzeuge);
  const chips=h('div',{id:'pk-plaene',role:'group','aria-label':'Pläne des Projekts'});
  stage.append(oben,chips);
  // ---- Hinweiskarte unten links: „Als Nächstes setzen …“, Probe von Hand, Brandherd, Pause ----
  const hinweis=h('div',{id:'pk-hinweis',role:'status'});stage.append(hinweis);
  const text=h('span',{id:'pk-hinweis-text'});const knoepfe=h('span',{class:'pk-hinweis-knoepfe'});
  const weiterSetzen=h('button',{type:'button',id:'pk-weiter-setzen'},'Weiter setzen');weiterSetzen.onclick=()=>this.setzen();
  const pause=h('button',{type:'button',id:'pk-pause',title:'Setzen anhalten – Ziehen und Zoomen gehen weiter (Esc)'},'Pause');pause.onclick=()=>this.pause();
  knoepfe.append(weiterSetzen,pause);
  hinweis.append(text);moveTo(hinweis,'weiter-chip','mode-hint','next-field','shape-field');hinweis.append(knoepfe);
  $('weiter-done').textContent='Pause';$('weiter-done').title='Setzen anhalten (Esc)';
  // ---- Zoom unten rechts mit Rückgängig/Wiederholen in Worten ----
  const zoom=stage.querySelector('.zoom-controls')!;
  const undo=$('undo'),redo=$('redo');undo.innerHTML='↶ <span class="pk-wort">Rückgängig</span>';undo.setAttribute('aria-label','Rückgängig');redo.innerHTML='↷ <span class="pk-wort">Wiederholen</span>';redo.setAttribute('aria-label','Wiederholen');redo.title='Wiederholen (Strg+Y)';
  const verlauf=h('span',{class:'pk-verlauf'});verlauf.append(undo,redo);zoom.prepend(verlauf,h('span',{class:'divider'}));
  $('zoom-in').textContent='+';
  // Ergebnislegende bleibt (über dem Zoom); Legende Probe/Brandherd und „Original bleibt unverändert“ entfallen (Planmaße → Plankarte ①)
  const footer=stage.querySelector('.canvas-footer')!;footer.classList.add('pk-legende');[...footer.children].forEach(c=>{if(c.id!=='result-legend'&&c.id!=='source-info')alt.append(c);});
  // ---- Lasche am rechten Kartenrand, wenn die Spalte zu ist ----
  const lasche=$('panel-toggle');lasche.className='pk-lasche';stage.append(lasche);
  // ---- rechte Spalte: je Schritt eine Ansicht ----
  const kopf=panel.querySelector('.panel-head')!;kopf.querySelector('.eyebrow')?.remove();
  const titel=h('div',{class:'pk-kopf'});titel.append(h('strong',{id:'pk-kopf-titel'}),h('span',{id:'pk-kopf-zahl'}));kopf.prepend(titel);
  const sicht=(id:string)=>{const s=h('div',{id,class:'pk-sicht'});scroll.append(s);return s;};
  const s1=sicht('pk-s1'),s2=sicht('pk-s2'),s3=sicht('pk-s3'),sf=sicht('pk-sf');
  // ① Plan laden: Planliste (Vorschaubilder), weitere Pläne, Plan vorbereiten, Maßstab & Norden, „Diesen Plan ersetzen …“
  const planKarte=h('section',{id:'pk-plankarte',class:'pk-karte'});s1.append(planKarte);   // erst einhängen, dann umsetzen (getElementById findet nur Eingehängtes)
  const planInfo=h('div',{class:'pk-planinfo'});moveTo(planInfo,'canvas-name','file-type','plan-name','source-info');
  planKarte.append(h('h2',{},'Pläne im Projekt'),h('p',{id:'pk-kein-plan',class:'tiny'},'Noch kein Plan. Grundriss auswählen oder ohne Plan eine Skizze zeichnen – beides auf der Karte links.'),planInfo);moveTo(planKarte,'sheet-strip');
  $('sheet-add').textContent='＋ Weiteren Plan (Geschoss) …';$('sheet-sketch').textContent='＋ Skizze als weiteren Plan';
  const vorbereiten=h('section',{id:'pk-vorbereiten',class:'pk-karte'});s1.append(vorbereiten);vorbereiten.append(h('h2',{},'Plan vorbereiten'));moveTo(vorbereiten,'preparation');
  for(const [id,t] of [['rotate-left','↶ Links drehen'],['rotate-right','↷ Rechts drehen'],['crop-start','Zuschneiden'],['align-start','Ausrichten'],['warp-start','Entzerren'],['sketch-edit','Skizze bearbeiten'],['sketch-tb','Skizze zeichnen']] as const){const b=document.getElementById(id);if(b){b.textContent=t;b.classList.remove('mode','rail-action');}}
  $('preparation').querySelector('.preparation-buttons')?.append($('sketch-edit'));$('preparation').querySelector('.tiny')?.remove();$('preparation').querySelector('.eyebrow')?.remove();
  alt.append($('sketch-tb'));   // „Skizze“ ohne Plan: Startkarte; mit Plan: „＋ Skizze als weiteren Plan“
  const ersetzen=h('div',{class:'pk-ersetzen'});s1.append($('scale-section'),ersetzen);moveTo(ersetzen,'load');
  // ② Proben setzen: gewählter Punkt („Probe P3“) oben, darunter die Probenliste; „Ergebnisfarben zeigen“ unten
  const probeKopf=h('div',{class:'pk-probe-kopf'});probeKopf.append(h('strong',{id:'pk-probe-titel'}));const zurueck=h('button',{type:'button',id:'pk-probe-zurueck',class:'pk-klein'},'× zurück zur Liste');zurueck.onclick=()=>this.hooks.deselect();probeKopf.append(zurueck);
  const markers=document.querySelector('.markers-section')!;markers.prepend(probeKopf);
  const label=$('label').closest('label')!;label.after(h('p',{id:'pk-kennung-fest',class:'tiny',hidden:''},'Kennung kommt aus LabelKit – dort ändern.'));
  const proben=$('proben-section');
  const listeKopf=proben.querySelector('.section-heading')!;listeKopf.querySelector('h2')!.textContent='Proben aus LabelKit';listeKopf.classList.add('pk-listenkopf');
  const zahl=h('p',{id:'pk-proben-zahl',class:'pk-proben-zahl',hidden:''});listeKopf.after(zahl);
  const importKnopf=$('lab-import');importKnopf.className='sp-knopf pk-import';listeKopf.querySelector('h2')!.replaceWith(importKnopf);
  s2.append(markers,proben);
  const leer=h('div',{id:'pk-proben-leer',class:'pk-leer',hidden:''});const gross=h('button',{type:'button',id:'pk-import-gross',class:'sp-knopf-app sp-knopf'},'Proben aus LabelKit übernehmen …');gross.onclick=()=>$('lab-import').click();   // derselbe Weg wie der kleine Knopf (im Projekt: Auswahl aus „Laborergebnisse“/„Laboraufträge“)
  leer.append(gross,h('p',{class:'tiny'},'oder eigene Proben mit „Probe von Hand“ setzen'));importKnopf.after(leer);
  const ergebnis=h('div',{class:'pk-ergebnisfarben'});const rt=$('results-toggle');rt.className='pk-schalter';rt.textContent='Ergebnisfarben zeigen';ergebnis.append(rt);
  s2.append(ergebnis);
  moveTo(alt,'weiter-switch');const sw=document.querySelector('.weiter-switch');if(sw)alt.append(sw);
  // ③ Plan ausgeben: Exportkarte (nicht modal, offen), Darstellung, Weitere Anlagen
  const exp=this.hooks.exportCard;s3.append(exp);
  exp.querySelector('.eyebrow')?.remove();const expH=exp.querySelector('h2');if(expH)expH.textContent='Ausgabe fürs Gutachten';
  (exp.querySelector('p.muted')||exp.querySelector('h2'))?.after(h('p',{id:'pk-offen-warnung',class:'pk-warnung',hidden:''}));
  const erledigt=h('p',{id:'pk-erledigt',class:'pk-erledigt',hidden:''});exp.append(erledigt);
  const darstellung=h('section',{id:'pk-darstellung',class:'pk-karte'});s3.append(darstellung);darstellung.append(h('h2',{},'Darstellung'));moveTo(darstellung,'size-section','label-section');
  const ek=h('details',{id:'pk-ergebniskarte'});darstellung.append(ek);ek.append(h('summary',{},'Ergebniskarte einstellen'));moveTo(ek,'results-section');
  const anlagen=h('section',{id:'pk-anlagen',class:'pk-karte'});s3.append(anlagen);anlagen.append(h('h2',{},'Weitere Anlagen'));moveTo(anlagen,'raumbuch-section');
  // Flächen-Ansicht (über „Mehr …“ oder F/G): Entwurf und Flächenliste rechts
  const fl=document.querySelector('.areas-section')!;sf.append(fl);fl.querySelector('.section-heading')?.after($('area-draft'));
  // ---- Fußleiste ----
  const fuss=h('footer',{id:'pk-fuss'});
  const mehr=h('button',{type:'button',id:'pk-mehr',class:'sp-knopf','aria-haspopup':'menu',title:'Schadensflächen, Projektdatei, Projektordner, Kurzanleitung, Version, Handbuch …'});mehr.innerHTML=MEHR_ICON+'Mehr …';mehr.onclick=()=>this.mehr(mehr);
  document.body.append(fuss);const stand=h('div',{class:'pk-stand'});fuss.append(mehr,stand);stand.append(h('span',{id:'pk-stand-text',class:'pk-stand-text'}));moveTo(stand,'saved','save-project');
  const save=$('save-project');save.className='sp-knopf pk-klein';
  const neben=h('button',{type:'button',id:'pk-neben',class:'sp-knopf',hidden:''});const haupt=h('button',{type:'button',id:'pk-haupt',class:'sp-haupt'});
  neben.onclick=()=>this.neben();haupt.onclick=()=>this.haupt();
  fuss.append(neben,haupt);
  new MutationObserver(()=>this.standZeigen()).observe($('saved'),{childList:true,characterData:true,subtree:true});
  new MutationObserver(()=>this.fussZeigen()).observe($('export'),{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['disabled']});
  // ---- Startkarte (①): „Projektordner öffnen …“ dazu, wenn kein Projekt offen ist ----
  const welcome=$('welcome');welcome.querySelector('.eyebrow')!.textContent='SCHRITT 1 · PLAN LADEN';welcome.querySelector('h2')!.innerHTML='Womit zeichnest du<br>den Probenplan?';
  const ordner=h('button',{type:'button',id:'pk-ordner-start',class:'welcome-sketch'},'📁 Projektordner öffnen …');ordner.onclick=()=>$('open-folder').click();(welcome.querySelector('.welcome-sketch-hint')||$('welcome-sketch')).after(ordner);
  // ---- Format merken (E10) ----
  $('format').addEventListener('change',()=>{try{localStorage.setItem(FORMAT_KEY,(document.getElementById('format') as HTMLSelectElement).value);}catch{/* privates Fenster */}});
  // Hinweis auf offene Proben und der „erledigt“-Zustand hängen an den Ausgabe-Feldern
  for(const id of ['format','view','scope','quality','framed','values-export','annex-title','annex-photos','report','date'])document.getElementById(id)?.addEventListener('change',()=>this.nachRender());
  window.addEventListener('resize',()=>this.fussHoehe());new ResizeObserver(()=>this.fussHoehe()).observe(fuss);
  this.anzeigen('1');
 }

 /** Schritt zeigen (Klick auf einen Kreis, Hauptaktion, Kürzel). Gesperrt, solange eine Vollbild-Leiste (Zuschnitt, Skizze …) offen ist. */
 zeige(s:Schritt){
  if(this.hooks.cropping())return;
  const vorher=this.schritt;if(s==='f'&&vorher!=='f')this.vorFlaechen=vorher;
  if(vorher===s){this.nachRender();return;}
  const mode=this.hooks.mode(),lab=this.hooks.labUI();
  // Werkzeuge gehören zu ihrem Schritt: beim Wechsel zurück zur Ansicht (Platzieren, Brandherd … sind in ① und ③ nicht sichtbar)
  if(mode==='lab-place')lab?.fertig();else if(mode!=='navigate'&&!(s==='1'&&mode==='measure'))this.hooks.setMode('navigate');
  if(s==='2')this.autoStart=true;
  this.anzeigen(s);this.hooks.render();
 }
 private anzeigen(s:Schritt){
  this.schritt=s;document.body.dataset.pkSchritt=s;
  const exp=this.hooks.exportCard;
  // show() setzt den Fokus in das erste Feld der Karte (Gutachtennummer) – dann liefen Tastenkürzel ins Feld. Fokus bleibt, wo er war.
  if(s==='3'){if(!exp.open){const fokus=document.activeElement;exp.show();if(fokus instanceof HTMLElement&&fokus!==document.body)fokus.focus({preventScroll:true});else (document.activeElement as HTMLElement|null)?.blur();}this.formatVorwahl();this.hooks.dimensions();}else if(exp.open)exp.close();
 }
 /** Nach dem Laden eines Projekts/Plans: mit Proben gleich ②, ein frischer Plan bleibt in ① (Zuschnitt-Angebot, „Weiter: Proben setzen“). */
 geladen(p:Project){
  this.formatGesetzt=false;this.ausgabeStand=null;this.letzteProbe=null;
  const voll=allMarkers(p).length>0||!!p.pending?.length||sheetCount(p)>1;
  this.zeige(voll?'2':'1');if(voll)this.autoStart=true;
 }
 /** ?aktion=anlage: Schritt ③ mit „Word · Anlage Probenahme“ (hat Vorrang vor der gemerkten Wahl). */
 anlage(){this.formatGesetzt=true;this.zeige('3');}
 private formatVorwahl(){
  if(this.formatGesetzt)return;this.formatGesetzt=true;
  const sel=document.getElementById('format') as HTMLSelectElement;let wahl='';try{wahl=localStorage.getItem(FORMAT_KEY)||'';}catch{/* privates Fenster */}
  if(![...sel.options].some(o=>o.value===wahl))wahl=this.hooks.folder()?'anlage':'pdf-a4';
  if(sel.value!==wahl){sel.value=wahl;sel.dispatchEvent(new Event('change'));}
 }
 /** Abschnitt sichtbar machen (reveal): in den passenden Schritt wechseln. */
 abschnitt(id:string){
  if(id==='results-section'&&this.schritt==='3'){const d=document.getElementById('pk-ergebniskarte') as HTMLDetailsElement|null;if(d)d.open=true;}
  const s=SCHRITT_VON[id];if(!s||s===this.schritt)return;
  if(id==='inspector'&&this.schritt==='f')return;
  this.zeige(s);
 }
 /** Tastenkürzel: true = ausführen. Kürzel aus einem anderen Schritt wechseln erst dorthin. V/Esc = Pause. */
 kuerzel(key:string,shift:boolean):boolean{
  if(!this.hooks.project())return true;
  if(key==='v'){this.pause();return false;}
  const ziel=KUERZEL[key]||(shift&&key==='r'?'1':undefined);
  if(ziel&&ziel!==this.schritt){if(this.hooks.cropping())return false;this.zeige(ziel);}
  return true;
 }
 /** Ränder der Karte, die von schwebenden Leisten bedeckt sind (für „Einpassen“). */
 rand(){
  const stage=$('stage').getBoundingClientRect();if(!this.hooks.project()||this.hooks.cropping())return {top:0,right:0,bottom:0,left:0};
  let top=0,bottom=0;
  for(const id of ['pk-oben','pk-plaene']){const e=document.getElementById(id);if(!e||!e.offsetParent)continue;const r=e.getBoundingClientRect();if(r.height)top=Math.max(top,r.bottom-stage.top+6);}
  for(const sel of ['#pk-hinweis','.zoom-controls']){const e=document.querySelector<HTMLElement>(sel);if(!e||!e.offsetParent)continue;const r=e.getBoundingClientRect();if(r.height)bottom=Math.max(bottom,stage.bottom-r.top+6);}
  return {top:Math.min(top,stage.height*.3),right:0,bottom:Math.min(bottom,stage.height*.25),left:0};
 }

 // ---- Werkzeuge ----
 private offen(){return this.hooks.project()?.pending||[];}
 private naechsteProbe(){const pending=this.offen();if(!pending.length)return null;const zuletzt=this.hooks.labUI()?.letzte()??this.letzteProbe;if(zuletzt&&pending.some(r=>r.label===zuletzt))return zuletzt;return naechste(pending,'');}
 /** „Proben setzen“: nächste offene Probe wählen (Platziermodus); ohne offene Probe „Probe von Hand“. */
 setzen(){
  if(!this.hooks.project()||this.hooks.blocked())return;if(this.schritt!=='2')this.zeige('2');
  const next=this.naechsteProbe();
  if(next!==null)this.hooks.labUI()?.choose(next);else{this.hooks.setMode('sample');this.hooks.render();}
 }
 private altModus(m:string){
  if(!this.hooks.project())return;const b=document.querySelector<HTMLButtonElement>(`button[data-mode="${m}"]`);if(!b||b.disabled)return;
  if(this.hooks.mode()==='lab-place')this.hooks.labUI()?.fertig();
  if(this.hooks.mode()===m&&m!=='navigate'){this.pause();return;}
  b.click();
 }
 pause(){this.autoStart=false;const lab=this.hooks.labUI();if(this.hooks.mode()==='lab-place'&&lab)lab.fertig();else{this.hooks.setMode('navigate');this.hooks.render();}}
 private flaechenFertig(){if(this.hooks.mode().startsWith('area-'))this.hooks.setMode('navigate');this.zeige(this.vorFlaechen==='f'?'2':this.vorFlaechen);}

 // ---- Hauptaktion / Nebenaktion ----
 private ausgabeText(){const f=(document.getElementById('format') as HTMLSelectElement).value;return f==='anlage'?'Anlage Probenahme speichern →':f.startsWith('pdf')?'PDF speichern →':'Bild speichern →';}
 private kopfbandWeiter(){return document.querySelector<HTMLAnchorElement>('#mosaikLeiste a.ml-weiter');}
 private haupt(){
  const p=this.hooks.project(),b=$<HTMLButtonElement>('pk-haupt');if(b.disabled)return;
  switch(b.dataset.aktion){
   case 'laden':$('welcome-load').click();break;
   case 'weiter2':this.zeige('2');break;
   case 'weiter3':this.zeige('3');break;
   case 'ausgeben':if(p)this.ausgeben();break;
   case 'kopfband':this.kopfbandWeiter()?.click();break;
   case 'flaechen':this.flaechenFertig();break;
  }
 }
 private neben(){const b=$<HTMLButtonElement>('pk-neben');if(b.dataset.aktion==='ausgeben')this.ausgeben();}
 private ausgeben(){const e=$<HTMLButtonElement>('export');if(e.disabled)return;this.laufend=true;e.click();}
 private laufend=false;
 /** Nach runExport: nur bei Erfolg „erledigt“ (an den Datenstand gebunden). */
 ausgegeben(ok:boolean){this.laufend=false;if(ok){this.ausgabeStand=this.fingerabdruck();this.ausgabeFormat=(document.getElementById('format') as HTMLSelectElement).value;}this.nachRender();}
 private fingerabdruck(){
  const p=this.hooks.project();if(!p)return '';
  const felder=['format','view','scope','quality','framed','values-export','annex-title','annex-photos','report','date'].map(id=>{const e=document.getElementById(id) as HTMLInputElement|null;return e?(e.type==='checkbox'?String(e.checked):e.value):'';});
  return JSON.stringify([felder,this.hooks.folder(),JSON.stringify(p,(k,v)=>k==='data'&&typeof v==='string'?`${v.length}:${v.slice(-24)}`:k==='active'?undefined:v)]);
 }

 // ---- „Mehr …“ ----
 private mehr(knopf:HTMLElement){
  const ML=(window as unknown as {MosaikLeiste?:{mehr?:(k:HTMLElement,e:unknown[])=>void}}).MosaikLeiste;if(!ML?.mehr)return;
  const p=this.hooks.project(),projekt=!!this.hooks.folder(),dis=(id:string)=>!!(document.getElementById(id) as HTMLButtonElement|null)?.disabled;
  ML.mehr(knopf,[
   {text:'Schadensflächen …',id:'pk-m-flaechen',title:'Schadensflächen zeichnen und bearbeiten (F/G) – Legende im Export, keine m²',disabled:!p||this.hooks.cropping(),onclick:()=>this.zeige('f')},
   {trenner:true},
   {text:'Projektdatei öffnen …',id:'pk-m-oeffnen',title:'Projektdatei (.probenplan) öffnen',disabled:dis('open-project'),onclick:()=>$('open-project').click()},
   {text:'Notfallkopie herunterladen',id:'pk-m-notfall',title:'Geöffnete Fassung zusätzlich als Datei herunterladen',hidden:!projekt||$('emergency-copy').hidden,onclick:()=>$('emergency-copy').click()},
   {text:'Projektordner öffnen …',id:'pk-m-ordner',title:'Projektordner wählen (z. B. „26.0123 Köln“) – PlanKit speichert seine Arbeitsdatei in „_Spektron/PlanKit“, Pläne und Bilder in „Pläne“',hidden:!this.hooks.folderSupported(),disabled:dis('open-folder'),onclick:()=>$('open-folder').click()},
   {text:'Projektdaten neu einlesen',id:'pk-m-projektdaten',title:'Gemeinsame Projektdaten (Objekt, Schaden, Zuständig) neu einlesen',hidden:!projekt,onclick:()=>$('project-badge').click()},
   {trenner:true},
   {text:(weiterOn()?'✓ ':'')+'Nach jeder Probe gleich die nächste wählen',id:'pk-m-weiter',title:'An: nach jeder gesetzten Probe ist gleich die nächste offene dran – erst im selben Raum, dann im nächsten. Gilt in diesem Browser.',onclick:()=>{setWeiter(!weiterOn());const lab=this.hooks.labUI();if(!weiterOn()&&this.hooks.mode()==='lab-place')lab?.fertig();else lab?.render(this.hooks.project());this.hooks.render();this.hooks.toast(weiterOn()?'Nach jeder Probe ist gleich die nächste dran.':'Nach jeder Probe hält PlanKit an – die nächste in der Liste antippen.');}},
   {text:'Kurzanleitung und Tastenkürzel',id:'pk-m-hilfe',onclick:()=>$('help').click()},
   {text:'Version, Offline und Änderungen',id:'pk-m-version',onclick:()=>{$('help').click();requestAnimationFrame(()=>document.getElementById('pk-aenderungen')?.scrollIntoView({block:'start'}));}},
  ]);
 }

 // ---- Stand in der Fußleiste (kurz; #saved behält den vollen Text) ----
 private standZeigen(){
  const roh=($('saved').textContent||'').trim(),t=$('pk-stand-text'),folder=this.hooks.folder(),save=$<HTMLButtonElement>('save-project');
  let text=roh,klasse='';
  if(/^⚠/.test(roh)){klasse='fehler';}
  else if(/^✓ In „/.test(roh)){const d=new Date();text=`✓ automatisch gespeichert ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;klasse='ok';}
  else if(/^✓ Aus „/.test(roh)){text='✓ gespeichert';klasse='ok';}
  else if(/^Wird in „/.test(roh)){text='Wird gespeichert …';}
  else if(/noch nicht im Projektordner|Wiederhergestellt/.test(roh)){klasse='gelb';}
  else if(/Lokal gesichert|lokal gesichert|Wird lokal/.test(roh)||!folder&&this.hooks.project()){text='Nur im Browser gesichert';klasse='gelb';}
  else if(!this.hooks.project()){text='';}
  if(t.textContent!==text)t.textContent=text;t.className=`pk-stand-text ${klasse}`;t.title=roh;
  const st=folder?'Speichern':'Als Datei speichern';if(save.textContent!==st)save.textContent=st;
  save.title=folder?'Jetzt in den Projektordner schreiben (PlanKit speichert sonst automatisch kurz nach jeder Änderung)':'Projekt als .probenplan-Datei herunterladen – ohne Projektordner liegt der Plan nur im Browser';
 }
 private fussHoehe(){const f=document.getElementById('pk-fuss');if(f)document.documentElement.style.setProperty('--pk-fuss',`${f.offsetHeight}px`);}

 // ---- nach jedem Zeichnen ----
 nachRender(){
  const p=this.hooks.project(),mode=this.hooks.mode(),lab=this.hooks.labUI(),crop=this.hooks.cropping();
  if(!p&&this.schritt!=='1')this.anzeigen('1');
  if(p&&!this.hatteProjekt){/* erster Plan: geladen() entscheidet */}
  this.hatteProjekt=!!p;
  document.body.classList.toggle('pk-vollbild',crop);document.body.classList.toggle('pk-ohne-plan',!p);
  const pending=p?.pending||[],gesetzt=p?allMarkers(p).filter(m=>m.lab).length:0;
  // Auto-Start in ② (E5, mit 6.1 b): nur mit einer nächsten offenen Probe und eingeschaltetem „gleich die nächste“
  if(this.offenVorher===0&&pending.length>0)this.autoStart=true;this.offenVorher=pending.length;
  if(this.schritt==='2'&&this.autoStart&&p&&!crop&&mode==='navigate'&&!this.hooks.blocked()&&!document.querySelector('dialog:modal')){
   this.autoStart=false;if(pending.length&&weiterOn()){const next=this.naechsteProbe();if(next!==null){lab?.choose(next);return;}}
  }
  const gewaehlt=lab?.gewaehlt()??null;if(gewaehlt)this.letzteProbe=gewaehlt;
  // Schritte
  document.querySelectorAll<HTMLButtonElement>('.pk-schritt').forEach(b=>{const s=b.dataset.pkStep as Schritt,an=s===this.schritt;if(an)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
   const fertig=s==='1'?!!p:s==='2'?(gesetzt>0&&!pending.length):false;b.classList.toggle('fertig',fertig&&!an);b.querySelector('.pk-kreis')!.textContent=fertig&&!an?'✓':s;b.disabled=crop||(!p&&s!=='1');b.title=!p&&s!=='1'?'Zuerst einen Plan laden':'';});
  // Werkzeuge (②) bzw. Flächen
  const setzenB=$<HTMLButtonElement>('pk-w-setzen');setzenB.textContent=pending.length?'Proben setzen':'Probe von Hand';
  setzenB.title=pending.length?'Nächste offene Probe setzen – ein Tipp in den Plan setzt sie':'Eigene Probe setzen: Nummer und Form unten links, dann in den Plan tippen (P)';
  const aktiv=(id:string,an:boolean)=>{const b=$(id);b.classList.toggle('aktiv',an);b.setAttribute('aria-pressed',String(an));};
  aktiv('pk-w-setzen',mode==='lab-place'||mode==='sample');aktiv('pk-w-brand',mode==='fire');aktiv('pk-w-schieben',mode==='edit');aktiv('pk-w-fzeichnen',mode==='area-draw');aktiv('pk-w-fbearbeiten',mode==='area-edit');
  for(const id of ['pk-w-setzen','pk-w-brand','pk-w-schieben','pk-w-fzeichnen','pk-w-fbearbeiten'])$<HTMLButtonElement>(id).disabled=!p||this.hooks.blocked();
  this.chipsZeigen(p);this.hinweisZeigen(p,mode,pending.length,gesetzt);this.spalteZeigen(p,pending.length,gesetzt);this.fussZeigen();this.standZeigen();
 }
 private chipsSig='';
 private chipsZeigen(p:Project|null){
  const box=$('pk-plaene');if(!p){box.hidden=true;this.chipsSig='';return;}box.hidden=false;
  const names=(p.sheets||[{id:'',name:p.plan.name?'EG':'EG'}]).map(s=>s.name),active=p.active??0,count=names.length,sig=JSON.stringify([names,active,this.hooks.cropping()]);
  if(sig===this.chipsSig)return;this.chipsSig=sig;box.replaceChildren();
  if(count<2){box.append(h('span',{class:'pk-chip einzel',title:'Ein Plan im Projekt – weitere in Schritt ① „Plan laden“'},names[0]||'Plan'));return;}
  if(count>=5){const sel=h('select',{id:'pk-plan-wahl','aria-label':'Plan wählen'});names.forEach((n,i)=>sel.append(new Option(`${n} (${i+1} von ${count})`,String(i),false,i===active)));sel.onchange=()=>{this.hooks.showSheet(Number(sel.value));};box.append(sel);return;}
  names.forEach((n,i)=>{const b=h('button',{type:'button',class:'pk-chip','data-pk-sheet':String(i),'aria-pressed':String(i===active),title:i===active?`${n} – Doppelklick: umbenennen, verschieben, löschen`:`${n} anzeigen (Bild↑/Bild↓)`},n);
   b.onclick=()=>this.hooks.showSheet(i);b.ondblclick=()=>this.hooks.openSheetMenu(i);b.oncontextmenu=e=>{e.preventDefault();this.hooks.openSheetMenu(i);};box.append(b);});
 }
 private hinweisZeigen(p:Project|null,mode:string,offen:number,gesetzt:number){
  const card=$('pk-hinweis'),text=$('pk-hinweis-text'),chip=$('weiter-chip'),hint=$('mode-hint'),next=$('next-field'),shape=$('shape-field'),ws=$('pk-weiter-setzen'),pause=$('pk-pause');
  const zeig=(e:HTMLElement,an:boolean)=>{e.classList.toggle('pk-aus',!an);};
  let art='';
  if(!p)art='';
  else if(this.hooks.cropping())art=hint.textContent?'modus':'';
  else if(mode==='measure'||mode.startsWith('area-'))art='modus';
  else if(this.schritt==='2'){
   if(mode==='lab-place')art='lab';   // Chip oder (ohne Chip) Hinweistext + Pause – das CSS folgt dem hidden des Chips, den LabUI auch ohne Neuzeichnen setzt
   else if(mode==='sample')art='hand';
   else if(mode==='fire'||mode==='edit')art='modus-pause';
   else art=offen?'pause':gesetzt?'fertig':'start';
  }
  card.hidden=!art;card.dataset.art=art;
  zeig(chip,art==='lab');zeig(hint,art==='modus'||art==='modus-pause'||art==='lab');zeig(next,art==='hand');zeig(shape,art==='hand');zeig(ws,art==='pause');zeig(pause,art==='hand'||art==='modus-pause'||art==='lab');
  const nx=art==='pause'?this.naechsteProbe():null,row=nx?p!.pending!.find(r=>r.label===nx):undefined;
  text.textContent=art==='hand'?'Nächste eigene Probe:':art==='pause'?`Pause – nächste wäre ${row?jetztText(row):nx}`:art==='fertig'?'Alle Laborproben gesetzt ✓ · weiter mit „Plan fürs Gutachten ausgeben“':art==='start'?'„Probe von Hand“ wählen, dann in den Plan tippen':'';
  zeig(text,!!text.textContent);
  if(art==='modus-pause'&&mode==='fire')hint.textContent='Brandherd: in den Plan tippen · Ziehen verschiebt die Ansicht';
  if(art==='modus-pause'&&mode==='edit')hint.textContent='Punkt oder Schild ziehen · Antippen zeigt die Probe rechts';
  if(art==='hand')hint.textContent='';
 }
 private spalteZeigen(p:Project|null,offen:number,gesetzt:number){
  const titel=$('pk-kopf-titel'),zahl=$('pk-kopf-zahl'),lasche=$('panel-toggle');
  const s=this.schritt;
  titel.textContent=s==='1'?'Plan laden':s==='2'?'Proben':s==='3'?'Plan ausgeben':'Schadensflächen';
  $('pk-kein-plan').hidden=!!p;document.querySelector<HTMLElement>('.pk-planinfo')!.hidden=!p;document.querySelector<HTMLElement>('.pk-ersetzen')!.hidden=!p;
  $('pk-ordner-start').hidden=!this.hooks.folderSupported()||!!this.hooks.folder();$<HTMLButtonElement>('save-project').hidden=!p;
  zahl.textContent=s==='2'&&p&&(gesetzt||offen)?`${gesetzt} gesetzt · ${offen} offen`:s==='1'&&p?`${sheetCount(p)} Plan${sheetCount(p)===1?'':'e'}`:'';
  lasche.textContent=(s==='2'?`Proben${offen?` ${offen}`:''}`:s==='1'?'Pläne':s==='3'?'Ausgabe':'Flächen')+' ‹';
  lasche.title='Spalte rechts einblenden (L)';
  // ②: Probenliste-Kopf, Leer-Zustand, gewählter Punkt
  const lk=!!p&&(gesetzt>0||offen>0);
  $('pk-proben-leer').hidden=!p||lk;$('lab-import').hidden=!lk;{const t=$('lab-import').textContent==='Bericht wird gelesen …'?'Bericht wird gelesen …':'Andere Proben übernehmen …';if($('lab-import').textContent!==t&&lk)$('lab-import').textContent=t;}
  $<HTMLButtonElement>('pk-import-gross').disabled=$<HTMLButtonElement>('lab-import').disabled;
  const sel=this.hooks.selectedId(),m=sel&&p?p.markers.find(x=>x.id===sel):undefined;
  $('pk-probe-titel').textContent=m?(m.kind==='fire'?`Brandherd ${m.label}`:`Probe ${m.label}`):'';
  const fest=!!m?.lab;const lab=$<HTMLInputElement>('label');lab.readOnly=fest;lab.title=fest?'Kennung kommt aus LabelKit – dort ändern':'';$('pk-kennung-fest').hidden=!fest;
  // ③: Hinweis auf offene Proben
  const w=$('pk-offen-warnung');w.hidden=!(p&&offen);w.textContent=offen?`${offen} Probe${offen===1?'':'n'} noch nicht im Plan – sie fehle${offen===1?'':'n'} in der Ausgabe.`:'';
  $('results-toggle').hidden=false;
 }
 fussZeigen(){
  const p=this.hooks.project(),haupt=$<HTMLButtonElement>('pk-haupt'),neben=$<HTMLButtonElement>('pk-neben'),exp=$<HTMLButtonElement>('export'),s=this.schritt,crop=this.hooks.cropping();
  let text='',aktion='',dis=false,nt='',na='';
  const erledigtZeile=$('pk-erledigt');erledigtZeile.hidden=true;
  if(s==='f'){text='Fertig';aktion='flaechen';}
  else if(s==='1'){if(!p){text='Grundriss auswählen …';aktion='laden';dis=this.hooks.blocked();}else{text='Weiter: Proben setzen →';aktion='weiter2';}}
  else if(s==='2'){text='Plan fürs Gutachten ausgeben →';aktion='weiter3';dis=!p;}
  else{
   const busyText=(exp.textContent||'').trim(),laeuft=exp.disabled&&!!p&&this.laufend;
   if(laeuft){text=busyText;aktion='ausgeben';dis=true;}
   else{
    const fertig=!!p&&this.ausgabeStand!==null&&this.ausgabeStand===this.fingerabdruck(),f=this.ausgabeFormat,folder=this.hooks.folder();
    if(fertig){erledigtZeile.hidden=false;erledigtZeile.textContent=folder?`✓ gespeichert in „${f==='anlage'?ANNEX_DIR:PLAENE}“`:'✓ erstellt – der Download ist bereit';}
    const weiter=fertig?this.kopfbandWeiter():null;
    if(weiter){text=(weiter.querySelector('strong')?.textContent||'Weiter →').trim();aktion='kopfband';nt='Erneut ausgeben';na='ausgeben';}
    else{text=fertig?this.ausgabeText().replace(' speichern →',' erneut speichern'):this.ausgabeText();aktion='ausgeben';dis=!p||exp.disabled;}
   }
  }
  dis=dis||crop;
  if(haupt.textContent!==text)haupt.textContent=text;haupt.dataset.aktion=aktion;haupt.disabled=dis;
  neben.hidden=!nt;neben.textContent=nt;neben.dataset.aktion=na;neben.disabled=crop||exp.disabled;
 }
}
