import DOMPurify from 'dompurify';
import { unzipSync } from 'fflate';
import { type Plan, type Project, validLabel } from './model';
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
export async function readPlan(name:string,bytes:Uint8Array):Promise<Plan>{
  if(bytes.length>MAX)throw Error('Die Plandatei ist zu groß (maximal 60 MB).');
  if(/\.svg$/i.test(name)){const p=sanitizeSVG(new TextDecoder().decode(bytes));await loadImage(p.data);return {...p,name,vector:true};}
  const mime=/\.png$/i.test(name)?'image/png':'image/jpeg';
  const data=await new Promise<string>((res,rej)=>{const reader=new FileReader();reader.onload=()=>res(String(reader.result));reader.onerror=()=>rej(Error('Datei nicht lesbar.'));reader.readAsDataURL(new Blob([bytes as BlobPart],{type:mime}));});
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
  if(!result.length)throw Error('Kein SVG-, PNG- oder JPG-Plan im ZIP gefunden. PDF, DXF und CSV werden noch nicht unterstützt.');return result;
}
export async function validateProject(value:unknown):Promise<Project>{
  const p=value as Project;
  if(!p||p.format!=='probenplan'||p.version!==1||!p.plan||typeof p.plan.data!=='string'||!Array.isArray(p.markers)||p.markers.length>3000)throw Error('Ungültige oder nicht unterstützte Projektdatei.');
  if(typeof p.plan.name!=='string'||typeof p.report!=='string'||p.report.length>100||typeof p.date!=='string'||(p.date!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(p.date)))throw Error('Ungültige Projektdaten.');
  if(p.plan.data.length>MAX*1.5)throw Error('Die Projektdatei enthält einen zu großen Plan.');
  let plan:Plan;
  if(p.plan.data.startsWith('data:image/svg+xml;base64,')){
    const decoded=new TextDecoder().decode(Uint8Array.from(atob(p.plan.data.split(',')[1]),c=>c.charCodeAt(0)));
    plan={...sanitizeSVG(decoded),name:p.plan.name,vector:true};await loadImage(plan.data);
  }else if(/^data:image\/(png|jpeg);base64,/.test(p.plan.data)&&safeData(p.plan.data)){
    const img=await loadImage(p.plan.data);if(img.naturalWidth*img.naturalHeight>50_000_000)throw Error('Das Planbild ist zu groß.');
    plan={name:p.plan.name,data:p.plan.data,width:img.naturalWidth,height:img.naturalHeight,vector:false};
  }else throw Error('Die Projektdatei enthält kein zulässiges Planbild.');
  const ids=new Set<string>();const labels=new Set<string>();
  for(const m of p.markers){
    if(!m||!['sample','fire'].includes(m.kind)||typeof m.id!=='string'||!/^[\w-]{1,80}$/.test(m.id)||ids.has(m.id)||typeof m.label!=='string'||!validLabel({...p,markers:[]},m.label,m.id)||labels.has(m.label.toLocaleUpperCase())||typeof m.note!=='string'||m.note.length>500||![m.x,m.y,m.lx,m.ly].every(n=>Number.isFinite(n)&&Math.abs(n)<1_000_000))throw Error('Ungültige oder doppelte Markierungen in der Projektdatei.');
    ids.add(m.id);labels.add(m.label.toLocaleUpperCase());
  }
  if(![p.nextSample,p.nextFire].every(n=>Number.isSafeInteger(n)&&n>=1&&n<1e9))throw Error('Ungültige Startnummer.');
  return {format:'probenplan',version:1,plan,markers:p.markers.map(m=>({id:m.id,kind:m.kind,label:m.label,note:m.note,x:m.x,y:m.y,lx:m.lx,ly:m.ly})),nextSample:p.nextSample,nextFire:p.nextFire,report:p.report,date:p.date};
}
