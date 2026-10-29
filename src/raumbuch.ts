// Raumbuch: je Raum Befund (Proben, Brandherd), Bewertung (Skala der Ergebniskarte), Maßnahme und Bemerkung.
// Befund und Bewertung werden immer aus den Proben berechnet und nie gespeichert. Gespeichert (Project.raumbuch) werden nur
// Eingaben des Sachverständigen: Maßnahme, Bemerkung, Räume ohne Probe mit Status, zusammengeführte Schreibweisen.
// Keine Flächen und keine Mengen: die Mengenermittlung bleibt beim ausführenden Unternehmen.
import {clone,floorName,sheetCount,sheetProject,SURFACE_NAMES,type Marker,type Project,type RaumEintrag,type RaumStatus,type Raumbuch} from './model';
import {hasValues,prepare,rateMarkers,shortParameter,valueOf,wertFuer,type Rated} from './results';
import {STIL,type Block,type Cell,type Row} from './docx';
import {scaleNotes} from './annex';

export const STATUS_TEXT:Record<RaumStatus,string>={unauffaellig:'Sichtprüfung unauffällig',auffaellig:'Sichtprüfung auffällig',nicht_begangen:'nicht begangen / nicht zugänglich'};
export const FOOTNOTE_MENGEN='Flächenangaben und Mengenermittlung obliegen dem ausführenden Unternehmen.';

/** Schlüssel für „gleicher Raum“: Groß-/Kleinschreibung, Umlaute (ä = ae), Leerzeichen und Satzzeichen zählen nicht. */
export function norm(s:string){
  return String(s||'').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'');
}
export const roomKey=(floor:string,name:string)=>`${norm(floor)}|${norm(name)}`;

const FLOOR_RE=/^(KG|UG|EG|DG|SB|OG|\d+\s*\.\s*OG|\d+\s*\.\s*UG|\d+\s*OG)(?=$|[\s,:/_-])[\s,:/_-]*/i;
/** Geschoss am Anfang des Raumnamens („EG Küche“, „1. OG Bad“) in einheitlicher Schreibweise. */
function floorPrefix(name:string){const m=FLOOR_RE.exec(name.trim());if(!m)return null;
  const f=m[1].toUpperCase().replace(/\s+/g,'').replace(/^(\d+)\.?(OG|UG)$/,'$1. $2');return {floor:f,rest:name.trim().slice(m[0].length).trim()};}
/** Geschoss und Raumname: Der Plan gibt das Geschoss vor (ein gleichlautender Präfix im Namen entfällt);
 *  ohne benannten Plan wird ein Präfix wie „EG“ als Geschoss gelesen. */
/** Wischprobenbezeichnung nach AidKit (ab 1.34): von groß nach klein, mit Leerzeichen wie in LabelKit –
 *  „Gebäude Geschoss Raum Zusatz Bauteil“, z. B. „EG Küche Brandraum Decke“ oder „Haus A 1OG Bad Wand B“.
 *  Im Raumbuch ist der Raum = Gebäude (falls vorhanden) + Raum; Zusatz und Bauteil gehören zur Probe, nicht zum Raum.
 *  Erkannt wird das Ende des Raumnamens an den Wörtern aus dem AidKit-Baukasten (Zusätze, Bauteile, Beaufschlagung,
 *  Oberflächenart). Ohne eigenes Geschoss-Wort oder wenn vor dem ersten solchen Wort kein Raum steht: null, alles wie bisher.
 *  „ · “ als Trenner wird ebenfalls verstanden. */
const ENDE_WORT=new Set(['brandraum','brandbereich','brandherd','referenz','unbelastet','ref','verdacht','kleber','teer','bitumen','freimessung',
  'decke','boden','wand','fenster','fensterbank','tür','türzarge','zarge','heizkörper','möbel','einbauten','elektro','leitungen',
  'gereinigt','verrußt','aufsicht','ansicht','untersicht']);
const NACH_MIT=new Set(['belag','ruß','russ','kondensat','staub']);
function istEnde(w:string[],i:number){
  const x=w[i].toLowerCase().replace(/[,;:]+$/,''),erst=x.split('/')[0];
  if(ENDE_WORT.has(x)||ENDE_WORT.has(erst))return true;
  if(x==='mit'&&NACH_MIT.has((w[i+1]||'').toLowerCase()))return true;
  if(x==='leicht'&&/^verru(ß|ss)t$/i.test(w[i+1]||''))return true;
  return false;
}
function wortRaum(raw:string):{floor:string;name:string}|null{
  const w=raw.replace(/·/g,' ').replace(/(\d+)\s*\.\s*(OG|UG)(?=\s|$)/gi,'$1.$2').split(/\s+/).filter(Boolean);
  const i=w.findIndex(x=>{const p=floorPrefix(x);return !!p&&!p.rest;});if(i<0)return null;
  const rest=w.slice(i+1);let j=rest.findIndex((_,k)=>istEnde(rest,k));if(j<0)j=rest.length;
  if(j===0)return null;
  return {floor:floorPrefix(w[i])!.floor,name:[...w.slice(0,i),...rest.slice(0,j)].join(' ')};
}
export function splitRoom(sheetFloor:string,raw:string):{floor:string;name:string}{
  const wort=wortRaum(raw.trim());
  if(wort){if(!sheetFloor)return wort;return {floor:sheetFloor,name:norm(wort.floor)===norm(sheetFloor)?wort.name:`${wort.floor} ${wort.name}`};}
  const name=raw.trim(),pre=floorPrefix(name);
  if(sheetFloor){if(pre&&pre.rest&&norm(pre.floor)===norm(sheetFloor))return {floor:sheetFloor,name:pre.rest};return {floor:sheetFloor,name};}
  if(pre&&pre.rest)return {floor:pre.floor,name:pre.rest};
  return {floor:'',name};
}
export function floorRank(f:string){const n=norm(f);if(!n)return 1000;if(n==='kg'||n==='ug'||/^\dug$/.test(n))return -1;if(n==='eg')return 0;
  const og=/^(\d+)og$/.exec(n);if(og)return Number(og[1]);if(n==='og')return 1;if(n==='dg')return 50;if(n==='sb')return 60;return 500;}
function resolve(alias:Record<string,string>|undefined,key:string){let k=key;for(let i=0;i<10&&alias?.[k];i++)k=alias[k];return k;}

export interface RaumProbe {label:string;wert:string;flaeche:string;placed:boolean}
export interface RaumZeile {
  key:string;floor:string;name:string;probes:RaumProbe[];brandherd:boolean;sampled:boolean;
  bewertung:string;auffaellig:boolean;offen:boolean;status?:RaumStatus;massnahme:string;bemerkung:string;order:number;
}
export interface RaumbuchStand {rows:RaumZeile[];ohneRaum:string[];doppelt:[RaumZeile,RaumZeile][];parameter:string;skalen:string[]}

type Rating={rank:number;name:string;top:boolean}|{rank:-1;name:'unter BG'|'n. n.';top:false}|{rank:-2;name:'n. b.'|'ohne Bewertung';top:false};
function ratings(rated:Rated|null){
  const out=new Map<string,Rating>();if(!rated)return out;
  for(const g of rated.groups)g.cats.forEach((c,i)=>{for(const l of c.labels)out.set(l,{rank:g.cats.length>1?i/(g.cats.length-1):0,name:c.name,top:i>0});});
  for(const l of rated.below)out.set(l,{rank:-1,name:'unter BG',top:false});
  for(const l of rated.notDetected)out.set(l,{rank:-1,name:'n. n.',top:false});
  for(const l of rated.notDetermined)out.set(l,{rank:-2,name:'n. b.',top:false});
  for(const l of rated.unrated)out.set(l,{rank:-2,name:'ohne Bewertung',top:false});
  return out;
}
const order=(a:string,b:string)=>a.localeCompare(b,'de',{numeric:true});
const labelNo=(l:string)=>{const m=/(\d+)/.exec(l);return m?Number(m[1]):1e9;};

/** Eingaben aus der Zeit vor 1.34 stehen unter dem vollen Namen, z. B. „EG“ / „Küche Brandraum Decke“. Hat dieser Name
 *  keine Proben mehr, wohl aber der Raum nach der Handbuch-Regel („Küche“), gehören Maßnahme und Bemerkung dorthin:
 *  leere Felder werden gefüllt, abweichende Texte mit „; “ angehängt; Eingaben, die schon beim Raum stehen, gehen vor.
 *  Gibt dieselbe Liste zurück, wenn nichts zu übertragen ist. */
function migriereEintraege(p:Project):RaumEintrag[]{
  const rb=p.raumbuch;if(!rb?.rooms.length)return rb?.rooms||[];
  const beprobt=new Set(raumbuchStand({...p,raumbuch:{rooms:[],...(rb.alias?{alias:rb.alias}:{})}}).rows.filter(r=>r.sampled).map(r=>r.key));
  const keyOf=(e:{floor:string;name:string})=>resolve(rb.alias,roomKey(e.floor,e.name));
  const ziel=(e:RaumEintrag)=>{
    if(beprobt.has(keyOf(e)))return null;
    const w=wortRaum(`EG ${e.name}`);if(!w)return null;
    const c={floor:e.floor,name:w.name};return keyOf(c)!==keyOf(e)&&beprobt.has(keyOf(c))?c:null;
  };
  const alt=rb.rooms.map(e=>({e,c:ziel(e)}));if(!alt.some(x=>x.c))return rb.rooms;
  const out:RaumEintrag[]=alt.filter(x=>!x.c).map(x=>({...x.e}));
  for(const {e,c} of alt){
    if(!c)continue;
    const i=out.findIndex(x=>keyOf(x)===keyOf(c)),t:RaumEintrag=i>=0?out[i]:{floor:c.floor,name:c.name};
    for(const f of ['massnahme','bemerkung'] as const){const v=e[f];if(!v)continue;if(!t[f])t[f]=v;else if(!t[f]!.split('; ').includes(v))t[f]=`${t[f]}; ${v}`.slice(0,500);}
    if(i<0&&(t.massnahme||t.bemerkung))out.push(t);
  }
  return out;
}
/** Übertragene Eingaben im Projekt festschreiben, bevor das Raumbuch geändert wird. */
function migriereGespeichert(p:Project){
  if(!p.raumbuch)return;const rooms=migriereEintraege(p);if(rooms!==p.raumbuch.rooms)p.raumbuch={...p.raumbuch,rooms};
}

/** Raumbuch aus dem Projekt berechnen (Projekt bleibt unverändert). */
export function raumbuchStand(source:Project):RaumbuchStand{
  const p=clone(source);if(hasValues(p))prepare(p);
  if(p.raumbuch?.rooms.length){const rooms=migriereEintraege(p);if(rooms!==p.raumbuch.rooms)p.raumbuch={...p.raumbuch,rooms};}
  const parameter=p.results?.parameter||'',rb:Raumbuch=p.raumbuch||{rooms:[]},alias=rb.alias;
  const rows=new Map<string,RaumZeile>(),ohneRaum:string[]=[],firstName=new Map<string,string>();
  // Ein einzelner Plan hat keinen Blattnamen: Geschoss dann aus dem Plannamen („EG.pdf“, „1. OG Grundriss.svg“), sonst keins.
  const singleFloor=sheetCount(p)<=1?floorPrefix(String(p.plan?.name||'').replace(/\.[a-z0-9]{2,4}$/i,'')+' ')?.floor||'':'';
  const sheetOrder=new Map<string,number>();for(let i=0;i<sheetCount(p);i++){const f=floorName(p,i);if(f&&!sheetOrder.has(norm(f)))sheetOrder.set(norm(f),i);}
  const rowFor=(floor:string,name:string)=>{
    const own=roomKey(floor,name),key=resolve(alias,own);
    if(own===key&&!firstName.has(key))firstName.set(key,name);
    let r=rows.get(key);
    if(!r){r={key,floor,name,probes:[],brandherd:false,sampled:false,bewertung:'',auffaellig:false,offen:false,massnahme:'',bemerkung:'',order:1e9};rows.set(key,r);}
    return r;
  };
  const best=new Map<string,Rating>();
  const add=(m:{label:string;kind:Marker['kind'];raum?:string;surface?:Marker['surface']},floorOfSheet:string,value:string,rating:Rating|undefined,placed:boolean)=>{
    if(!m.raum?.trim()){if(m.kind==='sample')ohneRaum.push(m.label);return;}
    const {floor,name}=splitRoom(floorOfSheet,m.raum),r=rowFor(floor,name);
    if(m.kind==='fire'){r.brandherd=true;return;}
    r.sampled=true;r.order=Math.min(r.order,labelNo(m.label));
    r.probes.push({label:m.label,wert:value,flaeche:m.surface&&m.surface!=='other'?SURFACE_NAMES[m.surface]:'',placed});
    if(!value)r.offen=true;
    if(rating){const b=best.get(r.key);if(!b||rating.rank>b.rank)best.set(r.key,rating);}
  };
  for(let i=0;i<sheetCount(p);i++){
    const view=sheetProject(p,i),rated=parameter?rateMarkers(view):null,rt=ratings(rated),floor=floorName(p,i)||singleFloor;
    for(const m of view.markers){const w=parameter&&m.kind==='sample'?valueOf(m,parameter):undefined;add(m,floor,w?`${w.r} ${w.u}`.trim():'',w?rt.get(m.label):undefined,true);}
  }
  // Noch nicht platzierte Proben mit Laborwerten werden nach derselben Skala bewertet wie die platzierten.
  const pending=p.pending||[],pseudo:Marker[]=pending.map((r,i)=>({id:`pending-${i}`,kind:'sample',label:r.label,note:'',x:0,y:0,lx:0,ly:0,lab:{ref:r.ref,desc:r.desc,werte:r.werte}}));
  const rtPending=parameter?ratings(rateMarkers(p,pseudo)):new Map<string,Rating>();
  pending.forEach(r=>{const w=parameter?wertFuer(r.werte,parameter):undefined;add({label:r.label,kind:'sample',raum:r.raum,surface:r.surface},singleFloor,w?`${w.r} ${w.u}`.trim():'',w?rtPending.get(r.label):undefined,false);});
  // Eingaben des Sachverständigen: an beprobte Räume anhängen oder als Räume ohne Probe aufnehmen
  for(const e of rb.rooms){const r=rowFor(e.floor,e.name);r.massnahme=e.massnahme||'';r.bemerkung=e.bemerkung||'';if(!r.sampled&&!r.brandherd)r.status=e.status||'unauffaellig';else if(!r.sampled)r.status=e.status;}
  for(const r of rows.values()){
    r.name=firstName.get(r.key)||r.name;
    const b=best.get(r.key);
    if(r.sampled){
      r.bewertung=b?b.name:r.offen?'Laborwerte ausstehend':'ohne Bewertung';r.auffaellig=!!b&&b.top;
      if(b&&r.offen)r.bewertung+=' (Werte teils ausstehend)';
    }else r.bewertung=r.status?STATUS_TEXT[r.status]:r.brandherd?'Brandherd, nicht beprobt':'';
    r.auffaellig||= r.status==='auffaellig';
  }
  const list=[...rows.values()].sort((a,b)=>{
    const fa=sheetOrder.get(norm(a.floor))??(100+floorRank(a.floor)),fb=sheetOrder.get(norm(b.floor))??(100+floorRank(b.floor));
    return fa-fb||(a.sampled===b.sampled?0:a.sampled?-1:1)||a.order-b.order||order(a.name,b.name);
  });
  return {rows:list,ohneRaum:ohneRaum.sort(order),doppelt:aehnlich(list),parameter,skalen:scaleNotes(p)};
}

function lev(a:string,b:string){if(Math.abs(a.length-b.length)>1)return 2;const d=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){let prev=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const tmp=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=tmp;}}return d[b.length];}
/** Vermutlich gleiche Räume mit anderer Schreibweise („Küche“ / „Kü.“ / „Kueche“ ist schon gleich), nur im selben Geschoss.
 *  Unterschiedliche Nummern („Zimmer 1“ / „Zimmer 2“) gelten nie als gleich. */
export function aehnlich(rows:RaumZeile[]):[RaumZeile,RaumZeile][]{
  const out:[RaumZeile,RaumZeile][]=[];
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=rows[i],b=rows[j];if(norm(a.floor)!==norm(b.floor))continue;
    const x=norm(a.name),y=norm(b.name),dx=x.replace(/\D/g,''),dy=y.replace(/\D/g,'');if(x===y||((dx||dy)&&dx!==dy))continue;
    const [s,l]=x.length<=y.length?[x,y]:[y,x];
    if((s.length>=3&&l.startsWith(s))||(s.length>=4&&lev(x,y)<=1))out.push([a,b]);}
  return out;
}

/** Eingabe zu einem Raum speichern (Maßnahme, Bemerkung, Status); leere Einträge ohne Status verschwinden. */
export function setEintrag(p:Project,row:{floor:string;name:string;sampled:boolean;brandherd?:boolean},patch:Partial<Omit<RaumEintrag,'floor'|'name'>>){
  migriereGespeichert(p);
  const rb:Raumbuch=p.raumbuch||{rooms:[]},key=resolve(rb.alias,roomKey(row.floor,row.name));
  const idx=rb.rooms.findIndex(e=>resolve(rb.alias,roomKey(e.floor,e.name))===key);
  const cur:RaumEintrag=idx>=0?{...rb.rooms[idx]}:{floor:row.floor,name:row.name};
  for(const [k,v] of Object.entries(patch) as [keyof RaumEintrag,string|undefined][]){const s=typeof v==='string'?v.trim().slice(0,500):v;if(s)(cur as unknown as Record<string,string>)[k]=s;else delete cur[k];}
  const keep=!!(cur.massnahme||cur.bemerkung||(!row.sampled&&cur.status)||(!row.sampled&&!row.brandherd));
  const rooms=rb.rooms.slice();if(idx>=0){if(keep)rooms[idx]=cur;else rooms.splice(idx,1);}else if(keep)rooms.push(cur);
  p.raumbuch={rooms,...(rb.alias?{alias:rb.alias}:{})};if(!rooms.length&&!rb.alias)delete p.raumbuch;
}
/** Raum ohne Probe hinzufügen (Status Sichtprüfung unauffällig). */
export function addRaum(p:Project,floor:string,name:string){
  migriereGespeichert(p);
  const f=floor.trim().slice(0,40),n=name.trim().slice(0,80);if(!n)throw Error('Bitte einen Raumnamen eingeben.');
  const key=roomKey(f,n);if(raumbuchStand(p).rows.some(r=>r.key===resolve(p.raumbuch?.alias,key)))throw Error(`„${n}“ steht bereits im Raumbuch.`);
  p.raumbuch={rooms:[...(p.raumbuch?.rooms||[]),{floor:f,name:n,status:'unauffaellig'}],...(p.raumbuch?.alias?{alias:p.raumbuch.alias}:{})};
}
/** Raum ohne Probe entfernen. */
export function removeRaum(p:Project,floor:string,name:string){
  migriereGespeichert(p);
  if(!p.raumbuch)return;const key=resolve(p.raumbuch.alias,roomKey(floor,name));
  const rooms=p.raumbuch.rooms.filter(e=>resolve(p.raumbuch!.alias,roomKey(e.floor,e.name))!==key);
  p.raumbuch={rooms,...(p.raumbuch.alias?{alias:p.raumbuch.alias}:{})};if(!rooms.length&&!p.raumbuch.alias)delete p.raumbuch;
}
/** Schreibweise „von“ in den Raum „nach“ zusammenführen; Eingaben von „von“ füllen nur leere Felder von „nach“. */
export function mergeRaum(p:Project,von:RaumZeile,nach:RaumZeile){
  migriereGespeichert(p);
  if(von.key===nach.key)return;
  const alias={...(p.raumbuch?.alias||{})};
  for(const [k,v] of Object.entries(alias))if(v===von.key)alias[k]=nach.key;
  alias[von.key]=nach.key;
  const rooms=(p.raumbuch?.rooms||[]).slice(),stay=rooms.filter(e=>roomKey(e.floor,e.name)!==von.key);
  const old=rooms.find(e=>roomKey(e.floor,e.name)===von.key),tgt=stay.findIndex(e=>roomKey(e.floor,e.name)===nach.key);
  if(old&&(old.massnahme||old.bemerkung)){
    if(tgt>=0)stay[tgt]={...stay[tgt],...(stay[tgt].massnahme?{}:old.massnahme?{massnahme:old.massnahme}:{}),...(stay[tgt].bemerkung?{}:old.bemerkung?{bemerkung:old.bemerkung}:{})};
    else stay.push({floor:nach.floor,name:nach.name,...(old.massnahme?{massnahme:old.massnahme}:{}),...(old.bemerkung?{bemerkung:old.bemerkung}:{})});
  }
  p.raumbuch={rooms:stay,alias};
}

export interface Pruefhinweis {text:string;detail?:string}
export function pruefhinweise(s:RaumbuchStand):Pruefhinweis[]{
  const out:Pruefhinweis[]=[];
  const ohneMassnahme=s.rows.filter(r=>r.auffaellig&&!r.massnahme);
  if(ohneMassnahme.length)out.push({text:`${ohneMassnahme.length} auffällige${ohneMassnahme.length===1?'r Raum':' Räume'} ohne Maßnahme`,detail:ohneMassnahme.map(r=>[r.floor,r.name].filter(Boolean).join(' ')).join(', ')});
  if(s.ohneRaum.length)out.push({text:`${s.ohneRaum.length} Probe${s.ohneRaum.length===1?'':'n'} ohne Raum – nicht im Raumbuch`,detail:s.ohneRaum.join(', ')});
  const offen=s.rows.filter(r=>r.offen);if(offen.length)out.push({text:`In ${offen.length} ${offen.length===1?'Raum':'Räumen'} fehlen noch Laborwerte`});
  if(s.doppelt.length)out.push({text:`${s.doppelt.length} Paar${s.doppelt.length===1?'':'e'} ähnlicher Raumnamen – gleicher Raum?`,detail:s.doppelt.map(([a,b])=>`„${a.name}“ / „${b.name}“`).join(', ')});
  return out;
}

const befund=(r:RaumZeile)=>[...r.probes.map(x=>`${x.label}${x.wert?` ${x.wert}`:' (Wert ausstehend)'}${x.flaeche?` · ${x.flaeche}`:''}${x.placed?'':' (nicht im Plan)'}`),...(r.brandherd?['Brandherd']:[])];

const W=9070;
const P=(text:string,o:Record<string,unknown>={})=>({t:'p' as const,text,size:11,...o});
const small=(text:string,o:Record<string,unknown>={})=>STIL.hinweis(text,o);
const th=(text:string):Cell=>({text,b:true,size:8.5});
export interface RaumbuchKopf {title:string;nr:string;ort:string;projectData:Record<string,unknown>;created:string;app:string;source:string;hinweis?:string}
/** Word-Anlage: Kopf, Tabelle je Raum, Fußnoten. */
export function raumbuchBlocks(s:RaumbuchStand,k:RaumbuchKopf):Block[]{
  const t=(v:unknown)=>v==null?'':String(v).trim(),b:Block[]=[];
  b.push(STIL.titel(`${k.title}: Raumbuch`));
  b.push(STIL.unterzeile(`Projekt ${k.nr}${k.ort?` · ${k.ort}`:''}${t(k.projectData.objekt)?` · ${t(k.projectData.objekt)}`:''}`,{after:60}));
  const info=[t(k.projectData.nutzung)?`Nutzung: ${t(k.projectData.nutzung)}`:'',s.parameter?`Bewertung: ${shortParameter(s.parameter)} (Skala siehe unten)`:''].filter(Boolean);
  if(info.length)b.push(P(info.join(' · '),{size:10,after:160}));
  const floors=s.rows.some(r=>r.floor),w=floors?[1000,1400,1950,1500,2000,1220]:[1500,2500,1700,2200,1170];
  const brich=(v:string)=>v.replace(/\//g,'/\u200B');   // „erreicht/überschritten“ darf am Schrägstrich umbrechen
  const rows:Row[]=[{header:true,cells:[...(floors?['Geschoss']:[]),'Raum','Befund','Bewertung','Maßnahme','Bemerkung'].map(th)}];
  for(const r of s.rows)rows.push({cells:[...(floors?[{text:r.floor||'–'}]:[]),{text:r.name,b:true},{text:befund(r).join('\n')||'–'},{text:brich(r.bewertung)||'–'},{text:r.massnahme||(r.auffaellig?'':'–')},{text:r.bemerkung}]});
  b.push({t:'table',widths:w,rows,size:8.5});
  b.push(small('Befund: Proben mit Messwert in der Schreibweise des Prüfberichts und Oberflächenart. „Sichtprüfung“: Raum begangen, nicht beprobt. „nicht begangen“: keine Aussage zu diesem Raum.',{before:80}));
  for(const n of s.skalen)b.push(small(`Bewertung · ${n}`));
  b.push(small('Die Bewertung ist die Zuordnung zur angegebenen Skala; sie ersetzt nicht die Bewertung im Gutachtentext.'));
  if(k.hinweis)b.push(small(k.hinweis,{b:true}));
  b.push(small(FOOTNOTE_MENGEN,{b:true}));
  if(s.ohneRaum.length)b.push(small(`Ohne Raumangabe und daher nicht aufgeführt: ${s.ohneRaum.join(', ')}.`));
  b.push(small(`Erstellt ${new Date(k.created).toLocaleString('de-DE')} mit ${k.app} aus ${k.source}.`,{before:80}));
  return b;
}
/** Tabelle für die Sanierung (CSV, Semikolon, für Excel mit BOM). */
export function raumbuchCSV(s:RaumbuchStand):string{
  // Zellen, die Excel als Formel lesen würde (=, +, @, -Text), mit Apostroph entschärfen
  const safe=(v:string)=>/^[=+@\t\r]|^-\S/.test(v)?`'${v}`:v;
  const q=(raw:string)=>{const v=safe(raw);return /[";\n\r]/.test(v)?`"${v.replace(/"/g,'""')}"`:v;};
  const lines=[['Geschoss','Raum','Status','Proben','Befund','Bewertung','Maßnahme','Bemerkung'].join(';')];
  for(const r of s.rows)lines.push([r.floor,r.name,r.sampled?'beprobt':r.status?STATUS_TEXT[r.status]:r.brandherd?'Brandherd':'',r.probes.map(x=>x.label).join(', '),befund(r).join(' | '),r.bewertung,r.massnahme,r.bemerkung].map(q).join(';'));
  lines.push('');lines.push(q(FOOTNOTE_MENGEN));
  return '﻿'+lines.join('\r\n')+'\r\n';
}
export function raumbuchName(nr:string,ext:'docx'|'csv',date:string,taken:string[]){
  const s=(v:string)=>v.normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  const base=`${s(nr)||'Projekt'}_Raumbuch_${date}`,used=new Set(taken.map(n=>n.toLowerCase()));
  for(let i=1;i<1000;i++){const n=`${base}${i>1?`_${i}`:''}.${ext}`;if(!used.has(n.toLowerCase()))return n;}
  throw Error('Zu viele Raumbücher mit gleichem Namen.');
}
