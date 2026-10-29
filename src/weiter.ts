// Weiter-Platzieren (ab 1.47): Nach dem Platzieren einer Laborprobe wählt PlanKit die nächste offene Probe selbst –
// zuerst im selben Raum, danach im nächsten Raum (Geschoss, dann Raum). Reine Rechnung, ohne DOM.
import {floorRank,splitRoom,roomKey} from './raumbuch';
import type {LabSample} from './model';

export const WEITER_KEY='plankit-weiter-platzieren';
/** Standard: an. Abschaltbar (gilt je Browser), dann platziert PlanKit wie bisher eine Probe und kehrt zur Ansicht zurück. */
export function weiterOn(){try{return localStorage.getItem(WEITER_KEY)!=='0';}catch{return true;}}
export function setWeiter(on:boolean){try{localStorage.setItem(WEITER_KEY,on?'1':'0');}catch{/* ohne Speicher */}}

export interface RaumRef {key:string;floor:string;name:string;ohne:boolean}
/** Geschoss und Raum einer Probe; das Geschoss kommt aus dem Plan (`sheetFloor`) oder dem Präfix im Raumnamen („EG Flur“).
 *  Ohne Raum: Gruppe „Ohne Raum“. */
export function raumVon(r:{raum?:string},sheetFloor=''):RaumRef{
  const raw=(r.raum||'').trim();if(!raw)return {key:'',floor:'',name:'',ohne:true};
  const {floor,name}=splitRoom(sheetFloor,raw);return {key:roomKey(floor,name),floor,name,ohne:false};
}
const natur=(a:string,b:string)=>a.localeCompare(b,'de',{numeric:true,sensitivity:'base'});
/** Reihenfolge der Räume: Geschoss (KG … EG … OG … DG), dann Raumname natürlich sortiert, „Ohne Raum“ zuletzt. */
export function raumVergleich(a:RaumRef,b:RaumRef){
  if(a.ohne!==b.ohne)return a.ohne?1:-1;
  return floorRank(a.floor)-floorRank(b.floor)||natur(a.floor,b.floor)||natur(a.name,b.name);
}
/** Offene Proben in Platzierreihenfolge: nach Raum, innerhalb des Raums in der Reihenfolge der Liste. */
export function sortiere(pending:readonly LabSample[]):LabSample[]{
  const info=pending.map((r,i)=>({r,i,raum:raumVon(r)}));
  info.sort((a,b)=>raumVergleich(a.raum,b.raum)||a.i-b.i);
  return info.map(x=>x.r);
}
/** Etikett der Probe, die nach `label` kommt (null, wenn keine andere offen ist). Gleicher Raum zuerst
 *  (erst die danach, dann von vorn im Raum), sonst der nächste Raum; nach dem letzten Raum wieder von vorn.
 *  Dient nach dem Platzieren (Probe ist noch in der Liste) und für „Überspringen“. */
export function naechste(pending:readonly LabSample[],label:string):string|null{
  const seq=sortiere(pending),cur=seq.findIndex(r=>r.label===label),others=seq.filter(r=>r.label!==label);
  if(!others.length)return null;
  if(cur>=0){
    const key=raumVon(seq[cur]).key,same=others.filter(r=>raumVon(r).key===key);
    if(same.length)return (same.find(r=>seq.indexOf(r)>cur)||same[0]).label;
  }
  return (others.find(r=>seq.indexOf(r)>cur)||others[0]).label;
}
/** Anzeige im Hinweisfeld: „P11 · EG Flur · Decke · Untersicht“ (die Beschreibung aus LabelKit enthält den Raum bereits). */
export function jetztText(r:LabSample):string{
  const teile=(r.desc||'').split(/,\s*/).map(s=>s.trim()).filter(Boolean);
  if(r.raum&&!teile.some(t=>t.toLowerCase()===r.raum!.toLowerCase()))teile.unshift(r.raum);
  if(!teile.length&&r.ref)teile.push(r.ref);
  return [r.label,...teile].join(' · ');
}
