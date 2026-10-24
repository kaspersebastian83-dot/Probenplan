import {validateSketch} from './sketch';
import {validDate} from './labreport';
import type {LabData} from './model';
import {copyOrigin,validOrigin} from './lab-provenance';
import DOMPurify from 'dompurify';
import { unzipSync } from 'fflate';
import { MARKER_SCALE, type Plan, type Project, type Preparation, type Sheet, type ResultSettings, type Scale, validLabel, SHAPES, MAX_SHEETS, cleanSheetName, allMarkers, allAreas ,SURFACES,TRIALS,type Trials,MAX_RAUM,RAUM_STATUS,type Raumbuch,type RaumEintrag} from './model';
import {MAX_AREAS,MAX_POINTS,PALETTE,cleanName,polygonError} from './areas';
import {MAX_ANGLE,wholeSize} from './preparation';
const MAX=60*1024*1024;
const safeData=(s:string)=>/^data:(?:image\/(?:png|jpeg|webp|gif)|font\/(?:woff2?|ttf|otf)|application\/(?:font-woff|x-font-ttf|vnd.ms-fontobject|octet-stream))(?:;charset=[\w-]+)?;base64,[a-z0-9+/=\s]+$/i.test(s);
function safeCSS(css:string){
  // Reject escapes and comments to avoid obfuscated URL / @import tokens.
  if(/[\\]|\/\*|@import|expression\s*\(|behavior\s*:|-moz-binding|image-set\s*\(/i.test(css))return '';
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi,(_all,_q,url:string)=>url.startsWith('#')||safeData(url)?`url("${url}")`:'none');
}
export function sanitizeSVG(source:string):{data:string;width:number;height:number} {
  if(source.length>MAX)throw Error('Die SVG ist zu groß (maximal 60 MB).');
  source=source.replace(/<!DOCTYPE[^>]*(?:\[[\s\S]*?\]\s*)?>/gi,'');
  const clean=DOMPurify.sanitize(source,{USE_PROFILES:{svg:true,svgFilters:true},ADD_TAGS:['style'],FORBID_TAGS:['foreignObject','script','animate','animateMotion','animateTransform','set','a','feImage'],FORBID_ATTR:['xml:base']});
  const doc=new DOMParser().parseFromString(clean,'image/svg+xml'); const svg=doc.documentElement;
  if(svg.localName!=='svg'||doc.querySelector('parsererror'))throw Error('Die SVG konnte nicht gelesen werden.');
  for(const el of [svg,...svg.querySelectorAll('*')]){
    for(const attr of [...el.attributes]){
      if(/^on/i.test(attr.name)||/^(?:base|src)$/i.test(attr.localName))el.removeAttributeNode(attr);
      else if(attr.localName==='href' && !(attr.value.startsWith('#') || (el.localName==='image' && /^data:image\/(png|jpeg|webp|gif)[;,]/i.test(attr.value)&&safeData(attr.value))))el.removeAttributeNode(attr);
      else if(attr.name==='style'||/url\s*\(/i.test(attr.value))el.setAttribute(attr.name,safeCSS(attr.value));
    }
    if(el.localName==='style')el.textContent=safeCSS(el.textContent||'');
  }
  const vb=svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const length=(s:string|null)=>{if(!s)return 0;const m=s.match(/^([\d.]+)\s*(px|pt|mm|cm|in)?$/);return m?Number(m[1])*({px:1,pt:96/72,mm:96/25.4,cm:96/2.54,in:96}[m[2]||'px']||1):0;};
  const width=length(svg.getAttribute('width'))||(vb?.[2]||0),height=length(svg.getAttribute('height'))||(vb?.[3]||0);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>100000||height>100000)throw Error('Die SVG benötigt gültige Abmessungen oder eine viewBox.');
  if(!vb)svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  return {data:`data:image/svg+xml;base64,${btoa(new TextEncoder().encode(new XMLSerializer().serializeToString(svg)).reduce((s,b)=>s+String.fromCharCode(b),''))}`,width,height};
}
/** Bild laden; bleibt der Browser die Antwort schuldig, wird nach 60 s ein Fehler gemeldet statt still zu warten. */
export function loadImage(src:string,what='Das Planbild'):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const img=new Image(),timer=setTimeout(()=>reject(Error(`${what} konnte nicht geladen werden (Zeitüberschreitung).`)),60_000);img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(Error(`${what} konnte nicht geladen werden.`));};img.src=src;});}
function checkRasterSize(bytes:Uint8Array){
  let width=0,height=0;
  if(bytes.length>=24&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);width=view.getUint32(16);height=view.getUint32(20);}
  else if(bytes[0]===255&&bytes[1]===216){let i=2;while(i+9<bytes.length){if(bytes[i]!==255){i++;continue;}const marker=bytes[i+1];i+=2;if(marker===218||marker===217)break;if(marker===216||marker===0)continue;const length=bytes[i]*256+bytes[i+1];if(length<2)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){height=bytes[i+3]*256+bytes[i+4];width=bytes[i+5]*256+bytes[i+6];break;}i+=length;}}
  if(width*height>50_000_000||Math.max(width,height)>18000)throw Error('Das Bild ist für die lokale Verarbeitung zu groß (maximal 50 Megapixel / 18.000 px pro Seite). Bitte eine kleinere JPG- oder PNG-Kopie verwenden.');
}
export async function readPlan(name:string,bytes:Uint8Array):Promise<Plan>{
  if(bytes.length>MAX)throw Error('Die Plandatei ist zu groß (maximal 60 MB).');
  if(/\.(heic|heif)$/i.test(name))throw Error('HEIC/HEIF wird noch nicht zuverlässig unterstützt. Bitte das Foto als JPG exportieren oder auf dem iPhone unter Kamera → Formate → Maximale Kompatibilität aufnehmen.');
  if(/\.svg$/i.test(name)){const p=sanitizeSVG(new TextDecoder().decode(bytes));await loadImage(p.data);return {...p,name,vector:true};}
  if(!/\.(png|jpe?g)$/i.test(name))throw Error('Bitte PDF, Polycam-ZIP, SVG, PNG oder JPG auswählen.');
  checkRasterSize(bytes);
  const mime=/\.png$/i.test(name)?'image/png':'image/jpeg';
  const data=await new Promise<string>((res,rej)=>{const reader=new FileReader();reader.onload=()=>res(String(reader.result));reader.onerror=()=>rej(Error('Datei nicht lesbar.'));reader.readAsDataURL(new Blob([bytes as BlobPart],{type:mime}));});
  // HTMLImageElement applies JPEG EXIF orientation; keep the original encoded bytes.
  const img=await loadImage(data); if(img.naturalWidth*img.naturalHeight>50_000_000)throw Error('Das Bild ist zu groß. Bitte auf höchstens 50 Megapixel verkleinern.');
  return {name,data,width:img.naturalWidth,height:img.naturalHeight,vector:false};
}
export interface Candidate {name:string; bytes:Uint8Array}
export async function candidates(file:File):Promise<Candidate[]>{
  if(file.size>MAX)throw Error('Die Datei ist zu groß (maximal 60 MB).');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!/\.zip$/i.test(file.name))return [{name:file.name,bytes}];
  let total=0,count=0;
  const files=unzipSync(bytes,{filter:e=>{
    if(!/\.(svg|png|jpe?g)$/i.test(e.name)||e.name.startsWith('__MACOSX/'))return false;
    total+=e.originalSize;count++;
    if(total>MAX||count>100)throw Error('Das ZIP enthält zu viele oder zu große Pläne (maximal 60 MB entpackt).');return true;
  }});
  const result=Object.entries(files).map(([name,bytes])=>({name,bytes})).sort((a,b)=>Number(/\.svg$/i.test(b.name))-Number(/\.svg$/i.test(a.name))||a.name.localeCompare(b.name));
  if(!result.length)throw Error('Kein SVG-, PNG- oder JPG-Plan im ZIP gefunden. PDF bitte direkt auswählen; DXF und CSV werden noch nicht unterstützt.');return result;
}
export async function validateProject(value:unknown):Promise<Project>{
  const raw=value as Project;
  if(raw&&raw.format==='probenplan'&&typeof raw.version==='number'&&raw.version>6)throw Error('Diese Projektdatei stammt von einer neueren PlanKit-Version. Bitte PlanKit aktualisieren (Seite neu laden).');
  // Format 6 = Format 5 bzw. Einzelplan plus Feinausrichtung: wie diese prüfen, Feinwinkel erlauben, Format 6 behalten.
  const fine=!!raw&&raw.format==='probenplan'&&raw.version===6;
  const p=(fine?{...raw,version:raw.sheets!==undefined?5:4}:raw) as Project;
  const result=await validateFormat(p,fine);
  if(fine)result.version=6;
  if(raw.raumbuch!==undefined){const rb=validRaumbuch(raw.raumbuch);if(rb.rooms.length||rb.alias)result.raumbuch=rb;}
  if(raw.trials!==undefined){const t=raw.trials;if(!t||typeof t!=='object'||Array.isArray(t)||Object.entries(t).some(([k,v])=>!TRIALS.includes(k as keyof Trials)||v!==true))throw Error('Ungültige Testfunktionen in der Projektdatei.');if(Object.keys(t).length)result.trials={...t};}
  return result;
}
async function validateFormat(p:Project,fine:boolean):Promise<Project>{
  if(!p||p.format!=='probenplan'||p.version!==5)return validateSingle(p,fine);
  // Format 5: mehrere Pläne. Jeder Plan wird wie ein Projekt des Formats 4 geprüft,
  // danach Kennungen und IDs über alle Pläne hinweg auf Eindeutigkeit.
  const sheets=p.sheets,active=p.active;
  if(!Array.isArray(sheets)||!sheets.length||sheets.length>MAX_SHEETS||!Number.isSafeInteger(active)||active!<0||active!>=sheets.length)throw Error('Ungültige Planliste in der Projektdatei.');
  const sheetIds=new Set<string>();
  for(const [i,sh] of sheets.entries()){if(!sh||typeof sh.id!=='string'||!/^[\w-]{1,80}$/.test(sh.id)||sheetIds.has(sh.id)||typeof sh.name!=='string'||!cleanSheetName(sh.name)||sh.name.length>40||(i===active)!==(sh.plan===undefined))throw Error('Ungültiger oder doppelter Plan in der Projektdatei.');sheetIds.add(sh.id);}
  const base={format:'probenplan' as const,version:4 as const,nextSample:p.nextSample,nextFire:p.nextFire,report:p.report,date:p.date,...(p.labReports!==undefined?{labReports:p.labReports}:{})};
  const own=await validateSingle({...base,plan:p.plan,markers:p.markers,...(p.areas!==undefined||p.nextArea!==undefined?{areas:p.areas??[],nextArea:p.nextArea}:{}),...(p.pending!==undefined?{pending:p.pending}:{}),...(p.results!==undefined?{results:p.results}:{})} as Project,fine);
  const out:Sheet[]=[];
  for(const [i,sh] of sheets.entries()){
    if(i===active){out.push({id:sh.id,name:cleanSheetName(sh.name)});continue;}
    const v=await validateSingle({...base,plan:sh.plan,markers:sh.markers,...(sh.areas!==undefined||p.nextArea!==undefined?{areas:sh.areas??[],nextArea:p.nextArea}:{})} as Project,fine);
    out.push({id:sh.id,name:cleanSheetName(sh.name),plan:v.plan,markers:v.markers,...(v.areas?{areas:v.areas}:{})});
  }
  const result:Project={...own,version:5,sheets:out,active};
  const ids=new Set<string>(),labels=new Set<string>();
  for(const item of [...allMarkers(result),...allAreas(result)]){if(ids.has(item.id)||labels.has(item.label.toLocaleUpperCase()))throw Error('Doppelte Kennungen oder Markierungen über mehrere Pläne.');ids.add(item.id);labels.add(item.label.toLocaleUpperCase());}
  for(const row of result.pending||[])if(labels.has(row.label.toUpperCase()))throw Error('Ungültige oder doppelte offene Probe.');
  if(allMarkers(result).length>3000)throw Error('Zu viele Markierungen in der Projektdatei.');
  return result;
}
async function validateSingle(p:Project,fine=false):Promise<Project>{
  if(!p||p.format!=='probenplan'||![1,2,3,4].includes(p.version)||!p.plan||typeof p.plan.data!=='string'||!Array.isArray(p.markers)||p.markers.length>3000)throw Error('Ungültige oder nicht unterstützte Projektdatei.');
  if(typeof p.plan.name!=='string'||typeof p.report!=='string'||p.report.length>100||typeof p.date!=='string'||(p.date!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(p.date)))throw Error('Ungültige Projektdaten.');
  if(p.plan.data.length>MAX*1.5)throw Error('Die Projektdatei enthält einen zu großen Plan.');
  let plan:Plan;
  if(p.plan.data.startsWith('data:image/svg+xml;base64,')){
    const decoded=new TextDecoder().decode(Uint8Array.from(atob(p.plan.data.split(',')[1]),c=>c.charCodeAt(0)));
    plan={...sanitizeSVG(decoded),name:p.plan.name,vector:true};await loadImage(plan.data);
  }else if(/^data:image\/(png|jpeg);base64,/.test(p.plan.data)&&safeData(p.plan.data)){
    const header=atob(p.plan.data.split(',')[1].slice(0,1_048_576));checkRasterSize(Uint8Array.from(header,c=>c.charCodeAt(0)));
    const img=await loadImage(p.plan.data);if(img.naturalWidth*img.naturalHeight>50_000_000)throw Error('Das Planbild ist zu groß.');
    plan={name:p.plan.name,data:p.plan.data,width:img.naturalWidth,height:img.naturalHeight,vector:false};
  }else throw Error('Die Projektdatei enthält kein zulässiges Planbild.');
  if(p.plan.pdf){const pdf=p.plan.pdf;if(plan.vector||![pdf.page,pdf.totalPages,pdf.renderLongSide].every(Number.isSafeInteger)||pdf.page<1||pdf.page>pdf.totalPages||pdf.totalPages>500||pdf.renderLongSide!==Math.max(plan.width,plan.height))throw Error('Ungültige PDF-Seiteninformation in der Projektdatei.');plan.pdf={page:pdf.page,totalPages:pdf.totalPages,renderLongSide:pdf.renderLongSide};}
  if(p.plan.preparation){
    const edit=p.plan.preparation,c=edit.crop;
    if(!edit||![0,90,180,270].includes(edit.rotation)||edit.sourceWidth!==plan.width||edit.sourceHeight!==plan.height||!c||![c.x,c.y,c.width,c.height].every(Number.isFinite)||c.x<0||c.y<0||c.width<=0||c.height<=0)throw Error('Ungültige Bildbearbeitung in der Projektdatei.');
    if(edit.angle!==undefined&&(!fine||typeof edit.angle!=='number'||!Number.isFinite(edit.angle)||edit.angle===0||Math.abs(edit.angle)>MAX_ANGLE))throw Error(fine?'Ungültige Feinausrichtung in der Projektdatei.':'Feinausrichtung benötigt Projektformat 6.');
    const whole=wholeSize({sourceWidth:edit.sourceWidth,sourceHeight:edit.sourceHeight,rotation:edit.rotation as Preparation['rotation'],crop:c,...(edit.angle!==undefined?{angle:edit.angle}:{})}),w=whole.width,h=whole.height;
    if(c.x+c.width>w+.01||c.y+c.height>h+.01||Math.abs(p.plan.width-c.width)>.01||Math.abs(p.plan.height-c.height)>.01)throw Error('Der gespeicherte Zuschnitt liegt außerhalb des Originalplans.');
    plan.preparation={sourceWidth:edit.sourceWidth,sourceHeight:edit.sourceHeight,rotation:edit.rotation as Preparation['rotation'],crop:{x:c.x,y:c.y,width:c.width,height:c.height},...(edit.angle!==undefined?{angle:edit.angle}:{})};plan.width=c.width;plan.height=c.height;
  }
  if(p.plan.markerScale!==undefined){const s=p.plan.markerScale;if(typeof s!=='number'||!Number.isFinite(s)||s<MARKER_SCALE.min||s>MARKER_SCALE.max)throw Error('Ungültige Punktgröße in der Projektdatei.');if(s!==1)plan.markerScale=s;}
  if(p.plan.sketch!==undefined){if(!plan.vector)throw Error('Ungültige Skizze in der Projektdatei.');plan.sketch=validateSketch(p.plan.sketch);}
  if(p.plan.autoLabels!==undefined){if(p.plan.autoLabels!==false)throw Error('Ungültige Beschriftungseinstellung in der Projektdatei.');plan.autoLabels=false;}
  if(p.plan.valueLabels!==undefined){if(p.plan.valueLabels!==true)throw Error('Ungültige Beschriftungseinstellung in der Projektdatei.');plan.valueLabels=true;}
  if(p.plan.calibration!==undefined){const c=p.plan.calibration;if(!c||typeof c!=='object'||![c.units,c.meters].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)||c.meters>100_000||c.units>10_000_000||c.meters/c.units>1000||c.meters/c.units<1e-7)throw Error('Ungültiger Maßstab in der Projektdatei.');plan.calibration={units:c.units,meters:c.meters};}
  if(p.plan.north!==undefined){const n=p.plan.north;if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>=360)throw Error('Ungültige Nordrichtung in der Projektdatei.');plan.north=n;}
  const ids=new Set<string>();const labels=new Set<string>();
  for(const m of p.markers){
    if(!m||!['sample','fire'].includes(m.kind)||typeof m.id!=='string'||!/^[\w-]{1,80}$/.test(m.id)||ids.has(m.id)||typeof m.label!=='string'||!validLabel({...p,markers:[],areas:[],pending:[]},m.label,m.id)||labels.has(m.label.toLocaleUpperCase())||typeof m.note!=='string'||m.note.length>500||![m.x,m.y,m.lx,m.ly].every(n=>Number.isFinite(n)&&Math.abs(n)<1_000_000)||(m.shape!==undefined&&!SHAPES.includes(m.shape))||(m.typ!==undefined&&(typeof m.typ!=='string'||m.typ.length>40))||(m.surface!==undefined&&(m.kind!=='sample'||!SURFACES.includes(m.surface)))||(m.raum!==undefined&&(typeof m.raum!=='string'||!m.raum.trim()||m.raum.length>MAX_RAUM)))throw Error('Ungültige oder doppelte Markierungen in der Projektdatei.');
    ids.add(m.id);labels.add(m.label.toLocaleUpperCase());
  }
  if(![p.nextSample,p.nextFire].every(n=>Number.isSafeInteger(n)&&n>=1&&n<1e9))throw Error('Ungültige Startnummer.');
  if(p.version===3||(p.version===4&&(p.areas!==undefined||p.nextArea!==undefined))){
    if(!Array.isArray(p.areas)||p.areas.length>MAX_AREAS||!Number.isSafeInteger(p.nextArea)||p.nextArea!<1||p.nextArea!>=1e9)throw Error('Ungültige Flächendaten in der Projektdatei.');
    for(const a of p.areas){if(!a||typeof a.id!=='string'||!/^[\w-]{1,80}$/.test(a.id)||ids.has(a.id)||typeof a.label!=='string'||!validLabel({...p,markers:[],areas:[],pending:[]},a.label,a.id)||labels.has(a.label.toLocaleUpperCase())||typeof a.name!=='string'||!cleanName(a.name)||a.name.length>160||!PALETTE.some(c=>c.color===a.color)||!Number.isFinite(a.opacity)||a.opacity<.05||a.opacity>.7||!Array.isArray(a.points)||a.points.length>MAX_POINTS||polygonError(a.points,plan)||polygonError(a.points.map(pt=>({x:Math.max(0,Math.min(plan.width,pt.x)),y:Math.max(0,Math.min(plan.height,pt.y))})),plan))throw Error('Ungültige Fläche: Kennung, Farbe, Deckkraft oder Polygonkoordinaten fehlerhaft.');ids.add(a.id);labels.add(a.label.toLocaleUpperCase());}
  }else if(p.areas!==undefined||p.nextArea!==undefined)throw Error('Flächen benötigen das Projektformat der Version 1.2.');
  if(p.version!==4&&(p.pending!==undefined||p.labReports!==undefined||p.markers.some(m=>m.lab!==undefined)))throw Error('Labordaten benötigen Projektformat 4.');
  const reports=new Map<string, NonNullable<Project['labReports']>[number]>();
  if(p.labReports!==undefined){
    if(!Array.isArray(p.labReports)||p.labReports.length>3000)throw Error('Ungültige Labor-Herkunftsliste.');
    for(const r of p.labReports){if(!validOrigin(r)||reports.has(r.id))throw Error('Ungültige oder doppelte Labor-Berichts-ID bzw. Herkunftsdaten.');reports.set(r.id,r);}
  }
  for(const m of p.markers)if(m.lab!==undefined&&!validLab(m.lab))throw Error('Ungültige Labordaten an einer Markierung.');
  if(p.pending!==undefined){if(!Array.isArray(p.pending)||p.pending.length>1000)throw Error('Ungültige Liste offener Proben.');for(const row of p.pending){if(!validLab(row)||!/^P[1-9]\d{0,8}$/.test(row.label)||labels.has(row.label.toUpperCase()))throw Error('Ungültige oder doppelte offene Probe.');labels.add(row.label.toUpperCase());}}
  for(const row of [...p.markers.flatMap(m=>m.lab?[m.lab]:[]),...(p.pending||[])])if(row.reportId!==undefined){const r=reports.get(row.reportId);if(!r||(row.bericht!==undefined&&row.bericht!==r.bericht))throw Error('Laborprobe verweist auf eine fehlende oder widersprüchliche Bericht-Herkunft.');}
  return {format:'probenplan',version:p.version>=3?p.version:plan.pdf||plan.preparation?2:p.version,plan,markers:p.markers.map(m=>({id:m.id,kind:m.kind,label:m.label,note:m.note,x:m.x,y:m.y,lx:m.lx,ly:m.ly,...(m.lab?{lab:copyLab(m.lab)}:{}),...(m.kind==='sample'&&m.shape&&m.shape!=='circle'?{shape:m.shape}:{}),...(m.kind==='sample'&&m.typ?{typ:m.typ}:{}),...(m.surface?{surface:m.surface}:{}),...(m.raum?{raum:m.raum}:{})})),nextSample:p.nextSample,nextFire:p.nextFire,report:p.report,date:p.date,...(p.areas!==undefined?{areas:p.areas!.map(a=>({id:a.id,label:a.label,name:cleanName(a.name),color:a.color,opacity:a.opacity,points:a.points.map(pt=>({x:Math.max(0,Math.min(plan.width,pt.x)),y:Math.max(0,Math.min(plan.height,pt.y))}))})),nextArea:p.nextArea}:{}),...(p.pending!==undefined?{pending:p.pending.map(r=>({label:r.label,...copyLab(r),...(typeof r.typ==='string'&&r.typ&&r.typ.length<=40?{typ:r.typ}:{}),...(r.shape&&SHAPES.includes(r.shape)?{shape:r.shape}:{}),...(r.surface&&SURFACES.includes(r.surface)?{surface:r.surface}:{}),...(typeof r.raum==='string'&&r.raum.trim()&&r.raum.length<=MAX_RAUM?{raum:r.raum}:{})}))}:{}),...(p.labReports!==undefined?{labReports:p.labReports.map(copyOrigin)}:{}),...(p.results!==undefined?{results:validResults(p.results)}:{})};
}
export function validResults(value:unknown):ResultSettings{
  const r=value as ResultSettings;if(!r||typeof r!=='object'||typeof r.parameter!=='string'||r.parameter.length>160||!r.scales||typeof r.scales!=='object'||Array.isArray(r.scales)||Object.keys(r.scales).length>100)throw Error('Ungültige Einstellungen der Ergebniskarte.');
  const skalen=(raw:Record<string,Scale>)=>{const scales:Record<string,Scale>={};
  for(const [key,s] of Object.entries(raw)){if(key.length>330||!s||typeof s.name!=='string'||s.name.length>160||!Array.isArray(s.cats)||!s.cats.length||s.cats.length>12||!s.cats.every((c,i)=>!!c&&typeof c.name==='string'&&!!c.name.trim()&&c.name.length<=60&&Number.isFinite(c.from)&&c.from>=0&&(i===0||c.from>=s.cats[i-1].from)&&typeof c.color==='string'&&/^#[0-9a-f]{6}$/i.test(c.color)))throw Error('Ungültige Bewertungsskala in der Projektdatei.');scales[key]={name:s.name,cats:s.cats.map(c=>({name:c.name,from:c.from,color:c.color.toLowerCase()}))};}
  return scales;};
  const scales=skalen(r.scales);
  if(r.vds!==undefined&&(!r.vds||typeof r.vds!=='object'||Array.isArray(r.vds)||Object.keys(r.vds).length>100))throw Error('Ungültige Einstellungen der Ergebniskarte.');
  const vds=r.vds?skalen(r.vds):{};
  if(r.usage!==undefined&&!['residential','industrial'].includes(r.usage))throw Error('Ungültige Nutzungskategorie der Ergebniskarte.');
  return {parameter:r.parameter,scales,...(r.usage?{usage:r.usage}:{}),...(Object.keys(vds).length?{vds}:{})};
}

export function validLab(row:unknown):row is LabData{const r=row as LabData;return !!r&&typeof r.ref==='string'&&r.ref.length<=160&&typeof r.desc==='string'&&r.desc.length<=500&&(['art','labNr','bericht'] as const).every(k=>r[k as 'art'|'labNr'|'bericht']===undefined||(typeof r[k]==='string'&&r[k].length<=160))&&(r.reportId===undefined||(typeof r.reportId==='string'&&/^[\w-]{1,80}$/.test(r.reportId)))&&(r.datum===undefined||r.datum===''||validDate(r.datum))&&(r.werte===undefined||(Array.isArray(r.werte)&&r.werte.length<=300&&r.werte.every(w=>!!w&&typeof w.p==='string'&&w.p.length<=160&&typeof w.r==='string'&&w.r.length<=40&&typeof w.u==='string'&&w.u.length<=40)));}
export function copyLab(r:LabData):LabData{return {ref:r.ref,desc:r.desc,...(r.art!==undefined?{art:r.art}:{}),...(r.labNr!==undefined?{labNr:r.labNr}:{}),...(r.datum!==undefined?{datum:r.datum}:{}),...(r.bericht!==undefined?{bericht:r.bericht}:{}),...(r.reportId!==undefined?{reportId:r.reportId}:{}),...(r.werte!==undefined?{werte:r.werte.map(w=>({p:w.p,r:w.r,u:w.u}))}:{})};}

/** Raumbuch prüfen: nur bekannte Felder, Längen begrenzt; Ungültiges weist die Datei ab, statt still etwas zu verlieren. */
export function validRaumbuch(value:unknown):Raumbuch{
  const r=value as Raumbuch,bad=()=>Error('Ungültiges Raumbuch in der Projektdatei.');
  if(!r||typeof r!=='object'||Array.isArray(r)||!Array.isArray(r.rooms)||r.rooms.length>500)throw bad();
  const str=(v:unknown,max:number,need=false)=>v===undefined?!need:typeof v==='string'&&v.length<=max&&(!need||!!v.trim());
  const rooms:RaumEintrag[]=r.rooms.map(e=>{
    if(!e||typeof e!=='object'||!str(e.floor,40)||typeof e.floor!=='string'||!str(e.name,MAX_RAUM,true)||(e.status!==undefined&&!RAUM_STATUS.includes(e.status))||!str(e.massnahme,500)||!str(e.bemerkung,500))throw bad();
    return {floor:e.floor,name:e.name,...(e.status?{status:e.status}:{}),...(e.massnahme?{massnahme:e.massnahme}:{}),...(e.bemerkung?{bemerkung:e.bemerkung}:{})};
  });
  let alias:Record<string,string>|undefined;
  if(r.alias!==undefined){
    if(!r.alias||typeof r.alias!=='object'||Array.isArray(r.alias)||Object.keys(r.alias).length>500)throw bad();
    alias={};for(const [k,v] of Object.entries(r.alias)){if(k.length>200||typeof v!=='string'||v.length>200||k===v||k==='__proto__')throw bad();alias[k]=v;}
    if(!Object.keys(alias).length)alias=undefined;
  }
  return {rooms,...(alias?{alias}:{})};
}
