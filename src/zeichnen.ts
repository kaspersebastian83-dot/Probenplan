/* Zeichen-Werkzeug der Skizze (ab 2.3.0 als eigenes Modul, vorher in main.ts – Inhalt unverändert übernommen).
   main.ts reicht über „Wirt“ nur das hinein, was der Editor von der Karte braucht (Projekt, Kamera, Sperre, Zeichenfläche). */
import {extendSketch,trimSketch,addOpening,addRoom,addText,addWall,cloneSketch,hit,meters,moveRoom,moveText,moveWall,openingAt,removeRoom,removeWall,resizeCanvas,resizeRoom,roomFrom,setOpeningWidth,setWallLength,sketchPlan,sketchSVG,wallFrom,wallLength,parseRoomList,roomsFromList,quickSketchOn,setQuickSketch,TEXT_SIZES,type Sketch,type SketchKind,type SketchRoom,type SketchText,type SketchWall} from './sketch';
import type {Point,Project} from './model';
export interface Kamera {x:number;y:number;width:number;height:number}
/** Was der Editor von main.ts braucht. project/camera/busy/cropping sind lebende Werte (Getter/Setter in main.ts). */
export interface Wirt {
  readonly project:Project|null; camera:Kamera; readonly busy:boolean; cropping:boolean;
  svg:SVGSVGElement; image:SVGImageElement; layer:SVGGElement;
  $:<T extends HTMLElement=HTMLElement>(id:string)=>T; input:(id:string)=>HTMLInputElement;
  updateCamera():void; point(e:{clientX:number;clientY:number}):Point; mutate(fn:(p:Project)=>void):void; toast(message:string,error?:boolean):void;
  setMode(next:string):void; render():void; fit():void; fitBelow(panel:string):void; requireFinished():boolean; clearSelection():void;
}
export interface SkizzenEditor {readonly aktiv:boolean; readonly zieht:boolean; start():void; render():void; resync():void}
type SketchTool='room'|'wall'|'door'|'window'|'text'|'select';
export function skizzenEditor(wirt:Wirt):SkizzenEditor{
const {svg,image,$,input,updateCamera,point,mutate,toast,setMode,fitBelow,requireFinished}=wirt,sketchLayer=wirt.layer,render=()=>wirt.render(),fit=()=>wirt.fit();
/** Skizze: Arbeitskopie s; Änderungen werden je abgeschlossener Aktion als ein Rückgängig-Schritt übernommen. Auch hier ist cropping gesetzt. */
let sketching:{s:Sketch;tool:SketchTool;sel:{type:SketchKind;id:string}|null;drag:{id:number;kind:'draw'|'move'|'resize'|'pan';start:Point;screen:{x:number;y:number};room?:SketchRoom;wall?:SketchWall;text?:SketchText;cam?:Kamera;moved:boolean}|null;draft:SketchRoom|null;draftWall:SketchWall|null}|null=null;
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
function previewSketch(){if(!sketching)return;image.setAttribute('href','data:image/svg+xml;charset=utf-8,'+encodeURIComponent(sketchSVG(sketching.s)));}
/** Arbeitskopie übernehmen: ein Rückgängig-Schritt, Plan neu aus der Skizze (Maßstab bleibt). */
function commitSketch(also?:(p:Project)=>void){if(!wirt.project||!sketching)return;const s=cloneSketch(sketching.s);mutate(p=>{p.plan=sketchPlan(s,p.plan);also?.(p);});sketching.s=cloneSketch(wirt.project.plan.sketch!);renderSketch();}
const pick=<T extends {id:string}>(list:T[],type:SketchKind)=>sketching?.sel?.type===type?list.find(x=>x.id===sketching!.sel!.id):undefined;
const selRoom=()=>pick(sketching?.s.rooms||[],'room'),selWall=()=>pick(sketching?.s.walls||[],'wall'),selOpening=()=>pick(sketching?.s.openings||[],'opening'),selText=()=>pick(sketching?.s.texts||[],'text');
const HINTS:Record<SketchTool,string>={room:'Raum aufziehen – Ecke zu Ecke. Räume rasten aneinander ein (Raster 10 cm).',wall:'Wand ziehen – von Punkt zu Punkt, auch schräg. Enden rasten an Ecken ein, Richtungen nahe 15°-Schritten werden genau ausgerichtet.',door:'Auf eine Wand tippen: Tür 0,90 m, Aufschlag zur angetippten Seite.',window:'Auf eine Wand tippen: Fenster 1,20 m.',text:'Antippen setzt einen Text, z. B. „Treppe“ oder „Garage“.',select:'Antippen wählt aus; Raum, Wand oder Text ziehen verschiebt (Raum: Ecke unten rechts = Größe). Leere Fläche ziehen: Ansicht bewegen. Entf löscht.'};
function renderSketch(){
  const on=!!sketching&&!!wirt.project;$('sketch-actions').hidden=!on;$('stage').classList.toggle('sketching',on);if(!on){sketchLayer.replaceChildren();return;}
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
function startSketch(){if(!wirt.project?.plan.sketch||wirt.busy||wirt.cropping||!requireFinished())return;sketching={s:extendSketch(wirt.project.plan.sketch),tool:wirt.project.plan.sketch.rooms.length||wirt.project.plan.sketch.walls.length?'select':'room',sel:null,drag:null,draft:null,draftWall:null};wirt.cropping=true;wirt.clearSelection();$('toast').hidden=true;setMode('navigate');$('stage').dataset.mode='sketch';const sk0=wirt.project.plan.sketch,leer=!sk0.rooms.length&&!sk0.walls.length&&!sk0.texts.length;$('sketch-list-panel').hidden=!(leer&&quickSketchOn());render();renderSketch();fitBelow('sketch-actions');renderSketch();if(!$('sketch-list-panel').hidden)focusField('sketch-list');}
function endSketch(){if(!sketching)return;
  // Zeichenfläche auf den Inhalt zuschneiden (1 m Rand); Proben und Flächen wandern mit – ein Rückgängig-Schritt, nur wenn sich etwas ändert.
  const {sketch,dx,dy}=trimSketch(sketching.s);if(wirt.project?.plan.sketch&&(dx||dy||sketch.width!==wirt.project.plan.width||sketch.height!==wirt.project.plan.height))mutate(p=>{p.plan=sketchPlan(sketch,p.plan);for(const m of p.markers){m.x-=dx;m.y-=dy;m.lx-=dx;m.ly-=dy;}for(const a of p.areas||[])a.points=a.points.map(q=>({x:q.x-dx,y:q.y-dy}));});
  sketching=null;wirt.cropping=false;$('sketch-list-panel').hidden=true;setMode('navigate');renderSketch();render();fit();}
$('sketch-done').onclick=()=>{const s=sketching?.s,n=s?s.rooms.length+s.walls.length:0;endSketch();toast(n?'Skizze fertig. Jetzt Proben setzen (P). „Skizze“ links bearbeitet sie weiter.':'Die Skizze ist noch leer. „Skizze“ links öffnet sie wieder.');};
document.querySelectorAll<HTMLButtonElement>('[data-sketch-tool]').forEach(b=>b.onclick=()=>{if(!sketching)return;sketching.tool=b.dataset.sketchTool as SketchTool;sketching.draft=null;sketching.draftWall=null;renderSketch();});
const sketchTry=(fn:()=>void,also?:(p:Project)=>void)=>{try{fn();previewSketch();commitSketch(also);}catch(e){if(sketching&&wirt.project?.plan.sketch)sketching.s=extendSketch(wirt.project.plan.sketch);previewSketch();renderSketch();toast(e instanceof Error?e.message:String(e),true);}};
const focusField=(id:string)=>setTimeout(()=>{input(id).focus();input(id).select();},0);
input('sketch-name').onchange=()=>{const r=selRoom(),v=input('sketch-name').value.replace(/\s+/g,' ').trim().slice(0,60);if(r&&v&&v!==r.name){const old=r.name,id=r.id;sketchTry(()=>{r.name=v;},p=>{for(const m of p.markers)if(m.raumSkizze===id&&m.raum===old)m.raum=v;});}else renderSketch();};   // nur Proben, deren Raum aus diesem Skizzenraum stammt – LabelKit und Handeingaben bleiben
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
  if(!sketching||!wirt.project||e.button>0)return;e.preventDefault();e.stopPropagation();const sk=sketching,pt=point(e),k=wirt.camera.width/Math.max(1,svg.clientWidth);
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
      else if(!h)sk.drag={...base,kind:'pan',cam:{...wirt.camera}};}
    renderSketch();}
  svg.setPointerCapture(e.pointerId);
},{capture:true});
svg.addEventListener('pointermove',e=>{
  const sk=sketching;if(!sk?.drag||sk.drag.id!==e.pointerId||!wirt.project)return;e.stopPropagation();const d=sk.drag;
  if(Math.hypot(e.clientX-d.screen.x,e.clientY-d.screen.y)>4)d.moved=true;if(!d.moved)return;
  if(d.kind==='pan'){const rect=svg.getBoundingClientRect();wirt.camera={...d.cam!,x:d.cam!.x-(e.clientX-d.screen.x)/rect.width*d.cam!.width,y:d.cam!.y-(e.clientY-d.screen.y)/rect.height*d.cam!.height};updateCamera();return;}
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
svg.addEventListener('pointerup',sketchDrop,{capture:true});svg.addEventListener('pointercancel',e=>{if(sketching?.drag?.id===e.pointerId){sketching.drag=null;sketching.draft=null;sketching.draftWall=null;if(wirt.project?.plan.sketch)sketching.s=extendSketch(wirt.project.plan.sketch);previewSketch();renderSketch();}},{capture:true});
window.addEventListener('keydown',e=>{
  if(!sketching||e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t instanceof Element&&t.closest('input,textarea,select'))return;
  if(e.key==='Escape'){e.preventDefault();if(sketching.draft||sketching.draftWall||sketching.sel){sketching.draft=null;sketching.draftWall=null;sketching.sel=null;renderSketch();}else $('sketch-done').click();}
  else if((e.key==='Delete'||e.key==='Backspace')&&sketching.sel){e.preventDefault();removeSel();}
});
function resyncSketch(){if(!sketching)return;if(wirt.project?.plan.sketch){sketching.s=extendSketch(wirt.project.plan.sketch);sketching.sel=null;sketching.draft=null;sketching.draftWall=null;renderSketch();}else endSketch();}
return {get aktiv(){return !!sketching;},get zieht(){return !!sketching?.drag;},start:startSketch,render:renderSketch,resync:resyncSketch};
}
