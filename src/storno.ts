// Stornierte Proben aus LabelKit (ab LabelKit 4.49.0): Feld `storniert: {am, kuerzel, grund}` an einer Probe.
// Eine stornierte Probe ist keine Probe mehr – PlanKit bietet sie nicht an und zählt sie nicht. Ihre Nummer bleibt
// in LabelKit vergeben und wird hier nie neu verwendet. Ein schon gesetzter Punkt wird nie still entfernt: Ein Hinweis
// fragt („P7 ist storniert – Punkt entfernen?“), du entscheidest.
import {otherSheets,type Project} from './model';

export interface Storno {label:string;am:string;kuerzel:string;grund:string}
/** Treffer im Projekt: platzierter Punkt (mit Plan) oder Eintrag unter „Noch zu platzieren“. */
export type StornoTreffer={storno:Storno;art:'punkt';id:string;sheet:number}|{storno:Storno;art:'offen'};

/** Eine Stornierung wiedererkennen: gleiche P-Nummer und gleicher Zeitpunkt. Wird ein Storno aufgehoben und später neu
 *  gesetzt, ist es ein neuer Zeitpunkt – dann kommt der Hinweis wieder, auch wenn der Punkt einmal „behalten“ wurde. */
export const stornoKey=(s:Storno)=>`${s.label.toUpperCase()}|${s.am}`;
const gleich=(a:string,b:string)=>a.toUpperCase()===b.toUpperCase();

/** Platzierte Laborproben und offene Proben, deren Probe in LabelKit storniert ist – „behalten“ ausgenommen. */
export function stornoTreffer(p:Project,liste:readonly Storno[],behalten:ReadonlySet<string>=new Set()):StornoTreffer[]{
 const out:StornoTreffer[]=[];if(!liste.length)return out;
 const plaene=[{index:p.active??0,markers:p.markers},...(p.sheets||[]).map((s,index)=>({index,markers:s.markers||[]})).filter(s=>s.index!==(p.active??0))];
 for(const s of liste){
  if(behalten.has(stornoKey(s)))continue;
  for(const plan of plaene)for(const m of plan.markers)if(m.kind==='sample'&&m.lab&&gleich(m.label,s.label))out.push({storno:s,art:'punkt',id:m.id,sheet:plan.index});
  if((p.pending||[]).some(r=>gleich(r.label,s.label)))out.push({storno:s,art:'offen'});
 }
 return out.sort((a,b)=>Number(a.storno.label.slice(1))-Number(b.storno.label.slice(1)));
}
/** Text des Hinweises, z. B. „P7 ist storniert – Punkt entfernen?“. */
export const stornoText=(t:StornoTreffer)=>t.art==='punkt'?`${t.storno.label} ist storniert – Punkt entfernen?`:`${t.storno.label} ist storniert – aus „Noch zu platzieren“ nehmen?`;
/** Tooltip: wann, von wem, warum (soweit in LabelKit angegeben). */
export function stornoDetail(s:Storno){
 const d=new Date(s.am),wann=s.am&&!Number.isNaN(d.getTime())?` am ${d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}`:'';
 return `In LabelKit storniert${wann}${s.kuerzel?` (${s.kuerzel})`:''}${s.grund?` – Grund: ${s.grund}`:''}. Die Nummer bleibt vergeben.`;
}
/** Punkt entfernen – auch auf einem anderen Plan. Kommt nicht zurück in die offene Liste: Die Probe gibt es nicht mehr. */
export function stornoPunktEntfernen(p:Project,id:string):boolean{
 for(const list of [p.markers,...otherSheets(p).map(s=>s.markers||[])]){const i=list.findIndex(m=>m.id===id);if(i>=0){list.splice(i,1);return true;}}
 return false;
}
