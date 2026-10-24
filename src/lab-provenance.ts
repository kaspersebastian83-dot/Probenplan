import {allAreas,allMarkers,clone,typeFromArt,shapeForType,type LabOrigin,type LabSample,type LabSources,type Project} from './model';
import type {LabReport} from './labreport';

const idPattern=/^[\w-]{1,80}$/;
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
export function sourceFilename(value:string){return value.split(/[\\/]/).at(-1)||'';}
export function sourceText(sources:LabSources){return [sources.xml,sources.pdf].filter(Boolean).join(' + ');}
export function copyOrigin(r:LabOrigin):LabOrigin{return {id:r.id,bericht:r.bericht,labor:r.labor,auftragsreferenz:r.auftragsreferenz,...(r.batch!==undefined?{batch:r.batch}:{}),...(r.vorlaeufig===true?{vorlaeufig:true as const}:{}),sources:{...(r.sources.xml!==undefined?{xml:r.sources.xml}:{}),...(r.sources.pdf!==undefined?{pdf:r.sources.pdf}:{})}};}
/** Vorläufige Prüfberichte, aus denen Werte im Projekt stammen (nur tatsächlich verwendete Herkunft). */
export function vorlaeufigeBerichte(p:Project):LabOrigin[]{
 const used=new Set<string>();for(const m of allMarkers(p))if(m.lab?.reportId)used.add(m.lab.reportId);for(const r of p.pending||[])if(r.reportId)used.add(r.reportId);
 return (p.labReports||[]).filter(r=>r.vorlaeufig&&used.has(r.id));
}
/** Vorläufige Berichte nur für die Werte, die eine Planseite zeigt: Proben dieser Seite (p.markers) mit Wert für den dargestellten Parameter.
 *  Nicht platzierte Proben, andere Geschosse und andere Parameter zählen hier nicht. */
export function vorlaeufigeBerichteAufPlan(p:Project,parameter:string):LabOrigin[]{
 const used=new Set<string>();for(const m of p.markers||[])if(m.lab?.reportId&&(!parameter||(m.lab.werte||[]).some(w=>w.p===parameter)))used.add(m.lab.reportId);
 return (p.labReports||[]).filter(r=>r.vorlaeufig&&used.has(r.id));
}
export const vorlaeufigText=(rs:LabOrigin[])=>rs.length?`Werte aus vorläufigem Prüfbericht ${rs.map(r=>r.bericht||'(ohne Nummer)').join(', ')} – sie können sich mit dem endgültigen Bericht ändern.`:'';
export function validOrigin(value:unknown):value is LabOrigin{
 const r=value as LabOrigin;if(!r||typeof r!=='object'||!text(r.id,80)||!idPattern.test(r.id)||!text(r.bericht,160)||!text(r.labor,500)||!text(r.auftragsreferenz,2000)||(r.batch!==undefined&&!text(r.batch,160))||(r.vorlaeufig!==undefined&&r.vorlaeufig!==true)||!r.sources||typeof r.sources!=='object'||Array.isArray(r.sources))return false;
 return (['xml','pdf'] as const).every(k=>r.sources[k]===undefined||(text(r.sources[k],255)&&!!r.sources[k].trim()&&sourceFilename(r.sources[k])===r.sources[k]&&!/[:\u0000-\u001f]/.test(r.sources[k])&&r.sources[k]!=='.'&&r.sources[k]!=='..'));
}
export function originFromReport(report:LabReport,id=crypto.randomUUID()):LabOrigin{
 const r:LabOrigin={id,bericht:report.bericht,labor:report.labor,auftragsreferenz:report.auftragsreferenz,...(report.batch?{batch:report.batch}:{}),...(report.vorlaeufig?{vorlaeufig:true as const}:{}),sources:{...report.sources}};
 if(!validOrigin(r))throw Error('Ungültige Labor-Herkunft: Feldlängen und Quelldateinamen prüfen (keine lokalen Pfade).');return copyOrigin(r);
}

// Build a complete replacement before touching the live project or its history.
// Each accepted import gets its own immutable origin, even for equal report numbers.
export function applyLabImport(project:Project,report:LabReport,choices:ReadonlyMap<LabSample,string>):Project{
 const next=clone(project),origin=originFromReport(report);next.pending||=[];
 const occupied=new Set([...allMarkers(next),...allAreas(next),...next.pending,...report.rows].map(r=>r.label.toUpperCase()));
 let number=Math.max(next.nextSample,...report.rows.map(r=>Number(r.label.slice(1))+1)),accepted=0;
 for(const input of report.rows){
  const choice=choices.get(input),hit=[...allMarkers(next),...allAreas(next),...next.pending].find(r=>r.label.toUpperCase()===input.label.toUpperCase());
  if(choice==='skip')continue;
  if(hit&&choice!=='update'&&choice!=='next')throw Error(`${input.label}: Herkunftskonflikt bitte ausdrücklich auflösen.`);
  const row:LabSample={label:input.label,ref:input.ref,desc:input.desc,...(input.art!==undefined?{art:input.art}:{}),...(input.labNr!==undefined?{labNr:input.labNr}:{}),...(input.datum!==undefined?{datum:input.datum}:{}),...(input.werte?{werte:input.werte.map(w=>({...w}))}:{}),bericht:origin.bericht,reportId:origin.id,...(input.typ?{typ:input.typ}:{}),...(input.shape?{shape:input.shape}:{}),...(input.surface?{surface:input.surface}:{}),...(input.raum?{raum:input.raum}:{})};
  if(choice==='update'){
   if(!hit||('kind' in hit&&hit.kind!=='sample')||'points' in hit)throw Error(`${input.label}: Nur Laborproben oder Probenmarker können ersetzt werden.`);
   // Probenart aus LabelKit (Form/Legende) bleibt erhalten, auch wenn der Laborbericht eine andere Probenart nennt
   const {label,typ,shape,surface,raum,...lab}=row;
   // Raum aus LabelKit füllt nur einen leeren Marker; eine Eingabe in PlanKit bleibt.
   if('kind' in hit&&raum&&!hit.raum)hit.raum=raum;
   // Oberflächenart aus LabelKit füllt nur einen leeren Marker; eine Eingabe in PlanKit bleibt.
   if('kind' in hit&&surface&&!hit.surface)hit.surface=surface;
   if('kind' in hit&&shape){if(shape==='circle')delete hit.shape;else hit.shape=shape;}
   if('kind' in hit){const old=hit.typ||typ||typeFromArt(hit.lab?.art)?.typ;if(old&&!hit.typ){hit.typ=old;if(!hit.shape&&shapeForType(old)!=='circle')hit.shape=shapeForType(old);}hit.note=row.desc;hit.lab=lab;}
   else{const old=hit.typ||typeFromArt(hit.art)?.typ||typ;Object.assign(hit,row);if(old)hit.typ=old;else delete hit.typ;}
  }else{
   if(choice==='next'){while(occupied.has(`P${number}`))number++;if(number>=999999999)throw Error('Probenzähler ausgeschöpft.');row.label=`P${number++}`;}
   occupied.add(row.label);next.pending.push(row);
  }
  accepted++;number=Math.max(number,Number(row.label.slice(1))+1);
 }
 // Preserve identity for a no-op so callers can skip history and persistence.
 if(!accepted)return project;
 if(next.pending.length>1000||allMarkers(next).length+next.pending.length>3000)throw Error('Zu viele Proben im Projekt (maximal 1000 offen, 3000 insgesamt).');
 if(number>=1e9)throw Error('Probenzähler ausgeschöpft.');
 if((next.labReports?.length||0)>=3000)throw Error('Zu viele gespeicherte Laborberichte (maximal 3000).');
 next.nextSample=number;next.version=Math.max(next.version,4) as Project['version'];next.labReports=[...(next.labReports||[]),origin];return next;
}

export function projectLabRows(p:Project):LabSample[]{return [...(p.pending||[]),...allMarkers(p).filter(m=>m.lab).map(m=>({label:m.label,...m.lab!}))];}
