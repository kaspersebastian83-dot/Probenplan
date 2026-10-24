// Wandansicht der Bohrkerne (ab 1.26): je Wand (Boden, Decke) eine Zeichnung mit den Kernen an ihrer Lage und je Kern
// einer Tiefensäule T1, T2 … mit dem Messwert und der Farbe der Einordnung, dazu eine Tabelle. Quelle der Kerne ist die
// neueste LabelKit-Datei (Bohrkern-ID, Tiefe, Material, Status, Lage aus dem Wandblatt); die Messwerte kommen aus dem
// PlanKit-Projekt über die Probennummer (P-Nummer), so wie sie der Prüfbericht liefert. Nichts wird gespeichert oder
// geschätzt: ohne Maße steht der Punkt nach dem Raster 1–9, ohne Skala gibt es keine Einordnung, nur den Wert.
import {STIL,type Block,type Cell,type Row} from './docx';
import {allMarkers,escape,type Project,type Scale,type Wert} from './model';
import {fromShared,labQualifier,labNumber,rangeText,rate,scaleFor,scaleKey,shortParameter,ink,BELOW_LIMIT,NOT_DETECTED,NOT_DETERMINED,UNRATED} from './results';

/** Bezeichnung wie AidKit (konventionen.js): Geschoss-Raum-Fläche-Punkt-Tiefe, F- = Freimessung, REF-n = Referenz. */
const MUSTER=/^(F-)?(?:(REF)-(\d{1,2})|(KG|UG|EG|[1-9]OG|DG)-([A-Z]{2,3})([1-9]?)-([A-H]|BO|DE)-([1-9]\d?)([a-z]?))(?:-T([1-9]))?$/;
const GESCHOSSE:[string,string][]=[['KG','Kellergeschoss'],['UG','Untergeschoss'],['EG','Erdgeschoss'],['1OG','1. Obergeschoss'],['2OG','2. Obergeschoss'],['3OG','3. Obergeschoss'],['DG','Dachgeschoss']];
const RAEUME:[string,string][]=[['WZ','Wohnzimmer'],['SZ','Schlafzimmer'],['KZ','Kinderzimmer'],['AZ','Arbeitszimmer'],['GZ','Gästezimmer'],['EZ','Esszimmer'],['KUE','Küche'],['BA','Bad'],['WC','Gäste-WC'],['FL','Flur, Diele'],['TH','Treppenhaus'],['HWR','Hauswirtschaftsraum'],['HK','Heizungskeller, Heizraum'],['TR','Tankraum'],['KE','Kellerraum'],['AR','Abstellraum'],['GA','Garage'],['BU','Büro'],['LA','Lager'],['WS','Werkstatt']];
const FLAECHEN=['A','B','C','D','E','F','G','H','BO','DE'];
const RASTER:Record<number,string>={1:'deckennah links',2:'deckennah Mitte',3:'deckennah rechts',4:'Mitte links',5:'Mitte',6:'Mitte rechts',7:'bodennah links',8:'bodennah Mitte',9:'bodennah rechts'};
const RASTER_BODEN:Record<number,string>={1:'Ecke A/D',2:'an Wand A, Mitte',3:'Ecke A/B',4:'an Wand D, Mitte',5:'Raummitte',6:'an Wand B, Mitte',7:'Ecke C/D',8:'an Wand C, Mitte',9:'Ecke B/C'};
export const RUECKSTELLPROBE='Rückstellprobe – nicht analysieren';

export interface WandSegment {label:string;id:string;tiefe:number;von:number|null;bis:number|null;material:string;status:'A'|'R';werte:Wert[]}
export interface WandKern {kern:string;punkt:string;nr:number;ecke:number|null;okff:number|null;geruch:string;segmente:WandSegment[]}
export interface Wand {key:string;frei:boolean;geschoss:string;raumCode:string;raum:string;flaeche:string;laenge:number|null;hoehe:number|null;kerne:WandKern[]}
export interface WandStand {waende:Wand[];referenz:WandKern[];ohneId:string[];parameter:string[]}

const t=(v:unknown)=>v==null?'':String(v).trim();
const zahl=(v:unknown)=>{if(v===''||v==null)return null;const n=typeof v==='number'?v:Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0?n:null;};
const m2=(v:number)=>v.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});
const cm=(v:number)=>v.toLocaleString('de-DE',{maximumFractionDigits:1});
export const geschossName=(k:string)=>(GESCHOSSE.find(g=>g[0]===k)||[k,k])[1];
export const flaecheName=(f:string)=>f==='BO'?'Boden':f==='DE'?'Decke':`Wand ${f}`;
const istFlaeche=(w:{flaeche:string})=>w.flaeche==='BO'||w.flaeche==='DE';

/** Bohrkerne aus der LabelKit-Datei nach Wand gruppieren, Messwerte aus dem Projekt über die P-Nummer. */
export function wandStand(daten:unknown,p:Project):WandStand{
  const werte=new Map<string,Wert[]>();
  for(const m of allMarkers(p))if(m.kind==='sample'&&m.lab?.werte?.length)werte.set(m.label,m.lab.werte);
  for(const r of p.pending||[])if(r.werte?.length&&!werte.has(r.label))werte.set(r.label,r.werte);
  const liste=(daten as {sonstigeProben?:unknown})?.sonstigeProben,waende=new Map<string,Wand>(),referenz=new Map<string,WandKern>(),ohneId:string[]=[],params:string[]=[];
  for(const raw of Array.isArray(liste)?liste:[]){
    if(!raw||typeof raw!=='object')continue;const s=raw as Record<string,unknown>;if(s.matrix!=='Bohrkern')continue;
    const n=[s._nr,s.chloridNr,s.id].map(Number).find(v=>Number.isSafeInteger(v)&&v>0&&v<1e9);if(!n)continue;
    const label=`P${n}`,id=t(s.bkId),m=MUSTER.exec(id);
    if(!m){ohneId.push(`${label}${t(s.bkBez)?` (${t(s.bkBez)})`:''}`);continue;}
    const status:'A'|'R'=t(s.bkStatus).toUpperCase()==='R'||t(s.notiz)===RUECKSTELLPROBE?'R':'A',w=status==='A'?werte.get(label)||[]:[];
    for(const x of w)if(!params.includes(x.p))params.push(x.p);
    const seg:WandSegment={label,id,tiefe:Number(m[10]||s.bkSegment)||1,von:zahl(s.bkVon),bis:zahl(s.bkBis),material:t(s.bkMaterial),status,werte:w};
    const kernId=id.replace(/-T\d$/,''),neuKern=(punkt:string,nr:number):WandKern=>({kern:kernId,punkt,nr,ecke:zahl(s.bkEcke),okff:zahl(s.bkOkff),geruch:t(s.bkGeruch),segmente:[]});
    let kern:WandKern|undefined;
    if(m[2]){kern=referenz.get(kernId)||neuKern(m[3],Number(m[3]));referenz.set(kernId,kern);}
    else{
      const key=`${m[1]||''}${m[4]}-${m[5]}${m[6]}-${m[7]}`;let wand=waende.get(key);
      if(!wand){const z2=t(s.z2).replace(new RegExp(`^${m[4]}\\s+`),'');wand={key,frei:!!m[1],geschoss:m[4],raumCode:`${m[5]}${m[6]}`,raum:z2||[(RAEUME.find(r=>r[0]===m[5])||[])[1]||m[5],m[6]].filter(Boolean).join(' '),flaeche:m[7],laenge:null,hoehe:null,kerne:[]};waende.set(key,wand);}
      wand.laenge??=zahl(s.bkWandL);wand.hoehe??=zahl(s.bkWandH);
      const punkt=`${m[8]}${m[9]}`;kern=wand.kerne.find(k=>k.kern===kernId);if(!kern){kern=neuKern(punkt,Number(m[8]));wand.kerne.push(kern);}
    }
    kern.ecke??=zahl(s.bkEcke);kern.okff??=zahl(s.bkOkff);if(!kern.geruch)kern.geruch=t(s.bkGeruch);
    kern.segmente.push(seg);
  }
  const order=(a:string,b:string)=>a.localeCompare(b,'de',{numeric:true});
  const gi=(g:string)=>{const i=GESCHOSSE.findIndex(x=>x[0]===g);return i<0?99:i;};
  const sortKerne=(k:WandKern[])=>{k.sort((a,b)=>a.nr-b.nr||order(a.punkt,b.punkt));for(const x of k)x.segmente.sort((a,b)=>a.tiefe-b.tiefe);return k;};
  const list=[...waende.values()].sort((a,b)=>Number(a.frei)-Number(b.frei)||gi(a.geschoss)-gi(b.geschoss)||order(a.raumCode,b.raumCode)||FLAECHEN.indexOf(a.flaeche)-FLAECHEN.indexOf(b.flaeche));
  for(const w of list)sortKerne(w.kerne);
  return {waende:list,referenz:sortKerne([...referenz.values()]),ohneId,parameter:params};
}

/** Vorschlag: MKW C10–C40 zuerst, C10–C22 als zweiter Wert; sonst der Parameter der Ergebniskarte. */
export function vorschlag(params:string[],ergebnis=''):[string,string]{
  const c40=params.find(x=>/C\s*10\s*[-–]\s*C?\s*40/i.test(x)),c22=params.find(x=>/C\s*10\s*[-–]\s*C?\s*22/i.test(x));
  const p1=c40||(params.includes(ergebnis)?ergebnis:params[0]||'');return [p1,c22&&c22!==p1?c22:''];
}

const C40_RE=/C\s*10\s*[-–]\s*C?\s*40/i,C22_RE=/C\s*10\s*[-–]\s*C?\s*22/i;
/** Das Paar [C10–C40, C10–C22], wenn beide als Werte gewählt sind, sonst null. */
export function kwPaar(p1:string,p2:string):[string,string]|null{const a=[p1,p2].filter(Boolean),c40=a.find(x=>C40_RE.test(x)),c22=a.find(x=>C22_RE.test(x));return c40&&c22&&c40!==c22?[c40,c22]:null;}
/** Anteil C10–C22 an C10–C40 in Prozent – nur aus den beiden Laborwerten gerechnet, keine Zuordnung zu einer Ölart.
 *  C10–C22 unter der BG („< 50“) ergibt eine Obergrenze („< 6 %“); ohne Zahl für C10–C40, bei n.n./n.b. oder
 *  verschiedenen Einheiten gibt es keinen Anteil. */
export function kwAnteil(s:WandSegment,paar:[string,string]|null):string{
  if(!paar||s.status==='R')return '';const w40=s.werte.find(x=>x.p===paar[0]),w22=s.werte.find(x=>x.p===paar[1]);
  if(!w40||!w22||w40.u.trim()!==w22.u.trim()||labQualifier(w40.r)!=='measured')return '';
  const n40=labNumber(w40.r);if(!(n40>0))return '';const pct=(v:number)=>Math.round(v/n40*100).toLocaleString('de-DE');
  const q=labQualifier(w22.r);
  if(q==='measured'){const n=labNumber(w22.r);return Number.isFinite(n)?`${pct(n)} %`:'';}
  if(q==='below'){const r=w22.r.trim().replace(/^\((.*)\)$/,'$1').trim();if(r.startsWith('<')){const g=labNumber(r.slice(1));if(Number.isFinite(g))return `< ${pct(g)} %`;}}
  return '';
}
const ANTEIL_TEXT='Anteil C10–C22 an C10–C40 in % (aus den beiden Laborwerten gerechnet; „<“: C10–C22 unter der BG). Keine Zuordnung zu einer Ölart.';

/** Skala wie in der Ergebniskarte (scaleFor: VdS, wenn vorhanden und nicht angepasst, sonst die Skala des Projekts), zuletzt aus FotoKit. Keine eigene. */
export function skalaFuer(p:Project,parameter:string,unit:string):Scale|undefined{
  return scaleFor(p.results,parameter,unit).scale||fromShared(scaleKey(parameter,unit))||undefined;
}
export interface Einordnung {fill:string;text:string;kategorie:string;art:'kategorie'|'below'|'notDetected'|'notDetermined'|'ohne'|'fehlt'|'R'}
export function einordnung(p:Project,seg:WandSegment,parameter:string):Einordnung{
  if(seg.status==='R')return {fill:'#ffffff',text:'R',kategorie:'Rückstellprobe',art:'R'};
  const w=seg.werte.find(x=>x.p===parameter);if(!w)return {fill:UNRATED,text:'–',kategorie:'',art:'fehlt'};
  const q=labQualifier(w.r);
  if(q==='below')return {fill:BELOW_LIMIT,text:w.r,kategorie:'unter BG',art:'below'};
  if(q==='notDetected')return {fill:NOT_DETECTED,text:w.r,kategorie:'n. n.',art:'notDetected'};
  if(q==='notDetermined')return {fill:NOT_DETERMINED,text:w.r,kategorie:'n. b.',art:'notDetermined'};
  const scale=skalaFuer(p,parameter,w.u),i=rate(scale,labNumber(w.r));
  return i<0||!scale?{fill:UNRATED,text:w.r,kategorie:'',art:'ohne'}:{fill:scale.cats[i].color,text:w.r,kategorie:scale.cats[i].name,art:'kategorie'};
}
const einheit=(w:Wand|WandKern[],parameter:string)=>{const kerne=Array.isArray(w)?w:w.kerne,u=new Set<string>();for(const k of kerne)for(const s of k.segmente)for(const x of s.werte)if(x.p===parameter)u.add(x.u);return [...u];};

/** Lage in Worten: gemessen (m) oder nach Raster. */
export function lageText(w:Wand,k:WandKern){
  if(!istFlaeche(w)&&k.ecke!=null&&k.okff!=null)return `${m2(k.ecke)} m von links, ${m2(k.okff)} m über OKFF`;
  if(k.nr>=10)return 'außerhalb des Rasters';
  return (istFlaeche(w)?RASTER_BODEN:RASTER)[k.nr]||'';
}
const tiefeText=(s:WandSegment)=>s.von!=null&&s.bis!=null?`${cm(s.von)}–${cm(s.bis)} cm`:`T${s.tiefe}`;

/* ---------- Zeichnung ---------- */
const FONT="IBM Plex Sans, Arial, Helvetica, sans-serif";
const BREITE=1000,X0=70,WW=860,CW=96,CH=24;
interface Legende {farbe:string;text:string;muster?:boolean}
export interface WandBild {svg:string;width:number;height:number;legende:Legende[];skalen:string[]}

/** Zeichnung einer Wand (oder von Boden/Decke) mit Tiefensäulen; Breite 1000 Einheiten, Höhe nach Wandmaßen. */
export function wandSvg(p:Project,w:Wand,parameter:string,o:{titel?:boolean;anteil?:[string,string]|null}={}):WandBild{
  const titel=o.titel!==false,ratio=w.laenge&&w.hoehe?w.hoehe/w.laenge:istFlaeche(w)?.7:.55;
  const WH=Math.round(Math.min(560,Math.max(300,WW*ratio))),Y0=titel?96:52,aussen=w.kerne.filter(k=>k.nr>=10&&(istFlaeche(w)||k.ecke==null||k.okff==null||!w.laenge||!w.hoehe));
  const yAussen=Y0+WH+84,legY=yAussen+(aussen.length?Math.max(...aussen.map(k=>k.segmente.length))*CH+40:0);
  const out:string[]=[],e=(s:string)=>escape(s);
  const units=einheit(w,parameter),paare:[string,Scale][]=[];
  for(const u of units){const sk=skalaFuer(p,parameter,u);if(sk&&!paare.some(([,x])=>JSON.stringify(x)===JSON.stringify(sk)))paare.push([u,sk]);}
  const skalen=paare.map(([,x])=>x);
  // Titel
  if(titel)out.push(`<text x="${X0}" y="34" font-size="22" font-weight="600">${e(`${geschossName(w.geschoss)} · ${w.raum} · ${flaecheName(w.flaeche)}${w.frei?' · Freimessung':''}`)}</text>`);
  const sicht=w.flaeche==='BO'?'Aufsicht (Blick von oben): Wand A oben, Wand D links':w.flaeche==='DE'?'Decke, Raster wie Boden: Wand A oben, Wand D links':'Ansicht von innen';
  out.push(`<text x="${X0}" y="${titel?60:20}" font-size="14" fill="#4a5a68">${e(`${sicht} · ${parameter?`${shortParameter(parameter)}${units.length===1?` in ${units[0]}`:''}`:'ohne Messwerte'} · Kennung ${w.key}`)}</text>`);
  // Fläche, Raster, Beschriftung der Ränder
  out.push(`<rect x="${X0}" y="${Y0}" width="${WW}" height="${WH}" fill="#f7f4ee" stroke="#1d2a33" stroke-width="3"/>`);
  for(const f of [1/3,2/3])out.push(`<line x1="${X0+WW*f}" y1="${Y0}" x2="${X0+WW*f}" y2="${Y0+WH}" stroke="#c9c2b4" stroke-dasharray="6 6"/><line x1="${X0}" y1="${Y0+WH*f}" x2="${X0+WW}" y2="${Y0+WH*f}" stroke="#c9c2b4" stroke-dasharray="6 6"/>`);
  const [oben,unten,links,rechts]=istFlaeche(w)?['Wand A','Wand C','Wand D','Wand B']:['Decke','Fußboden (OKFF)','',''];
  out.push(`<text x="${X0+WW/2}" y="${Y0-8}" font-size="13" text-anchor="middle" fill="#4a5a68">${oben}</text>`);
  out.push(`<text x="${X0+WW/2}" y="${Y0+WH+20}" font-size="13" text-anchor="middle" fill="#4a5a68">${e(unten)}${!istFlaeche(w)&&w.laenge?` · Länge ${m2(w.laenge)} m`:''}</text>`);
  if(links)out.push(`<text x="${X0-12}" y="${Y0+WH/2}" font-size="13" text-anchor="middle" fill="#4a5a68" transform="rotate(-90 ${X0-12} ${Y0+WH/2})">${links}</text><text x="${X0+WW+14}" y="${Y0+WH/2}" font-size="13" text-anchor="middle" fill="#4a5a68" transform="rotate(90 ${X0+WW+14} ${Y0+WH/2})">${rechts}</text>`);
  else if(w.hoehe)out.push(`<text x="${X0-12}" y="${Y0+WH/2}" font-size="13" text-anchor="middle" fill="#4a5a68" transform="rotate(-90 ${X0-12} ${Y0+WH/2})">Höhe ${m2(w.hoehe)} m</text>`);
  if(!istFlaeche(w)&&!(w.laenge&&w.hoehe))out.push(`<text x="${X0+WW-6}" y="${Y0+WH-8}" font-size="12" text-anchor="end" fill="#8a8172">ohne Wandmaße: Lage nach Raster 1–9</text>`);
  // Kerne
  const muster=w.kerne.some(k=>k.segmente.some(s=>s.status==='R'));
  if(muster)out.unshift(`<defs><pattern id="r" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#fff"/><line x1="0" y1="0" x2="0" y2="8" stroke="#c9c2b4" stroke-width="3"/></pattern></defs>`);
  let ai=0;
  for(const k of w.kerne){
    let x:number,y:number;const gemessen=!istFlaeche(w)&&k.ecke!=null&&k.okff!=null&&!!w.laenge&&!!w.hoehe;
    if(gemessen){x=X0+Math.min(1,k.ecke!/w.laenge!)*WW;y=Y0+WH-Math.min(1,k.okff!/w.hoehe!)*WH;}
    else if(k.nr>=1&&k.nr<=9){const c=(k.nr-1)%3,r=Math.floor((k.nr-1)/3);x=X0+WW*(c*2+1)/6;y=Y0+WH*(r*2+1)/6;}
    else{x=X0+30+ai*190;y=yAussen;ai++;}
    const n=k.segmente.length,nachLinks=x+18+CW+(o.anteil?44:0)>X0+WW-4,cx=nachLinks?x-18-CW:x+18;let cy=y-n*CH/2;
    if(y<Y0+WH+1)cy=Math.max(Y0+4,Math.min(Y0+WH-4-n*CH,cy));
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#1d2a33" stroke="#fff" stroke-width="2"/>`);
    out.push(`<text x="${x.toFixed(1)}" y="${(y-13).toFixed(1)}" font-size="14" font-weight="600" text-anchor="middle" stroke="#f7f4ee" stroke-width="4" paint-order="stroke">${e(`${w.flaeche}-${k.punkt}`)}</text>`);
    k.segmente.forEach((s,i)=>{
      const ein=einordnung(p,s,parameter),yy=cy+i*CH,fill=ein.art==='R'?'url(#r)':ein.fill,col=ein.art==='R'?'#6b6458':ink(ein.fill);
      out.push(`<rect x="${cx.toFixed(1)}" y="${yy.toFixed(1)}" width="${CW}" height="${CH}" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/>`);
      out.push(`<text x="${(cx+5).toFixed(1)}" y="${(yy+16.5).toFixed(1)}" font-size="12" fill="${col}" opacity=".8">T${s.tiefe}</text><text x="${(cx+CW-5).toFixed(1)}" y="${(yy+16.5).toFixed(1)}" font-size="12.5" font-weight="600" text-anchor="end" fill="${col}">${e(ein.text.length>11?ein.text.slice(0,10)+'…':ein.text)}</text>`);
    });
    out.push(`<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${CW}" height="${n*CH}" fill="none" stroke="#1d2a33" stroke-width="1"/>`);
    if(o.anteil)k.segmente.forEach((s,i)=>{const a=kwAnteil(s,o.anteil!);if(!a)return;const ax=nachLinks?cx-4:cx+CW+4;
      out.push(`<text x="${ax.toFixed(1)}" y="${(cy+i*CH+16.5).toFixed(1)}" font-size="11.5" text-anchor="${nachLinks?'end':'start'}" fill="#4a5a68" stroke="#f7f4ee" stroke-width="3" paint-order="stroke">${e(a)}</text>`);});
  }
  if(aussen.length)out.push(`<text x="${X0}" y="${yAussen-40}" font-size="13" fill="#4a5a68">Außerhalb des Rasters, ohne Maße:</text>`);
  // Legende
  const legende:Legende[]=[];
  for(const [u,s] of paare)s.cats.forEach((c,i)=>legende.push({farbe:c.color,text:`${c.name} (${rangeText(s,i,u)})`}));
  const arten=new Set(w.kerne.flatMap(k=>k.segmente.map(s=>einordnung(p,s,parameter).art)));
  if(arten.has('below'))legende.push({farbe:BELOW_LIMIT,text:'unter BG'});
  if(arten.has('notDetected'))legende.push({farbe:NOT_DETECTED,text:'n. n.'});
  if(arten.has('notDetermined'))legende.push({farbe:NOT_DETERMINED,text:'n. b.'});
  if(arten.has('ohne'))legende.push({farbe:UNRATED,text:skalen.length?'Wert ohne Einordnung':'Wert (keine Skala für diesen Parameter)'});
  if(arten.has('fehlt'))legende.push({farbe:UNRATED,text:'– noch kein Laborwert'});
  if(arten.has('R'))legende.push({farbe:'url(#r)',text:'R Rückstellprobe (nicht analysiert)',muster:true});
  if(o.anteil&&w.kerne.some(k=>k.segmente.some(s=>kwAnteil(s,o.anteil!))))legende.push({farbe:'none',text:'% neben der Säule: Anteil C10–C22 an C10–C40'});
  let lx=X0,ly=legY;const zeilen:string[]=[];
  for(const l of legende){const wtxt=l.text.length*7.2+34;if(lx+wtxt>BREITE-20&&lx>X0){lx=X0;ly+=26;}
    zeilen.push(`${l.farbe==='none'?'':`<rect x="${lx}" y="${ly-13}" width="18" height="16" fill="${l.farbe}" stroke="#8a8172"/>`}<text x="${l.farbe==='none'?lx:lx+24}" y="${ly}" font-size="13">${e(l.text)}</text>`);lx+=wtxt;}
  out.push(...zeilen);
  const height=Math.ceil((legende.length?ly+18:legY))+8;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BREITE} ${height}" width="${BREITE}" height="${height}" font-family="${FONT}" fill="#1d2a33"><rect width="${BREITE}" height="${height}" fill="#fff"/>${out.join('')}</svg>`;
  return {svg,width:BREITE,height,legende,skalen:skalen.map(s=>s.name).filter(Boolean)};
}

/* ---------- Word und CSV ---------- */
export interface WandKopf {title:string;nr:string;ort:string;projectData:Record<string,unknown>;created:string;app:string;source:string;labelkit:string;hinweis?:string}
export interface WandBildDatei {data:Uint8Array;ext:'png';widthPx:number;heightPx:number}
const P=(text:string,o:Record<string,unknown>={})=>({t:'p' as const,text,size:11,...o});
const small=(text:string,o:Record<string,unknown>={})=>STIL.hinweis(text,o);
const th=(text:string):Cell=>({text,b:true,size:8});
/** Spaltenkopf: „Kohlenwasserstoffe C10-C40“ → „KW C10-C40“ (voller Name steht im Kopf der Anlage). */
const kurz=(x:string)=>shortParameter(x).replace(/^Kohlenwasserstoffe\s+/i,'KW ');
// Breiten so, dass „Probe“, „Geruch“ und „Rückstellprobe“ nicht mitten im Wort umbrechen
const BREITEN2=[700,1400,1450,850,780,1150,1150,1590],BREITEN1=[700,1600,1650,950,800,1400,1970],BREITEN3=[700,1250,1200,800,720,1150,1150,850,1250];
const breiten=(p2:string,paar:unknown)=>paar?BREITEN3:p2?BREITEN2:BREITEN1;
function zeilen(p:Project,w:Wand|null,kerne:WandKern[],p1:string,p2:string):Row[]{
  // Einheit in den Spaltenkopf, wenn alle Werte der Spalte dieselbe haben (wie in Prüfberichtstabellen üblich)
  const einheit=(par:string)=>{const u=new Set(kerne.flatMap(k=>k.segmente.flatMap(s=>s.werte.filter(x=>x.p===par).map(x=>x.u.trim()))));return u.size===1?[...u][0]:'';};
  const u1=p1?einheit(p1):'',u2=p2?einheit(p2):'',kopf=(par:string,u:string)=>u?`${kurz(par)}\n[${u}]`:kurz(par);
  const paar=kwPaar(p1,p2),rows:Row[]=[{header:true,cells:['Probe','Kern / Tiefe','Lage','Material','Geruch',p1?kopf(p1,u1):'Wert',...(p2?[kopf(p2,u2)]:[]),...(paar?['Anteil C10–C22']:[]),'Einordnung'].map(th)}];
  for(const k of kerne)k.segmente.forEach((s,i)=>{
    const e1=einordnung(p,s,p1),w1=s.werte.find(x=>x.p===p1),w2=s.werte.find(x=>x.p===p2),wert=(x:Wert|undefined,u:string)=>s.status==='R'?'–':x?(u?x.r:`${x.r} ${x.u}`.trim()):'–';
    // Einordnung als farbiges Kästchen vor dem Text statt vollflächig eingefärbter Zelle
    const ein:Cell=e1.art==='kategorie'?{runs:[{text:'■ ',color:e1.fill.slice(1).toUpperCase()},{text:e1.kategorie}]}:{text:s.status==='R'?'Rückstellprobe':e1.kategorie||(w1?'–':'kein Laborwert')};
    rows.push({cells:[{text:s.label},{text:`${i?'':`${k.kern}\n`}T${s.tiefe} · ${tiefeText(s)}`},{text:i?'':w?lageText(w,k):'–'},{text:s.material||'–'},{text:i?'':k.geruch||'–'},{text:wert(w1,u1)},...(p2?[{text:wert(w2,u2)}]:[]),...(paar?[{text:kwAnteil(s,paar)||'–'}]:[]),ein]});
  });
  return rows;
}
export function wandBlocks(p:Project,st:WandStand,bilder:Map<string,WandBildDatei>,p1:string,p2:string,k:WandKopf):Block[]{
  const b:Block[]=[],pd=(x:string)=>t(k.projectData[x]);
  b.push(STIL.titel(`${k.title}: Bohrkerne – Wandansichten`));
  b.push(STIL.unterzeile(`Projekt ${k.nr}${k.ort?` · ${k.ort}`:''}${pd('objekt')?` · ${pd('objekt')}`:''}`,{after:60}));
  const n=st.waende.reduce((a,w)=>a+w.kerne.length,0),seg=st.waende.reduce((a,w)=>a+w.kerne.reduce((c,x)=>c+x.segmente.length,0),0);
  b.push(P(`${st.waende.length} ${st.waende.length===1?'Fläche':'Flächen'}, ${n} ${n===1?'Bohrkern':'Bohrkerne'}, ${seg} Segmente. Farbe und Wert: ${p1?shortParameter(p1):'–'}${p2?`; in der Tabelle zusätzlich ${shortParameter(p2)}`:''}.`,{size:10,after:160}));
  const skalen=new Set<string>();
  st.waende.forEach((w,i)=>{
    b.push(STIL.abschnitt(`${geschossName(w.geschoss)} · ${w.raum} · ${flaecheName(w.flaeche)}${w.frei?' · Freimessung':''}`,{size:11.5,pageBreakBefore:i>0,before:i>0?0:120,after:80}));
    const img=bilder.get(w.key);
    if(img){const widthMm=165;b.push({t:'image',data:img.data,ext:'png',widthMm,heightMm:Math.round(widthMm*img.heightPx/img.widthPx),alt:`Wandansicht ${w.key}`,after:80,keepNext:true});}
    b.push({t:'table',widths:breiten(p2,kwPaar(p1,p2)),rows:zeilen(p,w,w.kerne,p1,p2),size:8});
    for(const s of wandSvg(p,w,p1).skalen)skalen.add(s);
  });
  if(st.referenz.length){b.push(STIL.abschnitt('Referenzproben',{size:11.5,before:240,after:80}));b.push({t:'table',widths:breiten(p2,kwPaar(p1,p2)),rows:zeilen(p,null,st.referenz,p1,p2),size:8});}
  b.push(small('Werte in der Schreibweise des Prüfberichts. Lage: Abstand von der linken Wandecke (Blick von innen auf die Wand) und Höhe über OKFF; ohne Maße nach Raster 1–9 wie eine Telefontastatur (1–3 deckennah, 7–9 bodennah). Boden und Decke: Raster von Wand A aus (Wand A oben).',{before:120}));
  if(k.hinweis)b.push(small(k.hinweis,{b:true}));
  b.push(small('Rückstellproben (R) wurden nur gesägt und aufbewahrt, nicht analysiert.'));
  if(kwPaar(p1,p2))b.push(small(ANTEIL_TEXT));
  for(const s of skalen)b.push(small(`Einordnung · ${s}`));
  b.push(small(skalen.size?'Die Einordnung ist die Zuordnung zur angegebenen Skala; sie ersetzt nicht die Bewertung im Gutachtentext.':'Für den dargestellten Parameter ist keine Skala hinterlegt – die Farben zeigen nur, ob ein Wert vorliegt; es gibt keine Einordnung.'));
  if(st.ohneId.length)b.push(small(`Ohne gültige Bohrkern-ID und daher nicht dargestellt: ${st.ohneId.join(', ')}.`));
  b.push(small(`Erstellt ${new Date(k.created).toLocaleString('de-DE')} mit ${k.app} aus ${k.labelkit} (Bohrkerne) und ${k.source} (Messwerte).`,{before:80}));
  return b;
}
export function wandCSV(p:Project,st:WandStand,p1:string,p2:string):string{
  const paar=kwPaar(p1,p2),safe=(v:string)=>/^[=+@\t\r]|^-\S/.test(v)?`'${v}`:v,q=(raw:string)=>{const v=safe(raw);return /[";\n\r]/.test(v)?`"${v.replace(/"/g,'""')}"`:v;};
  const lines=[['Geschoss','Raum','Fläche','Kern','Segment','Probe','Lage','von cm','bis cm','Material','Geruch','Status',p1||'Wert',...(p2?[p2]:[]),...(paar?['Anteil C10-C22 an C10-C40 (%)']:[]),'Einordnung'].map(q).join(';')];
  const zeile=(w:Wand|null,k:WandKern)=>{for(const s of k.segmente){const e1=einordnung(p,s,p1),f=(x?:Wert)=>s.status==='R'||!x?'':`${x.r} ${x.u}`.trim();
    lines.push([w?geschossName(w.geschoss):'',w?.raum||'Referenz',w?flaecheName(w.flaeche):'',k.kern,s.id,s.label,w?lageText(w,k):'',s.von==null?'':cm(s.von),s.bis==null?'':cm(s.bis),s.material,k.geruch,s.status==='R'?'Rückstellprobe':'analysiert',f(s.werte.find(x=>x.p===p1)),...(p2?[f(s.werte.find(x=>x.p===p2))]:[]),...(paar?[kwAnteil(s,paar).replace(/ %$/,'')]:[]),s.status==='R'?'':e1.kategorie].map(q).join(';'));}};
  for(const w of st.waende)for(const k of w.kerne)zeile(w,k);
  for(const k of st.referenz)zeile(null,k);
  return '﻿'+lines.join('\r\n')+'\r\n';
}
export function wandName(nr:string,ext:'docx'|'csv',date:string,taken:string[]){
  const s=(v:string)=>v.normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  const base=`${s(nr)||'Projekt'}_Wandansichten_${date}`,used=new Set(taken.map(n=>n.toLowerCase()));
  for(let i=1;i<1000;i++){const n=`${base}${i>1?`_${i}`:''}.${ext}`;if(!used.has(n.toLowerCase()))return n;}
  throw Error('Zu viele Dateien mit gleichem Namen.');
}
/** Hinweise vor dem Export. */
export function wandHinweise(st:WandStand,p1:string){
  const out:string[]=[],segs=st.waende.flatMap(w=>w.kerne.flatMap(k=>k.segmente)).concat(st.referenz.flatMap(k=>k.segmente));
  const offen=segs.filter(s=>s.status==='A'&&!s.werte.some(x=>x.p===p1));if(offen.length)out.push(`${offen.length} analysierte${offen.length===1?'s Segment':' Segmente'} noch ohne Laborwert${p1?` für ${shortParameter(p1)}`:''}: ${offen.map(s=>s.label).join(', ')}`);
  const ohneMass=st.waende.filter(w=>!istFlaeche(w)&&!(w.laenge&&w.hoehe));if(ohneMass.length)out.push(`${ohneMass.length} ${ohneMass.length===1?'Wand':'Wände'} ohne Wandmaße – Lage nach Raster: ${ohneMass.map(w=>w.key).join(', ')}`);
  if(st.ohneId.length)out.push(`Ohne gültige Bohrkern-ID, nicht dargestellt: ${st.ohneId.join(', ')}`);
  return out;
}
