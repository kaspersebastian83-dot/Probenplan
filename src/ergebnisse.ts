// Geprüfte Laborergebnisse aus ResultKit: „Laborergebnisse/_Ergebnisse.json“ (Format spektron-ergebnisse, Version 1).
// Im Projekt importiert und prüft ResultKit die Prüfberichte; PlanKit übernimmt daraus je Bericht die Proben mit Messwerten
// über die gewohnte Prüftabelle (applyLabImport). Die Datei schreibt nur ResultKit – PlanKit liest sie nur.
// Feldnamen der Berichte wie PlanKits LabOrigin/LabSample (ResultKit src/ergebnisse.ts, dort identisch halten).
import {blankReport,referenceLabel,type LabReport} from './labreport';
import {MAX_RAUM,type LabOrigin,type LabSample,type Surface} from './model';

export const ERGEBNIS_DATEI='_Ergebnisse.json';
export interface ErgebnisBericht extends LabOrigin {proben:LabSample[]}
export interface Ergebnisse {projekt:string;uebernommen:string;vollstaendig:boolean;stand:string;berichte:ErgebnisBericht[];offen:string[];
 /** Berichte, die ResultKit als ersetzt führt (z. B. vorläufig → endgültig) */ersetzt:{bericht:string;durch:string[]}[]}

const text=(v:unknown,max=500)=>typeof v==='string'?v.slice(0,max):'';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);

/** Datei lesen und auf das Nötige prüfen; unbekannte Felder fallen weg. Wirft mit verständlicher Meldung. */
export function liesErgebnisse(inhalt:string):Ergebnisse{
 let v:unknown;try{v=JSON.parse(inhalt);}catch{throw Error(`„${ERGEBNIS_DATEI}“ ist keine gültige JSON-Datei.`);}
 if(!obj(v)||v.format!=='spektron-ergebnisse')throw Error(`„${ERGEBNIS_DATEI}“ stammt nicht aus ResultKit.`);
 if(v.version!==1)throw Error(`„${ERGEBNIS_DATEI}“ hat ein neueres Format (Version ${String(v.version)}) – bitte PlanKit aktualisieren.`);
 if(!Array.isArray(v.berichte))throw Error(`„${ERGEBNIS_DATEI}“ ist unvollständig.`);
 // Oberflächenart und Raum (aus LabelKit): ab ResultKit 1.5 an jeder Berichtsprobe; ältere Dateien nur im Laborauftrag.
 const auftrag=new Map((obj(v.auftrag)&&Array.isArray(v.auftrag.proben)?v.auftrag.proben:[]).filter(obj).slice(0,1000).map(p=>[text(p.label,12).toUpperCase(),p] as const).filter(([l])=>l));
 const berichte=v.berichte.filter(obj).slice(0,200).map((b,i):ErgebnisBericht=>{
  const sources=obj(b.sources)?b.sources:{};
  const proben=(Array.isArray(b.proben)?b.proben:[]).filter(obj).slice(0,1000).map((p):LabSample=>({label:text(p.label,12),ref:text(p.ref,160),desc:text(p.desc),
   ...(p.art?{art:text(p.art,160)}:{}),...(p.labNr?{labNr:text(p.labNr,160)}:{}),...(p.datum?{datum:text(p.datum,10)}:{}),...(p.typ?{typ:text(p.typ,40)}:{}),
   ...lage(p,auftrag.get(text(p.label,12).toUpperCase())),
   ...(Array.isArray(p.werte)?{werte:p.werte.filter(obj).slice(0,300).map(w=>({p:text(w.p,200),r:text(w.r,40),u:text(w.u,40)}))}:{})}));
  return {id:text(b.id,80)||`b${i+1}`,bericht:text(b.bericht,160),labor:text(b.labor,500),auftragsreferenz:text(b.auftragsreferenz,2000),...(b.batch?{batch:text(b.batch,160)}:{}),
   sources:{...(sources.xml?{xml:text(sources.xml,255)}:{}),...(sources.pdf?{pdf:text(sources.pdf,255)}:{})},...(b.vorlaeufig===true?{vorlaeufig:true as const}:{}),proben};});
 const ersetzt=(Array.isArray(v.ersetzt)?v.ersetzt:[]).filter(obj).slice(0,200).map(e=>({bericht:text(e.bericht,160),durch:(Array.isArray(e.durch)?e.durch:[]).slice(0,20).map(x=>text(x,160)).filter(Boolean)})).filter(e=>e.bericht);
 return {projekt:text(v.projekt,20),uebernommen:text(v.uebernommen,40),vollstaendig:v.vollstaendig===true,stand:text(v.stand,1e6),berichte,offen:Array.isArray(v.offen)?v.offen.map(x=>text(x,160)):[],ersetzt};
}

const SURFACES:readonly Surface[]=['floor','wall','ceiling'];
/** Oberflächenart und Raum einer Probe: aus der Berichtsprobe, sonst aus dem Laborauftrag (gleiche Probennummer). */
function lage(p:Record<string,unknown>,a:Record<string,unknown>|undefined):{surface?:Surface;raum?:string}{
 const surface=[p.surface,a?.surface].find((x):x is Surface=>SURFACES.includes(x as Surface));
 const raum=[p.raum,a?.raum].map(x=>text(x,MAX_RAUM).trim()).find(Boolean);
 return {...(surface?{surface}:{}),...(raum?{raum}:{})};
}
/** Ein Bericht aus ResultKit als Laborbericht für die Prüftabelle (wie nach dem Lesen einer XML). */
export function berichtAlsReport(b:ErgebnisBericht):LabReport{
 const r=blankReport();
 return {...r,bericht:b.bericht,labor:b.labor,auftragsreferenz:b.auftragsreferenz,batch:b.batch||'',sources:{...b.sources},quelle:[b.sources.xml,b.sources.pdf].filter(Boolean).join(' + ')||'ResultKit',
  rows:b.proben.map(p=>({...p,label:p.label||referenceLabel(p.ref),...(p.werte?{werte:p.werte.map(w=>({...w}))}:{})})),expected:b.proben.length,...(b.vorlaeufig?{vorlaeufig:true}:{})};
}

/** Dateistand wie in ResultKit (Name|Größe|Zeit, sortiert): weicht er ab, wurde der Ordner nach der Übernahme geändert. */
export function standKennung(dateien:{name:string;size:number;t:number}[]){return [...dateien].sort((a,b)=>a.name.localeCompare(b.name)).map(d=>`${d.name}|${d.size}|${d.t}`).join('\n');}

/** Liegt der Plan hinter der letzten Übernahme in ResultKit zurück?
 *  ersetzt: Werte im Plan stammen aus einem Bericht, den ResultKit inzwischen als ersetzt führt (z. B. vorläufig → endgültig).
 *  neu: ResultKit hat einen Bericht mit Messwerten, den der Plan noch gar nicht kennt.
 *  Nur für Pläne, die schon Werte aus Prüfberichten zeigen (verwendet, mit Berichtsnummer) – ein Plan nur mit LabelKit-Proben „liegt nicht zurück“.
 *  bekannt: alle im Plan gespeicherten Herkünfte (auch nicht mehr verwendete), damit bewusst Ausgelassenes nicht immer wieder gemeldet wird. */
export function planHinterResultKit(verwendet:LabOrigin[],bekannt:LabOrigin[],e:Ergebnisse):{ersetzt:{alt:string;neu:string[]}[];neu:string[]}{
 // Die Probenerfassung aus LabelKit ist auch eine Herkunft, aber ohne Prüfberichtsnummer und ohne Messwerte – zählt hier nicht.
 verwendet=verwendet.filter(r=>r.bericht.trim());
 if(!verwendet.length)return {ersetzt:[],neu:[]};
 const name=(code:string,vorl?:boolean)=>`${code||'(ohne Nummer)'}${vorl?' (vorläufig)':''}`;
 const ersetzt:{alt:string;neu:string[]}[]=[],gesehen=new Set<string>();
 for(const u of verwendet){
  const k=`${u.bericht}|${u.vorlaeufig?1:0}`;if(gesehen.has(k))continue;gesehen.add(k);
  const laut=e.ersetzt.find(x=>x.bericht===u.bericht&&!e.berichte.some(b=>b.bericht===u.bericht&&!!b.vorlaeufig===!!u.vorlaeufig));
  if(laut){ersetzt.push({alt:name(u.bericht,u.vorlaeufig),neu:laut.durch});continue;}
  // gleiche Berichtsnummer, inzwischen endgültig
  if(u.vorlaeufig&&e.berichte.some(b=>b.bericht===u.bericht&&!b.vorlaeufig))ersetzt.push({alt:name(u.bericht,true),neu:[u.bericht]});
 }
 const imPlan=new Set(bekannt.map(r=>`${r.bericht}|${r.vorlaeufig?1:0}`));
 const neu=e.berichte.filter(b=>b.proben.some(p=>p.werte?.length)&&!imPlan.has(`${b.bericht}|${b.vorlaeufig?1:0}`)&&!ersetzt.some(x=>x.neu.includes(b.bericht))).map(b=>name(b.bericht,b.vorlaeufig));
 return {ersetzt,neu};
}
/** Ein Satz für die Warnleiste; leer, wenn der Plan auf dem Stand ist. */
export function hinterText(h:{ersetzt:{alt:string;neu:string[]}[];neu:string[]}):string{
 const teile=[...h.ersetzt.map(x=>`${x.alt} ist in ResultKit ersetzt${x.neu.length?` durch ${x.neu.join(', ')}`:''}`),...(h.neu.length?[`${h.neu.length===1?'Prüfbericht':'Prüfberichte'} ${h.neu.join(', ')} ${h.neu.length===1?'ist':'sind'} in ResultKit übernommen, aber noch nicht im Plan`]:[])];
 if(!teile.length)return '';
 return `Neuerer Laborstand in ResultKit: ${teile.join('; ')}.${h.ersetzt.length?' Im Plan stehen noch die alten Werte.':''} Über „Proben übernehmen …“ aktualisieren – platzierte Proben bleiben, wo sie sind.`;
}
