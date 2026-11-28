// PlanKit 2.7.0 – Ortstermin je Probe (Stufe 3; plankit-ortstermine-plan.md, Entscheidungen T1–T18). Nur rechnen: kein Lesen,
// kein Schreiben. Der Termin einer Probe wird bei jedem Zeichnen neu gerechnet – in der .probenplan steht nichts Neues (T1, T12).
//  - Tage = Datum von Termin 1 („ortstermin“) und der weiteren Termine (Ortstermine.liste), nur gültige Daten; je Tag EIN Eintrag mit den
//    Bezeichnungen aller Termine dieses Tages (T13: gerechnet wird nach dem Tag, nicht nach der Kennung).
//  - Mehrere Termine = mindestens zwei verschiedene Tage oder ein Tag, der nicht Termin 1 ist. Sonst gilt überall „wie heute“.
//  - Datum einer Probe (T2): aus der aktuellen LabelKit-Datei dieses Projekts (über die P-Nummer), sonst das Datum am Punkt bzw. an
//    der offenen Probe. Termin = der Tag mit genau diesem Datum – kein Datum oder kein passender Tag → „ohne Termin“ mit Grund. Nie
//    geraten, nie der nächstgelegene. Von Hand gesetzte Proben haben kein Datum und bleiben „ohne Termin“ (T16, kein Datumsfeld).
//  - Gelbe Zeile (T14) nur, wenn LabelKit-Datum und Datum am Punkt zu verschiedenen Terminen führen (oder eines zu keinem).
//  - Brandherde und Flächen haben keinen Termin und gehören zu jeder Ansicht (T4).
import './ortstermine.js';
import {GRAU,BLASS,TERMIN,type Marker,type Project,type LabSample,type TerminKopf} from './model';

export interface Tag {datum:string;ids:string[];bezeichnungen:string[];erster:boolean}
export interface Zuordnung {tag:string|null;datum:string;quelle:'labelkit'|'punkt'|'';grund:string;abweichung:string}
export interface Wahl {tag:string;frueher:'grau'|'weg'}
export type Rolle='normal'|'grau'|'weg';
export type LkDaten=ReadonlyMap<string,string>;

const ISO=/^\d{4}-\d{2}-\d{2}$/;
const OT=()=>(globalThis as unknown as {Ortstermine:typeof Ortstermine}).Ortstermine;
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
const gueltig=(v:unknown):v is string=>typeof v==='string'&&ISO.test(v)&&OT().gueltig(v);
/** „20.08.“ bzw. mit Jahr „20.08.2026“. */
export const kurz=(iso:string)=>ISO.test(iso)?`${iso.slice(8,10)}.${iso.slice(5,7)}.`:iso;
export const lang=(iso:string)=>ISO.test(iso)?`${iso.slice(8,10)}.${iso.slice(5,7)}.${iso.slice(0,4)}`:iso;

/** Tage des Projekts, aufsteigend. pj = _Projekt.json (nur gelesen). */
export function tage(pj:Record<string,unknown>|null|undefined):Tag[]{
  if(!pj||typeof pj!=='object')return [];
  const map=new Map<string,Tag>();
  const dazu=(datum:unknown,id:string,bezeichnung:unknown)=>{if(!gueltig(datum))return;let t=map.get(datum);if(!t){t={datum,ids:[],bezeichnungen:[],erster:false};map.set(datum,t);}
    if(!t.ids.includes(id))t.ids.push(id);const b=text(bezeichnung);if(b&&!t.bezeichnungen.includes(b))t.bezeichnungen.push(b);if(id==='t1')t.erster=true;};
  dazu(pj.ortstermin,'t1',pj.ortsterminBezeichnung);
  for(const e of OT().liste(pj))dazu(e.datum,String(e.id),e.bezeichnung);
  return [...map.values()].sort((a,b)=>a.datum.localeCompare(b.datum));
}
/** Mehrere Termine: zwei verschiedene Tage, oder ein Tag, der nicht Termin 1 ist. Sonst „wie heute“ (nichts davon sichtbar). */
export function mehrere(t:readonly Tag[]){return t.length>=2||(t.length===1&&!t[0].erster);}
/** „20.08. (Nachbeprobung)“, bei zwei Terminen am Tag „20.08. (Nachbeprobung · Freimessung)“. */
export function tagName(t:Tag,mitJahr=false){return `${mitJahr?lang(t.datum):kurz(t.datum)}${t.bezeichnungen.length?` (${t.bezeichnungen.join(' · ')})`:''}`;}

/** Probenahmedatum je P-Nummer aus einer LabelKit-Projektdatei (PAK, Chlorid, Asbest, Sonstige; erstes Vorkommen gilt). */
const LISTEN=['proben','chloridProben','asbestProben','sonstigeProben'];
export function labelkitDaten(data:unknown):Map<string,string>{
  const out=new Map<string,string>(),d=data as Record<string,unknown>|null;if(!d||typeof d!=='object')return out;
  for(const key of LISTEN)for(const raw of (Array.isArray(d[key])?d[key] as Record<string,unknown>[]:[])){
    if(!raw||typeof raw!=='object'||raw.storniert)continue;   // storniert: keine Probe mehr (wie labelkitReport)
    let n=0;for(const v of [raw._nr,raw.chloridNr,raw.id]){const x=Number(v);if(Number.isSafeInteger(x)&&x>0&&x<1e9){n=x;break;}}
    if(!n||out.has(`P${n}`))continue;
    const s=text(raw.datum),m=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s),iso=m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:s;
    out.set(`P${n}`,gueltig(iso)?iso:'');
  }
  return out;
}
const tagVon=(datum:string,t:readonly Tag[])=>datum?t.find(x=>x.datum===datum)?.datum??null:null;
/** Termin (Tag) einer Probe. vonHand: Punkt ohne Labordaten (eigene Probe) – hat nie ein Datum (T16). */
export function zuordnen(label:string,punkt:string|undefined,lk:LkDaten|null,t:readonly Tag[],vonHand=false):Zuordnung{
  // Kennt LabelKit die Probe, zählt nur ihr Datum dort – auch wenn es fehlt (dann „ohne Termin“, nie das ältere Datum am Punkt; Codex #99)
  const imLk=!vonHand&&!!lk?.has(label),p=gueltig(punkt)?punkt:'',l=imLk?lk!.get(label)||'':'',datum=imLk?l:p,quelle=l?'labelkit':datum?'punkt':'',tag=tagVon(datum,t);
  let abweichung='';
  if(l&&p&&l!==p){const a=tagVon(l,t),b=tagVon(p,t);if(a!==b)abweichung=`${label}: laut LabelKit ${kurz(l)}, am Punkt ${kurz(p)} – Proben übernehmen`;}
  const grund=tag?'':!datum?(vonHand?'von Hand gesetzt – kein Probenahmedatum':imLk?'kein Probenahmedatum in LabelKit':'kein Probenahmedatum'):`Probenahmedatum ${lang(datum)} passt zu keinem Ortstermin`;
  return {tag,datum,quelle,grund,abweichung};
}

/** Rolle einer Probe in einer Ausgabe: gewählter Tag normal; frühere grau (oder weg); spätere und „ohne Termin“ weg; „alle“: alles normal. */
export function rolle(z:Zuordnung,w:Wahl):Rolle{
  if(w.tag==='alle')return 'normal';
  if(!z.tag)return 'weg';
  if(z.tag===w.tag)return 'normal';
  return z.tag<w.tag&&w.frueher==='grau'?'grau':'weg';
}
/** Vorwahl (E6): der neueste Tag mit mindestens einer Probe, sonst der neueste; frühere grau. */
export function vorwahl(t:readonly Tag[],zugeordnet:Iterable<Zuordnung>):Wahl{
  const mit=new Set<string>();for(const z of zugeordnet)if(z.tag)mit.add(z.tag);
  const mitProbe=t.filter(x=>mit.has(x.datum));
  return {tag:(mitProbe.at(-1)||t.at(-1))?.datum||'alle',frueher:'grau'};
}
/** Gemerkte Wahl nur, wenn ihr Tag (noch) einer der Tage ist. */
export function gueltigeWahl(v:unknown,t:readonly Tag[]):Wahl|null{
  const w=v as Partial<Wahl>|null;if(!w||typeof w!=='object')return null;
  const frueher=w.frueher==='weg'?'weg':w.frueher==='grau'?'grau':null;if(!frueher)return null;
  if(w.tag==='alle'||(typeof w.tag==='string'&&t.some(x=>x.datum===w.tag)))return {tag:w.tag,frueher};
  return null;
}
/** Link „mitteilung=m2“ (T11, nur lesen): Tage der Termine dieser Mitteilung. Ein Tag → dieser, frühere grau. Alle Tage des Projekts →
 *  „alle Termine“. Mehrere, aber nicht alle → der neueste davon, mit Satz. Unbekannte Kennung oder kein Tag → null (Vorwahl wie ohne Link). */
export function ausMitteilung(pj:Record<string,unknown>|null|undefined,id:string,t:readonly Tag[]):{wahl:Wahl;satz:string}|null{
  const l=pj&&Array.isArray(pj.weitereMitteilungen)?pj.weitereMitteilungen as Record<string,unknown>[]:[];
  const e=id?l.find(x=>x&&typeof x==='object'&&x.id===id):undefined;if(!e||!Array.isArray(e.termine))return null;
  const ids=(e.termine as unknown[]).map(String),meine=t.filter(x=>x.ids.some(i=>ids.includes(i)));if(!meine.length)return null;
  if(meine.length===1)return {wahl:{tag:meine[0].datum,frueher:'grau'},satz:''};
  if(meine.length===t.length)return {wahl:{tag:'alle',frueher:'grau'},satz:''};
  const nr=Number.isInteger(e.nr)?`${e.nr}. Mitteilung`:'Mitteilung',namen=meine.map(x=>kurz(x.datum));
  return {wahl:{tag:meine.at(-1)!.datum,frueher:'grau'},satz:`${nr}: Termine ${namen.slice(0,-1).join(', ')} und ${namen.at(-1)}`};
}

/** Ortstermin für Fußzeile („Ortstermin 20.08.2026 (Nachbeprobung)“ bzw. „Ortstermine 12.08. · 20.08.2026“) und Schriftfeld
 *  (Feldname „Ortstermin · Nachbeprobung“, Wert „20.08.2026“ – das Datum wird nie abgeschnitten). */
export function terminKopf(w:Wahl,t:readonly Tag[]):TerminKopf{
  if(w.tag!=='alle'){const x=t.find(y=>y.datum===w.tag);if(!x)return {titel:'',feld:'',wert:''};
    return {titel:`Ortstermin ${tagName(x,true)}`,feld:`Ortstermin${x.bezeichnungen.length?` · ${x.bezeichnungen.join(' · ')}`:''}`,wert:lang(x.datum)};}
  if(!t.length)return {titel:'',feld:'',wert:''};const jahr=t.at(-1)!.datum.slice(0,4);
  const wert=t.map((x,i)=>i===t.length-1||x.datum.slice(0,4)!==jahr?lang(x.datum):kurz(x.datum)).join(' · ');
  return {titel:`Ortstermine ${wert}`,feld:'Ortstermine',wert};
}
/** Legendenzeile für graue Proben: „grau: Proben vom 12.08.2026“ (mehrere Tage: „vom 12.08. · 15.08.2026“). */
export function grauText(tageGrau:readonly string[]){
  const d=[...new Set(tageGrau)].filter(x=>ISO.test(x)).sort();if(!d.length)return '';const jahr=d.at(-1)!.slice(0,4);
  return `grau: Proben vom ${d.map((x,i)=>i===d.length-1||x.slice(0,4)!==jahr?lang(x):kurz(x)).join(' · ')}`;
}

/* ---------- Dateinamen (gemeinsame Namensregel; BerichtKit 1.27.0 und Projektzentrale 1.56.0 lesen sie) ----------
   Pläne/Probenplan <Ordner>[ - <Plan/Geschoss>][ - Termin TT.MM.JJJJ | - alle Termine][ - Ergebniskarte][ (k)].pdf
   Ein Termin: ohne Zusatz, genau wie bis 2.6.3. Mehrere Termine: immer mit Zusatz – auch für den Tag von Termin 1 (T5, T6). */
export function terminZusatz(tag:string){return tag==='alle'?' - alle Termine':ISO.test(tag)?` - Termin ${lang(tag)}`:'';}
export function planDateiName(basis:string,floor:string,tag:string,ergebnis:boolean,ext:string){
  return `${`${basis}${floor?` - ${floor}`:''}${terminZusatz(tag)}${ergebnis?' - Ergebniskarte':''}`.replace(/[<>:"/\\|?*]/g,'_')}.${ext}`;
}
/** Teil im Namen der Anlage Probenahme: „Termin-20-08-2026“ bzw. „alle-Termine“ (ein Termin: leer). */
export function anlageTerminTeil(tag:string){return tag==='alle'?'alle-Termine':ISO.test(tag)?`Termin-${tag.slice(8,10)}-${tag.slice(5,7)}-${tag.slice(0,4)}`:'';}

/* ---------- Plannamen-Schutz ----------
   Wie BerichtKit 1.27.0 / Projektzentrale 1.56.0 (anlagen.js, „verdächtig“): Pläne mit diesen Namen lassen sie im Termin-Betrieb aus.
   „Termine“, „2. Termin“ und „Terminal“ bleiben erlaubt (PlanKit schreibt bei mehreren Terminen immer einen gültigen Zusatz). */
const ERGEBNIS_WORT=/(?:^|[\s.-])ergebniskarten?(?![a-zäöüß])/i,TERMIN_NAME=/(?:^|[\s.-])(?:termin \d{1,2}\.\d{1,2}\.\d{2,4}|alle termine)(?![a-zäöüß0-9])/i;
export function planNameProblem(name:string){
  const n=String(name).normalize('NFC').replace(/\s+/g,' ').trim(),z=n.replace(/[<>:"/\\|?*]/g,'_');
  if(TERMIN_NAME.test(n)||TERMIN_NAME.test(z))return `„${n}“ geht als Name eines Plans nicht: BerichtKit und die Projektzentrale würden darin einen Ortstermin lesen. Bitte einen Namen wie „EG“ oder „1. OG“ wählen.`;
  if(ERGEBNIS_WORT.test(n)||ERGEBNIS_WORT.test(z))return `„${n}“ geht als Name eines Plans nicht: BerichtKit und die Projektzentrale würden darin eine Ergebniskarte lesen. Bitte einen Namen ohne „Ergebniskarte“ wählen.`;
  return '';
}

/* ---------- Termin-Ansicht (nur im Speicher) ----------
   Vor Bild, PDF, Blatt mit Schriftfeld und den Lageplänen der Anlage: Proben nach ihrer Rolle normal, grau (Symbol GRAU – nie in einer
   Datei, JSON kennt keine Symbole) oder weg. anzeige: für die Karte in ② – „weg“ bleibt blass sichtbar (BLASS), damit man es greifen kann.
   Offene Proben: nur die des gewählten Tags (für die Anlage). Brandherde und Flächen bleiben (T4). */
export type ZuordnungVon=(label:string,datum:string|undefined,vonHand:boolean)=>Zuordnung;
export function ansicht(p:Project,zu:ZuordnungVon,w:Wahl,kopf:TerminKopf,anzeige=false):Project{
  const markers=(list:Marker[])=>list.flatMap(m=>{if(m.kind!=='sample')return [m];const z=zu(m.label,m.lab?.datum,!m.lab),r=rolle(z,w);
    return r==='normal'?[m]:r==='grau'?[{...m,[GRAU]:z.tag!}]:anzeige?[{...m,[BLASS]:true as const}]:[];});
  const pending=(list:LabSample[])=>list.filter(s=>rolle(zu(s.label,s.datum,false),w)==='normal');
  return {...p,[TERMIN]:kopf,markers:markers(p.markers),...(p.sheets?{sheets:p.sheets.map((s,i)=>i===(p.active??0)||!s.markers?s:{...s,markers:markers(s.markers)})}:{}),...(p.pending?{pending:pending(p.pending)}:{})};
}
