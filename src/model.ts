export type Kind = 'sample' | 'fire';
export interface LabData {ref:string;desc:string;art?:string;labNr?:string;datum?:string;bericht?:string}
export interface LabSample extends LabData {label:string}
export interface Marker { id: string; kind: Kind; label: string; note: string; x: number; y: number; lx: number; ly: number; lab?:LabData }
export interface Rect { x:number; y:number; width:number; height:number }
export interface Point { x:number; y:number }
export interface Area { id:string; label:string; name:string; color:string; opacity:number; points:Point[] }
export interface Preparation { sourceWidth:number; sourceHeight:number; rotation:0|90|180|270; crop:Rect }
export interface Plan { name: string; width: number; height: number; data: string; vector: boolean; preparation?:Preparation; pdf?:{page:number; totalPages:number; renderLongSide:number} }
export interface Project { format: 'probenplan'; version: 1|2|3|4; plan: Plan; markers: Marker[]; nextSample: number; nextFire: number; report: string; date: string; areas?:Area[]; nextArea?:number; pending?:LabSample[] }
export const clone = <T>(value: T): T => {
  if(value && typeof value==='object' && 'format' in value && value.format==='probenplan'){
    const p=value as unknown as Project;
    // Image data is immutable. Share the large string across history snapshots;
    // only coordinates and preparation metadata need independent copies.
    return {...p,plan:{...p.plan,...(p.plan.preparation?{preparation:structuredClone(p.plan.preparation)}:{}),...(p.plan.pdf?{pdf:{...p.plan.pdf}}:{})},markers:p.markers.map(m=>({...m,...(m.lab?{lab:{...m.lab}}:{})})),...(p.pending?{pending:p.pending.map(r=>({...r}))}:{}),...(p.areas?{areas:p.areas.map(a=>({...a,points:a.points.map(pt=>({...pt}))}))}:{})} as T;
  }
  return structuredClone(value);
};
export const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function createProject(plan: Plan): Project { return {format:'probenplan',version:plan.pdf||plan.preparation?2:1,plan,markers:[],nextSample:1,nextFire:1,report:'',date: new Date().toLocaleDateString('sv-SE')}; }
export function addMarker(p: Project, kind: Kind, x: number, y: number): Marker {
  const key = kind === 'sample' ? 'nextSample' : 'nextFire'; const prefix = kind === 'sample' ? 'P' : 'B';
  let number=p[key]; while([...p.markers,...(p.areas||[]),...(p.pending||[]).map(r=>({...r,id:''}))].some(m=>m.label.toLocaleUpperCase()===`${prefix}${number}`))number++;
  p[key]=number+1; const m={id:crypto.randomUUID(),kind,label:`${prefix}${number}`,note:'',x,y,lx:x,ly:y}; p.markers.push(m); return m;
}
export function validLabel(p: Project, label: string, id: string) { return /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,15}$/u.test(label) && ![...p.markers,...(p.areas||[]),...(p.pending||[]).map(r=>({...r,id:''}))].some(m=>m.id!==id && m.label.toLocaleUpperCase()===label.toLocaleUpperCase()); }
export function markerSize(p: Project) { return Math.max(p.plan.width,p.plan.height)/65; }
export function labelRadius(p: Project,m:Marker) { return markerSize(p)*Math.max(1,m.label.length*.34); }
export function bounds(p:Project) {
  let x=0,y=0,right=p.plan.width,bottom=p.plan.height; const r=markerSize(p);
  for(const m of p.markers){const rx=labelRadius(p,m)*(m.kind==='fire'?1.2:1)+r*.3;x=Math.min(x,m.x-r,m.lx-rx);y=Math.min(y,m.y-r,m.ly-r*1.5);right=Math.max(right,m.x+r,m.lx+rx);bottom=Math.max(bottom,m.y+r,m.ly+r*1.5);}
  return {x,y,width:right-x,height:bottom-y};
}
export function markerSVG(p:Project,m:Marker,selected=false,minSize=0) {
  const r=Math.max(markerSize(p),minSize),rx=r*Math.max(1,m.label.length*.34),color=m.kind==='sample'?'#17665e':'#ae4328';
  const displaced=Math.hypot(m.x-m.lx,m.y-m.ly)>.01;
  const shape=m.kind==='sample'?`<ellipse cx="${m.lx}" cy="${m.ly}" rx="${rx}" ry="${r}"/>`:`<path d="M ${m.lx} ${m.ly-r*1.3} L ${m.lx+rx*1.2} ${m.ly} L ${m.lx} ${m.ly+r*1.3} L ${m.lx-rx*1.2} ${m.ly} Z"/>`;
  return `<g data-id="${m.id}">${selected?`<ellipse cx="${m.lx}" cy="${m.ly}" rx="${rx+r*.6}" ry="${r*1.8}" fill="none" stroke="#e0ae42" stroke-width="${r*.2}" stroke-dasharray="${r*.3} ${r*.2}"/>`:''}${displaced?`<path d="M${m.x} ${m.y} L${m.lx} ${m.ly}" stroke="white" stroke-width="${r*.3}"/><path d="M${m.x} ${m.y} L${m.lx} ${m.ly}" stroke="${color}" stroke-width="${r*.12}"/><g data-drag="point"><circle cx="${m.x}" cy="${m.y}" r="${Math.max(r*.85,minSize*1.85)}" fill="transparent"/><circle cx="${m.x}" cy="${m.y}" r="${r*.24}" fill="${color}" stroke="white" stroke-width="${r*.1}"/><path d="M${m.x-r*.45} ${m.y}h${r*.9}M${m.x} ${m.y-r*.45}v${r*.9}" stroke="${color}" stroke-width="${r*.1}"/></g>`:''}<g data-drag="${displaced?'label':'point'}" fill="white" stroke="${color}" stroke-width="${r*.18}">${minSize?`<ellipse cx="${m.lx}" cy="${m.ly}" rx="${Math.max(rx,minSize*1.85)}" ry="${Math.max(r,minSize*1.85)}" fill="transparent" stroke="none"/>`:''}${shape}</g><text data-drag="${displaced?'label':'point'}" x="${m.lx}" y="${m.ly+r*.3}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${r*.87}" fill="${color}">${escape(m.label)}</text></g>`;
}
export class History {
  past:Project[]=[]; future:Project[]=[];
  push(p:Project){this.past.push(clone(p));if(this.past.length>60)this.past.shift();this.future=[];}
  undo(p:Project){const prev=this.past.pop();if(prev){this.future.push(clone(p));return prev;}return p;}
  redo(p:Project){const next=this.future.pop();if(next){this.past.push(clone(p));return next;}return p;}
  clear(){this.past=[];this.future=[];}
}
