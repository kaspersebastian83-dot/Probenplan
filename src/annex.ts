// Anlage „Probenahme und Laborergebnisse“ als Word-Datei: Lageplan je Geschoss (maßstäblich), Probenverzeichnis,
// je Probe ein Probenblatt mit Fotos und Laborwerten, Prüfprotokoll mit Herkunftsnachweis (SHA-256).
// Gerichtsfest gedacht: Messwerte in der Schreibweise des Prüfberichts, keine Interpolation, keine Hochrechnung,
// Einordnung nur in die Skala des Sachverständigen (mit Angabe der Skala) – jede Abweichung steht im Prüfprotokoll.
// Dieser Teil ist rein: er rechnet nur mit den übergebenen Daten (Bilder, Prüfsummen und Dateien liefert annex-run.ts).
import {allMarkers,floorName,sheetCount,sheetProject,type Project,type Wert} from './model';
import {rangeText,rateMarkers,shortParameter,valueOf,vdsScale,type Rated} from './results';
import type {Block,Cell,Row} from './docx';

export interface AnnexImage {data:Uint8Array;ext:'png'|'jpeg';widthPx:number;heightPx:number}
export type PhotoStatus='ok'|'changed'|'nohash'|'missing';
export interface AnnexPhoto {file:string;desc:string;section:string;taken:string;sha:string;status:PhotoStatus;labels:string[];image?:AnnexImage}
export interface AnnexPlanPage {floor:string;image:AnnexImage;widthMm:number;heightMm:number;ratio:number|null;results:boolean}
export interface AnnexSource {role:string;name:string;stand:string;sha:string}
export interface AnnexSample {label:string;floor:string;placed:boolean;desc:string;note:string;art:string;datum:string;labNr:string;ref:string;bericht:string;labor:string;werte:Wert[];value?:Wert;rating:string;excerpt?:AnnexImage}
export interface AnnexCheck {text:string;ok:boolean;detail?:string}
export interface AnnexInput {
  title:string;nr:string;ort:string;projectData:Record<string,unknown>;parameter:string;scaleNotes:string[];
  plans:AnnexPlanPage[];samples:AnnexSample[];photos:AnnexPhoto[];sources:AnnexSource[];checks:AnnexCheck[];
  created:string;app:string;maxPhotos:number;photosIncluded:boolean;
}

const W=9070;   // Textbreite in twips (A4, Ränder 25 mm)
const t=(v:unknown)=>v==null?'':String(v).trim();
const deDate=(v:string)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t(v));return m?`${m[3]}.${m[2]}.${m[1]}`:t(v);};
const clock=(iso:string)=>{const d=new Date(iso);if(isNaN(+d))return iso;const z=(n:number)=>String(n).padStart(2,'0');return `${z(d.getDate())}.${z(d.getMonth()+1)}.${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())} Uhr`;};
const order=(a:string,b:string)=>a.localeCompare(b,'de',{numeric:true});
/** „P1, p 2; Probe 3“ → ['P1','P2','P3'] (wie FotoKit). */
export function photoLabels(s:string){return String(s||'').split(/[,;/]+/).map(x=>x.trim()).filter(Boolean).map(x=>{const m=/^(?:p|probe)?\s*-?\s*0*(\d+)\s*([a-z]?)$/i.exec(x);return m?`P${m[1]}${m[2].toLowerCase()}`:x.toUpperCase();});}

/** Einordnung je Probe als Text (Kategorie der Skala, „unter BG“, „n.n.“ … oder leer ohne Wert). */
function ratingTexts(rated:Rated){
  const out=new Map<string,string>();
  for(const g of rated.groups)for(const c of g.cats)for(const l of c.labels)out.set(l,c.name);
  for(const l of rated.below)out.set(l,'unter BG');
  for(const l of rated.notDetected)out.set(l,'n. n.');
  for(const l of rated.notDetermined)out.set(l,'n. b.');
  for(const l of rated.unrated)out.set(l,'ohne Bewertung');
  return out;
}
/** Alle Proben des Projekts (alle Geschosse, platziert und noch nicht platziert) in Nummernfolge. */
export function collectSamples(p:Project):AnnexSample[]{
  const parameter=p.results?.parameter||'',origins=new Map((p.labReports||[]).map(r=>[r.id,r]));
  const rows:AnnexSample[]=[];
  for(let i=0;i<sheetCount(p);i++){
    const view=sheetProject(p,i),rated=parameter?rateMarkers(view):null,texts=rated?ratingTexts(rated):new Map<string,string>();
    for(const m of view.markers){if(m.kind!=='sample')continue;const lab=m.lab,o=lab?.reportId?origins.get(lab.reportId):undefined,value=parameter?valueOf(m,parameter):undefined;
      rows.push({label:m.label,floor:floorName(p,i),placed:true,desc:t(lab?.desc),note:t(m.note)!==t(lab?.desc)?t(m.note):'',art:t(lab?.art),datum:t(lab?.datum),labNr:t(lab?.labNr),ref:t(lab?.ref),
        bericht:t(lab?.bericht),labor:t(o?.labor),werte:lab?.werte||[],value,rating:value?texts.get(m.label)||'ohne Bewertung':''});}
  }
  for(const r of p.pending||[]){const o=r.reportId?origins.get(r.reportId):undefined,value=parameter?r.werte?.find(w=>w.p===parameter):undefined;
    rows.push({label:r.label,floor:'',placed:false,desc:t(r.desc),note:'',art:t(r.art),datum:t(r.datum),labNr:t(r.labNr),ref:t(r.ref),bericht:t(r.bericht),labor:t(o?.labor),werte:r.werte||[],value,rating:value?'nicht im Plan':''});}
  return rows.sort((a,b)=>order(a.label,b.label));
}
/** Beschreibung der verwendeten Skalen (je Einheit), damit die Einordnung nachvollziehbar ist. */
export function scaleNotes(p:Project):string[]{
  const s=p.results;if(!s?.parameter)return [];const seen=new Set<string>(),notes:string[]=[];
  for(const m of allMarkers(p)){const w=valueOf(m,s.parameter);if(!w||seen.has(w.u))continue;seen.add(w.u);
    const scale=s.usage?vdsScale(s.parameter,w.u,s.usage):s.scales[`${s.parameter}|${w.u}`];
    if(!scale?.cats.length){notes.push(`${shortParameter(s.parameter)} in ${w.u}: keine Skala hinterlegt – Werte ohne Einordnung.`);continue;}
    notes.push(`${shortParameter(s.parameter)} in ${w.u}: ${scale.name?`Skala „${scale.name}“`:'Skala'}${s.usage?'':' (Vorgabe des Sachverständigen)'} – ${scale.cats.map((c,i)=>`${c.name} ${rangeText(scale,i,w.u)}`).join(' · ')}.`);}
  return notes;
}

/** Prüfungen vor dem Erstellen. Nichts wird verschwiegen: jede Lücke wird mit den betroffenen Proben/Dateien genannt. */
export function annexChecks(samples:AnnexSample[],photos:AnnexPhoto[],plans:{floor:string;ratio:number|null}[],parameter:string,photosChecked:boolean,extra:AnnexCheck[]=[]):AnnexCheck[]{
  const list=(xs:string[],max=12)=>xs.length>max?`${xs.slice(0,max).join(', ')} … (+${xs.length-max})`:xs.join(', ');
  const placed=samples.filter(s=>s.placed),pending=samples.filter(s=>!s.placed).map(s=>s.label);
  const out:AnnexCheck[]=[{text:`${placed.length} Probenahmestelle${placed.length===1?'':'n'} im Plan`,ok:placed.length>0}];
  out.push(pending.length?{text:'Proben ohne Lage im Plan',ok:false,detail:list(pending)}:{text:'Alle Proben haben eine Lage im Plan',ok:true});
  if(parameter){const without=samples.filter(s=>!s.value).map(s=>s.label);
    out.push(without.length?{text:`Proben ohne Messwert für ${shortParameter(parameter)}`,ok:false,detail:list(without)}:{text:`Alle Proben haben einen Messwert für ${shortParameter(parameter)}`,ok:true});
    const unrated=samples.filter(s=>s.rating==='ohne Bewertung').map(s=>s.label);if(unrated.length)out.push({text:'Messwert ohne Einordnung (keine Skala für die Einheit oder Zahl nicht eindeutig)',ok:false,detail:list(unrated)});
  }else out.push({text:'Noch keine Laborwerte im Projekt',ok:false});
  const uncal=plans.filter(x=>!x.ratio).map(x=>x.floor||'Plan');
  out.push(uncal.length?{text:'Lageplan ohne Maßstab (nicht kalibriert oder zu groß)',ok:false,detail:list(uncal)}:{text:'Alle Lagepläne in genormtem Maßstab',ok:true});
  if(photosChecked){
    const labels=new Set(samples.map(s=>s.label)),without=samples.filter(s=>!photos.some(f=>f.labels.includes(s.label))).map(s=>s.label);
    out.push(without.length?{text:'Proben ohne zugeordnetes Foto (FotoKit „Probe-Nr.“)',ok:false,detail:list(without)}:{text:'Jede Probe hat mindestens ein Foto',ok:true});
    const unknown=[...new Set(photos.flatMap(f=>f.labels.filter(l=>!labels.has(l))))].sort(order);
    if(unknown.length)out.push({text:'Fotos mit Probe-Nr., die im Projekt nicht vorkommt',ok:false,detail:list(unknown)});
    const changed=photos.filter(f=>f.status==='changed').map(f=>f.file),missing=photos.filter(f=>f.status==='missing').map(f=>f.file),nohash=photos.filter(f=>f.status==='nohash').map(f=>f.file);
    out.push(changed.length?{text:'Fotos verändert seit der Prüfsumme in FotoKit',ok:false,detail:list(changed)}:{text:`Keine Fotos verändert seit FotoKit (Prüfsumme erneut berechnet und verglichen: ${photos.filter(f=>f.status==='ok').length})`,ok:true});
    if(missing.length)out.push({text:'Fotos in FotoKit erfasst, aber nicht im Ordner „Fotos“',ok:false,detail:list(missing)});
    if(nohash.length)out.push({text:'Fotos ohne gespeicherte Prüfsumme in FotoKit (nur aktuelle Prüfsumme angegeben)',ok:false,detail:list(nohash)});
  }else out.push({text:'Fotos nicht einbezogen (kein Projektordner oder ohne FotoKit-Daten)',ok:false});
  return [...out,...extra];
}

const P=(text:string,o:Record<string,unknown>={})=>({t:'p' as const,text,size:11,...o});
const head=(text:string,pageBreak=true)=>P(text,{size:12,u:true,after:120,keepNext:true,pageBreakBefore:pageBreak});
const small=(text:string,o:Record<string,unknown>={})=>P(text,{size:8.5,after:40,...o});
const imageSize=(img:AnnexImage,maxW:number,maxH:number)=>{const s=Math.min(maxW/img.widthPx,maxH/img.heightPx);return {widthMm:img.widthPx*s,heightMm:img.heightPx*s};};
const th=(text:string,o:Partial<Cell>={}):Cell=>({text,b:true,shade:'F2F2F2',...o});

export function annexBlocks(a:AnnexInput):Block[]{
  const pd=a.projectData,b:Block[]=[];const param=a.parameter?shortParameter(a.parameter):'';
  const nrs=a.samples.map(s=>s.label);
  // 1 · Deckblatt
  b.push(P(`${a.title}: Probenahme und Laborergebnisse`,{size:12,u:true,after:60,keepNext:true}));
  b.push(P(`Projekt ${a.nr}${a.ort?` · ${a.ort}`:''}`,{after:200}));
  const info:[string,string][]=([['Objekt',t(pd.objekt)],['Auftraggeber',t(pd.auftraggeber)],['Schaden-Nr. des Auftraggebers',t(pd.schadennummer)],['Schadenereignis',t(pd.schadenereignis)],
    ['Schadendatum',deDate(t(pd.schadendatum))],['Ortstermin',deDate(t(pd.ortstermin))],['Sachverständiger',t(pd.sachverstaendiger)]] as [string,string][]).filter(([,v])=>v);
  if(info.length)b.push({t:'table',widths:[3000,W-3000],size:10,rows:info.map(([k,v])=>({cells:[th(k),{text:v}]}))});
  const withValue=a.samples.filter(s=>s.value).length,photoCount=new Set(a.photos.filter(f=>f.labels.length).map(f=>f.file)).size;
  b.push(P(`${a.samples.length} Probe${a.samples.length===1?'':'n'} auf ${a.plans.length} Plan${a.plans.length===1?'':'seiten'}`+(param?` · ${withValue} mit Messwert für ${param}`:'')+(a.photosIncluded?` · ${photoCount} zugeordnete Foto${photoCount===1?'':'s'}`:''),{before:120,after:160}));
  b.push(P('Inhalt',{b:true,after:40}));
  const inhalt=[`1. Lageplan der Probenahmestellen${a.plans.length>1?` (${a.plans.map(x=>x.floor||'Plan').join(', ')})`:''}`,'2. Probenverzeichnis'+(param?' mit Messwerten':''),
    `3. Probenblätter${nrs.length?` ${nrs[0]}${nrs.length>1?`–${nrs.at(-1)}`:''}`:''} (je Probe mit Lage${a.photosIncluded?', Fotos':''} und Laborwerten)`,'4. Prüfprotokoll und Herkunftsnachweis'];
  inhalt.forEach(x=>b.push(P(x,{after:20,indent:284})));

  // 2 · Lagepläne (maßstäblich: Bild in Originalgröße einsetzen)
  a.plans.forEach((pl,i)=>{
    b.push(head(`1. Lageplan der Probenahmestellen${pl.floor?` – ${pl.floor}`:''}${a.plans.length>1?` (${i+1}/${a.plans.length})`:''}`));
    b.push({t:'image',data:pl.image.data,ext:pl.image.ext,widthMm:pl.widthMm,heightMm:pl.heightMm,alt:`Lageplan ${pl.floor}`,after:40});
    b.push(small(`${pl.results?`Ergebniskarte: Proben eingefärbt nach ${param||'Messwert'} (Legende im Plan).`:'Probenplan.'} ${pl.ratio?`Maßstab 1:${pl.ratio.toLocaleString('de-DE')} – beim Drucken „Tatsächliche Größe“ (100 %) wählen.`:'Ohne Maßstab (Plan nicht kalibriert).'}`,{align:'center'}));
  });

  // 3 · Probenverzeichnis
  b.push(head('2. Probenverzeichnis'));
  if(param)b.push(P(`Parameter: ${a.parameter}`,{size:10,after:80}));
  // Spalte „Geschoss“ nur bei mehreren Plänen; nicht platzierte Proben stehen dann in „Probenahmestelle“
  const floors=a.plans.length>1,w=floors?[600,800,2100,1000,1000,1150,1350,1070]:[600,2700,1150,1000,1200,1350,1070];
  const heads=['Probe',...(floors?['Geschoss']:[]),'Probenahmestelle','Art','Datum','Labor-Nr.','Messwert','Einordnung'];
  const rows:Row[]=[{header:true,cells:heads.map(h=>({...th(h),size:8.5}))}];
  for(const s of a.samples){const stelle=[s.desc,s.note,!floors&&!s.placed?'(nicht im Plan)':''].filter(Boolean).join('\n');
    rows.push({cells:[{text:s.label,b:true},...(floors?[{text:s.placed?s.floor||'–':'nicht im Plan'}]:[]),{text:stelle},{text:s.art},{text:deDate(s.datum)},{text:s.labNr},
    {text:s.value?`${s.value.r} ${s.value.u}`.trim():''},{text:s.rating}]});}
  b.push({t:'table',widths:w,rows,size:8.5});
  b.push(small('Messwerte unverändert in der Schreibweise des Prüfberichts. BG = Bestimmungsgrenze, n. n. = nicht nachgewiesen, n. b. = nicht bestimmt. Keine Werte zwischen den Probenahmestellen interpoliert oder hochgerechnet.',{before:80}));
  for(const n of a.scaleNotes)b.push(small(`Einordnung · ${n}`));
  if(a.scaleNotes.length)b.push(small('Die Einordnung ist eine Zuordnung zur angegebenen Skala und ersetzt nicht die Bewertung im Gutachtentext.'));

  // 4 · Probenblätter
  for(const s of a.samples){
    b.push(P(`Probenblatt ${s.label}`,{size:12,b:true,after:40,keepNext:true,pageBreakBefore:true}));
    b.push(P([s.art,s.placed?s.floor:'nicht im Plan platziert'].filter(Boolean).join(' · '),{size:10,after:120,keepNext:true}));
    const d:[string,string][]=([['Probenahmestelle',s.desc],['Notiz im Plan',s.note],['Geschoss',s.placed?s.floor:'nicht im Plan'],['Art / Matrix',s.art],['Probenahmedatum',deDate(s.datum)],
      ['Laborreferenz',s.ref],['Labor-Nr.',s.labNr],['Prüfbericht',[s.bericht,s.labor].filter(Boolean).join(' · ')],
      ...(param?[[`${param} (Einordnung)`,s.value?`${s.value.r} ${s.value.u}`.trim()+(s.rating?` · ${s.rating}`:''):'kein Messwert']]:[])] as [string,string][]).filter(([,v])=>v);
    b.push({t:'table',widths:[2800,W-2800],size:9.5,rows:d.map(([k,v])=>({cells:[th(k),{text:v}]}))});
    if(s.excerpt){const sz=imageSize(s.excerpt,95,55);b.push({t:'image',data:s.excerpt.data,ext:s.excerpt.ext,...sz,alt:`Lage von ${s.label}`,after:20,keepNext:true});b.push(small(`Lage im Plan${s.floor?` (${s.floor})`:''} – Ausschnitt, ohne Maßstab`,{align:'center'}));}
    if(a.photosIncluded){
      const fotos=a.photos.filter(f=>f.labels.includes(s.label)),shown=fotos.filter(f=>f.image).slice(0,a.maxPhotos);
      if(!fotos.length)b.push(small('Keine Fotos mit dieser Probe-Nr. in FotoKit.',{before:120}));
      else{
        const cell=(f:typeof fotos[number]):Cell=>({image:{data:f.image!.data,ext:f.image!.ext,...imageSize(f.image!,76,57),alt:f.desc||f.file},paras:[
          {text:f.desc||f.file,size:8.5,i:true,align:'center',after:0},{text:`${f.file}${f.taken?` · ${f.taken}`:''}`,size:7.5,align:'center',after:0},
          {text:`SHA-256 ${f.sha.slice(0,16)}… · ${{ok:'unverändert seit FotoKit',changed:'VERÄNDERT seit FotoKit',nohash:'ohne FotoKit-Prüfsumme',missing:'fehlt'}[f.status]}`,size:7,mono:false,align:'center',after:60}]});
        const r:Row[]=[];for(let i=0;i<shown.length;i+=2)r.push({cells:[cell(shown[i]),shown[i+1]?cell(shown[i+1]):{text:''}]});
        if(r.length)b.push({t:'table',widths:[W/2,W/2],borders:false,size:8.5,rows:r});
        const rest=fotos.filter(f=>!shown.includes(f));if(rest.length)b.push(small(`Weitere Fotos zu ${s.label}: ${rest.map(f=>f.file).join(', ')}`));
      }
    }
    b.push(P('Laborwerte (Schreibweise des Prüfberichts)',{size:10,b:true,before:160,after:60,keepNext:true}));
    if(s.werte.length)b.push({t:'table',widths:[5070,2200,1800],size:9,rows:[{header:true,cells:[th('Parameter'),th('Ergebnis'),th('Einheit')]},...s.werte.map(x=>({cells:[{text:x.p,b:x.p===a.parameter},{text:x.r,b:x.p===a.parameter},{text:x.u}]}))]});
    else b.push(small('Keine Laborwerte zugeordnet.'));
  }

  // 5 · Prüfprotokoll
  b.push(head('4. Prüfprotokoll und Herkunftsnachweis'));
  b.push(P('Automatisch beim Erstellen dieser Anlage geprüft. Jede Abweichung wird hier genannt.',{size:10,after:120}));
  b.push({t:'table',widths:[700,4400,W-5100],size:9,rows:[{header:true,cells:[th(''),th('Prüfung'),th('Betroffen')]},...a.checks.map(c=>({cells:[{text:c.ok?'✓':'!',b:true,align:'center' as const},{text:c.text},{text:c.detail||''}]}))]});
  b.push(P('Quelldateien',{size:10,b:true,before:200,after:60,keepNext:true}));
  b.push({t:'table',widths:[2000,3000,1500,W-6500],size:8,rows:[{header:true,cells:[th('Rolle'),th('Datei'),th('Stand'),th('SHA-256')]},...a.sources.map(x=>({cells:[{text:x.role},{text:x.name},{text:x.stand},{text:x.sha,mono:true,size:6.5}]}))]});
  const fotoRows=a.photos.filter(f=>f.labels.length);
  if(a.photosIncluded&&fotoRows.length){
    b.push(P('Fotos',{size:10,b:true,before:200,after:60,keepNext:true}));
    b.push({t:'table',widths:[900,2600,1500,W-5000],size:8,rows:[{header:true,cells:[th('Probe'),th('Datei'),th('Status'),th('SHA-256 (beim Erstellen berechnet)')]},
      ...fotoRows.map(f=>({cells:[{text:f.labels.join(', ')},{text:f.file},{text:{ok:'unverändert',changed:'verändert',nohash:'ohne FotoKit-Prüfsumme',missing:'fehlt'}[f.status]},{text:f.sha||'–',mono:true,size:6.5}]}))]});
    b.push(small('In der Anlage sind verkleinerte Kopien abgebildet; maßgeblich sind die Originaldateien im Ordner „Fotos“ mit der angegebenen Prüfsumme.'));
  }
  b.push(P('Verfahren',{size:10,b:true,before:200,after:60,keepNext:true}));
  for(const x of ['Lage, Proben und Messwerte stammen aus der PlanKit-Projektdatei; Messwerte wurden maschinell aus dem Laborbericht übernommen und unverändert wiedergegeben.',
    'Keine Interpolation oder Hochrechnung zwischen Probenahmestellen. Einordnung nur in die angegebene Skala.',
    'Prüfsummen (SHA-256) wurden beim Erstellen dieser Anlage aus den Dateien berechnet. Nachprüfen unter Windows: certutil -hashfile "Datei" SHA256 – das Ergebnis muss mit der Tabelle übereinstimmen.'])b.push(small(x,{after:60}));
  b.push(small(`Erstellt am ${clock(a.created)} mit ${a.app}.`,{before:120,color:'595959'}));
  return b;
}
