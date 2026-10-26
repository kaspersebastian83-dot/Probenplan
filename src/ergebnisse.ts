// Geprüfte Laborergebnisse aus ResultKit: „Laborergebnisse/_Ergebnisse.json“ (Format spektron-ergebnisse, Version 1).
// Im Projekt importiert und prüft ResultKit die Prüfberichte; PlanKit übernimmt daraus je Bericht die Proben mit Messwerten
// über die gewohnte Prüftabelle (applyLabImport). Die Datei schreibt nur ResultKit – PlanKit liest sie nur.
// Feldnamen der Berichte wie PlanKits LabOrigin/LabSample (ResultKit src/ergebnisse.ts, dort identisch halten).
import {blankReport,referenceLabel,type LabReport} from './labreport';
import type {LabOrigin,LabSample} from './model';

export const ERGEBNIS_DATEI='_Ergebnisse.json';
export interface ErgebnisBericht extends LabOrigin {proben:LabSample[]}
export interface Ergebnisse {projekt:string;uebernommen:string;vollstaendig:boolean;stand:string;berichte:ErgebnisBericht[];offen:string[]}

const text=(v:unknown,max=500)=>typeof v==='string'?v.slice(0,max):'';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);

/** Datei lesen und auf das Nötige prüfen; unbekannte Felder fallen weg. Wirft mit verständlicher Meldung. */
export function liesErgebnisse(inhalt:string):Ergebnisse{
 let v:unknown;try{v=JSON.parse(inhalt);}catch{throw Error(`„${ERGEBNIS_DATEI}“ ist keine gültige JSON-Datei.`);}
 if(!obj(v)||v.format!=='spektron-ergebnisse')throw Error(`„${ERGEBNIS_DATEI}“ stammt nicht aus ResultKit.`);
 if(v.version!==1)throw Error(`„${ERGEBNIS_DATEI}“ hat ein neueres Format (Version ${String(v.version)}) – bitte PlanKit aktualisieren.`);
 if(!Array.isArray(v.berichte))throw Error(`„${ERGEBNIS_DATEI}“ ist unvollständig.`);
 const berichte=v.berichte.filter(obj).slice(0,200).map((b,i):ErgebnisBericht=>{
  const sources=obj(b.sources)?b.sources:{};
  const proben=(Array.isArray(b.proben)?b.proben:[]).filter(obj).slice(0,1000).map((p):LabSample=>({label:text(p.label,12),ref:text(p.ref,160),desc:text(p.desc),
   ...(p.art?{art:text(p.art,160)}:{}),...(p.labNr?{labNr:text(p.labNr,160)}:{}),...(p.datum?{datum:text(p.datum,10)}:{}),...(p.typ?{typ:text(p.typ,40)}:{}),
   ...(Array.isArray(p.werte)?{werte:p.werte.filter(obj).slice(0,300).map(w=>({p:text(w.p,200),r:text(w.r,40),u:text(w.u,40)}))}:{})}));
  return {id:text(b.id,80)||`b${i+1}`,bericht:text(b.bericht,160),labor:text(b.labor,160),auftragsreferenz:text(b.auftragsreferenz,160),...(b.batch?{batch:text(b.batch,160)}:{}),
   sources:{...(sources.xml?{xml:text(sources.xml,255)}:{}),...(sources.pdf?{pdf:text(sources.pdf,255)}:{})},...(b.vorlaeufig===true?{vorlaeufig:true as const}:{}),proben};});
 return {projekt:text(v.projekt,20),uebernommen:text(v.uebernommen,40),vollstaendig:v.vollstaendig===true,stand:text(v.stand,1e6),berichte,offen:Array.isArray(v.offen)?v.offen.map(x=>text(x,160)):[]};
}

/** Ein Bericht aus ResultKit als Laborbericht für die Prüftabelle (wie nach dem Lesen einer XML). */
export function berichtAlsReport(b:ErgebnisBericht):LabReport{
 const r=blankReport();
 return {...r,bericht:b.bericht,labor:b.labor,auftragsreferenz:b.auftragsreferenz,batch:b.batch||'',sources:{...b.sources},quelle:[b.sources.xml,b.sources.pdf].filter(Boolean).join(' + ')||'ResultKit',
  rows:b.proben.map(p=>({...p,label:p.label||referenceLabel(p.ref),...(p.werte?{werte:p.werte.map(w=>({...w}))}:{})})),expected:b.proben.length,...(b.vorlaeufig?{vorlaeufig:true}:{})};
}

/** Dateistand wie in ResultKit (Name|Größe|Zeit, sortiert): weicht er ab, wurde der Ordner nach der Übernahme geändert. */
export function standKennung(dateien:{name:string;size:number;t:number}[]){return [...dateien].sort((a,b)=>a.name.localeCompare(b.name)).map(d=>`${d.name}|${d.size}|${d.t}`).join('\n');}
