/* Skizze (ab 1.21): Plan zeichnen, wenn kein Grundriss vorliegt.
   Räume als Rechtecke mit Maßen, freie (auch schräge) Wände, Türen und Fenster auf jeder Wand, freier Text.
   Einheiten in Zentimetern; daraus entsteht ein normaler SVG-Plan mit gesetztem Maßstab (100 Einheiten = 1 m).
   Die Skizzendaten bleiben am Plan (plan.sketch) und lassen sich jederzeit weiter bearbeiten; Proben behalten ihre Lage,
   weil der Ursprung der Zeichenfläche beim Bearbeiten fest bleibt. */
import type {Plan,Point} from './model';

/** fire: Brandraum (ab 1.41, Schnellskizze) – hell orange hinterlegt, „Brandraum“ unter dem Namen. */
export interface SketchRoom {id:string;name:string;x:number;y:number;w:number;h:number;fire?:true}
/** Freie Wand von (x1,y1) nach (x2,y2), auch schräg. */
export interface SketchWall {id:string;x1:number;y1:number;x2:number;y2:number}
/** Tür oder Fenster mittig bei (x,y) auf einer Wand mit Richtung a (Grad); w = Breite; side = Aufschlagseite der Tür (+1/-1). */
export interface SketchOpening {id:string;kind:'door'|'window';x:number;y:number;a:number;w:number;side:1|-1}
/** Freier Text, z. B. „Treppe“, „Garage“; size = Schrifthöhe in cm. */
export interface SketchText {id:string;x:number;y:number;text:string;size:number}
/** schematic (ab 1.41): „Skizze – nicht maßstäblich“ – kein Maßstab, keine m², Stempel auf dem Plan. */
export interface Sketch {width:number;height:number;rooms:SketchRoom[];walls:SketchWall[];openings:SketchOpening[];texts:SketchText[];schematic?:true}
export const GRID=10,WALL=12,MIN_ROOM=50,MIN_WALL=30,DEFAULT_DOOR=90,DEFAULT_WINDOW=120,MAX_ROOMS=200,MAX_WALLS=400,MAX_OPENINGS=400,MAX_TEXTS=200,MAX_SIZE=20000;   // cm; 200 m
export const TEXT_SIZES:[number,string][]=[[20,'klein'],[30,'mittel'],[45,'groß']];
export const snap=(v:number)=>Math.round(v/GRID)*GRID;
const uid=()=>crypto.randomUUID();
export function emptySketch(widthM=25,heightM=18):Sketch{return {width:Math.round(widthM*100),height:Math.round(heightM*100),rooms:[],walls:[],openings:[],texts:[]};}
export const cloneSketch=(s:Sketch):Sketch=>({width:s.width,height:s.height,rooms:s.rooms.map(r=>({...r})),walls:s.walls.map(w=>({...w})),openings:s.openings.map(o=>({...o})),texts:s.texts.map(t=>({...t})),...(s.schematic?{schematic:true as const}:{})});
const esc=(t:string)=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export const meters=(cm:number)=>(cm/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});
export const area=(r:SketchRoom)=>(r.w*r.h/10000).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
const r2=(v:number)=>Math.round(v*100)/100;
export const wallLength=(w:SketchWall)=>Math.hypot(w.x2-w.x1,w.y2-w.y1);

/* ---------- Wände als Strecken ---------- */
interface Seg {x1:number;y1:number;x2:number;y2:number;owner:string}
export function segments(s:Sketch):Seg[]{
  const out:Seg[]=[];
  for(const r of s.rooms){const a={x:r.x,y:r.y},b={x:r.x+r.w,y:r.y},c={x:r.x+r.w,y:r.y+r.h},d={x:r.x,y:r.y+r.h};
    for(const [p,q] of [[a,b],[b,c],[d,c],[a,d]] as [Point,Point][])out.push({x1:p.x,y1:p.y,x2:q.x,y2:q.y,owner:r.id});}
  for(const w of s.walls)out.push({...w,owner:w.id});
  return out;
}
/** Abstand eines Punkts zur Strecke und Lage t (0…1) des Lotfußpunkts. */
function project(seg:Seg,p:Point){const dx=seg.x2-seg.x1,dy=seg.y2-seg.y1,l2=dx*dx+dy*dy||1;const t=Math.max(0,Math.min(1,((p.x-seg.x1)*dx+(p.y-seg.y1)*dy)/l2));const x=seg.x1+t*dx,y=seg.y1+t*dy;return {t,x,y,d:Math.hypot(p.x-x,p.y-y),len:Math.sqrt(l2)};}
/** Liegt die Öffnung auf dieser Strecke (parallel, auf der Linie, innerhalb)? */
function onSeg(o:SketchOpening,seg:Seg){const pr=project(seg,o),a=Math.atan2(seg.y2-seg.y1,seg.x2-seg.x1)*180/Math.PI,diff=Math.abs(Math.sin((a-o.a)*Math.PI/180));return pr.d<1&&diff<.01&&pr.t>0&&pr.t<1;}
const hostedBy=(s:Sketch,o:SketchOpening,owner:string)=>segments(s).some(g=>g.owner===owner&&onSeg(o,g));
/** Öffnungen ohne Wand entfernen (nach Löschen oder Verkleinern). */
function dropOrphans(s:Sketch){const segs=segments(s);s.openings=s.openings.filter(o=>segs.some(g=>onSeg(o,g)));}

/* ---------- SVG ---------- */
const FONT='Arial, Helvetica, sans-serif';
/** Brandraum: ruhiges Pastell-Orange (Füllung) und dunkles Orange für die Schrift. */
export const FIRE_FILL='#fbe7d8',FIRE_TEXT='#8a3f10';
/** SVG der Skizze: Räume und Wände mit Wandstärke, Türen (Aufschlag) und Fenster, Raumname mit Fläche, freier Text. */
export function sketchSVG(s:Sketch){
  const fills=s.rooms.map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.fire?FIRE_FILL:'#ffffff'}"/>`).join('');
  const walls=s.rooms.map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="#1f1f1f" stroke-width="${WALL}" stroke-linejoin="miter"/>`).join('')
    +s.walls.map(w=>`<line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="#1f1f1f" stroke-width="${WALL}" stroke-linecap="square"/>`).join('');
  const openings=s.openings.map(o=>{const h=o.w/2,gap=`<rect x="${-h}" y="${-WALL}" width="${o.w}" height="${WALL*2}" fill="#ffffff"/>`;
    const body=o.kind==='door'?`<path d="M${-h} 0 L${-h} ${o.side*o.w} A${o.w} ${o.w} 0 0 ${o.side>0?0:1} ${h} 0" fill="none" stroke="#6b6b6b" stroke-width="3"/>`
      :`<rect x="${-h}" y="${-WALL/2}" width="${o.w}" height="${WALL}" fill="#ffffff" stroke="#1f1f1f" stroke-width="2"/><line x1="${-h}" y1="0" x2="${h}" y2="0" stroke="#1f1f1f" stroke-width="2"/>`;
    return `<g transform="translate(${r2(o.x)} ${r2(o.y)}) rotate(${r2(o.a)})">${gap}${body}</g>`;}).join('');
  const names=s.rooms.map(r=>{const fs=Math.round(Math.max(14,Math.min(40,r.w/7,r.h/4))),sub=Math.round(fs*.7);
    const second=r.fire?`<text x="${r.x+r.w/2}" y="${r.y+r.h/2+fs*1.05}" font-family="${FONT}" font-size="${sub}" font-weight="700" text-anchor="middle" fill="${FIRE_TEXT}">BRANDRAUM</text>`
      :s.schematic?'':`<text x="${r.x+r.w/2}" y="${r.y+r.h/2+fs*1.05}" font-family="${FONT}" font-size="${sub}" text-anchor="middle" fill="#666666">${area(r)} m²</text>`;
    return `<text x="${r.x+r.w/2}" y="${r.y+r.h/2}" font-family="${FONT}" font-size="${fs}" text-anchor="middle" fill="#2b2b2b">${esc(r.name)}</text>${second}`;}).join('');
  const texts=s.texts.map(t=>`<text x="${t.x}" y="${t.y+t.size*.35}" font-family="${FONT}" font-size="${t.size}" text-anchor="middle" fill="#2b2b2b">${esc(t.text)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.width}" height="${s.height}" viewBox="0 0 ${s.width} ${s.height}"><rect width="${s.width}" height="${s.height}" fill="#ffffff"/>${fills}${walls}${openings}${names}${texts}${s.schematic?stamp(s):''}</svg>`;
}
/** Stempel unten rechts: „SKIZZE – NICHT MASSSTÄBLICH“. */
export const STAMP_TEXT='SKIZZE – NICHT MASSSTÄBLICH';
function stamp(s:Sketch){
  const fs=Math.round(Math.max(18,Math.min(40,Math.min(s.width,s.height)/35))),w=Math.round(fs*.62*STAMP_TEXT.length+fs*1.2),h=Math.round(fs*1.8),x=s.width-w-fs,y=s.height-h-fs;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="#1f1f1f" stroke-width="${Math.max(2,Math.round(fs/10))}"/><text x="${x+w/2}" y="${y+h/2+fs*.35}" font-family="${FONT}" font-size="${fs}" font-weight="700" text-anchor="middle" fill="#1f1f1f">${STAMP_TEXT}</text></g>`;
}
function dataURL(svg:string){const bytes=new TextEncoder().encode(svg);let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return 'data:image/svg+xml;base64,'+btoa(bin);}
/** Plan aus der Skizze; Einstellungen des bisherigen Plans (Punktgröße, Beschriftung, Norden) bleiben. Maßstab 1 m = 100 Einheiten. */
export function sketchPlan(s:Sketch,keep?:Plan):Plan{
  return {name:keep?.name||'Skizze',width:s.width,height:s.height,data:dataURL(sketchSVG(s)),vector:true,sketch:cloneSketch(s),...(s.schematic?{}:{calibration:{units:100,meters:1}}),
    ...(keep?.markerScale!==undefined?{markerScale:keep.markerScale}:{}),...(keep?.autoLabels!==undefined?{autoLabels:keep.autoLabels}:{}),...(keep?.valueLabels!==undefined?{valueLabels:keep.valueLabels}:{}),...(keep?.surfaceBars!==undefined?{surfaceBars:keep.surfaceBars}:{}),...(keep?.north!==undefined?{north:keep.north}:{})};
}

/* ---------- Räume ---------- */
/** Raster und Kanten anderer Räume (bis tol cm) – Wandkante vor Raster. */
/** Nächste Kante bis tol cm, sonst null. */
function edgeNear(v:number,edges:number[],tol=25){let best:number|null=null,d=tol;for(const e of edges){const x=Math.abs(e-v);if(x<=d){best=e;d=x;}}return best;}
export function snapTo(v:number,edges:number[],tol=25){let best:number|null=null,d=tol;for(const e of edges){const x=Math.abs(e-v);if(x<=d){best=e;d=x;}}return best??snap(v);}
export function edges(s:Sketch,except?:string){const xs:number[]=[],ys:number[]=[];for(const r of s.rooms){if(r.id===except)continue;xs.push(r.x,r.x+r.w);ys.push(r.y,r.y+r.h);}for(const w of s.walls){if(w.id===except)continue;xs.push(w.x1,w.x2);ys.push(w.y1,w.y2);}return {xs,ys};}
export function nextRoomName(s:Sketch){let n=s.rooms.length+1;while(s.rooms.some(r=>r.name===`Raum ${n}`))n++;return `Raum ${n}`;}
/** Raum aus zwei Ecken (gerastet, an Kanten eingerastet, in der Zeichenfläche). null, wenn zu klein. */
export function roomFrom(s:Sketch,a:Point,b:Point):SketchRoom|null{
  const e=edges(s),x0=snapTo(Math.min(a.x,b.x),e.xs),x1=snapTo(Math.max(a.x,b.x),e.xs),y0=snapTo(Math.min(a.y,b.y),e.ys),y1=snapTo(Math.max(a.y,b.y),e.ys);
  const x=Math.max(0,x0),y=Math.max(0,y0),w=Math.min(s.width,x1)-x,h=Math.min(s.height,y1)-y;
  return w>=MIN_ROOM&&h>=MIN_ROOM?{id:uid(),name:nextRoomName(s),x,y,w,h}:null;
}
export function addRoom(s:Sketch,r:SketchRoom){if(s.rooms.length>=MAX_ROOMS)throw Error(`Höchstens ${MAX_ROOMS} Räume je Skizze.`);s.rooms.push(r);}
/** Raum verschieben (gerastet, an Kanten eingerastet); Türen und Fenster auf seinen Wänden wandern mit. */
export function moveRoom(s:Sketch,id:string,dx:number,dy:number,from:SketchRoom,edgeFirst=false){
  const r=s.rooms.find(x=>x.id===id);if(!r)return;const e=edges(s,id);
  // Schnellskizze (edgeFirst): rastet eine der beiden Kanten an einer Wand ein, gewinnt das vor dem Raster (ab 1.41).
  const axis=(v:number,size:number,list:number[])=>{const c=[edgeNear(v,list),(()=>{const t=edgeNear(v+size,list);return t===null?null:t-size;})()].filter((n):n is number=>n!==null);return c.length?c.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a):snap(v);};
  let x:number,y:number;
  if(edgeFirst){x=axis(from.x+dx,from.w,e.xs);y=axis(from.y+dy,from.h,e.ys);}
  else{x=from.x+dx;y=from.y+dy;const sx=snapTo(x,e.xs),sx2=snapTo(x+from.w,e.xs)-from.w;x=Math.abs(sx-x)<=Math.abs(sx2-x)?sx:sx2;
    const sy=snapTo(y,e.ys),sy2=snapTo(y+from.h,e.ys)-from.h;y=Math.abs(sy-y)<=Math.abs(sy2-y)?sy:sy2;}
  x=Math.max(0,Math.min(s.width-from.w,x));y=Math.max(0,Math.min(s.height-from.h,y));
  const mx=x-r.x,my=y-r.y,moving=s.openings.filter(o=>hostedBy(s,o,id));r.x=x;r.y=y;for(const o of moving){o.x+=mx;o.y+=my;}
}
/** Größe ändern: neue Breite/Tiefe in cm (obere linke Ecke bleibt); Öffnungen ohne Wand fallen weg. */
export function resizeRoom(s:Sketch,id:string,w:number,h:number){
  const r=s.rooms.find(x=>x.id===id);if(!r)return;if(!Number.isFinite(w)||!Number.isFinite(h))throw Error('Bitte Maße in Metern eingeben, z. B. 4,20.');
  r.w=Math.max(MIN_ROOM,Math.min(s.width-r.x,snap(w)));r.h=Math.max(MIN_ROOM,Math.min(s.height-r.y,snap(h)));dropOrphans(s);
}
export function removeRoom(s:Sketch,id:string){s.rooms=s.rooms.filter(x=>x.id!==id);dropOrphans(s);}

/* ---------- Freie Wände ---------- */
/** Endpunkt einrasten: Raumecken und Wandenden (bis tol cm), sonst Raster. */
function snapPoint(s:Sketch,p:Point,except?:string,tol=25):Point{
  let best:Point|null=null,d=tol;
  const pts:Point[]=[...s.rooms.flatMap(r=>[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}]),...s.walls.filter(w=>w.id!==except).flatMap(w=>[{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}])];
  for(const q of pts){const x=Math.hypot(q.x-p.x,q.y-p.y);if(x<=d){best=q;d=x;}}
  return best?{...best}:{x:snap(p.x),y:snap(p.y)};
}
/** Wand aus zwei Punkten: Enden rasten an Ecken ein; Richtungen nahe 15°-Schritten (±4°) werden genau ausgerichtet. */
export function wallFrom(s:Sketch,a:Point,b:Point):SketchWall|null{
  const p=snapPoint(s,a);let q=snapPoint(s,b);
  const ang=Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI,step=Math.round(ang/15)*15;
  if(Math.abs(ang-step)<=4&&Math.abs(ang-step)>1e-9){const len=snap(Math.hypot(q.x-p.x,q.y-p.y)),r=step*Math.PI/180;q={x:r2(p.x+Math.cos(r)*len),y:r2(p.y+Math.sin(r)*len)};}
  const clamp=(v:number,max:number)=>Math.max(0,Math.min(max,v));q={x:clamp(q.x,s.width),y:clamp(q.y,s.height)};
  return Math.hypot(q.x-p.x,q.y-p.y)>=MIN_WALL?{id:uid(),x1:clamp(p.x,s.width),y1:clamp(p.y,s.height),x2:q.x,y2:q.y}:null;
}
export function addWall(s:Sketch,w:SketchWall){if(s.walls.length>=MAX_WALLS)throw Error(`Höchstens ${MAX_WALLS} Wände je Skizze.`);s.walls.push(w);}
/** Wand verschieben (Startpunkt rastet ein); Öffnungen darauf wandern mit. */
export function moveWall(s:Sketch,id:string,dx:number,dy:number,from:SketchWall){
  const w=s.walls.find(x=>x.id===id);if(!w)return;const p=snapPoint(s,{x:from.x1+dx,y:from.y1+dy},id),mx=p.x-from.x1,my=p.y-from.y1;
  const xs=[from.x1+mx,from.x2+mx],ys=[from.y1+my,from.y2+my];if(Math.min(...xs)<0||Math.min(...ys)<0||Math.max(...xs)>s.width||Math.max(...ys)>s.height)return;
  const moving=s.openings.filter(o=>hostedBy(s,o,id)),ox=from.x1+mx-w.x1,oy=from.y1+my-w.y1;
  w.x1=from.x1+mx;w.y1=from.y1+my;w.x2=from.x2+mx;w.y2=from.y2+my;for(const o of moving){o.x+=ox;o.y+=oy;}
}
/** Länge ändern (Start und Richtung bleiben). */
export function setWallLength(s:Sketch,id:string,len:number){
  const w=s.walls.find(x=>x.id===id);if(!w)return;if(!Number.isFinite(len)||len<MIN_WALL)throw Error('Bitte eine Länge ab 0,30 m eingeben.');
  const l=wallLength(w),ux=(w.x2-w.x1)/l,uy=(w.y2-w.y1)/l,x2=r2(w.x1+ux*snap(len)),y2=r2(w.y1+uy*snap(len));
  if(x2<0||y2<0||x2>s.width||y2>s.height)throw Error('Die Wand würde über die Zeichenfläche hinausragen.');w.x2=x2;w.y2=y2;dropOrphans(s);
}
export function removeWall(s:Sketch,id:string){s.walls=s.walls.filter(w=>w.id!==id);dropOrphans(s);}

/* ---------- Türen und Fenster ---------- */
/** Öffnung an der nächsten Wand (bis tol cm). Tür schlägt in die Seite auf, auf der getippt wurde. */
export function openingAt(s:Sketch,p:Point,kind:'door'|'window',tol=40):SketchOpening|null{
  let best:{d:number;o:SketchOpening}|null=null;
  for(const g of segments(s)){
    const pr=project(g,p);if(pr.d>tol)continue;const want=kind==='door'?DEFAULT_DOOR:DEFAULT_WINDOW,w=Math.min(want,pr.len-20);if(w<40)continue;
    const dx=(g.x2-g.x1)/pr.len,dy=(g.y2-g.y1)/pr.len,along=Math.max(w/2,Math.min(pr.len-w/2,snap(pr.t*pr.len)));
    const cross=dx*(p.y-pr.y)-dy*(p.x-pr.x),inside=s.rooms.some(r=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h&&r.id===g.owner);
    const o:SketchOpening={id:uid(),kind,x:r2(g.x1+dx*along),y:r2(g.y1+dy*along),a:r2(Math.atan2(dy,dx)*180/Math.PI),w,side:cross>=0?1:-1};
    const score=pr.d-(inside?5:0);if(!best||score<best.d)best={d:score,o};
  }
  return best?.o||null;
}
export function addOpening(s:Sketch,o:SketchOpening){
  if(s.openings.length>=MAX_OPENINGS)throw Error(`Höchstens ${MAX_OPENINGS} Türen und Fenster je Skizze.`);
  if(s.openings.some(x=>Math.abs(Math.sin((x.a-o.a)*Math.PI/180))<.01&&Math.hypot(x.x-o.x,x.y-o.y)<(x.w+o.w)/2))throw Error('Dort ist schon eine Tür oder ein Fenster.');
  s.openings.push(o);
}
export function setOpeningWidth(s:Sketch,id:string,w:number){
  const o=s.openings.find(x=>x.id===id);if(!o)return;if(!Number.isFinite(w)||w<40||w>400)throw Error('Breite zwischen 0,40 und 4,00 m.');
  const old=o.w;o.w=snap(w);if(!segments(s).some(g=>{const pr=project(g,o);return onSeg(o,g)&&pr.t*pr.len>=o.w/2-.01&&(1-pr.t)*pr.len>=o.w/2-.01;})){o.w=old;throw Error('So breit passt die Öffnung nicht auf diese Wand.');}
}

/* ---------- Text ---------- */
export function addText(s:Sketch,p:Point,text='Text'):SketchText{if(s.texts.length>=MAX_TEXTS)throw Error(`Höchstens ${MAX_TEXTS} Texte je Skizze.`);const t={id:uid(),x:snap(p.x),y:snap(p.y),text,size:30};s.texts.push(t);return t;}
export function moveText(s:Sketch,id:string,dx:number,dy:number,from:SketchText){const t=s.texts.find(x=>x.id===id);if(!t)return;t.x=Math.max(0,Math.min(s.width,snap(from.x+dx)));t.y=Math.max(0,Math.min(s.height,snap(from.y+dy)));}

/* ---------- Auswahl ---------- */
export type SketchKind='room'|'wall'|'opening'|'text';
/** Element unter dem Punkt: Öffnungen, Texte, Wände, dann Räume (zuletzt gezeichnete zuerst). */
export function hit(s:Sketch,p:Point,tol=20):{type:SketchKind;id:string}|null{
  for(const o of s.openings){const r=-o.a*Math.PI/180,dx=p.x-o.x,dy=p.y-o.y,lx=dx*Math.cos(r)-dy*Math.sin(r),ly=dx*Math.sin(r)+dy*Math.cos(r);if(Math.abs(lx)<=o.w/2&&Math.abs(ly)<tol)return {type:'opening',id:o.id};}
  for(const t of s.texts){const hw=Math.max(tol,t.size*.3*t.text.length),hh=Math.max(tol,t.size*.6);if(Math.abs(p.x-t.x)<=hw&&Math.abs(p.y-t.y)<=hh)return {type:'text',id:t.id};}
  for(const w of s.walls)if(project({...w,owner:w.id},p).d<Math.max(tol,WALL))return {type:'wall',id:w.id};
  for(let i=s.rooms.length-1;i>=0;i--){const r=s.rooms[i];if(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)return {type:'room',id:r.id};}
  return null;
}

/* ---------- Zeichenfläche ---------- */
function extent(s:Sketch){
  const xs=[...s.rooms.flatMap(r=>[r.x,r.x+r.w]),...s.walls.flatMap(w=>[w.x1,w.x2]),...s.texts.flatMap(t=>[t.x-t.size*.3*t.text.length,t.x+t.size*.3*t.text.length])];
  const ys=[...s.rooms.flatMap(r=>[r.y,r.y+r.h]),...s.walls.flatMap(w=>[w.y1,w.y2]),...s.texts.flatMap(t=>[t.y-t.size,t.y+t.size])];
  return xs.length?{x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)}:null;
}
/** Zeichenfläche ändern: nur so klein, dass alles darauf passt. */
export function resizeCanvas(s:Sketch,w:number,h:number){
  if(!Number.isFinite(w)||!Number.isFinite(h))throw Error('Bitte Maße in Metern eingeben.');const e=extent(s);
  s.width=Math.min(MAX_SIZE,Math.max(MIN_ROOM*4,e?Math.ceil(e.x1):0,snap(w)));s.height=Math.min(MAX_SIZE,Math.max(MIN_ROOM*4,e?Math.ceil(e.y1):0,snap(h)));
}
/** Zeichenfläche auf den Inhalt zuschneiden (Rand in cm). Gibt die Verschiebung zurück, um Proben/Flächen mitzuschieben. */
export function trimSketch(s:Sketch,margin=100):{sketch:Sketch;dx:number;dy:number}{
  const e=extent(s);if(!e)return {sketch:cloneSketch(s),dx:0,dy:0};
  const x0=Math.max(0,snap(e.x0-margin)),y0=Math.max(0,snap(e.y0-margin)),x1=snap(e.x1+margin),y1=snap(e.y1+margin);
  const t=cloneSketch(s);t.rooms.forEach(r=>{r.x-=x0;r.y-=y0;});t.walls.forEach(w=>{w.x1-=x0;w.x2-=x0;w.y1-=y0;w.y2-=y0;});t.openings.forEach(o=>{o.x=r2(o.x-x0);o.y=r2(o.y-y0);});t.texts.forEach(x=>{x.x-=x0;x.y-=y0;});
  t.width=Math.min(MAX_SIZE,Math.max(MIN_ROOM*4,x1-x0));t.height=Math.min(MAX_SIZE,Math.max(MIN_ROOM*4,y1-y0));
  return {sketch:t,dx:x0,dy:y0};
}
/** Zum Weiterzeichnen: Fläche rechts und unten erweitern (Ursprung bleibt, Proben bleiben an ihrer Stelle). */
export function extendSketch(s:Sketch,extra=800){const t=cloneSketch(s),e=extent(t);if(e){t.width=Math.min(MAX_SIZE,Math.max(t.width,Math.ceil(e.x1+extra)));t.height=Math.min(MAX_SIZE,Math.max(t.height,Math.ceil(e.y1+extra)));}return t;}

/* ---------- Projektdatei ---------- */
/** Skizze aus einer Projektdatei prüfen (Zahlen, Grenzen, Kennungen, Texte). */
export function validateSketch(raw:unknown):Sketch{
  const bad=():never=>{throw Error('Ungültige Skizze in der Projektdatei.');};
  const o=raw as Sketch;if(!o||typeof o!=='object')bad();
  for(const k of ['rooms','walls','openings','texts'] as const)if(!Array.isArray(o[k]))bad();
  const num=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  if(!num(o.width,MIN_ROOM,MAX_SIZE)||!num(o.height,MIN_ROOM,MAX_SIZE)||o.rooms.length>MAX_ROOMS||o.walls.length>MAX_WALLS||o.openings.length>MAX_OPENINGS||o.texts.length>MAX_TEXTS)bad();
  const id=(v:unknown)=>typeof v==='string'&&/^[\w-]{1,80}$/.test(v),W=o.width,H=o.height;
  const rooms=o.rooms.map(r=>{if(!r||!id(r.id)||typeof r.name!=='string'||r.name.length>60||!num(r.x,0,W)||!num(r.y,0,H)||!num(r.w,1,W)||!num(r.h,1,H)||r.x+r.w>W+.01||r.y+r.h>H+.01||(r.fire!==undefined&&r.fire!==true))bad();return {id:r.id,name:r.name,x:r.x,y:r.y,w:r.w,h:r.h,...(r.fire?{fire:true as const}:{})};});
  const walls=o.walls.map(w=>{if(!w||!id(w.id)||!num(w.x1,0,W)||!num(w.x2,0,W)||!num(w.y1,0,H)||!num(w.y2,0,H))bad();return {id:w.id,x1:w.x1,y1:w.y1,x2:w.x2,y2:w.y2};});
  const openings=o.openings.map(x=>{if(!x||!id(x.id)||(x.kind!=='door'&&x.kind!=='window')||(x.side!==1&&x.side!==-1)||!num(x.x,0,W)||!num(x.y,0,H)||!num(x.a,-360,360)||!num(x.w,10,1000))bad();return {id:x.id,kind:x.kind,x:x.x,y:x.y,a:x.a,w:x.w,side:x.side};});
  const texts=o.texts.map(t=>{if(!t||!id(t.id)||typeof t.text!=='string'||!t.text.trim()||t.text.length>80||!num(t.x,0,W)||!num(t.y,0,H)||!num(t.size,8,200))bad();return {id:t.id,x:t.x,y:t.y,text:t.text,size:t.size};});
  if(o.schematic!==undefined&&o.schematic!==true)bad();
  return {width:W,height:H,rooms,walls,openings,texts,...(o.schematic?{schematic:true as const}:{})};
}

/* ---------- Schnellskizze (ab 1.41, abschaltbar) ----------
   Räume als Liste eintippen → Rechtecke im Raster, danach nur noch anordnen. „Nicht maßstäblich“ ohne Maßstab und m²,
   Brandraum je Raum, beim Setzen einer Probe wird der Raum übernommen. Ausgeschaltet verhält sich die Skizze wie bisher;
   bereits gesetzte Kennzeichen (Brandraum, nicht maßstäblich) bleiben in der Skizze erhalten. */
export const QUICK_KEY='plankit-schnellskizze';
export function quickSketchOn(){try{return localStorage.getItem(QUICK_KEY)!=='0';}catch{return true;}}
export function setQuickSketch(on:boolean){try{localStorage.setItem(QUICK_KEY,on?'1':'0');}catch{/* ohne Speicher */}}
export const LIST_ROOM_W=400,LIST_ROOM_H=350,LIST_GAP=100;
/** Raumliste: eine Zeile je Raum, Komma oder Semikolon geht auch. „Brandraum“ am Ende (auch in Klammern) markiert den Raum. */
export function parseRoomList(text:string):{name:string;fire:boolean}[]{
  return String(text||'').split(/[\n\r,;]+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean).map(x=>{
    const m=/^(.*?)(?:^|[\s(\-–]+)brandraum\)?$/i.exec(x);const name=(m&&m[1].trim()?m[1].trim():x).slice(0,60);
    return {name,fire:!!m};});
}
/** Räume aus der Liste im Raster unter den bisherigen Inhalt legen (Zeichenfläche wächst mit). Gibt die neuen Räume zurück. */
export function roomsFromList(s:Sketch,list:{name:string;fire:boolean}[]):SketchRoom[]{
  if(!list.length)throw Error('Bitte mindestens einen Raum eintragen.');
  if(s.rooms.length+list.length>MAX_ROOMS)throw Error(`Höchstens ${MAX_ROOMS} Räume je Skizze.`);
  const cols=Math.min(4,Math.ceil(Math.sqrt(list.length))),rows=Math.ceil(list.length/cols),e=extent(s);
  const x0=100,y0=e?snap(e.y1+LIST_GAP*2):100,stepX=LIST_ROOM_W+LIST_GAP,stepY=LIST_ROOM_H+LIST_GAP;
  const needW=x0+cols*stepX,needH=y0+rows*stepY;if(needW>MAX_SIZE||needH>MAX_SIZE)throw Error('Die Zeichenfläche ist voll. Bitte eine weitere Skizze anlegen.');
  s.width=Math.max(s.width,needW);s.height=Math.max(s.height,needH);
  const out=list.map((r,i)=>({id:uid(),name:r.name,x:x0+(i%cols)*stepX,y:y0+Math.floor(i/cols)*stepY,w:LIST_ROOM_W,h:LIST_ROOM_H,...(r.fire?{fire:true as const}:{})}));
  s.rooms.push(...out);return out;
}
/** Raum unter dem Punkt (zuletzt gezeichneter zuerst) – für die Raumangabe an Proben. */
export function roomAt(s:Sketch,p:Point):SketchRoom|null{for(let i=s.rooms.length-1;i>=0;i--){const r=s.rooms[i];if(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)return r;}return null;}
