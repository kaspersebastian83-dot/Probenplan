/* Beschriftung am Plan (ab 1.19):
   • Schilder automatisch platzieren – die Probenstelle bleibt exakt, nur das Schild weicht Text, Linien und anderen Schildern aus.
   • Messwerte am Plan – in der Ergebniskarte ein Wertkästchen je Probe (Wert wie im Prüfbericht, Einheit, Kategorie).
   Beides je Plan ein-/ausschaltbar. Die berechneten Positionen werden nie gespeichert: Gespeichert wird nur, was der Nutzer
   von Hand verschiebt (Marker.lx/ly). Bildschirm, PNG/JPG, PDF und Anlage verwenden dieselbe Rechnung. */
import {escape,labelRadius,markerSize,markerSVG,shapeOf,type Marker,type Plan,type Project} from './model';
import {qualifierGroups,valueOf,UNRATED,type Rated} from './results';
import {loadImage} from './import';
import {planMatrix,preparation} from './preparation';

export interface ValueBox {value:string;unit:string;cat:string;color:string;w:number;h:number;fs:number}
/** Anzeige-Marker: auto = Schild automatisch versetzt (nicht gespeichert), box = Wertkästchen der Ergebniskarte. */
export type Shown = Marker & {auto?:boolean;box?:ValueBox};

export const autoLabels=(plan:Plan)=>plan.autoLabels!==false;
export const valueLabels=(plan:Plan)=>plan.valueLabels===true;
const pinned=(m:Marker)=>Math.hypot(m.x-m.lx,m.y-m.ly)>.01;

/* ---------- Tinte: wo der Plan selbst Text, Wände, Schraffur hat ---------- */
interface Ink {w:number;h:number;cell:number;sum:Float64Array}
const inks=new Map<string,Ink>();const pending=new Map<string,Promise<Ink|null>>();const failed=new Set<string>();
const INK_SIDE=480;
function inkKey(plan:Plan){const d=plan.data;return `${plan.width}x${plan.height}:${d.length}:${d.slice(0,48)}:${d.slice(-48)}:${JSON.stringify(plan.preparation||null)}`;}
/** Tinte des Plans laden (einmal je Plan und Bearbeitungsstand). Ohne Erfolg wird ohne Tinte platziert. */
export function ensureInk(plan:Plan):Promise<Ink|null>{
  const key=inkKey(plan);if(inks.has(key))return Promise.resolve(inks.get(key)!);
  if(!pending.has(key))pending.set(key,computeInk(plan).then(ink=>{if(ink){if(inks.size>12)inks.delete(inks.keys().next().value!);inks.set(key,ink);}else failed.add(key);pending.delete(key);return ink;},()=>{pending.delete(key);failed.add(key);return null;}));
  return pending.get(key)!;
}
export const inkReady=(plan:Plan)=>inks.has(inkKey(plan));
/** Tinte geladen oder endgültig nicht verfügbar – kein weiterer Versuch nötig. */
export const inkTried=(plan:Plan)=>{const k=inkKey(plan);return inks.has(k)||failed.has(k);};
async function computeInk(plan:Plan):Promise<Ink|null>{
  if(typeof document==='undefined')return null;
  const long=Math.max(plan.width,plan.height),k=INK_SIDE/long,w=Math.max(1,Math.round(plan.width*k)),h=Math.max(1,Math.round(plan.height*k));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
  try{
    ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.scale(k,k);ctx.beginPath();ctx.rect(0,0,plan.width,plan.height);ctx.clip();ctx.transform(...planMatrix(plan));
    const source=preparation(plan),img=await loadImage(plan.data,'Der Grundriss');ctx.drawImage(img,0,0,source.sourceWidth,source.sourceHeight);
    const px=ctx.getImageData(0,0,w,h).data,sum=new Float64Array((w+1)*(h+1));
    for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){const i=(y*w+x)*4,lum=px[i]*.299+px[i+1]*.587+px[i+2]*.114;row+=lum<170?1:0;sum[(y+1)*(w+1)+x+1]=sum[y*(w+1)+x+1]+row;}}
    return {w,h,cell:1/k,sum};
  }finally{canvas.width=1;canvas.height=1;}
}
/** Anteil „Tinte“ (0…1) in einem Rechteck in Planeinheiten; außerhalb des Plans keine Tinte. */
function inkIn(ink:Ink|null,x0:number,y0:number,x1:number,y1:number){
  if(!ink)return 0;const c=ink.cell,area=Math.max(1e-9,(x1-x0)*(y1-y0)/(c*c));
  const cx=(v:number)=>Math.min(ink.w,Math.max(0,Math.round(v/c))),cy=(v:number)=>Math.min(ink.h,Math.max(0,Math.round(v/c)));
  const a=cx(x0),b=cx(x1),d=cy(y0),e=cy(y1);if(b<=a||e<=d)return 0;const W=ink.w+1,s=ink.sum;
  return (s[e*W+b]-s[d*W+b]-s[e*W+a]+s[d*W+a])/area;
}
function inkAlong(ink:Ink|null,x0:number,y0:number,x1:number,y1:number){
  if(!ink)return 0;const n=Math.max(2,Math.ceil(Math.hypot(x1-x0,y1-y0)/ink.cell));let hit=0;
  for(let i=1;i<n;i++){const t=i/n,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;hit+=inkIn(ink,x-ink.cell,y-ink.cell,x+ink.cell,y+ink.cell)>.3?1:0;}
  return hit/n;
}

/* ---------- Wertkästchen ---------- */
const QUALIFIER_SHORT=['unter BG','n.n.','n.b.'];
function categoryOf(rated:Rated,label:string){
  for(const g of rated.groups)for(const c of g.cats)if(c.labels.includes(label))return c.name;
  const q=qualifierGroups(rated).findIndex(g=>g.labels.includes(label));
  if(q>=0){const name=qualifierGroups(rated)[q].name;return QUALIFIER_SHORT.find(s=>name.toLowerCase().startsWith(s.slice(0,5).toLowerCase()))||name.split(' (')[0];}
  return '';
}
/** Gut lesbare Textfarbe für eine Kategorie auf Weiß (Gelb wird dunkler). */
export function textOn(color:string){const n=parseInt(color.slice(1),16);if(!Number.isFinite(n))return '#1d2a33';const r=n>>16,g=n>>8&255,b=n&255,l=(r*299+g*587+b*114)/1000;if(l<150)return color;const f=150/l;return `#${[r,g,b].map(v=>Math.round(v*f).toString(16).padStart(2,'0')).join('')}`;}
function box(p:Project,m:Marker,rated:Rated):ValueBox|undefined{
  const w=valueOf(m,rated.parameter);if(!w||m.kind!=='sample')return undefined;
  const fs=markerSize(p)*.9,cat=categoryOf(rated,m.label),color=rated.fill.get(m.id)||UNRATED;
  const line1=fs*(.66*m.label.length+.6*w.r.length+.46*w.u.length+1.4),line2=fs*.75*.56*(cat||'ohne Bewertung').length;
  return {value:w.r,unit:w.u,cat:cat||'ohne Bewertung',color,fs,w:Math.max(line1,line2)+fs*1.5,h:fs*2.75};
}

/* ---------- Platzierung ---------- */
interface R {x0:number;y0:number;x1:number;y1:number}
const overlap=(a:R,b:R)=>Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));
function segHitsRect(x0:number,y0:number,x1:number,y1:number,r:R){
  // Liang–Barsky
  let t0=0,t1=1;const dx=x1-x0,dy=y1-y0;
  for(const [pp,q] of [[-dx,x0-r.x0],[dx,r.x1-x0],[-dy,y0-r.y0],[dy,r.y1-y0]] as [number,number][]){if(pp===0){if(q<0)return false;}else{const t=q/pp;if(pp<0){if(t>t1)return false;if(t>t0)t0=t;}else{if(t<t0)return false;if(t<t1)t1=t;}}}
  return t1-t0>.02;
}
function segsCross(a:number[],b:number[]){
  const o=(p:number[],q:number[],r:number[])=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));
  const A=[a[0],a[1]],B=[a[2],a[3]],C=[b[0],b[1]],D=[b[2],b[3]];
  return o(A,B,C)*o(A,B,D)<0&&o(C,D,A)*o(C,D,B)<0;
}
/** Halbe Ausdehnung eines Schilds bzw. Wertkästchens. */
function half(p:Project,m:Shown){
  if(m.box)return {hw:m.box.w/2,hh:m.box.h/2};
  const r=markerSize(p),rx=labelRadius(p,m),form=shapeOf(m);
  return form==='diamond'?{hw:rx*1.2+r*.15,hh:r*1.3+r*.15}:{hw:Math.max(rx,r*1.05)+r*.15,hh:r*1.05+r*.15};
}
let cache:{key:string;out:Shown[]}|null=null;
/** Projektansicht mit Anzeige-Markern (Schilder ggf. versetzt, Wertkästchen). rated nur für die Ergebniskarte. */
export function labeled(p:Project,rated?:Rated|null):Project{
  const auto=autoLabels(p.plan),values=!!rated&&valueLabels(p.plan);
  if(!auto&&!values)return p;
  const key=[auto,values,markerSize(p),inkReady(p.plan)?inkKey(p.plan):'-',p.plan.width,p.plan.height,rated?.parameter||'',
    ...p.markers.map(m=>`${m.id}|${m.label}|${m.x}|${m.y}|${m.lx}|${m.ly}|${m.shape||''}|${m.kind}|${values?`${rated!.fill.get(m.id)}|${valueOf(m,rated!.parameter)?.r||''}|${categoryOf(rated!,m.label)}`:''}`)].join(';');
  if(cache?.key===key)return {...p,markers:cache.out};
  const out=place(p,auto,values?rated!:null,inks.get(inkKey(p.plan))||null);
  cache={key,out};return {...p,markers:out};
}
function place(p:Project,auto:boolean,rated:Rated|null,ink:Ink|null):Shown[]{
  const r=markerSize(p),shown:Shown[]=p.markers.map(m=>{const b=rated?box(p,m,rated):undefined;return b?{...m,box:b}:{...m};});
  const rects=new Map<string,R>(),leaders:number[][]=[];
  const rectAt=(m:Shown,x:number,y:number):R=>{const {hw,hh}=half(p,m);return {x0:x-hw,y0:y-hh,x1:x+hw,y1:y+hh};};
  const points=shown.map(m=>({id:m.id,x:m.x,y:m.y,rad:m.kind==='fire'?r*1.4:r*.55}));
  // Feste Schilder zuerst: von Hand versetzte, Brandherde, und alles ohne Automatik
  const free:Shown[]=[];
  for(const m of shown){
    if(m.kind==='fire'||pinned(m)){rects.set(m.id,rectAt(m,m.lx,m.ly));if(pinned(m))leaders.push([m.x,m.y,m.lx,m.ly]);continue;}
    if(!auto){
      if(m.box){const {hw}=half(p,m);m.lx=m.x+r*1.1+hw;m.ly=m.y;m.auto=true;leaders.push([m.x,m.y,m.lx,m.ly]);}
      rects.set(m.id,rectAt(m,m.lx,m.ly));continue;
    }
    free.push(m);
  }
  if(!free.length)return shown;
  // Dichte Stellen zuerst, damit dort die besten Plätze vergeben werden
  const crowd=(m:Shown)=>points.filter(q=>q.id!==m.id&&Math.hypot(q.x-m.x,q.y-m.y)<r*5).length;
  free.sort((a,b)=>crowd(b)-crowd(a)||a.y-b.y||a.x-b.x);
  const W=p.plan.width,H=p.plan.height;
  const cost=(m:Shown,x:number,y:number,inPlace:boolean)=>{
    const rc=rectAt(m,x,y),area=(rc.x1-rc.x0)*(rc.y1-rc.y0);let c=inkIn(ink,rc.x0,rc.y0,rc.x1,rc.y1)*(m.box?320:260);
    for(const [id,o] of rects)if(id!==m.id){const ov=overlap(rc,o);if(ov>0)c+=200+ov/area*1000;}
    for(const q of points){if(q.id===m.id){if(!inPlace&&q.x>rc.x0-q.rad&&q.x<rc.x1+q.rad&&q.y>rc.y0-q.rad&&q.y<rc.y1+q.rad)c+=1000;continue;}
      if(q.x>rc.x0-q.rad&&q.x<rc.x1+q.rad&&q.y>rc.y0-q.rad&&q.y<rc.y1+q.rad)c+=400;}
    if(!inPlace){
      const seg=[m.x,m.y,x,y];c+=Math.hypot(x-m.x,y-m.y)/r*1.6+inkAlong(ink,m.x,m.y,x,y)*12;
      for(const l of leaders)if(segsCross(seg,l))c+=40;
      for(const [id,o] of rects)if(id!==m.id&&segHitsRect(m.x,m.y,x,y,o))c+=60;
      for(const q of points)if(q.id!==m.id&&segHitsRect(m.x,m.y,x,y,{x0:q.x-q.rad,y0:q.y-q.rad,x1:q.x+q.rad,y1:q.y+q.rad}))c+=60;
    }
    const outside=Math.max(0,-rc.x0)+Math.max(0,rc.x1-W)+Math.max(0,-rc.y0)+Math.max(0,rc.y1-H);if(outside>0)c+=(m.box?4:10)+outside/r;
    return c;
  };
  for(const m of free){
    let best={x:m.x,y:m.y,c:Infinity,inPlace:true};
    if(!m.box){const c=cost(m,m.x,m.y,true);best={x:m.x,y:m.y,c,inPlace:true};if(c<3){rects.set(m.id,rectAt(m,m.x,m.y));continue;}}
    const {hw,hh}=half(p,m);
    for(let ring=0;ring<(m.box?10:6);ring++)for(let i=0;i<16;i++){
      const a=-Math.PI/4+i*Math.PI/8,ux=Math.cos(a),uy=Math.sin(a);
      // Abstand so, dass das Rechteck den Punkt nicht berührt (Rand des Rechtecks in Richtung a)
      const edge=Math.min(Math.abs(ux)>1e-6?hw/Math.abs(ux):Infinity,Math.abs(uy)>1e-6?hh/Math.abs(uy):Infinity);
      const d=edge+r*(.9+ring*1.3),x=m.x+ux*d,y=m.y+uy*d,c=cost(m,x,y,false)+ring*.8+(i%2)*.15;
      if(c<best.c)best={x,y,c,inPlace:false};
    }
    if(!best.inPlace){m.lx=best.x;m.ly=best.y;m.auto=true;leaders.push([m.x,m.y,m.lx,m.ly]);}
    rects.set(m.id,rectAt(m,m.lx,m.ly));
  }
  return shown;
}
/** SVG eines Wertkästchens (Mitte lx/ly). */
function boxSVG(m:Shown){
  const b=m.box!,x=m.lx-b.w/2,y=m.ly-b.h/2,fs=b.fs,ink=textOn(b.color);
  return `<g data-drag="label"><rect x="${x}" y="${y}" width="${b.w}" height="${b.h}" rx="${fs*.3}" fill="#ffffff" stroke="#ffffff" stroke-width="${fs*.5}"/><rect x="${x}" y="${y}" width="${b.w}" height="${b.h}" rx="${fs*.3}" fill="#ffffff" stroke="${b.color}" stroke-width="${fs*.13}"/><rect x="${x}" y="${y}" width="${fs*.38}" height="${b.h}" rx="${fs*.15}" fill="${b.color}"/>`
    +`<text x="${x+fs*.75}" y="${y+fs*1.2}" font-family="Arial, sans-serif" font-size="${fs}" fill="#1d2a33"><tspan font-weight="700">${escape(m.label)}</tspan><tspan dx="${fs*.45}" font-weight="700" fill="${ink}">${escape(b.value)}</tspan><tspan dx="${fs*.3}" font-size="${fs*.72}" fill="#5b6773">${escape(b.unit)}</tspan></text>`
    +`<text x="${x+fs*.75}" y="${y+fs*2.25}" font-family="Arial, sans-serif" font-size="${fs*.75}" font-weight="700" fill="${ink}">${escape(b.cat)}</text></g>`;
}
/** Marker für Bildschirm und Export: Wertkästchen mit Hinweislinie, sonst das bisherige Schild – bei Automatik mit weißem Rand. */
export function shownSVG(p:Project,m:Shown,selected=false,minSize=0,fill?:string){
  const r=markerSize(p);
  if(m.box){
    const c=m.box.color,pr=Math.max(r*.5,minSize*.9);
    return `<g data-id="${m.id}">${selected?`<rect x="${m.lx-m.box.w/2-r*.35}" y="${m.ly-m.box.h/2-r*.35}" width="${m.box.w+r*.7}" height="${m.box.h+r*.7}" rx="${r*.4}" fill="none" stroke="#e0ae42" stroke-width="${r*.2}" stroke-dasharray="${r*.3} ${r*.2}"/>`:''}`
      +`<path d="M${m.x} ${m.y} L${m.lx} ${m.ly}" stroke="#ffffff" stroke-width="${r*.32}" pointer-events="none"/><path d="M${m.x} ${m.y} L${m.lx} ${m.ly}" stroke="${c}" stroke-width="${r*.13}" pointer-events="none"/>`
      +boxSVG(m)
      +`<g data-drag="point"><circle cx="${m.x}" cy="${m.y}" r="${Math.max(r*.85,minSize*1.85)}" fill="transparent"/><circle cx="${m.x}" cy="${m.y}" r="${pr}" fill="${c}" stroke="#ffffff" stroke-width="${pr*.35}" paint-order="stroke"/></g></g>`;
  }
  const halo=m.auto||autoLabels(p.plan)?(()=>{const {hw,hh}=half(p,m),k=m.kind==='fire'?.9:1;return `<rect x="${m.lx-hw*k-r*.12}" y="${m.ly-hh*k-r*.12}" width="${(hw*k+r*.12)*2}" height="${(hh*k+r*.12)*2}" rx="${Math.min(hw,hh)}" fill="#ffffff" fill-opacity=".85" pointer-events="none"/>`;})():'';
  return (m.kind==='fire'?'':halo)+markerSVG(p,m,selected,minSize,fill);
}
