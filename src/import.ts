import DOMPurify from 'dompurify';
import { unzipSync } from 'fflate';
import { type Plan, type Project, type Preparation, validLabel } from './model';
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
export function loadImage(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Das Planbild konnte nicht geladen werden.'));img.src=src;});}
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
  const p=value as Project;
  if(!p||p.format!=='probenplan'||![1,2].includes(p.version)||!p.plan||typeof p.plan.data!=='string'||!Array.isArray(p.markers)||p.markers.length>3000)throw Error('Ungültige oder nicht unterstützte Projektdatei.');
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
    const w=edit.rotation%180?plan.height:plan.width,h=edit.rotation%180?plan.width:plan.height;
    if(c.x+c.width>w+.01||c.y+c.height>h+.01||Math.abs(p.plan.width-c.width)>.01||Math.abs(p.plan.height-c.height)>.01)throw Error('Der gespeicherte Zuschnitt liegt außerhalb des Originalplans.');
    plan.preparation={sourceWidth:edit.sourceWidth,sourceHeight:edit.sourceHeight,rotation:edit.rotation as Preparation['rotation'],crop:{x:c.x,y:c.y,width:c.width,height:c.height}};plan.width=c.width;plan.height=c.height;
  }
  const ids=new Set<string>();const labels=new Set<string>();
  for(const m of p.markers){
    if(!m||!['sample','fire'].includes(m.kind)||typeof m.id!=='string'||!/^[\w-]{1,80}$/.test(m.id)||ids.has(m.id)||typeof m.label!=='string'||!validLabel({...p,markers:[]},m.label,m.id)||labels.has(m.label.toLocaleUpperCase())||typeof m.note!=='string'||m.note.length>500||![m.x,m.y,m.lx,m.ly].every(n=>Number.isFinite(n)&&Math.abs(n)<1_000_000))throw Error('Ungültige oder doppelte Markierungen in der Projektdatei.');
    ids.add(m.id);labels.add(m.label.toLocaleUpperCase());
  }
  if(![p.nextSample,p.nextFire].every(n=>Number.isSafeInteger(n)&&n>=1&&n<1e9))throw Error('Ungültige Startnummer.');
  return {format:'probenplan',version:plan.pdf||plan.preparation?2:p.version,plan,markers:p.markers.map(m=>({id:m.id,kind:m.kind,label:m.label,note:m.note,x:m.x,y:m.y,lx:m.lx,ly:m.ly})),nextSample:p.nextSample,nextFire:p.nextFire,report:p.report,date:p.date};
}
