/* Skizze (ab 1.21): Plan zeichnen, wenn kein Grundriss vorliegt.
   Räume als Rechtecke mit Maßen, Türen als Lücken mit Aufschlag. Einheiten in Zentimetern; daraus entsteht ein normaler
   SVG-Plan mit gesetztem Maßstab (100 Einheiten = 1 m). Die Skizzendaten bleiben am Plan (plan.sketch) und lassen sich
   jederzeit weiter bearbeiten; Proben behalten ihre Lage, weil der Ursprung der Zeichenfläche fest ist. */
import type {Plan,Point} from './model';

export interface SketchRoom {id:string;name:string;x:number;y:number;w:number;h:number}
/** Tür mittig bei (x,y) auf einer waagerechten ('h') oder senkrechten ('v') Wand; w = Breite, side = Aufschlagrichtung (+1/-1). */
export interface SketchDoor {id:string;x:number;y:number;dir:'h'|'v';w:number;side:1|-1}
export interface Sketch {width:number;height:number;rooms:SketchRoom[];doors:SketchDoor[]}
export const GRID=10,WALL=12,MIN_ROOM=50,DEFAULT_DOOR=90,MAX_ROOMS=200,MAX_DOORS=400,MAX_SIZE=20000;   // cm; 200 m
export const snap=(v:number)=>Math.round(v/GRID)*GRID;
const uid=()=>crypto.randomUUID();
export function emptySketch(widthM=25,heightM=18):Sketch{return {width:Math.round(widthM*100),height:Math.round(heightM*100),rooms:[],doors:[]};}
export const cloneSketch=(s:Sketch):Sketch=>({width:s.width,height:s.height,rooms:s.rooms.map(r=>({...r})),doors:s.doors.map(d=>({...d}))});
const esc=(t:string)=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export const meters=(cm:number)=>(cm/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});
export const area=(r:SketchRoom)=>(r.w*r.h/10000).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});

/** SVG der Skizze: weiße Fläche, Räume mit Wandstärke, Türlücken mit Aufschlag, Raumname und Fläche. */
export function sketchSVG(s:Sketch){
  const fills=s.rooms.map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#ffffff"/>`).join('');
  const walls=s.rooms.map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="#1f1f1f" stroke-width="${WALL}" stroke-linejoin="miter"/>`).join('');
  const doors=s.doors.map(d=>{const h=d.dir==='h',a=h?{x:d.x-d.w/2,y:d.y}:{x:d.x,y:d.y-d.w/2},b=h?{x:d.x+d.w/2,y:d.y}:{x:d.x,y:d.y+d.w/2};
    const gap=h?`<rect x="${a.x}" y="${d.y-WALL}" width="${d.w}" height="${WALL*2}" fill="#ffffff"/>`:`<rect x="${d.x-WALL}" y="${a.y}" width="${WALL*2}" height="${d.w}" fill="#ffffff"/>`;
    const leaf=h?{x:a.x,y:a.y+d.side*d.w}:{x:a.x+d.side*d.w,y:a.y},sweep=(h?d.side>0:d.side<0)?0:1;
    return `${gap}<path d="M${a.x} ${a.y} L${leaf.x} ${leaf.y} A${d.w} ${d.w} 0 0 ${sweep} ${b.x} ${b.y}" fill="none" stroke="#6b6b6b" stroke-width="3"/>`;}).join('');
  const texts=s.rooms.map(r=>{const fs=Math.round(Math.max(14,Math.min(40,r.w/7,r.h/4)));return `<text x="${r.x+r.w/2}" y="${r.y+r.h/2}" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" text-anchor="middle" fill="#2b2b2b">${esc(r.name)}</text><text x="${r.x+r.w/2}" y="${r.y+r.h/2+fs*1.05}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(fs*.7)}" text-anchor="middle" fill="#666666">${area(r)} m²</text>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.width}" height="${s.height}" viewBox="0 0 ${s.width} ${s.height}"><rect width="${s.width}" height="${s.height}" fill="#ffffff"/>${fills}${walls}${doors}${texts}</svg>`;
}
function dataURL(svg:string){const bytes=new TextEncoder().encode(svg);let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return 'data:image/svg+xml;base64,'+btoa(bin);}
/** Plan aus der Skizze; Einstellungen des bisherigen Plans (Punktgröße, Beschriftung, Norden) bleiben. Maßstab 1 m = 100 Einheiten. */
export function sketchPlan(s:Sketch,keep?:Plan):Plan{
  const svg=sketchSVG(s);
  return {name:keep?.name||'Skizze',width:s.width,height:s.height,data:dataURL(svg),vector:true,sketch:cloneSketch(s),calibration:{units:100,meters:1},
    ...(keep?.markerScale!==undefined?{markerScale:keep.markerScale}:{}),...(keep?.autoLabels!==undefined?{autoLabels:keep.autoLabels}:{}),...(keep?.valueLabels!==undefined?{valueLabels:keep.valueLabels}:{}),...(keep?.north!==undefined?{north:keep.north}:{})};
}

/* ---------- Bearbeiten ---------- */
/** Raster und Kanten anderer Räume (bis tol cm) – Räume rasten aneinander ein. */
export function snapTo(v:number,edges:number[],tol=25){let best:number|null=null,d=tol;for(const e of edges){const x=Math.abs(e-v);if(x<=d){best=e;d=x;}}return best??snap(v);}   // Wandkante vor Raster
export function edges(s:Sketch,except?:string){const xs:number[]=[],ys:number[]=[];for(const r of s.rooms){if(r.id===except)continue;xs.push(r.x,r.x+r.w);ys.push(r.y,r.y+r.h);}return {xs,ys};}
export function nextRoomName(s:Sketch){let n=s.rooms.length+1;while(s.rooms.some(r=>r.name===`Raum ${n}`))n++;return `Raum ${n}`;}
/** Raum aus zwei Ecken (gerastet, an Kanten eingerastet, in der Zeichenfläche). null, wenn zu klein. */
export function roomFrom(s:Sketch,a:Point,b:Point):SketchRoom|null{
  const e=edges(s),x0=snapTo(Math.min(a.x,b.x),e.xs),x1=snapTo(Math.max(a.x,b.x),e.xs),y0=snapTo(Math.min(a.y,b.y),e.ys),y1=snapTo(Math.max(a.y,b.y),e.ys);
  const x=Math.max(0,x0),y=Math.max(0,y0),w=Math.min(s.width,x1)-x,h=Math.min(s.height,y1)-y;
  return w>=MIN_ROOM&&h>=MIN_ROOM?{id:uid(),name:nextRoomName(s),x,y,w,h}:null;
}
export function addRoom(s:Sketch,r:SketchRoom){if(s.rooms.length>=MAX_ROOMS)throw Error(`Höchstens ${MAX_ROOMS} Räume je Skizze.`);s.rooms.push(r);}
/** Raum verschieben (gerastet, an Kanten anderer Räume eingerastet); Türen auf seinen Wänden wandern mit. */
export function moveRoom(s:Sketch,id:string,dx:number,dy:number,from:SketchRoom){
  const r=s.rooms.find(x=>x.id===id);if(!r)return;const e=edges(s,id);
  let x=from.x+dx,y=from.y+dy;const sx=snapTo(x,e.xs),sx2=snapTo(x+from.w,e.xs)-from.w;x=Math.abs(sx-x)<=Math.abs(sx2-x)?sx:sx2;
  const sy=snapTo(y,e.ys),sy2=snapTo(y+from.h,e.ys)-from.h;y=Math.abs(sy-y)<=Math.abs(sy2-y)?sy:sy2;
  x=Math.max(0,Math.min(s.width-from.w,x));y=Math.max(0,Math.min(s.height-from.h,y));
  const mx=x-r.x,my=y-r.y;for(const d of s.doors)if(onRoom(d,r)){d.x+=mx;d.y+=my;}r.x=x;r.y=y;
}
/** Größe ändern: neue Breite/Tiefe in cm (obere linke Ecke bleibt). */
export function resizeRoom(s:Sketch,id:string,w:number,h:number){
  const r=s.rooms.find(x=>x.id===id);if(!r)return;if(!Number.isFinite(w)||!Number.isFinite(h))throw Error('Bitte Maße in Metern eingeben, z. B. 4,20.');
  w=Math.max(MIN_ROOM,Math.min(s.width-r.x,snap(w)));h=Math.max(MIN_ROOM,Math.min(s.height-r.y,snap(h)));
  s.doors=s.doors.filter(d=>!onRoom(d,r)||withinRoom(d,{...r,w,h}));r.w=w;r.h=h;
}
const onRoom=(d:SketchDoor,r:SketchRoom)=>d.dir==='h'?(Math.abs(d.y-r.y)<1||Math.abs(d.y-r.y-r.h)<1)&&d.x>=r.x&&d.x<=r.x+r.w:(Math.abs(d.x-r.x)<1||Math.abs(d.x-r.x-r.w)<1)&&d.y>=r.y&&d.y<=r.y+r.h;
const withinRoom=(d:SketchDoor,r:SketchRoom)=>onRoom(d,r);
export function removeRoom(s:Sketch,id:string){const r=s.rooms.find(x=>x.id===id);if(!r)return;s.rooms=s.rooms.filter(x=>x.id!==id);s.doors=s.doors.filter(d=>!onRoom(d,r)||s.rooms.some(o=>onRoom(d,o)));}
/** Tür an der nächsten Wand (bis tol cm von der Wand); Aufschlag in den Raum, in den geklickt wurde. */
export function doorAt(s:Sketch,p:Point,tol=40):SketchDoor|null{
  let best:{d:number;door:SketchDoor}|null=null;
  for(const r of s.rooms){
    const inside=p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
    const cand:[number,SketchDoor][]=[];const w=Math.min(DEFAULT_DOOR,r.w-20,r.h-20);if(w<40)continue;
    const cx=Math.max(r.x+w/2,Math.min(r.x+r.w-w/2,snap(p.x))),cy=Math.max(r.y+w/2,Math.min(r.y+r.h-w/2,snap(p.y)));
    cand.push([Math.abs(p.y-r.y),{id:'',x:cx,y:r.y,dir:'h',w,side:1}],[Math.abs(p.y-r.y-r.h),{id:'',x:cx,y:r.y+r.h,dir:'h',w,side:-1}],
      [Math.abs(p.x-r.x),{id:'',x:r.x,y:cy,dir:'v',w,side:1}],[Math.abs(p.x-r.x-r.w),{id:'',x:r.x+r.w,y:cy,dir:'v',w,side:-1}]);
    for(const [d,door] of cand){if(d>tol)continue;const along=door.dir==='h'?p.x>=r.x-tol&&p.x<=r.x+r.w+tol:p.y>=r.y-tol&&p.y<=r.y+r.h+tol;if(!along)continue;
      const score=d-(inside?5:0);if(!best||score<best.d)best={d:score,door:{...door,id:uid()}};}
  }
  return best?.door||null;
}
export function addDoor(s:Sketch,d:SketchDoor){if(s.doors.length>=MAX_DOORS)throw Error(`Höchstens ${MAX_DOORS} Türen je Skizze.`);if(s.doors.some(o=>o.dir===d.dir&&Math.hypot(o.x-d.x,o.y-d.y)<(o.w+d.w)/2))throw Error('Dort ist schon eine Tür.');s.doors.push(d);}
/** Raum oder Tür unter dem Punkt (Türen zuerst). */
export function hit(s:Sketch,p:Point,tol=20):{type:'room'|'door';id:string}|null{
  for(const d of s.doors){const h=d.dir==='h';if(h?Math.abs(p.y-d.y)<tol&&Math.abs(p.x-d.x)<=d.w/2:Math.abs(p.x-d.x)<tol&&Math.abs(p.y-d.y)<=d.w/2)return {type:'door',id:d.id};}
  for(let i=s.rooms.length-1;i>=0;i--){const r=s.rooms[i];if(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)return {type:'room',id:r.id};}
  return null;
}
/** Zeichenfläche ändern: nur so klein, dass alle Räume darauf passen. */
export function resizeCanvas(s:Sketch,w:number,h:number){
  if(!Number.isFinite(w)||!Number.isFinite(h))throw Error('Bitte Maße in Metern eingeben.');
  const need={w:Math.max(MIN_ROOM*4,...s.rooms.map(r=>r.x+r.w)),h:Math.max(MIN_ROOM*4,...s.rooms.map(r=>r.y+r.h))};
  s.width=Math.min(MAX_SIZE,Math.max(need.w,snap(w)));s.height=Math.min(MAX_SIZE,Math.max(need.h,snap(h)));
}
/** Skizze aus einer Projektdatei prüfen (Zahlen, Grenzen, Kennungen). */
export function validateSketch(raw:unknown):Sketch{
  const bad=()=>{throw Error('Ungültige Skizze in der Projektdatei.');};
  const o=raw as Sketch;if(!o||typeof o!=='object'||!Array.isArray(o.rooms)||!Array.isArray(o.doors))bad();
  const num=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  if(!num(o.width,MIN_ROOM,MAX_SIZE)||!num(o.height,MIN_ROOM,MAX_SIZE)||o.rooms.length>MAX_ROOMS||o.doors.length>MAX_DOORS)bad();
  const id=(v:unknown)=>typeof v==='string'&&/^[\w-]{1,80}$/.test(v);
  const rooms=o.rooms.map(r=>{if(!r||!id(r.id)||typeof r.name!=='string'||r.name.length>60||!num(r.x,0,o.width)||!num(r.y,0,o.height)||!num(r.w,1,o.width)||!num(r.h,1,o.height)||r.x+r.w>o.width+.01||r.y+r.h>o.height+.01)bad();return {id:r.id,name:r.name,x:r.x,y:r.y,w:r.w,h:r.h};});
  const doors=o.doors.map(d=>{if(!d||!id(d.id)||(d.dir!=='h'&&d.dir!=='v')||(d.side!==1&&d.side!==-1)||!num(d.x,0,o.width)||!num(d.y,0,o.height)||!num(d.w,10,1000))bad();return {id:d.id,x:d.x,y:d.y,dir:d.dir,w:d.w,side:d.side};});
  return {width:o.width,height:o.height,rooms,doors};
}
/** Zeichenfläche auf die Räume zuschneiden (Rand in cm). Gibt die Verschiebung zurück, um die Proben/Flächen mitzuschieben. */
export function trimSketch(s:Sketch,margin=100):{sketch:Sketch;dx:number;dy:number}{
  if(!s.rooms.length)return {sketch:cloneSketch(s),dx:0,dy:0};
  const x0=Math.max(0,Math.min(...s.rooms.map(r=>r.x))-margin),y0=Math.max(0,Math.min(...s.rooms.map(r=>r.y))-margin);
  const x1=Math.max(...s.rooms.map(r=>r.x+r.w))+margin,y1=Math.max(...s.rooms.map(r=>r.y+r.h))+margin;
  const t=cloneSketch(s);t.rooms.forEach(r=>{r.x-=x0;r.y-=y0;});t.doors.forEach(d=>{d.x-=x0;d.y-=y0;});t.width=Math.min(MAX_SIZE,x1-x0);t.height=Math.min(MAX_SIZE,y1-y0);
  return {sketch:t,dx:x0,dy:y0};
}
/** Zum Weiterzeichnen: Fläche rechts und unten erweitern (Ursprung bleibt, Proben bleiben an ihrer Stelle). */
export function extendSketch(s:Sketch,extra=800){const t=cloneSketch(s);t.width=Math.min(MAX_SIZE,Math.max(t.width,...t.rooms.map(r=>r.x+r.w+extra)));t.height=Math.min(MAX_SIZE,Math.max(t.height,...t.rooms.map(r=>r.y+r.h+extra)));return t;}
