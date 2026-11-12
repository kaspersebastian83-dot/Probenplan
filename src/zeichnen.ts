/* Zeichen-Werkzeug (ab 2.3.0 als eigenes Modul, vorher in main.ts) – ein Editor, zwei Ziele:
   • Skizze: der Plan IST die Zeichnung (plan.sketch, Zentimeter, Raster, Maße) – unverändert wie bis 2.2.0.
   • Nachzeichnung: Räume ÜBER einem geladenen Plan (plan.trace, Planeinheiten, kein Raster, keine Maße), mit Prüfschritt.
   Zeiger, Auswahl, Tasten und „je Aktion ein Rückgängig-Schritt“ sind gemeinsam; was sich unterscheidet, steht an der Stelle als Zweig.
   main.ts reicht über „Wirt“ nur das hinein, was der Editor von der Karte braucht (Projekt, Kamera, Sperre, Zeichenfläche). */
import {extendSketch,trimSketch,addOpening,addRoom,addText,addWall,cloneSketch,hit,meters,moveRoom,moveText,moveWall,openingAt,removeRoom,removeWall,resizeCanvas,resizeRoom,roomFrom,setOpeningWidth,setWallLength,sketchPlan,sketchSVG,wallFrom,wallLength,parseRoomList,roomsFromList,quickSketchOn,setQuickSketch,TEXT_SIZES,type Sketch,type SketchKind,type SketchRoom,type SketchText,type SketchWall} from './sketch';
import {escape,type Plan,type Point,type Project} from './model';
import {addTraceRoom,cloneTrace,moveTraceRoom,rectAt,mainRoom,removeTraceRoom,renameTraceRoom,resizeTraceRoom,setChecked,setTraceFire,traceEmpty,traceRoomFrom,type Trace,type TraceRoom} from './trace';
export interface Kamera {x:number;y:number;width:number;height:number}
/** Was der Editor von main.ts braucht. project/camera/busy/cropping sind lebende Werte (Getter/Setter in main.ts). */
export interface Wirt {
  readonly project:Project|null; camera:Kamera; readonly busy:boolean; cropping:boolean;
  svg:SVGSVGElement; image:SVGImageElement; layer:SVGGElement;
  $:<T extends HTMLElement=HTMLElement>(id:string)=>T; input:(id:string)=>HTMLInputElement;
  updateCamera():void; point(e:{clientX:number;clientY:number}):Point; mutate(fn:(p:Project)=>void):void; toast(message:string,error?:boolean):void;
  setMode(next:string):void; render():void; fit():void; fitBelow(panel:string):void; requireFinished():boolean; clearSelection():void;
  /** Rückfrage mit Knöpfen (vorhandener Dialog). */ ask(title:string,text:string,choices:string[],primary?:string):Promise<string>;
  /** Kürzel der Mitarbeiterliste (falls geladen) – Vorschläge für „Wer prüft?“. */ kuerzel():string[];
}
export interface SkizzenEditor {readonly aktiv:boolean; readonly zieht:boolean; /** Skizze bearbeiten */start():void; /** Räume über dem geladenen Plan nachzeichnen */nachzeichnen():void; render():void; resync():void}
/** Wohin gezeichnet wird. */
type Ziel='skizze'|'nachzeichnung';
/** Was im Nachzeichnen zu sehen ist: Plan und Nachzeichnung, nur der Plan, nur die Nachzeichnung. */
type Ansicht='beides'|'plan'|'zeichnung';
export const KUERZEL_KEY='plankit-kuerzel';
const heute=()=>new Date().toLocaleDateString('sv-SE');
const datumDE=(iso:string)=>{const [j,m,t]=iso.split('-');return `${t}.${m}.${j}`;};
/** Stand der Nachzeichnung als Satz (Schritt ①): leer = keine. */
export function traceStand(plan:Plan|undefined):{text:string;offen:boolean}{
  const t=plan?.trace;if(!t||traceEmpty(t))return {text:'',offen:false};
  return t.checked?{text:`Nachzeichnung: geprüft am ${datumDE(t.checked.date)} (${t.checked.by})`,offen:false}:{text:'Nachzeichnung: noch nicht geprüft',offen:true};
}
/** Nachzeichnung als Arbeitskopie in der Form der Skizze (Größe = Plan, keine Texte) – so teilen sich beide Ziele die Zeiger-Logik. */
function traceAlsSkizze(plan:Plan):Sketch{const t=plan.trace?cloneTrace(plan.trace):{rooms:[],walls:[],openings:[]};return {width:plan.width,height:plan.height,rooms:t.rooms,walls:t.walls,openings:t.openings,texts:[]};}
/** Geometrie ohne Namen und Brandraum: ändert sie sich, ist die Nachzeichnung nicht mehr „geprüft“. */
const geometrie=(t:{rooms:TraceRoom[];walls:SketchWall[];openings:unknown[]})=>JSON.stringify([t.rooms.map(r=>[r.id,r.x,r.y,r.w,r.h,r.joins||'']),t.walls,t.openings]);
type SketchTool='room'|'wall'|'door'|'window'|'text'|'select';
export function skizzenEditor(wirt:Wirt):SkizzenEditor{
const {svg,image,$,input,updateCamera,point,mutate,toast,setMode,fitBelow,requireFinished}=wirt,sketchLayer=wirt.layer,render=()=>wirt.render(),fit=()=>wirt.fit();
/** Skizze: Arbeitskopie s; Änderungen werden je abgeschlossener Aktion als ein Rückgängig-Schritt übernommen. Auch hier ist cropping gesetzt. */
let sketching:{ziel:Ziel;ansicht:Ansicht;pruefen:boolean;s:Sketch;tool:SketchTool;sel:{type:SketchKind;id:string}|null;drag:{id:number;kind:'draw'|'move'|'resize'|'pan';start:Point;screen:{x:number;y:number};room?:SketchRoom;wall?:SketchWall;text?:SketchText;cam?:Kamera;moved:boolean}|null;draft:SketchRoom|null;draftWall:SketchWall|null}|null=null;
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
/** Vorschau der Arbeitskopie im Planbild (ohne Projektänderung). */
function previewSketch(){if(!sketching||sketching.ziel==='nachzeichnung')return;image.setAttribute('href','data:image/svg+xml;charset=utf-8,'+encodeURIComponent(sketchSVG(sketching.s)));}
/** Arbeitskopie übernehmen: ein Rückgängig-Schritt, Plan neu aus der Skizze (Maßstab bleibt). */
function commitSketch(also?:(p:Project)=>void){if(!wirt.project||!sketching)return;const s=cloneSketch(sketching.s);
  if(sketching.ziel==='nachzeichnung'){
    // Nachzeichnung: nur plan.trace ändert sich, das Planbild nie. Leer = keine Nachzeichnung. Geänderte Geometrie nimmt „geprüft“ weg. Format 7.
    mutate(p=>{const alt=p.plan.trace,neu:Trace={rooms:s.rooms as TraceRoom[],walls:s.walls,openings:s.openings};
      if(alt?.checked&&geometrie(alt)===geometrie(neu))neu.checked={...alt.checked};
      if(traceEmpty(neu))delete p.plan.trace;else{p.plan.trace=neu;p.version=Math.max(p.version,7) as Project['version'];}
      also?.(p);});
    sketching.s=traceAlsSkizze(wirt.project.plan);renderSketch();return;}
  mutate(p=>{p.plan=sketchPlan(s,p.plan);also?.(p);});sketching.s=cloneSketch(wirt.project.plan.sketch!);renderSketch();}
const pick=<T extends {id:string}>(list:T[],type:SketchKind)=>sketching?.sel?.type===type?list.find(x=>x.id===sketching!.sel!.id):undefined;
const selRoom=()=>pick(sketching?.s.rooms||[],'room'),selWall=()=>pick(sketching?.s.walls||[],'wall'),selOpening=()=>pick(sketching?.s.openings||[],'opening'),selText=()=>pick(sketching?.s.texts||[],'text');
const HINTS:Record<SketchTool,string>={room:'Raum aufziehen – Ecke zu Ecke. Räume rasten aneinander ein (Raster 10 cm).',wall:'Wand ziehen – von Punkt zu Punkt, auch schräg. Enden rasten an Ecken ein, Richtungen nahe 15°-Schritten werden genau ausgerichtet.',door:'Auf eine Wand tippen: Tür 0,90 m, Aufschlag zur angetippten Seite.',window:'Auf eine Wand tippen: Fenster 1,20 m.',text:'Antippen setzt einen Text, z. B. „Treppe“ oder „Garage“.',select:'Antippen wählt aus; Raum, Wand oder Text ziehen verschiebt (Raum: Ecke unten rechts = Größe). Leere Fläche ziehen: Ansicht bewegen. Entf löscht.'};
function renderSketch(){
  const on=!!sketching&&!!wirt.project,nach=on&&sketching!.ziel==='nachzeichnung';$('sketch-actions').hidden=!on||nach;$('trace-actions').hidden=!nach;$('stage').classList.toggle('sketching',on&&!(nach&&sketching!.pruefen));if(!on){sketchLayer.replaceChildren();return;}
  if(nach){renderTrace();return;}
  const sk=sketching!,s=sk.s,k=wirt.camera.width/Math.max(1,svg.clientWidth);
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
function startSketch(){if(!wirt.project?.plan.sketch||wirt.busy||wirt.cropping||!requireFinished())return;sketching={ziel:'skizze',ansicht:'beides',pruefen:false,s:extendSketch(wirt.project.plan.sketch),tool:wirt.project.plan.sketch.rooms.length||wirt.project.plan.sketch.walls.length?'select':'room',sel:null,drag:null,draft:null,draftWall:null};wirt.cropping=true;wirt.clearSelection();$('toast').hidden=true;setMode('navigate');$('stage').dataset.mode='sketch';const sk0=wirt.project.plan.sketch,leer=!sk0.rooms.length&&!sk0.walls.length&&!sk0.texts.length;$('sketch-list-panel').hidden=!(leer&&quickSketchOn());render();renderSketch();fitBelow('sketch-actions');renderSketch();if(!$('sketch-list-panel').hidden)focusField('sketch-list');}
function endSketch(){if(!sketching)return;
  // Zeichenfläche auf den Inhalt zuschneiden (1 m Rand); Proben und Flächen wandern mit – ein Rückgängig-Schritt, nur wenn sich etwas ändert.
  const {sketch,dx,dy}=trimSketch(sketching.s);if(wirt.project?.plan.sketch&&(dx||dy||sketch.width!==wirt.project.plan.width||sketch.height!==wirt.project.plan.height))mutate(p=>{p.plan=sketchPlan(sketch,p.plan);for(const m of p.markers){m.x-=dx;m.y-=dy;m.lx-=dx;m.ly-=dy;}for(const a of p.areas||[])a.points=a.points.map(q=>({x:q.x-dx,y:q.y-dy}));});
  sketching=null;wirt.cropping=false;$('sketch-list-panel').hidden=true;setMode('navigate');renderSketch();render();fit();}
$('sketch-done').onclick=()=>{const s=sketching?.s,n=s?s.rooms.length+s.walls.length:0;endSketch();toast(n?'Skizze fertig. Jetzt Proben setzen (P). „Skizze“ links bearbeitet sie weiter.':'Die Skizze ist noch leer. „Skizze“ links öffnet sie wieder.');};
document.querySelectorAll<HTMLButtonElement>('[data-sketch-tool]').forEach(b=>b.onclick=()=>{if(!sketching)return;sketching.tool=b.dataset.sketchTool as SketchTool;sketching.draft=null;sketching.draftWall=null;renderSketch();});
const sketchTry=(fn:()=>void,also?:(p:Project)=>void)=>{try{fn();previewSketch();commitSketch(also);}catch(e){neuLaden();previewSketch();renderSketch();toast(e instanceof Error?e.message:String(e),true);}};
const focusField=(id:string)=>setTimeout(()=>{input(id).focus();input(id).select();},0);
input('sketch-name').onchange=()=>{const r=selRoom(),v=input('sketch-name').value.replace(/\s+/g,' ').trim().slice(0,60);if(r&&v&&v!==r.name){const old=r.name,id=r.id;sketchTry(()=>{r.name=v;},p=>{for(const m of p.markers)if(m.raumSkizze===id&&m.raum===old)m.raum=v;});}else renderSketch();};   // nur Proben, deren Raum aus diesem Skizzenraum stammt – LabelKit und Handeingaben bleiben
const roomSize=()=>{const r=selRoom();if(r)sketchTry(()=>resizeRoom(sketching!.s,r.id,metersIn('sketch-w'),metersIn('sketch-h')));};
input('sketch-w').onchange=roomSize;input('sketch-h').onchange=roomSize;
input('sketch-wl').onchange=()=>{const w=selWall();if(w)sketchTry(()=>setWallLength(sketching!.s,w.id,metersIn('sketch-wl')));};
input('sketch-ow').onchange=()=>{const o=selOpening();if(o)sketchTry(()=>setOpeningWidth(sketching!.s,o.id,metersIn('sketch-ow')));};
$('sketch-door-flip').onclick=()=>{const o=selOpening();if(o)sketchTry(()=>{o.side=o.side===1?-1:1;});};
input('sketch-text').onchange=()=>{const t=selText(),v=input('sketch-text').value.replace(/\s+/g,' ').trim().slice(0,80);if(t&&v&&v!==t.text)sketchTry(()=>{t.text=v;});else renderSketch();};
$<HTMLSelectElement>('sketch-text-size').onchange=()=>{const t=selText();if(t)sketchTry(()=>{t.size=Number($<HTMLSelectElement>('sketch-text-size').value);});};
const removeSel=()=>{const sk=sketching;if(!sk?.sel)return;const {type,id}=sk.sel;sk.sel=null;
  if(sk.ziel==='nachzeichnung'){if(sk.pruefen||type!=='room')return;let erbe:string|null=null;
    // Proben, deren Raum aus diesem Rechteck stammt, zeigen danach auf das neue Hauptrechteck (falls es Teile gab)
    sketchTry(()=>{erbe=removeTraceRoom(sk.s,id).heir;},p=>{if(erbe)for(const m of p.markers)if(m.raumSkizze===id)m.raumSkizze=erbe;});return;}
  sketchTry(()=>{
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
  if(!sketching||!wirt.project||e.button>0)return;e.preventDefault();e.stopPropagation();const sk=sketching,pt=point(e),k=wirt.camera.width/Math.max(1,svg.clientWidth);
  const base={id:e.pointerId,start:pt,screen:{x:e.clientX,y:e.clientY},moved:false};
  const nach=sk.ziel==='nachzeichnung';
  if(nach&&sk.pruefen){sk.drag={...base,kind:'pan',cam:{...wirt.camera}};svg.setPointerCapture(e.pointerId);return;}   // Prüfen: nur schauen
  if(sk.tool==='room'||sk.tool==='wall'){sk.drag={...base,kind:'draw'};}
  else if(sk.tool==='door'||sk.tool==='window'){const o=openingAt(sk.s,pt,sk.tool,Math.max(40,k*18));if(!o){toast('Bitte auf eine Wand tippen.',true);return;}sketchTry(()=>{addOpening(sk.s,o);sk.sel={type:'opening',id:o.id};});return;}
  else if(sk.tool==='text'){if(pt.x<0||pt.y<0||pt.x>sk.s.width||pt.y>sk.s.height)return;let t:SketchText|null=null;sketchTry(()=>{t=addText(sk.s,pt);sk.sel={type:'text',id:t.id};sk.tool='select';});if(t)focusField('sketch-text');return;}
  else{const r=selRoom();
    if(r&&Math.abs(pt.x-(r.x+r.w))<k*14&&Math.abs(pt.y-(r.y+r.h))<k*14)sk.drag={...base,kind:'resize',room:{...r}};
    else{let h=hit(sk.s,pt,nach?k*10:Math.max(15,k*10));if(nach&&h&&h.type!=='room')h=null;   // Nachzeichnen 2.3.0: nur Räume
      sk.sel=h;
      if(h?.type==='room')sk.drag={...base,kind:'move',room:{...sk.s.rooms.find(x=>x.id===h.id)!}};
      else if(h?.type==='wall')sk.drag={...base,kind:'move',wall:{...sk.s.walls.find(x=>x.id===h.id)!}};
      else if(h?.type==='text')sk.drag={...base,kind:'move',text:{...sk.s.texts.find(x=>x.id===h.id)!}};
      else if(!h)sk.drag={...base,kind:'pan',cam:{...wirt.camera}};}
    renderSketch();}
  svg.setPointerCapture(e.pointerId);
},{capture:true});
svg.addEventListener('pointermove',e=>{
  const sk=sketching;if(!sk?.drag||sk.drag.id!==e.pointerId||!wirt.project)return;e.stopPropagation();const d=sk.drag;
  if(Math.hypot(e.clientX-d.screen.x,e.clientY-d.screen.y)>4)d.moved=true;if(!d.moved)return;
  if(d.kind==='pan'){const rect=svg.getBoundingClientRect();wirt.camera={...d.cam!,x:d.cam!.x-(e.clientX-d.screen.x)/rect.width*d.cam!.width,y:d.cam!.y-(e.clientY-d.screen.y)/rect.height*d.cam!.height};updateCamera();return;}
  const pt=point(e),dx=pt.x-d.start.x,dy=pt.y-d.start.y;
  const nach=sk.ziel==='nachzeichnung',plan=wirt.project.plan,tol=wirt.camera.width/Math.max(1,svg.clientWidth)*12;   // Nachzeichnen: Einrasten 12 px am Bildschirm
  if(d.kind==='draw'){if(sk.tool==='wall')sk.draftWall=wallFrom(sk.s,d.start,pt);else sk.draft=nach?traceRoomFrom(sk.s,plan,d.start,pt,tol):roomFrom(sk.s,d.start,pt);renderSketch();return;}
  if(nach){if(d.kind==='move'&&d.room)moveTraceRoom(sk.s,plan,d.room.id,dx,dy,d.room,tol);else if(d.kind==='resize'&&d.room)resizeTraceRoom(sk.s,plan,d.room.id,d.room.w+dx,d.room.h+dy,tol);renderSketch();return;}
  if(d.kind==='move'){if(d.room)moveRoom(sk.s,d.room.id,dx,dy,d.room,quickSketchOn());else if(d.wall)moveWall(sk.s,d.wall.id,dx,dy,d.wall);else if(d.text)moveText(sk.s,d.text.id,dx,dy,d.text);}
  if(d.kind==='resize'&&d.room){try{resizeRoom(sk.s,d.room.id,d.room.w+dx,d.room.h+dy);}catch{/* weiterziehen */}}
  previewSketch();renderSketch();
},{capture:true});
const sketchDrop=(e:PointerEvent)=>{
  const sk=sketching;if(!sk?.drag||sk.drag.id!==e.pointerId)return;const d=sk.drag;sk.drag=null;
  if(d.kind==='draw'){
    if(sk.tool==='wall'){const w=sk.draftWall;sk.draftWall=null;if(w&&d.moved){sketchTry(()=>{addWall(sk.s,w);sk.sel={type:'wall',id:w.id};});}else renderSketch();return;}
    const r=sk.draft;sk.draft=null;
    if(sk.ziel==='nachzeichnung'){   // Werkzeug „Raum“ bleibt gewählt (mehrere Räume nacheinander); Tipp auf einen vorhandenen Raum wählt ihn
      if(r&&d.moved){sketchTry(()=>{addTraceRoom(sk.s,r);sk.sel={type:'room',id:r.id};});focusField('trace-name');}
      else{const da=d.moved?null:rectAt(sk.s,d.start);sk.sel=da?{type:'room',id:da.id}:null;renderSketch();}
      return;}
    if(r&&d.moved){sketchTry(()=>{addRoom(sk.s,r);sk.sel={type:'room',id:r.id};sk.tool='select';});focusField('sketch-name');}else renderSketch();return;}
  if((d.kind==='move'||d.kind==='resize')&&d.moved)sketchTry(()=>{});else renderSketch();
};
svg.addEventListener('pointerup',sketchDrop,{capture:true});svg.addEventListener('pointercancel',e=>{if(sketching?.drag?.id===e.pointerId){sketching.drag=null;sketching.draft=null;sketching.draftWall=null;neuLaden();previewSketch();renderSketch();}},{capture:true});
window.addEventListener('keydown',e=>{
  if(!sketching||e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t instanceof Element&&t.closest('input,textarea,select'))return;
  if(e.key==='Escape'){e.preventDefault();if(sketching.draft||sketching.draftWall||sketching.sel){sketching.draft=null;sketching.draftWall=null;sketching.sel=null;renderSketch();}
    else if(sketching.ziel==='nachzeichnung')$(sketching.pruefen?'trace-change':'trace-done').click();else $('sketch-done').click();}
  else if((e.key==='Delete'||e.key==='Backspace')&&sketching.sel){e.preventDefault();removeSel();}
});
/* ---------- Nachzeichnen (ab 2.3.0) ----------
   Räume über dem geladenen Plan: Rechteck aufziehen, benennen, Brandraum. Plan darunter, Nachzeichnung halb durchsichtig in PlanKit-Blau,
   Anzeige umschaltbar. Keine Maße, keine Flächen, kein Raster – Kanten rasten an Nachbarräumen ein (12 px am Bildschirm).
   Am Ende der Prüfschritt: Plan in voller Stärke, Nachzeichnung als Umriss; „Ja, geprüft“ schreibt Datum und Kürzel in die Datei. */
$('stage').insertAdjacentHTML('beforeend',`<div id="trace-actions" hidden><div class="align-row"><span class="sketch-tools" id="trace-tools" role="group" aria-label="Werkzeug"><button data-trace-tool="room" aria-pressed="true">▭ Raum</button><button data-trace-tool="select" aria-pressed="false">↖ Auswählen</button></span><span class="sketch-tools" role="group" aria-label="Anzeige"><button data-trace-view="beides" aria-pressed="true">Plan + Nachzeichnung</button><button data-trace-view="plan" aria-pressed="false">nur Plan</button><button data-trace-view="zeichnung" aria-pressed="false">nur Nachzeichnung</button></span><button id="trace-done" class="primary">Fertig – jetzt prüfen →</button></div>
<p id="trace-hint" class="tiny"></p>
<div class="align-row" id="trace-room-fields" hidden><label>Name<input id="trace-name" maxlength="60"></label><label><input type="checkbox" id="trace-fire"> Brandraum</label><button id="trace-room-delete" class="danger">Raum löschen</button></div>
<div class="align-row" id="trace-rest"><span class="tiny" id="trace-count"></span><button id="trace-clear" class="danger" hidden>Nachzeichnung löschen …</button></div>
<div id="trace-check" hidden><p><b>Stimmen die nachgezeichneten Räume mit dem Plan überein?</b> Schau in Ruhe hin – verschieben und zoomen geht, ändern erst wieder mit „Noch ändern“.</p>
<div class="align-row"><span id="trace-wer"></span><button id="trace-wer-aendern">ändern</button><label id="trace-wer-feld" hidden>Wer prüft? Dein Kürzel<input id="trace-kuerzel" maxlength="40" size="8" list="trace-kuerzel-liste" autocomplete="off"></label><datalist id="trace-kuerzel-liste"></datalist></div>
<div class="align-row"><button id="trace-ok" class="primary">Ja, geprüft ✓</button><button id="trace-change">Noch ändern</button><button id="trace-later">Später prüfen</button></div></div></div>`);
const kuerzelLesen=()=>{try{return (localStorage.getItem(KUERZEL_KEY)||'').replace(/\s+/g,' ').trim().slice(0,40);}catch{return '';}};
const kuerzelMerken=(k:string)=>{try{localStorage.setItem(KUERZEL_KEY,k);}catch{/* ohne Speicher: beim nächsten Mal wieder fragen */}};
/** „Wer prüft?“ offen: beim ersten Bestätigen (kein Kürzel gemerkt) oder nach „ändern“. */
let werOffen=false;
const TRACE_HINTS:Record<'room'|'select',string>={room:'Zieh ein Rechteck über einen Raum im Plan – von Ecke zu Ecke. Kanten rasten an Nachbarräumen ein. Tipp auf einen Raum wählt ihn.',select:'Antippen wählt einen Raum. Ziehen verschiebt ihn, die Ecke unten rechts ändert die Größe. Leere Fläche ziehen: Ansicht bewegen. Entf löscht.'};
function renderTrace(){
  const sk=sketching!,s=sk.s,rooms=s.rooms as TraceRoom[],k=wirt.camera.width/Math.max(1,svg.clientWidth),pr=sk.pruefen;
  image.style.visibility=sk.ansicht==='zeichnung'?'hidden':'';
  const BLAU='#4179b2',text=(x:number,y:number,t:string,size:number,color:string)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial" font-weight="700" font-size="${k*size}" fill="${color}" stroke="#fff" stroke-width="${k*3}" paint-order="stroke">${escape(t)}</text>`;
  let out='';
  if(sk.ansicht!=='plan'){
    for(const r of rooms)out+=`<rect data-trace-room="${r.id}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${pr?'none':r.fire?'rgba(232,145,45,.22)':'rgba(65,121,178,.12)'}" stroke="${r.fire?'#c2620c':BLAU}" stroke-opacity="${pr?1:.7}" stroke-width="${k*(pr?3.5:2.5)}"/>`;
    for(const w of s.walls)out+=`<line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="${BLAU}" stroke-opacity="${pr?1:.7}" stroke-width="${k*4}" stroke-linecap="round"/>`;
    for(const o of s.openings)out+=`<g transform="translate(${o.x} ${o.y}) rotate(${o.a})"><rect x="${-o.w/2}" y="${-k*4}" width="${o.w}" height="${k*8}" fill="#fff" stroke="${BLAU}" stroke-width="${k*1.5}"/></g>`;
    for(const r of rooms)if(!r.joins){out+=text(r.x+r.w/2,r.y+r.h/2+k*4,r.name,13,r.fire?'#8a3f10':'#1f4f86');if(r.fire)out+=text(r.x+r.w/2,r.y+r.h/2+k*18,'Brandraum',10,'#8a3f10');}
  }
  const room=pr?undefined:selRoom();
  if(room)out+=`<rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="rgba(65,121,178,.1)" stroke="#2c5a93" stroke-width="${k*3.5}"/>${sk.tool==='select'?`<rect x="${room.x+room.w-k*9}" y="${room.y+room.h-k*9}" width="${k*18}" height="${k*18}" fill="#fff" stroke="#2c5a93" stroke-width="${k*3}"/>`:''}`;
  if(sk.draft)out+=`<rect x="${sk.draft.x}" y="${sk.draft.y}" width="${sk.draft.w}" height="${sk.draft.h}" fill="rgba(232,145,45,.1)" stroke="#e8912d" stroke-width="${k*3}" stroke-dasharray="${k*9} ${k*5}"/>`;
  sketchLayer.innerHTML=out;
  document.querySelectorAll<HTMLButtonElement>('[data-trace-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.traceTool===sk.tool)));
  document.querySelectorAll<HTMLButtonElement>('[data-trace-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.traceView===sk.ansicht)));
  $('trace-tools').hidden=pr;$('trace-done').hidden=pr;$('trace-hint').hidden=pr;$('trace-check').hidden=!pr;$('trace-room-fields').hidden=!room;$('trace-rest').hidden=pr||!!room;   // eine Zeile, entweder Raumfelder oder Zähler – die Leiste bleibt gleich hoch und verdeckt den Plan nicht nachträglich
  $('trace-hint').textContent=room&&sk.tool==='room'?'Gib dem Raum seinen Namen aus dem Plan (z. B. „Küche“) – oder zieh gleich den nächsten Raum auf.':TRACE_HINTS[sk.tool==='select'?'select':'room'];
  const set=(id:string,v:string)=>{if(document.activeElement!==input(id))input(id).value=v;};
  if(room){const m=mainRoom(s,room);set('trace-name',m.name);input('trace-fire').checked=!!m.fire;}
  const n=rooms.filter(r=>!r.joins).length;$('trace-count').textContent=n?`${n} ${n===1?'Raum':'Räume'} nachgezeichnet`:'Noch nichts nachgezeichnet.';$('trace-clear').hidden=traceEmpty(s)||!!room;
  if(pr){const by=kuerzelLesen(),frage=werOffen||!by;$('trace-wer').textContent=frage?'':`Geprüft von: ${by}`;$('trace-wer').hidden=frage;$('trace-wer-aendern').hidden=frage;$('trace-wer-feld').hidden=!frage;
    $('trace-kuerzel-liste').replaceChildren(...wirt.kuerzel().map(x=>{const o=document.createElement('option');o.value=x;return o;}));}
  $('mode-hint').textContent=pr?'Nachzeichnung prüfen':'Nachzeichnen';
}
function startTrace(){const p=wirt.project;if(!p||p.plan.sketch||wirt.busy||wirt.cropping||!requireFinished())return;
  sketching={ziel:'nachzeichnung',ansicht:'beides',pruefen:false,s:traceAlsSkizze(p.plan),tool:'room',sel:null,drag:null,draft:null,draftWall:null};werOffen=false;
  wirt.cropping=true;wirt.clearSelection();$('toast').hidden=true;setMode('navigate');$('stage').dataset.mode='trace';render();renderSketch();fitBelow('trace-actions');renderSketch();}
function endTrace(){if(!sketching)return;sketching=null;image.style.visibility='';wirt.cropping=false;setMode('navigate');renderSketch();render();fit();}
document.querySelectorAll<HTMLButtonElement>('[data-trace-tool]').forEach(b=>b.onclick=()=>{if(!sketching||sketching.pruefen)return;sketching.tool=b.dataset.traceTool as SketchTool;sketching.draft=null;renderSketch();});
document.querySelectorAll<HTMLButtonElement>('[data-trace-view]').forEach(b=>b.onclick=()=>{if(!sketching)return;sketching.ansicht=b.dataset.traceView as Ansicht;renderSketch();});
input('trace-name').onchange=()=>{const sk=sketching,r=selRoom();if(!sk||!r)return;const m=mainRoom(sk.s,r),v=input('trace-name').value.replace(/\s+/g,' ').trim().slice(0,60);
  if(!v||v===m.name){renderSketch();return;}const old=m.name,id=m.id;
  // wie bei der Skizze: nur Proben, deren Raum aus diesem nachgezeichneten Raum stammt – LabelKit und Handeingaben bleiben
  sketchTry(()=>{renameTraceRoom(sk.s,r.id,v);},p=>{for(const x of p.markers)if(x.raumSkizze===id&&x.raum===old)x.raum=v;});};
input('trace-name').onkeydown=e=>{if(e.key==='Enter')input('trace-name').blur();};
input('trace-fire').onchange=()=>{const sk=sketching,r=selRoom(),on=input('trace-fire').checked;if(sk&&r)sketchTry(()=>setTraceFire(sk.s,r.id,on));};
$('trace-room-delete').onclick=()=>removeSel();
$('trace-clear').onclick=()=>{void wirt.ask('Nachzeichnung löschen?','Alle nachgezeichneten Räume dieses Plans werden entfernt. Die Raumangaben an den Proben bleiben stehen. „Rückgängig“ stellt die Nachzeichnung wieder her.',['Abbrechen','Löschen'],'Abbrechen').then(a=>{const sk=sketching;if(a!=='Löschen'||!sk||sk.ziel!=='nachzeichnung')return;sketchTry(()=>{sk.s.rooms=[];sk.s.walls=[];sk.s.openings=[];sk.sel=null;});});};
$('trace-done').onclick=()=>{const sk=sketching;if(!sk||sk.ziel!=='nachzeichnung')return;
  if(traceEmpty(sk.s)){endTrace();toast('Noch nichts nachgezeichnet. „Räume nachzeichnen“ in Schritt ① öffnet es wieder.');return;}
  sk.pruefen=true;sk.sel=null;sk.draft=null;sk.ansicht='beides';werOffen=false;renderSketch();fitBelow('trace-actions');renderSketch();if(!kuerzelLesen())focusField('trace-kuerzel');};
$('trace-change').onclick=()=>{if(!sketching)return;sketching.pruefen=false;renderSketch();};
$('trace-later').onclick=()=>{const offen=!wirt.project?.plan.trace?.checked;endTrace();toast(offen?'Nachzeichnung gespeichert – noch nicht geprüft. „Räume nachzeichnen“ in Schritt ① öffnet sie wieder.':'Nachzeichnung unverändert – sie ist geprüft.');};
$('trace-wer-aendern').onclick=()=>{werOffen=true;input('trace-kuerzel').value=kuerzelLesen();renderSketch();focusField('trace-kuerzel');};
input('trace-kuerzel').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('trace-ok').click();}};
$('trace-ok').onclick=()=>{const sk=sketching,t=wirt.project?.plan.trace;if(!sk?.pruefen||!t||traceEmpty(t))return;
  let by=kuerzelLesen();
  if(werOffen||!by){by=input('trace-kuerzel').value.replace(/\s+/g,' ').trim().slice(0,40);if(!by){werOffen=true;renderSketch();focusField('trace-kuerzel');toast('Bitte dein Kürzel eintragen – es steht mit dem Datum an der Nachzeichnung.',true);return;}kuerzelMerken(by);werOffen=false;}
  const datum=heute();mutate(p=>{if(p.plan.trace)setChecked(p.plan.trace,datum,by);});endTrace();toast(`Nachzeichnung geprüft (${by}, ${datumDE(datum)}).`);};
/** Arbeitskopie aus dem Projekt (nach Fehler, Abbruch, Rückgängig). false: das Ziel gibt es an diesem Plan nicht mehr. */
function neuLaden(){const p=wirt.project?.plan;if(!sketching||!p)return false;
  if(sketching.ziel==='nachzeichnung'){if(p.sketch)return false;sketching.s=traceAlsSkizze(p);return true;}
  if(!p.sketch)return false;sketching.s=extendSketch(p.sketch);return true;}
function resyncSketch(){if(!sketching)return;if(neuLaden()){sketching.sel=null;sketching.draft=null;sketching.draftWall=null;if(sketching.ziel==='nachzeichnung'&&sketching.pruefen&&traceEmpty(wirt.project?.plan.trace))sketching.pruefen=false;renderSketch();}else if(sketching.ziel==='nachzeichnung')endTrace();else endSketch();}
return {get aktiv(){return !!sketching;},get zieht(){return !!sketching?.drag;},start:startSketch,nachzeichnen:startTrace,render:renderSketch,resync:resyncSketch};
}
