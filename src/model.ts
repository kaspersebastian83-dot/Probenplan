export type Kind = 'sample' | 'fire';
export interface LabSources {xml?:string;pdf?:string}
export interface LabOrigin {id:string;bericht:string;labor:string;auftragsreferenz:string;batch?:string;sources:LabSources}
/** Ein Messwert aus dem Laborbericht: Parameter, Ergebnis wie gedruckt (z. B. "< 0,50"), Einheit. */
export interface Wert {p:string;r:string;u:string}
export interface LabData {ref:string;desc:string;art?:string;labNr?:string;datum?:string;bericht?:string;reportId?:string;werte?:Wert[]}
/** Ergebniskarte: Kategorie ab einem Wert (erste Kategorie ab 0), Farbe als #rrggbb. */
export interface Category {name:string;from:number;color:string}
export interface Scale {name:string;cats:Category[]}
export interface ResultSettings {usage?:'residential'|'industrial';parameter:string;scales:Record<string,Scale>}
/** typ: Probenart aus LabelKit (PAK, Chlorid, Asbest, Sonstige) – bleibt erhalten, wenn der Laborbericht die Probe ergänzt. */
export interface LabSample extends LabData {label:string;typ?:string;shape?:Shape}
/** Form der Probenahmestelle (Kreis ist Standard und wird nicht gespeichert); typ = Probenart aus LabelKit für die Legende. */
export type Shape = 'circle' | 'square' | 'diamond';
export const SHAPES:readonly Shape[]=['circle','square','diamond'];
export const SHAPE_NAMES:Record<Shape,string>={circle:'Kreis',square:'Quadrat',diamond:'Raute'};
export interface Marker { id: string; kind: Kind; label: string; note: string; x: number; y: number; lx: number; ly: number; lab?:LabData; shape?:Shape; typ?:string }
/** LabelKit-Probenart („PAK · Wischprobe“) → Typ und Standardform: PAK Kreis, Chlorid Quadrat, Asbest Raute, Sonstige Kreis. */
const TYPES:[RegExp,string,Shape][]=[[/^pak\b/i,'PAK','circle'],[/^chlorid\b/i,'Chlorid','square'],[/^asbest\b/i,'Asbest','diamond'],[/^sonstige\b/i,'Sonstige','circle']];
export function typeFromArt(art?:string):{typ:string;shape:Shape}|null{const a=(art||'').trim();for(const [re,typ,shape] of TYPES)if(re.test(a))return {typ,shape};return null;}
export function shapeForType(typ?:string):Shape{return TYPES.find(t=>t[1]===typ)?.[2]||'circle';}
/** Form einer Laborprobe vor dem Platzieren: im Prüfdialog gewählt, sonst aus der Probenart. */
export function pendingShape(r:{shape?:Shape;typ?:string;art?:string}):Shape{return r.shape||shapeForType(r.typ||typeFromArt(r.art)?.typ);}
export const SHAPE_SYMBOL:Record<Shape,string>={circle:'○',square:'□',diamond:'◇'};
export const TYPE_ORDER=TYPES.map(t=>t[1]);
export function shapeOf(m:Marker):Shape{return m.shape||typeFromArt(m.lab?.art)?.shape||'circle';}
export function typeOf(m:Marker):string{return m.typ||typeFromArt(m.lab?.art)?.typ||'';}
/** Roter Stern für den Brandherd (ohne Kennung). */
export function starPath(cx:number,cy:number,R:number){const pts:string[]=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?R*.45:R;pts.push(`${(cx+r*Math.cos(a)).toFixed(3)} ${(cy+r*Math.sin(a)).toFixed(3)}`);}return `M ${pts.join(' L ')} Z`;}
export const FIRE_RED='#d42a1f';
export interface Rect { x:number; y:number; width:number; height:number }
export interface Point { x:number; y:number }
export interface Area { id:string; label:string; name:string; color:string; opacity:number; points:Point[] }
/** Bildvorbereitung: angle = Feinausrichtung in Grad (±45, im Uhrzeigersinn), vor der 90°-Drehung und dem Zuschnitt angewandt. */
export interface Preparation { sourceWidth:number; sourceHeight:number; rotation:0|90|180|270; crop:Rect; angle?:number }
/** Maßstab je Plan: eine gemessene Strecke in Planeinheiten und ihre wahre Länge in Metern. Drehen/Zuschneiden ändern die Einheit nicht. */
export interface Calibration { units:number; meters:number }
export interface Plan { name: string; width: number; height: number; data: string; vector: boolean; markerScale?:number; calibration?:Calibration; north?:number; preparation?:Preparation; pdf?:{page:number; totalPages:number; renderLongSide:number} }
// Mehrere Pläne (Geschosse) ab Format 5: Der aktive Plan steht wie bisher in plan/markers/areas,
// in sheets[active] nur Kennung und Name. Alle anderen Pläne liegen vollständig in sheets.
export interface Sheet { id:string; name:string; plan?:Plan; markers?:Marker[]; areas?:Area[] }
// Format 6: wie 5, zusätzlich Feinausrichtung (Preparation.angle). Ältere PlanKit-Versionen lehnen es ab, statt den Winkel still zu übergehen.
export type Version = 1|2|3|4|5|6;
export interface Project { format: 'probenplan'; version: Version; plan: Plan; markers: Marker[]; nextSample: number; nextFire: number; report: string; date: string; areas?:Area[]; nextArea?:number; pending?:LabSample[]; labReports?:LabOrigin[]; sheets?:Sheet[]; active?:number; results?:ResultSettings }
const clonePlan=(plan:Plan):Plan=>({...plan,...(plan.calibration?{calibration:{...plan.calibration}}:{}),...(plan.preparation?{preparation:structuredClone(plan.preparation)}:{}),...(plan.pdf?{pdf:{...plan.pdf}}:{})});
const cloneMarkers=(markers:Marker[])=>markers.map(m=>({...m,...(m.lab?{lab:{...m.lab}}:{})}));
const cloneAreas=(areas:Area[])=>areas.map(a=>({...a,points:a.points.map(pt=>({...pt}))}));
export const clone = <T>(value: T): T => {
  if(value && typeof value==='object' && 'format' in value && value.format==='probenplan'){
    const p=value as unknown as Project;
    // Image data is immutable. Share the large string across history snapshots;
    // only coordinates and preparation metadata need independent copies.
    return {...p,plan:clonePlan(p.plan),markers:cloneMarkers(p.markers),...(p.pending?{pending:p.pending.map(r=>({...r}))}:{}),...(p.labReports?{labReports:p.labReports.map(r=>({...r,sources:{...r.sources}}))}:{}),...(p.areas?{areas:cloneAreas(p.areas)}:{}),...(p.results?{results:structuredClone(p.results)}:{}),
      ...(p.sheets?{sheets:p.sheets.map(sh=>({...sh,...(sh.plan?{plan:clonePlan(sh.plan)}:{}),...(sh.markers?{markers:cloneMarkers(sh.markers)}:{}),...(sh.areas?{areas:cloneAreas(sh.areas)}:{})}))}:{})} as T;
  }
  return structuredClone(value);
};
export const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function createProject(plan: Plan): Project { return {format:'probenplan',version:plan.pdf||plan.preparation?2:1,plan,markers:[],nextSample:1,nextFire:1,report:'',date: new Date().toLocaleDateString('sv-SE')}; }
export function addMarker(p: Project, kind: Kind, x: number, y: number): Marker {
  const key = kind === 'sample' ? 'nextSample' : 'nextFire'; const prefix = kind === 'sample' ? 'P' : 'B';
  let number=p[key]; while(takenLabels(p).some(m=>m.label.toLocaleUpperCase()===`${prefix}${number}`))number++;
  p[key]=number+1; const m={id:crypto.randomUUID(),kind,label:`${prefix}${number}`,note:'',x,y,lx:x,ly:y}; p.markers.push(m); return m;
}
export function validLabel(p: Project, label: string, id: string) { return /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,15}$/u.test(label) && !takenLabels(p).some(m=>m.id!==id && m.label.toLocaleUpperCase()===label.toLocaleUpperCase()); }
/** Punktgröße je Plan: Faktor auf die Grundgröße (1/65 der längeren Planseite). Gespeichert am Plan, also je Geschoss. */
export const MARKER_SCALE={min:.2,max:3,step:1.2};
export function markerScale(p:Project){const s=p.plan.markerScale;return typeof s==='number'&&Number.isFinite(s)?Math.min(MARKER_SCALE.max,Math.max(MARKER_SCALE.min,s)):1;}
/** Nächster Faktor für die Tasten < und >: ca. 20 % je Schritt, auf 5 % gerundet, mindestens ein 5-%-Schritt. */
export function stepMarkerScale(current:number,direction:1|-1){
  const next=Math.round(current*(direction>0?MARKER_SCALE.step:1/MARKER_SCALE.step)*20)/20,fallback=Math.round((current+direction*.05)*20)/20;
  return Math.min(MARKER_SCALE.max,Math.max(MARKER_SCALE.min,next===Math.round(current*20)/20?fallback:next));
}
/** Meter je Planeinheit oder null, wenn der Plan nicht kalibriert ist. */
export function metersPerUnit(plan:Plan){const c=plan.calibration;return c&&c.units>0&&c.meters>0?c.meters/c.units:null;}
/** Nordrichtung in Grad im Uhrzeigersinn (0 = oben) oder null, wenn kein Nordpfeil gesetzt ist. */
export function northAngle(plan:Plan){const n=plan.north;return typeof n==='number'&&Number.isFinite(n)?((n%360)+360)%360:null;}
export function markerSize(p: Project) { return Math.max(p.plan.width,p.plan.height)/65*markerScale(p); }
export function labelRadius(p: Project,m:Marker) { return markerSize(p)*Math.max(1,m.label.length*.34); }
export function bounds(p:Project) {
  let x=0,y=0,right=p.plan.width,bottom=p.plan.height; const r=markerSize(p);
  for(const m of p.markers){const rx=(m.kind==='fire'?r*1.4:labelRadius(p,m)*(shapeOf(m)==='diamond'?1.2:1))+r*.3;x=Math.min(x,m.x-r,m.lx-rx);y=Math.min(y,m.y-r,m.ly-r*1.5);right=Math.max(right,m.x+r,m.lx+rx);bottom=Math.max(bottom,m.y+r,m.ly+r*1.5);}
  return {x,y,width:right-x,height:bottom-y};
}
/** fill: Füllfarbe für die Ergebniskarte (sonst weiß). */
export function markerSVG(p:Project,m:Marker,selected=false,minSize=0,fill?:string) {
  const r=Math.max(markerSize(p),minSize),rx=r*Math.max(1,m.label.length*.34),color=m.kind==='sample'?'#17665e':FIRE_RED;
  const n=fill?parseInt(fill.slice(1),16):0,text=fill?((n>>16)*299+(n>>8&255)*587+(n&255)*114)/1000>150?'#1d2a33':'#ffffff':color;
  const displaced=Math.hypot(m.x-m.lx,m.y-m.ly)>.01;
  const fire=m.kind==='fire',form=shapeOf(m),sq=Math.max(rx,r*1.05);
  const shape=fire?`<path d="${starPath(m.lx,m.ly,r*1.35)}" fill="${FIRE_RED}" stroke="#ffffff" stroke-width="${r*.12}" stroke-linejoin="round"/>`
    :form==='square'?`<rect x="${m.lx-sq}" y="${m.ly-r*1.05}" width="${sq*2}" height="${r*2.1}" rx="${r*.12}"/>`
    :form==='diamond'?`<path d="M ${m.lx} ${m.ly-r*1.3} L ${m.lx+rx*1.2} ${m.ly} L ${m.lx} ${m.ly+r*1.3} L ${m.lx-rx*1.2} ${m.ly} Z"/>`
    :`<ellipse cx="${m.lx}" cy="${m.ly}" rx="${rx}" ry="${r}"/>`;
  return `<g data-id="${m.id}">${selected?`<ellipse cx="${m.lx}" cy="${m.ly}" rx="${rx+r*.6}" ry="${r*1.8}" fill="none" stroke="#e0ae42" stroke-width="${r*.2}" stroke-dasharray="${r*.3} ${r*.2}"/>`:''}${displaced?`<path d="M${m.x} ${m.y} L${m.lx} ${m.ly}" stroke="white" stroke-width="${r*.3}"/><path d="M${m.x} ${m.y} L${m.lx} ${m.ly}" stroke="${color}" stroke-width="${r*.12}"/><g data-drag="point"><circle cx="${m.x}" cy="${m.y}" r="${Math.max(r*.85,minSize*1.85)}" fill="transparent"/><circle cx="${m.x}" cy="${m.y}" r="${r*.24}" fill="${color}" stroke="white" stroke-width="${r*.1}"/><path d="M${m.x-r*.45} ${m.y}h${r*.9}M${m.x} ${m.y-r*.45}v${r*.9}" stroke="${color}" stroke-width="${r*.1}"/></g>`:''}<g data-drag="${displaced?'label':'point'}" fill="${fill||'white'}" stroke="${fill?'#1d2a33':color}" stroke-width="${r*.18}">${minSize?`<ellipse cx="${m.lx}" cy="${m.ly}" rx="${Math.max(rx,minSize*1.85)}" ry="${Math.max(r,minSize*1.85)}" fill="transparent" stroke="none"/>`:''}${shape}</g>${fire?'':`<text data-drag="${displaced?'label':'point'}" x="${m.lx}" y="${m.ly+r*.3}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${r*.87}" fill="${text}">${escape(m.label)}</text>`}</g>`;
}
export class History {
  past:Project[]=[]; future:Project[]=[];
  push(p:Project){this.past.push(clone(p));if(this.past.length>60)this.past.shift();this.future=[];}
  // Der zurückgelegte Zustand zeigt denselben Plan wie der wiederhergestellte, damit Wiederholen dort landet, wo die Änderung war.
  undo(p:Project){const prev=this.past.pop();if(prev){this.future.push(alignFloor(clone(p),prev));return prev;}return p;}
  redo(p:Project){const next=this.future.pop();if(next){this.past.push(alignFloor(clone(p),next));return next;}return p;}
  clear(){this.past=[];this.future=[];}
}

// ---- Mehrere Pläne ----
export const MAX_SHEETS=40;
/** Die übrigen (nicht aktiven) Pläne mit vollständigen Daten. */
export function otherSheets(p:Project){return (p.sheets||[]).filter((_,i)=>i!==(p.active??0));}
export function allMarkers(p:Project):Marker[]{return [...p.markers,...otherSheets(p).flatMap(s=>s.markers||[])];}
export function allAreas(p:Project):Area[]{return [...(p.areas||[]),...otherSheets(p).flatMap(s=>s.areas||[])];}
/** Alle vergebenen Kennungen im ganzen Gebäude – Proben werden über alle Pläne fortlaufend nummeriert. */
export function takenLabels(p:Project):{id:string;label:string}[]{return [...allMarkers(p),...allAreas(p),...(p.pending||[]).map(r=>({label:r.label,id:''}))];}
export function sheetCount(p:Project){return p.sheets?.length||1;}
/** Name des Plans; bei nur einem Plan ohne ausdrückliche Benennung leer. */
export function floorName(p:Project,index=p.active??0){return p.sheets&&p.sheets.length>1?p.sheets[index]?.name||'':'';}
export function suggestFloorName(n:number){return n===0?'EG':`${n}. OG`;}
function ensureSheets(p:Project){if(!p.sheets){p.sheets=[{id:crypto.randomUUID(),name:suggestFloorName(0)}];p.active=0;}p.version=Math.max(p.version,5) as Project['version'];return p.sheets;}
/** Projektansicht eines einzelnen Plans (für Export und Vorschau). */
export function sheetProject(p:Project,index:number):Project{
  if(!p.sheets||index===(p.active??0))return p;
  const s=p.sheets[index];return {...p,plan:s.plan!,markers:s.markers||[],areas:s.areas,active:index};
}
export function switchSheet(p:Project,index:number){
  const sheets=p.sheets,current=p.active??0;if(!sheets||index===current||index<0||index>=sheets.length)return;
  const target=sheets[index];
  sheets[current]={id:sheets[current].id,name:sheets[current].name,plan:p.plan,markers:p.markers,...(p.areas?{areas:p.areas}:{})};
  p.plan=target.plan!;p.markers=target.markers||[];if(target.areas)p.areas=target.areas;else if(p.nextArea!==undefined)p.areas=[];else delete p.areas;
  sheets[index]={id:target.id,name:target.name};p.active=index;
}
export function addSheet(p:Project,plan:Plan,name=suggestFloorName(sheetCount(p))){
  const sheets=ensureSheets(p);if(sheets.length>=MAX_SHEETS)throw Error(`Höchstens ${MAX_SHEETS} Pläne pro Projekt.`);
  sheets.push({id:crypto.randomUUID(),name:cleanSheetName(name)||suggestFloorName(sheets.length),plan,markers:[],...(p.nextArea!==undefined?{areas:[]}:{})});
  switchSheet(p,sheets.length-1);
}
export function cleanSheetName(name:string){return name.replace(/\s+/g,' ').trim().slice(0,40);}
export function renameSheet(p:Project,index:number,name:string){const clean=cleanSheetName(name);if(!clean)throw Error('Bitte einen Namen für den Plan eingeben.');ensureSheets(p)[index].name=clean;}
export function moveSheet(p:Project,from:number,to:number){
  const sheets=p.sheets;if(!sheets||to<0||to>=sheets.length||from===to)return;
  const activeId=sheets[p.active??0].id;const [s]=sheets.splice(from,1);sheets.splice(to,0,s);p.active=sheets.findIndex(x=>x.id===activeId);
}
/** Entfernt einen Plan. Platzierte Laborproben gehen zurück in die Liste „Noch zu platzieren“. */
export function removeSheet(p:Project,index:number){
  const sheets=p.sheets;if(!sheets||sheets.length<2)throw Error('Der letzte Plan kann nicht gelöscht werden.');
  if(index===(p.active??0))switchSheet(p,index===0?1:index-1);
  const [gone]=sheets.splice(index,1);p.active=sheets.findIndex(s=>!s.plan);
  const back=(gone.markers||[]).filter(m=>m.lab).map(m=>({label:m.label,...m.lab!}));
  if(back.length)p.pending=[...(p.pending||[]),...back].sort((a,b)=>Number(a.label.slice(1))-Number(b.label.slice(1)));
  return gone;
}
function alignFloor(p:Project,ref:Project){const id=ref.sheets?.[ref.active??0]?.id,index=id?p.sheets?.findIndex(s=>s.id===id)??-1:-1;if(index>=0)switchSheet(p,index);return p;}
