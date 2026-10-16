import {allAreas,allMarkers,clone,type LabOrigin,type LabSample,type LabSources,type Project} from './model';
import type {LabReport} from './labreport';

const idPattern=/^[\w-]{1,80}$/;
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
export function sourceFilename(value:string){return value.split(/[\\/]/).at(-1)||'';}
export function sourceText(sources:LabSources){return [sources.xml,sources.pdf].filter(Boolean).join(' + ');}
export function copyOrigin(r:LabOrigin):LabOrigin{return {id:r.id,bericht:r.bericht,labor:r.labor,auftragsreferenz:r.auftragsreferenz,...(r.batch!==undefined?{batch:r.batch}:{}),sources:{...(r.sources.xml!==undefined?{xml:r.sources.xml}:{}),...(r.sources.pdf!==undefined?{pdf:r.sources.pdf}:{})}};}
export function validOrigin(value:unknown):value is LabOrigin{
 const r=value as LabOrigin;if(!r||typeof r!=='object'||!text(r.id,80)||!idPattern.test(r.id)||!text(r.bericht,160)||!text(r.labor,500)||!text(r.auftragsreferenz,2000)||(r.batch!==undefined&&!text(r.batch,160))||!r.sources||typeof r.sources!=='object'||Array.isArray(r.sources))return false;
 return (['xml','pdf'] as const).every(k=>r.sources[k]===undefined||(text(r.sources[k],255)&&!!r.sources[k].trim()&&sourceFilename(r.sources[k])===r.sources[k]&&!/[:\u0000-\u001f]/.test(r.sources[k])&&r.sources[k]!=='.'&&r.sources[k]!=='..'));
}
export function originFromReport(report:LabReport,id=crypto.randomUUID()):LabOrigin{
 const r:LabOrigin={id,bericht:report.bericht,labor:report.labor,auftragsreferenz:report.auftragsreferenz,...(report.batch?{batch:report.batch}:{}),sources:{...report.sources}};
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
  const row:LabSample={label:input.label,ref:input.ref,desc:input.desc,...(input.art!==undefined?{art:input.art}:{}),...(input.labNr!==undefined?{labNr:input.labNr}:{}),...(input.datum!==undefined?{datum:input.datum}:{}),...(input.werte?{werte:input.werte.map(w=>({...w}))}:{}),bericht:origin.bericht,reportId:origin.id};
  if(choice==='update'){
   if(!hit||('kind' in hit&&hit.kind!=='sample')||'points' in hit)throw Error(`${input.label}: Nur Laborproben oder Probenmarker können ersetzt werden.`);
   const {label,...lab}=row;if('kind' in hit){hit.note=row.desc;hit.lab=lab;}else Object.assign(hit,row);
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
