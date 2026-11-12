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
/** Rechteck verschieben: eine der Kanten rastet an Nachbarn ein; bleibt im Plan. from = Lage vor dem Ziehen. Türen und Fenster auf seinen Kanten wandern mit. */
export function moveTraceRoom(t:Trace,plan:{width:number;height:number},id:string,dx:number,dy:number,from:TraceRoom,tol:number){
  const r=t.rooms.find(x=>x.id===id);if(!r)return;const e=traceEdges(t,id);
  const axis=(v:number,size:number,list:number[])=>{const a=snapEdge(v,list,tol),b=snapEdge(v+size,list,tol)-size;return a!==v&&(b===v||Math.abs(a-v)<=Math.abs(b-v))?a:b;};
  const mit=openingsOn(t,id),x=r2(Math.max(0,Math.min(plan.width-from.w,axis(from.x+dx,from.w,e.xs)))),y=r2(Math.max(0,Math.min(plan.height-from.h,axis(from.y+dy,from.h,e.ys)))),mx=x-r.x,my=y-r.y;
  r.x=x;r.y=y;for(const o of mit){o.x=r2(o.x+mx);o.y=r2(o.y+my);}dropTraceOrphans(t);uncheck(t);
}
/** Größe ändern (obere linke Ecke bleibt): rechte/untere Kante rastet ein. Öffnungen auf der rechten/unteren Kante wandern mit; was keine Wand mehr hat, fällt weg. */
export function resizeTraceRoom(t:Trace,plan:{width:number;height:number},id:string,w:number,h:number,tol:number){
  const r=t.rooms.find(x=>x.id===id);if(!r)return;const e=traceEdges(t,id),min=minRoom(plan);
  const x1=Math.min(plan.width,snapEdge(r.x+w,e.xs,tol)),y1=Math.min(plan.height,snapEdge(r.y+h,e.ys,tol));
  const mit=openingsOn(t,id),rechts=mit.filter(o=>Math.abs(o.x-(r.x+r.w))<HOST_TOL),unten=mit.filter(o=>Math.abs(o.y-(r.y+r.h))<HOST_TOL),nw=r2(Math.max(min,x1-r.x)),nh=r2(Math.max(min,y1-r.y));
  for(const o of rechts)o.x=r2(o.x+nw-r.w);for(const o of unten)o.y=r2(o.y+nh-r.h);
  r.w=nw;r.h=nh;dropTraceOrphans(t);uncheck(t);
}
/** Rechteck löschen. War es ein Hauptrechteck mit Teilen, wird der erste Teil zum Hauptrechteck. Gibt dessen Kennung zurück (für Proben). */
export function removeTraceRoom(t:Trace,id:string):{heir:string|null}{
  const gone=t.rooms.find(r=>r.id===id);if(!gone)return {heir:null};
  t.rooms=t.rooms.filter(r=>r.id!==id);let heir:TraceRoom|undefined;
  if(!gone.joins){heir=t.rooms.find(r=>r.joins===id);if(heir){delete heir.joins;heir.name=gone.name;if(gone.fire)heir.fire=true;for(const r of t.rooms)if(r.joins===id)r.joins=heir.id;}}
  dropTraceOrphans(t);uncheck(t);return {heir:heir?.id||null};
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
  dropTraceOrphans(t);uncheck(t);   // die gemeinsame Kante ist keine Wand mehr – Türen/Fenster darauf fallen weg
}
/** „Verbindung lösen“: der Teil wird wieder ein eigener Raum (mit dem bisherigen Namen). */
export function unjoinTraceRoom(t:Trace,id:string){const r=t.rooms.find(x=>x.id===id);if(!r?.joins)return;delete r.joins;uncheck(t);}
/** Alle Rechtecke des Raums, zu dem r gehört (Hauptrechteck und Teile). */
export function roomParts(t:Trace,r:TraceRoom):TraceRoom[]{const m=mainRoom(t,r);return t.rooms.filter(x=>x===m||x.joins===m.id);}

/* ---------- Wände, Türen und Fenster (ab 2.4.0) ----------
   Wände sind freie Strecken, auch schräg. Türen und Fenster liegen auf einer Wand (Raumkante oder freie Wand) und werden von Kante zu Kante
   gezogen – es gibt keine Maße. Alle Größen sind Anteile der längeren Planseite oder Bildschirm-Pixel (tol), nie Zentimeter. */
export const MIN_WALL_SHARE=.008,MIN_OPENING_SHARE=.004,DOOR_SHARE=.025,WINDOW_SHARE=.035;
const langeSeite=(plan:{width:number;height:number})=>Math.max(plan.width,plan.height);
/** Lage-Toleranz in Planeinheiten: Koordinaten sind auf 0,01 gerundet. */
const HOST_TOL=.05,EPS=.005;
export interface TraceSeg {x1:number;y1:number;x2:number;y2:number;owner:string;room:boolean}
/** Strecke [a,b] ohne die Löcher. */
function ohne(a:number,b:number,holes:[number,number][]):[number,number][]{
  let parts:[number,number][]=[[a,b]];
  for(const [h0,h1] of holes)parts=parts.flatMap(([p,q]):[number,number][]=>h1<=p+EPS||h0>=q-EPS?[[p,q]]:([[p,Math.min(q,h0)],[Math.max(p,h1),q]] as [number,number][]).filter(([u,v])=>v-u>EPS));
  return parts;
}
/** Alle Wandstrecken: die Kanten der Räume und die freien Wände. Die gemeinsame Kante ausdrücklich verbundener Rechtecke (joins) ist KEINE Wand –
 *  gleichnamige, nicht verbundene Räume behalten ihre Wand. */
export function traceSegments(t:Trace):TraceSeg[]{
  const out:TraceSeg[]=[];
  for(const r of t.rooms){
    const rest=roomParts(t,r).filter(o=>o!==r),x1=r.x+r.w,y1=r.y+r.h;
    const quer=(y:number,innen:(o:TraceRoom)=>boolean)=>{for(const [a,b] of ohne(r.x,x1,rest.filter(innen).map(o=>[o.x,o.x+o.w])))out.push({x1:a,y1:y,x2:b,y2:y,owner:r.id,room:true});};
    const hoch=(x:number,innen:(o:TraceRoom)=>boolean)=>{for(const [a,b] of ohne(r.y,y1,rest.filter(innen).map(o=>[o.y,o.y+o.h])))out.push({x1:x,y1:a,x2:x,y2:b,owner:r.id,room:true});};
    quer(r.y,o=>o.y<r.y-EPS&&r.y<=o.y+o.h+EPS);quer(y1,o=>o.y<=y1+EPS&&y1<o.y+o.h-EPS);
    hoch(r.x,o=>o.x<r.x-EPS&&r.x<=o.x+o.w+EPS);hoch(x1,o=>o.x<=x1+EPS&&x1<o.x+o.w-EPS);
  }
  for(const w of t.walls)out.push({x1:w.x1,y1:w.y1,x2:w.x2,y2:w.y2,owner:w.id,room:false});
  return out;
}
/** Lotfußpunkt auf der Strecke: Lage along (0…len), Abstand d. */
function lot(g:{x1:number;y1:number;x2:number;y2:number},p:Point){const dx=g.x2-g.x1,dy=g.y2-g.y1,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,roh=(p.x-g.x1)*ux+(p.y-g.y1)*uy,along=Math.max(0,Math.min(len,roh)),x=g.x1+ux*along,y=g.y1+uy*along;return {along,roh,len,ux,uy,x,y,d:Math.hypot(p.x-x,p.y-y)};}
/** Nächste Wandstrecke bis tol Planeinheiten (ohne die Wand „except“). */
export function traceSegNear(t:Trace,p:Point,tol:number,except?:string):TraceSeg|null{let best:TraceSeg|null=null,d=tol;for(const g of traceSegments(t)){if(g.owner===except)continue;const x=lot(g,p).d;if(x<=d){best=g;d=x;}}return best;}
/** Punkt einrasten (E16): zuerst Raumecken und Wandenden, dann Raumkanten und Wände, sonst frei. tol in Planeinheiten (am Bildschirm 12 px). */
export function snapTracePoint(t:Trace,p:Point,tol:number,except?:string):{p:Point;an:'ecke'|'kante'|'frei'}{
  let best:Point|null=null,d=tol;
  const ecken:Point[]=[...t.rooms.flatMap(r=>[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}]),...t.walls.filter(w=>w.id!==except).flatMap(w=>[{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}])];
  for(const q of ecken){const x=Math.hypot(q.x-p.x,q.y-p.y);if(x<=d){best=q;d=x;}}
  if(best)return {p:{...best},an:'ecke'};
  const g=traceSegNear(t,p,tol,except);if(g){const f=lot(g,p);return {p:{x:f.x,y:f.y},an:'kante'};}
  return {p:{...p},an:'frei'};
}
export const minWall=(plan:{width:number;height:number})=>langeSeite(plan)*MIN_WALL_SHARE;
/** Wand von a nach b: Enden rasten ein; liegt die Richtung nahe an einem 15°-Schritt (±4°), wird sie genau ausgerichtet (wie in der Skizze) –
 *  außer das Ende sitzt auf einer Ecke. Ohne Länge, ohne Raster. null, wenn zu kurz. fest: a wird nicht eingerastet (Ende einer vorhandenen Wand ziehen). */
export function traceWallFrom(t:Trace,plan:{width:number;height:number},a:Point,b:Point,tol:number,except?:string,fest=false):SketchWall|null{
  const p=fest?{...a}:snapTracePoint(t,a,tol,except).p,e=snapTracePoint(t,b,tol,except);let q=e.p;
  if(e.an!=='ecke'){
    const grad=Math.atan2(b.y-p.y,b.x-p.x)*180/Math.PI,step=Math.round(grad/15)*15;
    if(Math.abs(grad-step)<=4){
      const r=step*Math.PI/180,ux=Math.cos(r),uy=Math.sin(r),len=Math.hypot(b.x-p.x,b.y-p.y);q={x:p.x+ux*len,y:p.y+uy*len};
      // liegt dort eine Kante: bis genau an die Kante (Schnittpunkt der ausgerichteten Richtung mit ihr)
      const g=traceSegNear(t,q,tol,except);
      if(g){const vx=g.x2-g.x1,vy=g.y2-g.y1,det=ux*vy-uy*vx;
        if(Math.abs(det)>1e-6){const s=((g.x1-p.x)*vy-(g.y1-p.y)*vx)/det,u=((g.x1-p.x)*uy-(g.y1-p.y)*ux)/det,hit={x:p.x+ux*s,y:p.y+uy*s};if(s>0&&u>=-1e-6&&u<=1+1e-6&&Math.hypot(hit.x-q.x,hit.y-q.y)<=tol*2)q=hit;}}
    }
  }
  const cx=(v:number)=>r2(Math.max(0,Math.min(plan.width,v))),cy=(v:number)=>r2(Math.max(0,Math.min(plan.height,v))),w={id:uid(),x1:cx(p.x),y1:cy(p.y),x2:cx(q.x),y2:cy(q.y)};
  return Math.hypot(w.x2-w.x1,w.y2-w.y1)>=minWall(plan)?w:null;
}
export function addTraceWall(t:Trace,w:SketchWall){if(t.walls.length>=MAX_TRACE_WALLS)throw Error(`Höchstens ${MAX_TRACE_WALLS} Wände je Nachzeichnung.`);t.walls.push(w);uncheck(t);}
export function removeTraceWall(t:Trace,id:string){t.walls=t.walls.filter(w=>w.id!==id);dropTraceOrphans(t);uncheck(t);}
/** Wand als Ganzes verschieben (ein Ende rastet ein); Türen und Fenster darauf wandern mit. from = Lage vor dem Ziehen. */
export function moveTraceWall(t:Trace,plan:{width:number;height:number},id:string,dx:number,dy:number,from:SketchWall,tol:number){
  const w=t.walls.find(x=>x.id===id);if(!w)return;
  const a=snapTracePoint(t,{x:from.x1+dx,y:from.y1+dy},tol,id),b=snapTracePoint(t,{x:from.x2+dx,y:from.y2+dy},tol,id);
  let mx=dx,my=dy;if(a.an!=='frei'&&(b.an==='frei'||a.an==='ecke'||b.an!=='ecke')){mx=a.p.x-from.x1;my=a.p.y-from.y1;}else if(b.an!=='frei'){mx=b.p.x-from.x2;my=b.p.y-from.y2;}
  const xs=[from.x1+mx,from.x2+mx],ys=[from.y1+my,from.y2+my];if(Math.min(...xs)<0||Math.min(...ys)<0||Math.max(...xs)>plan.width||Math.max(...ys)>plan.height)return;
  const mit=openingsOn(t,id),ox=from.x1+mx-w.x1,oy=from.y1+my-w.y1;
  w.x1=r2(from.x1+mx);w.y1=r2(from.y1+my);w.x2=r2(from.x2+mx);w.y2=r2(from.y2+my);for(const o of mit){o.x=r2(o.x+ox);o.y=r2(o.y+oy);}uncheck(t);
}
/** Ein Ende einer Wand ziehen (das andere bleibt): rastet ein wie beim Zeichnen. Türen und Fenster behalten ihren Abstand zum festen Ende; passt eine nicht mehr, fällt sie weg. */
export function moveTraceWallEnd(t:Trace,plan:{width:number;height:number},id:string,end:1|2,to:Point,tol:number){
  const w=t.walls.find(x=>x.id===id);if(!w)return;const fest=end===2?{x:w.x1,y:w.y1}:{x:w.x2,y:w.y2},neu=traceWallFrom(t,plan,fest,to,tol,id,true);if(!neu)return;
  const mit=openingsOn(t,id).map(o=>({o,s:Math.hypot(o.x-fest.x,o.y-fest.y)}));
  if(end===2){w.x2=neu.x2;w.y2=neu.y2;}else{w.x1=neu.x2;w.y1=neu.y2;}
  const len=Math.hypot(w.x2-w.x1,w.y2-w.y1),zx=end===2?w.x2:w.x1,zy=end===2?w.y2:w.y1,ux=(zx-fest.x)/len,uy=(zy-fest.y)/len,grad=r2(Math.atan2(w.y2-w.y1,w.x2-w.x1)*180/Math.PI),weg=new Set<string>();
  for(const {o,s} of mit){if(s+o.w/2>len+HOST_TOL){weg.add(o.id);continue;}o.x=r2(fest.x+ux*s);o.y=r2(fest.y+uy*s);o.a=grad;}
  t.openings=t.openings.filter(o=>!weg.has(o.id));uncheck(t);
}
/** Liegt die Öffnung auf dieser Strecke (parallel, auf der Linie, Mitte innerhalb)? */
function aufStrecke(o:SketchOpening,g:{x1:number;y1:number;x2:number;y2:number}){const f=lot(g,o),a=Math.atan2(g.y2-g.y1,g.x2-g.x1)*180/Math.PI;return f.d<HOST_TOL&&Math.abs(Math.sin((a-o.a)*Math.PI/180))<.01&&f.roh>0&&f.roh<f.len;}
/** Türen und Fenster auf den Kanten dieses Raums bzw. auf dieser Wand. */
export function openingsOn(t:Trace,owner:string):SketchOpening[]{const segs=traceSegments(t).filter(g=>g.owner===owner);return t.openings.filter(o=>segs.some(g=>aufStrecke(o,g)));}
/** Die Wandstrecke, auf der die Öffnung liegt. */
export function hostSeg(t:Trace,o:SketchOpening):TraceSeg|null{return traceSegments(t).find(g=>aufStrecke(o,g))||null;}
/** Türen und Fenster ohne Wand entfernen (nach Löschen, Verkleinern, Verbinden). */
export function dropTraceOrphans(t:Trace){if(!t.openings.length)return;const segs=traceSegments(t);t.openings=t.openings.filter(o=>segs.some(g=>aufStrecke(o,g)));}
/** Die beiden Enden einer Öffnung (Mitte ∓ halbe Breite entlang ihrer Richtung). */
export function openingEnds(o:SketchOpening):[Point,Point]{const a=o.a*Math.PI/180,dx=Math.cos(a)*o.w/2,dy=Math.sin(a)*o.w/2;return [{x:o.x-dx,y:o.y-dy},{x:o.x+dx,y:o.y+dy}];}
export const minOpening=(plan:{width:number;height:number})=>langeSeite(plan)*MIN_OPENING_SHARE;
/** Tür oder Fenster auf der Wandstrecke g: von „from“ bis „to“ gezogen (Kante zu Kante) – oder, bei einem einfachen Tipp (to = null), mit einer
 *  Standardbreite (Anteil der längeren Planseite, höchstens 80 % der Wand). Kein Maß. Die Tür schlägt zur Seite des ersten Tipps auf. null, wenn zu klein. */
export function traceOpeningOn(plan:{width:number;height:number},g:TraceSeg,kind:'door'|'window',from:Point,to:Point|null):SketchOpening|null{
  const a=lot(g,from),min=minOpening(plan);let s0:number,s1:number;
  if(to){const b=lot(g,to);s0=Math.min(a.along,b.along);s1=Math.max(a.along,b.along);}
  else{const w=Math.min(langeSeite(plan)*(kind==='door'?DOOR_SHARE:WINDOW_SHARE),a.len*.8),m=Math.max(w/2,Math.min(a.len-w/2,a.along));s0=m-w/2;s1=m+w/2;}
  if(s1-s0<min)return null;
  const m=(s0+s1)/2,cross=a.ux*(from.y-a.y)-a.uy*(from.x-a.x);
  return {id:uid(),kind,x:r2(g.x1+a.ux*m),y:r2(g.y1+a.uy*m),a:r2(Math.atan2(a.uy,a.ux)*180/Math.PI),w:r2(s1-s0),side:cross>=0?1:-1};
}
const ueberlappt=(t:Trace,o:SketchOpening)=>t.openings.some(x=>x.id!==o.id&&Math.abs(Math.sin((x.a-o.a)*Math.PI/180))<.01&&Math.abs(Math.sin(Math.atan2(x.y-o.y,x.x-o.x)-o.a*Math.PI/180))*Math.hypot(x.x-o.x,x.y-o.y)<HOST_TOL*4&&Math.hypot(x.x-o.x,x.y-o.y)<(x.w+o.w)/2-HOST_TOL);
export function addTraceOpening(t:Trace,o:SketchOpening){
  if(t.openings.length>=MAX_TRACE_OPENINGS)throw Error(`Höchstens ${MAX_TRACE_OPENINGS} Türen und Fenster je Nachzeichnung.`);
  if(ueberlappt(t,o))throw Error('Dort ist schon eine Tür oder ein Fenster.');
  t.openings.push(o);uncheck(t);
}
export function removeTraceOpening(t:Trace,id:string){t.openings=t.openings.filter(o=>o.id!==id);uncheck(t);}
/** Ein Ende einer Tür/eines Fensters entlang der Wand ziehen (end −1 = Anfang, 1 = Ende); das andere Ende bleibt. */
export function moveTraceOpeningEnd(t:Trace,plan:{width:number;height:number},id:string,end:-1|1,to:Point){
  const o=t.openings.find(x=>x.id===id);if(!o)return;const g=hostSeg(t,o);if(!g)return;
  const m=lot(g,o),richtung=Math.cos((o.a-Math.atan2(g.y2-g.y1,g.x2-g.x1)*180/Math.PI)*Math.PI/180)>=0?1:-1,e=end*richtung;   // e: zieht das Ende mit der größeren (1) oder kleineren (−1) Lage auf der Strecke
  const fest=m.along-e*o.w/2,ziel=lot(g,to).along,min=minOpening(plan),neu=e>0?Math.max(fest+min,ziel):Math.min(fest-min,ziel);
  if(neu<-EPS||neu>m.len+EPS)return;
  const alt={x:o.x,y:o.y,w:o.w},mitte=(fest+neu)/2;o.x=r2(g.x1+m.ux*mitte);o.y=r2(g.y1+m.uy*mitte);o.w=r2(Math.abs(neu-fest));
  if(ueberlappt(t,o)){o.x=alt.x;o.y=alt.y;o.w=alt.w;return;}uncheck(t);
}
/** Tür/Fenster entlang seiner Wand schieben. from = Lage vor dem Ziehen. */
export function moveTraceOpening(t:Trace,id:string,dx:number,dy:number,from:SketchOpening){
  const o=t.openings.find(x=>x.id===id);if(!o)return;const g=hostSeg(t,{...o,x:from.x,y:from.y});if(!g)return;
  const m=lot(g,from),mitte=Math.max(o.w/2,Math.min(m.len-o.w/2,m.along+dx*m.ux+dy*m.uy)),alt={x:o.x,y:o.y};
  o.x=r2(g.x1+m.ux*mitte);o.y=r2(g.y1+m.uy*mitte);if(ueberlappt(t,o)){o.x=alt.x;o.y=alt.y;return;}uncheck(t);
}
/** Element unter dem Punkt: Türen/Fenster, freie Wände, dann Räume (zuletzt gezeichnete zuerst). tol in Planeinheiten. */
export function traceHit(t:Trace,p:Point,tol:number):{type:'room'|'wall'|'opening';id:string}|null{
  for(const o of t.openings){const r=-o.a*Math.PI/180,dx=p.x-o.x,dy=p.y-o.y,lx=dx*Math.cos(r)-dy*Math.sin(r),ly=dx*Math.sin(r)+dy*Math.cos(r);if(Math.abs(lx)<=o.w/2&&Math.abs(ly)<=tol)return {type:'opening',id:o.id};}
  let wand:SketchWall|null=null,d=tol;for(const w of t.walls){const x=lot(w,p).d;if(x<=d){wand=w;d=x;}}
  if(wand)return {type:'wall',id:wand.id};
  const r=rectAt(t,p);return r?{type:'room',id:r.id}:null;
}

/* ---------- Schon gesetzte Proben (E22, ab 2.4.0) ----------
   Nie still ändern: ein Angebot nur für Proben OHNE Raum, die in einem nachgezeichneten Raum liegen – und getrennt davon eine Prüfliste der
   Abweichungen (an der Probe steht ein anderer Raum, als der Punkt liegt). Die Prüfliste ändert nie etwas. Namen, Kennungen, Laborwerte bleiben. */
interface ProbePunkt {id:string;kind:string;label:string;x:number;y:number;raum?:string;raumSkizze?:string}
export interface RaumVorschlag {id:string;label:string;raum:string;raumSkizze:string}
export interface RaumAbweichung {id:string;label:string;steht:string;liegt:string}
const glatt=(v:string)=>v.toLocaleLowerCase('de').replace(/\s+/g,' ').trim();
/** Passt die Raumangabe an der Probe zum nachgezeichneten Raum? Gleich (ohne Groß/Klein, Leerzeichen) – oder der Raumname steht als ganzes Wort
 *  in der Angabe (LabelKit schreibt „EG Küche Brandraum“, nachgezeichnet ist „Küche“). */
export function raumPasst(steht:string,liegt:string){const a=glatt(steht),b=glatt(liegt);if(!b)return true;if(a===b)return true;
  const wort=/[\p{L}\p{N}]/u;for(let i=a.indexOf(b);i>=0;i=a.indexOf(b,i+1)){const vor=i>0?a[i-1]:'',nach=a[i+b.length]||'';if(!wort.test(vor)&&!wort.test(nach))return true;}return false;}
export function probenAbgleich(t:Trace|undefined,markers:ProbePunkt[]):{ohne:RaumVorschlag[];abweichend:RaumAbweichung[]}{
  const ohne:RaumVorschlag[]=[],abweichend:RaumAbweichung[]=[];if(!t||!t.rooms.length)return {ohne,abweichend};
  for(const m of markers){if(m.kind!=='sample')continue;const r=traceRoomAt(t,m);if(!r)continue;
    if(!m.raum?.trim())ohne.push({id:m.id,label:m.label,raum:r.name,raumSkizze:r.id});
    else if(!raumPasst(m.raum,r.name))abweichend.push({id:m.id,label:m.label,steht:m.raum.trim(),liegt:r.name});}
  return {ohne,abweichend};
}
/** „Übernehmen“: setzt den Raum nur an Proben, die (immer noch) keinen haben. Gibt die Zahl zurück. */
export function raeumeUebernehmen(markers:ProbePunkt[],liste:RaumVorschlag[]){let n=0;for(const v of liste){const m=markers.find(x=>x.id===v.id);if(m&&m.kind==='sample'&&!m.raum?.trim()){m.raum=v.raum;m.raumSkizze=v.raumSkizze;n++;}}return n;}

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
