/* Nachzeichnung (ab 2.3.0, Projektformat 7): Räume, Wände, Türen und Fenster ÜBER einem geladenen Plan (PDF, Bild, SVG).
   Anders als die Skizze (plan.sketch) ersetzt sie das Planbild nicht – sie ist eine eigene Ebene und steht in plan.trace.
   Einheiten: Planeinheiten, dieselben Koordinaten wie die Probenpunkte (0…plan.width × 0…plan.height).
   Die Nachzeichnung liest und schreibt nie einen Maßstab: keine Meter, keine Flächen.
   Drehen um 90° und Zuschneiden nehmen sie exakt mit; Ausrichten und Entzerren sind gesperrt, solange es sie gibt.
   checked: bestätigt („geprüft“) mit Datum und Kürzel; fehlt es, gilt die Nachzeichnung als ungeprüft.
   joins: dieses Rechteck gehört ausdrücklich zu einem anderen Raum (Kennung des Hauptrechtecks) – gleiche Namen allein verbinden nichts. */
import type {Point,Rect} from './model';
import type {SketchOpening,SketchWall} from './sketch';

export interface TraceRoom {id:string;name:string;x:number;y:number;w:number;h:number;fire?:true;joins?:string}
export interface TraceCheck {date:string;by:string}
export interface Trace {rooms:TraceRoom[];walls:SketchWall[];openings:SketchOpening[];checked?:TraceCheck}
export const MAX_TRACE_ROOMS=200,MAX_TRACE_WALLS=1000,MAX_TRACE_OPENINGS=400,MAX_KUERZEL=40;
/** Kleinster Raum als Anteil der längeren Planseite (es gibt keine Zentimeter). */
export const MIN_ROOM_SHARE=.012;
export const minRoom=(plan:{width:number;height:number})=>Math.max(plan.width,plan.height)*MIN_ROOM_SHARE;
const r2=(v:number)=>Math.round(v*100)/100;
const uid=()=>crypto.randomUUID();

export const emptyTrace=():Trace=>({rooms:[],walls:[],openings:[]});
export const cloneTrace=(t:Trace):Trace=>({rooms:t.rooms.map(r=>({...r})),walls:t.walls.map(w=>({...w})),openings:t.openings.map(o=>({...o})),...(t.checked?{checked:{...t.checked}}:{})});
export const traceEmpty=(t:Trace|undefined)=>!t||!(t.rooms.length||t.walls.length||t.openings.length);
/** Jede Änderung an der Geometrie nimmt „geprüft“ weg (Umbenennen und Brandraum nicht). */
export function uncheck(t:Trace){delete t.checked;}
export function setChecked(t:Trace,date:string,by:string){
  const k=by.replace(/\s+/g,' ').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!k||k.length>MAX_KUERZEL)throw Error('Bitte ein Kürzel angeben (wer prüft).');
  if(traceEmpty(t))throw Error('Die Nachzeichnung ist noch leer.');
  t.checked={date,by:k};
}

/* ---------- Räume ---------- */
/** Hauptrechteck eines Raums (bei verbundenen Teilen das Rechteck, auf das joins zeigt). */
export function mainRoom(t:Trace,r:TraceRoom):TraceRoom{return r.joins?t.rooms.find(x=>x.id===r.joins)||r:r;}
const inside=(r:TraceRoom,p:Point)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
/** Rechteck unter dem Punkt (zuletzt gezeichnetes zuerst). */
export function rectAt(t:Trace,p:Point):TraceRoom|null{for(let i=t.rooms.length-1;i>=0;i--)if(inside(t.rooms[i],p))return t.rooms[i];return null;}
/** Raum unter dem Punkt – für die Raumangabe an Proben: Name und Kennung des Hauptrechtecks. */
export function traceRoomAt(t:Trace,p:Point):TraceRoom|null{const r=rectAt(t,p);return r?mainRoom(t,r):null;}
export function nextTraceRoomName(t:Trace){let n=t.rooms.filter(r=>!r.joins).length+1;while(t.rooms.some(r=>r.name===`Raum ${n}`))n++;return `Raum ${n}`;}
/** Kanten und Ecken zum Einrasten (ohne das Rechteck/die Wand „except“). */
export function traceEdges(t:Trace,except?:string){const xs:number[]=[],ys:number[]=[];for(const r of t.rooms){if(r.id===except)continue;xs.push(r.x,r.x+r.w);ys.push(r.y,r.y+r.h);}for(const w of t.walls){if(w.id===except)continue;xs.push(w.x1,w.x2);ys.push(w.y1,w.y2);}return {xs,ys};}
/** Wert an die nächste Kante legen (bis tol Planeinheiten), sonst unverändert – es gibt kein Raster. */
export function snapEdge(v:number,list:number[],tol:number){let best=v,d=tol;for(const e of list){const x=Math.abs(e-v);if(x<=d){best=e;d=x;}}return best;}
/** Raum aus zwei Ecken: an Kanten eingerastet, im Plan. null, wenn zu klein. tol in Planeinheiten (am Bildschirm 12 px). */
export function traceRoomFrom(t:Trace,plan:{width:number;height:number},a:Point,b:Point,tol:number):TraceRoom|null{
  const e=traceEdges(t),clampX=(v:number)=>Math.max(0,Math.min(plan.width,v)),clampY=(v:number)=>Math.max(0,Math.min(plan.height,v));
  const x0=clampX(snapEdge(Math.min(a.x,b.x),e.xs,tol)),x1=clampX(snapEdge(Math.max(a.x,b.x),e.xs,tol)),y0=clampY(snapEdge(Math.min(a.y,b.y),e.ys,tol)),y1=clampY(snapEdge(Math.max(a.y,b.y),e.ys,tol)),min=minRoom(plan);
  return x1-x0>=min&&y1-y0>=min?{id:uid(),name:nextTraceRoomName(t),x:r2(x0),y:r2(y0),w:r2(x1-x0),h:r2(y1-y0)}:null;
}
export function addTraceRoom(t:Trace,r:TraceRoom){if(t.rooms.length>=MAX_TRACE_ROOMS)throw Error(`Höchstens ${MAX_TRACE_ROOMS} Räume je Nachzeichnung.`);t.rooms.push(r);uncheck(t);}
/** Rechteck verschieben: eine der Kanten rastet an Nachbarn ein; bleibt im Plan. from = Lage vor dem Ziehen. */
export function moveTraceRoom(t:Trace,plan:{width:number;height:number},id:string,dx:number,dy:number,from:TraceRoom,tol:number){
  const r=t.rooms.find(x=>x.id===id);if(!r)return;const e=traceEdges(t,id);
  const axis=(v:number,size:number,list:number[])=>{const a=snapEdge(v,list,tol),b=snapEdge(v+size,list,tol)-size;return a!==v&&(b===v||Math.abs(a-v)<=Math.abs(b-v))?a:b;};
  r.x=r2(Math.max(0,Math.min(plan.width-from.w,axis(from.x+dx,from.w,e.xs))));r.y=r2(Math.max(0,Math.min(plan.height-from.h,axis(from.y+dy,from.h,e.ys))));uncheck(t);
}
/** Größe ändern (obere linke Ecke bleibt): rechte/untere Kante rastet ein. */
export function resizeTraceRoom(t:Trace,plan:{width:number;height:number},id:string,w:number,h:number,tol:number){
  const r=t.rooms.find(x=>x.id===id);if(!r)return;const e=traceEdges(t,id),min=minRoom(plan);
  const x1=Math.min(plan.width,snapEdge(r.x+w,e.xs,tol)),y1=Math.min(plan.height,snapEdge(r.y+h,e.ys,tol));
  r.w=r2(Math.max(min,x1-r.x));r.h=r2(Math.max(min,y1-r.y));uncheck(t);
}
/** Rechteck löschen. War es ein Hauptrechteck mit Teilen, wird der erste Teil zum Hauptrechteck. Gibt dessen Kennung zurück (für Proben). */
export function removeTraceRoom(t:Trace,id:string):{heir:string|null}{
  const gone=t.rooms.find(r=>r.id===id);if(!gone)return {heir:null};
  t.rooms=t.rooms.filter(r=>r.id!==id);let heir:TraceRoom|undefined;
  if(!gone.joins){heir=t.rooms.find(r=>r.joins===id);if(heir){delete heir.joins;heir.name=gone.name;if(gone.fire)heir.fire=true;for(const r of t.rooms)if(r.joins===id)r.joins=heir.id;}}
  uncheck(t);return {heir:heir?.id||null};
}
/** Raum umbenennen (wirkt auf das Hauptrechteck und alle Teile). „geprüft“ bleibt. */
export function renameTraceRoom(t:Trace,id:string,name:string):{main:string;old:string}|null{
  const r=t.rooms.find(x=>x.id===id);if(!r)return null;const m=mainRoom(t,r),old=m.name,v=name.replace(/\s+/g,' ').trim().slice(0,60);if(!v||v===old)return null;
  m.name=v;for(const x of t.rooms)if(x.joins===m.id)x.name=v;return {main:m.id,old};
}
export function setTraceFire(t:Trace,id:string,on:boolean){const r=t.rooms.find(x=>x.id===id);if(!r)return;const m=mainRoom(t,r);for(const x of t.rooms)if(x===m||x.joins===m.id){if(on)x.fire=true;else delete x.fire;}}
const touches=(a:TraceRoom,b:TraceRoom)=>a.x<=b.x+b.w+.01&&b.x<=a.x+a.w+.01&&a.y<=b.y+b.h+.01&&b.y<=a.y+a.h+.01;
/** „gehört zu Raum …“: Rechteck part wird Teil des Raums von target (muss ihn berühren oder überlappen). Eigene Teile wandern mit. */
export function joinTraceRoom(t:Trace,partId:string,targetId:string){
  const part=t.rooms.find(r=>r.id===partId),target=t.rooms.find(r=>r.id===targetId);if(!part||!target)return;
  const main=mainRoom(t,target);if(main.id===mainRoom(t,part).id)throw Error('Das gehört schon zu diesem Raum.');
  const group=t.rooms.filter(r=>r===main||r.joins===main.id);
  if(!group.some(g=>touches(g,part)))throw Error('Die beiden Rechtecke müssen sich berühren.');
  const own=t.rooms.filter(r=>r.joins===part.id);
  for(const r of [part,...own]){r.joins=main.id;r.name=main.name;if(main.fire)r.fire=true;else delete r.fire;}
  uncheck(t);
}
/** „Verbindung lösen“: der Teil wird wieder ein eigener Raum (mit dem bisherigen Namen). */
export function unjoinTraceRoom(t:Trace,id:string){const r=t.rooms.find(x=>x.id===id);if(!r?.joins)return;delete r.joins;uncheck(t);}

/* ---------- Drehen und Zuschneiden (exakt, „geprüft“ bleibt) ---------- */
/** Um 90° drehen wie rotateProject: w,h = Plangröße VOR dem Drehen; direction 1 = rechts, -1 = links. */
export function rotateTrace(t:Trace,direction:1|-1,w:number,h:number){
  const turn=(x:number,y:number)=>direction===1?{x:h-y,y:x}:{x:y,y:w-x};
  for(const r of t.rooms){const a=turn(r.x,r.y),b=turn(r.x+r.w,r.y+r.h);r.x=r2(Math.min(a.x,b.x));r.y=r2(Math.min(a.y,b.y));const rw=r.w;r.w=r.h;r.h=rw;}
  for(const wl of t.walls){const a=turn(wl.x1,wl.y1),b=turn(wl.x2,wl.y2);wl.x1=r2(a.x);wl.y1=r2(a.y);wl.x2=r2(b.x);wl.y2=r2(b.y);}
  for(const o of t.openings){const p=turn(o.x,o.y);o.x=r2(p.x);o.y=r2(p.y);o.a=r2(((o.a+direction*90+540)%360)-180);}
}
/** Alle Punkte der Nachzeichnung: Raumecken, Wandenden und beide Enden jeder Öffnung (Mitte ± halbe Breite entlang ihrer Richtung) –
 *  ein Zuschnitt, der eine Tür oder ein Fenster durchschneidet, wird so abgelehnt statt sie still zu kappen. */
export function tracePoints(t:Trace):Point[]{return [...t.rooms.flatMap(r=>[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y+r.h}]),...t.walls.flatMap(w=>[{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}]),
  ...t.openings.flatMap(o=>{const a=o.a*Math.PI/180,dx=Math.cos(a)*o.w/2,dy=Math.sin(a)*o.w/2;return [{x:o.x-dx,y:o.y-dy},{x:o.x+dx,y:o.y+dy}];})];}
export const CROP_TRACE_ERROR='Der Zuschnitt muss die Nachzeichnung enthalten. Bitte einen größeren Ausschnitt wählen oder die Nachzeichnung vorher ändern/löschen.';
/** Zuschnitt: verschieben; liegt etwas außerhalb, wird der Zuschnitt abgelehnt (wie bei Proben). */
export function cropTrace(t:Trace,rect:Rect){
  if(tracePoints(t).some(p=>p.x<rect.x-.01||p.y<rect.y-.01||p.x>rect.x+rect.width+.01||p.y>rect.y+rect.height+.01))throw Error(CROP_TRACE_ERROR);
  const cx=(v:number)=>r2(Math.max(0,Math.min(rect.width,v-rect.x))),cy=(v:number)=>r2(Math.max(0,Math.min(rect.height,v-rect.y)));
  for(const r of t.rooms){const x1=cx(r.x+r.w),y1=cy(r.y+r.h);r.x=cx(r.x);r.y=cy(r.y);r.w=r2(x1-r.x);r.h=r2(y1-r.y);}
  for(const w of t.walls){w.x1=cx(w.x1);w.y1=cy(w.y1);w.x2=cx(w.x2);w.y2=cy(w.y2);}
  for(const o of t.openings){o.x=cx(o.x);o.y=cy(o.y);}
}
/** Satz an „Ausrichten“ und „Entzerren“, solange es eine Nachzeichnung gibt. */
export const LOCK_TRACE='Erst ausrichten, dann nachzeichnen – oder die Nachzeichnung löschen.';

/* ---------- Projektdatei ---------- */
/** Nachzeichnung aus einer Projektdatei prüfen. Ungültiges weist die Datei ab, statt still etwas zu verlieren. */
export function validateTrace(raw:unknown,plan:{width:number;height:number}):Trace{
  const bad=():never=>{throw Error('Ungültige Nachzeichnung in der Projektdatei.');};
  const o=raw as Trace;if(!o||typeof o!=='object'||Array.isArray(o))bad();
  for(const k of ['rooms','walls','openings'] as const)if(!Array.isArray(o[k]))bad();
  if(Object.keys(o).some(k=>!['rooms','walls','openings','checked'].includes(k)))bad();
  if(o.rooms.length>MAX_TRACE_ROOMS||o.walls.length>MAX_TRACE_WALLS||o.openings.length>MAX_TRACE_OPENINGS)bad();
  const W=plan.width,H=plan.height,num=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min-.01&&v<=max+.01;
  const id=(v:unknown):v is string=>typeof v==='string'&&/^[\w-]{1,80}$/.test(v),ids=new Set<string>();
  const once=(v:unknown)=>{if(!id(v)||ids.has(v))bad();ids.add(v as string);};
  const rooms=o.rooms.map(r=>{
    if(!r||typeof r!=='object')bad();once(r.id);
    if(typeof r.name!=='string'||!r.name.trim()||r.name.length>60||!num(r.x,0,W)||!num(r.y,0,H)||!(r.w>0)||!(r.h>0)||!num(r.x+r.w,0,W)||!num(r.y+r.h,0,H)||(r.fire!==undefined&&r.fire!==true)||(r.joins!==undefined&&!id(r.joins)))bad();
    return {id:r.id,name:r.name,x:r.x,y:r.y,w:r.w,h:r.h,...(r.fire?{fire:true as const}:{}),...(r.joins?{joins:r.joins}:{})};});
  // joins: zeigt auf ein vorhandenes Hauptrechteck – kein Selbstbezug, keine Kette; Name und Brandraum wie das Hauptrechteck.
  for(const r of rooms)if(r.joins){const m=rooms.find(x=>x.id===r.joins);if(!m||m===r||m.joins||m.name!==r.name||!!m.fire!==!!r.fire)bad();}
  const walls=o.walls.map(w=>{if(!w||typeof w!=='object')bad();once(w.id);if(!num(w.x1,0,W)||!num(w.x2,0,W)||!num(w.y1,0,H)||!num(w.y2,0,H)||Math.hypot(w.x2-w.x1,w.y2-w.y1)<=0)bad();return {id:w.id,x1:w.x1,y1:w.y1,x2:w.x2,y2:w.y2};});
  const openings=o.openings.map(x=>{if(!x||typeof x!=='object')bad();once(x.id);if((x.kind!=='door'&&x.kind!=='window')||(x.side!==1&&x.side!==-1)||!num(x.x,0,W)||!num(x.y,0,H)||!num(x.a,-360,360)||!(x.w>0)||!num(x.w,0,Math.max(W,H)))bad();return {id:x.id,kind:x.kind,x:x.x,y:x.y,a:x.a,w:x.w,side:x.side};});
  let checked:TraceCheck|undefined;
  if(o.checked!==undefined){const c=o.checked;
    if(!c||typeof c!=='object'||Object.keys(c).some(k=>k!=='date'&&k!=='by')||typeof c.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||Number.isNaN(Date.parse(c.date))||typeof c.by!=='string'||!c.by.trim()||c.by.length>MAX_KUERZEL)bad();
    if(!(rooms.length||walls.length||openings.length))bad();
    checked={date:c.date,by:c.by};}
  return {rooms,walls,openings,...(checked?{checked}:{})};
}
