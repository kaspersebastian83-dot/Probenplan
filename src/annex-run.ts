// Anlage Probenahme erstellen (Browser-Teil): Planseiten und Ausschnitte rendern, Fotos aus FotoKit lesen, prüfen und
// verkleinern, Prüfsummen der Quelldateien berechnen, Word-Datei bauen und – im Projektordner – nie überschreibend
// in „Mitteilungen“ speichern (mit Zeile im „_Anlagen-Protokoll.txt“, wie die Anlagen aus der Projektzentrale).
import {build} from './docx';
import {annexBlocks,annexChecks,bohrkernNummern,collectSamples,photoLabels,scaleNotes,type AnnexCheck,type AnnexImage,type AnnexPhoto,type AnnexPlanPage,type AnnexSample,type AnnexSource} from './annex';
import {renderSheet,sheetLayout} from './sheet';
import {drawPlanContent} from './export';
import {clone,floorName,markerSize,sheetCount,sheetProject,type Project} from './model';
import {hasValues,prepare,rateMarkers} from './results';
import {vorlaeufigeBerichte,vorlaeufigText} from './lab-provenance';
import {fileInfo,fileRevision,findSubdir,listFiles,projectFileName,AUFTRAEGE,LABOR,PLAENE,type ProjectFolder} from './folder';

export const ANNEX_DIR='Mitteilungen',ANNEX_LOG='_Anlagen-Protokoll.txt',FOTOS='Fotos',FOTOKIT_FILE='_Bildumbenenner.json';
export interface AnnexOptions {title:string;maxPhotos:number;results:boolean;objekt:string;projectData:Record<string,unknown>;projectDataSource?:File|null;projectDataStale?:boolean;app:string;progress?:(text:string)=>void}
type Dir=ProjectFolder['dir'];

const stand=(ms:number)=>{const d=new Date(ms),z=(n:number)=>String(n).padStart(2,'0');return `${z(d.getDate())}.${z(d.getMonth()+1)}.${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`;};
const today=()=>{const d=new Date(),z=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;};
async function sha(data:BufferSource){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function canvasBytes(canvas:HTMLCanvasElement,type:'image/png'|'image/jpeg',quality?:number):Promise<AnnexImage>{
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Der Browser konnte das Bild nicht erzeugen.')),type,quality));
  return {data:new Uint8Array(await blob.arrayBuffer()),ext:type==='image/png'?'png':'jpeg',widthPx:canvas.width,heightPx:canvas.height};
}
const release=(c:HTMLCanvasElement|null)=>{if(c){c.width=1;c.height=1;}};

/** Je Geschoss eine maßstäbliche Planseite (Format „anlage“, 200 dpi). */
async function planPages(p:Project,o:AnnexOptions):Promise<AnnexPlanPage[]>{
  const n=sheetCount(p),out:AnnexPlanPage[]=[];
  for(let i=0;i<n;i++){o.progress?.(`Plan ${i+1} von ${n} wird gezeichnet …`);
    const view=clone(sheetProject(p,i)),rated=o.results?rateMarkers(view):null,layout=sheetLayout(view,'anlage',rated);let canvas:HTMLCanvasElement|null=null;
    try{canvas=await renderSheet(view,layout,rated,{objekt:o.objekt,page:i+1,pages:n},200);out.push({floor:floorName(p,i),image:await canvasBytes(canvas,'image/png'),widthMm:layout.width,heightMm:layout.height,ratio:layout.ratio,results:!!rated});}
    finally{release(canvas);}
  }
  return out;
}
/** Ausschnitt um eine Probe (ohne Maßstab) mit Markierungsring. */
async function excerpts(p:Project,o:AnnexOptions,samples:AnnexSample[]){
  for(let i=0;i<sheetCount(p);i++){
    const view=clone(sheetProject(p,i)),rated=o.results?rateMarkers(view):null,span=Math.max(view.plan.width,view.plan.height)*.3,r=markerSize(view);
    for(const m of view.markers){if(m.kind!=='sample')continue;const s=samples.find(x=>x.label===m.label&&x.placed);if(!s)continue;
      o.progress?.(`Lage ${m.label} …`);
      const box={x:m.lx-span*.75,y:m.ly-span*.5,width:span*1.5,height:span},W=900,k=W/box.width;let canvas:HTMLCanvasElement|null=document.createElement('canvas');
      try{canvas.width=W;canvas.height=Math.round(box.height*k);const ctx=canvas.getContext('2d');if(!ctx)throw Error('Kein Bildspeicher verfügbar.');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);await drawPlanContent(ctx,view,box,0,0,k,rated);
        ctx.strokeStyle='#e0ae42';ctx.lineWidth=5;ctx.setLineDash([12,8]);ctx.beginPath();ctx.arc((m.lx-box.x)*k,(m.ly-box.y)*k,Math.max(r*k*2.1,22),0,2*Math.PI);ctx.stroke();
        ctx.setLineDash([]);ctx.strokeStyle='#8a97a3';ctx.lineWidth=2;ctx.strokeRect(1,1,canvas.width-2,canvas.height-2);
        s.excerpt=await canvasBytes(canvas,'image/jpeg',.88);}
      finally{release(canvas);canvas=null;}
    }
  }
}

interface FotoKitImage {beschreibung?:string;abschnitt?:string;probe?:string;drehung?:number;aussortiert?:boolean;original?:{name?:string;aufnahme?:string};sha256?:{wert?:string}}
/** Fotos mit Probe-Nr. aus FotoKit: Datei lesen, Prüfsumme neu berechnen und mit FotoKit vergleichen, für die Anlage verkleinern. */
async function photos(f:ProjectFolder,o:AnnexOptions,samples:AnnexSample[],sources:AnnexSource[],bk?:Map<string,string[]>):Promise<AnnexPhoto[]|null>{
  const dir=await findSubdir(f.dir,FOTOS);if(!dir)return null;
  const json=await fileInfo(dir,FOTOKIT_FILE);if(!json)return null;
  let data:{bilder?:Record<string,FotoKitImage>;reihenfolge?:string[]};try{data=JSON.parse(await json.text());}catch{throw Error(`„${FOTOS}/${FOTOKIT_FILE}“ ist nicht lesbar.`);}
  sources.push({role:'Fotos und Probe-Nr. (FotoKit)',name:`${FOTOS}/${FOTOKIT_FILE}`,stand:stand(json.lastModified),sha:await sha(await json.arrayBuffer())});
  const rank=new Map((data.reihenfolge||[]).map((n,i)=>[n,i]));
  const entries=Object.entries(data.bilder||{}).filter(([,v])=>v&&!v.aussortiert&&String(v.probe||'').trim())
    .sort(([a],[b])=>(rank.get(a)??1e9)-(rank.get(b)??1e9)||a.localeCompare(b,'de',{numeric:true}));
  const labels=new Set(samples.map(s=>s.label)),shownPer=new Map<string,number>(),out:AnnexPhoto[]=[];
  for(const [i,[name,v]] of entries.entries()){
    o.progress?.(`Foto ${i+1} von ${entries.length} wird geprüft …`);
    const ls=photoLabels(String(v.probe),bk),file=await fileInfo(dir,name),stored=String(v.sha256?.wert||'').toLowerCase();
    const photo:AnnexPhoto={file:name,desc:String(v.beschreibung||'').trim(),section:String(v.abschnitt||'').trim(),taken:String(v.original?.aufnahme||'').trim(),sha:'',status:'missing',labels:ls,probe:String(v.probe).trim()};
    if(file){photo.sha=(await fileRevision(file))||'';photo.status=!stored?'nohash':stored===photo.sha?'ok':'changed';
      const wanted=ls.some(l=>labels.has(l)&&(shownPer.get(l)||0)<o.maxPhotos);
      if(wanted&&o.maxPhotos>0){try{photo.image=await shrink(file,Number(v.drehung)||0);ls.forEach(l=>shownPer.set(l,(shownPer.get(l)||0)+1));}catch{/* nicht lesbares Bildformat (z. B. HEIC): nur in der Liste */}}}
    out.push(photo);
  }
  return out;
}
/** Verkleinerte Kopie (längste Seite 1600 px, JPEG); EXIF-Ausrichtung und FotoKit-Drehung werden angewendet. */
async function shrink(file:File,rotation:number):Promise<AnnexImage>{
  const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});let canvas:HTMLCanvasElement|null=document.createElement('canvas');
  try{const turn=((Math.round(rotation/90)%4)+4)%4,s=Math.min(1,1600/Math.max(bmp.width,bmp.height)),w=Math.round(bmp.width*s),h=Math.round(bmp.height*s);
    canvas.width=turn%2?h:w;canvas.height=turn%2?w:h;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Kein Bildspeicher verfügbar.');
    ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(turn*Math.PI/2);ctx.drawImage(bmp,-w/2,-h/2,w,h);
    return await canvasBytes(canvas,'image/jpeg',.85);}
  finally{bmp.close();release(canvas);canvas=null;}
}
async function hashSource(dir:Dir|null,folderName:string,name:string,role:string,sources:AnnexSource[],missing:string[]){
  const file=dir?await fileInfo(dir,name):null;
  if(!file){missing.push(`${folderName}/${name}`);sources.push({role,name:`${folderName}/${name}`,stand:'–',sha:'nicht gefunden'});return;}
  sources.push({role,name:`${folderName}/${name}`,stand:stand(file.lastModified),sha:await sha(await file.arrayBuffer())});
}
export function annexFileName(nr:string,title:string,date:string,taken:string[]){
  const s=(v:string)=>v.normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  const base=[s(nr)||'Projekt',s(title)||'Anlage','Probenahme'].join('_').slice(0,64)+'_'+date,used=new Set(taken.map(n=>n.toLowerCase()));
  for(let i=1;i<1000;i++){const n=`${base}${i>1?`_${i}`:''}.docx`;if(!used.has(n.toLowerCase()))return n;}
  throw Error('Zu viele Anlagen mit gleichem Namen.');
}

/** Baut die Anlage. folder=null: ohne Fotos und Quelldateien (nur Projektstand), zum Herunterladen. */
export async function createAnnex(p:Project,folder:ProjectFolder|null,o:AnnexOptions){
  const project=clone(p),created=new Date().toISOString(),sources:AnnexSource[]=[],missing:string[]=[],extra:AnnexCheck[]=[];
  // Parameter und Skalen wie in der Ergebniskarte (fehlende Skalen aus FotoKit) – nur in der Kopie für die Anlage
  if(hasValues(project))prepare(project);
  const samples=collectSamples(project);if(!samples.length)throw Error('Im Projekt gibt es noch keine Proben.');
  const plans=await planPages(project,o);await excerpts(project,o,samples);
  let fotos:AnnexPhoto[]|null=null;
  if(folder){
    o.progress?.('Quelldateien werden geprüft …');
    const planFile=await fileInfo(folder.plaene,projectFileName(folder));
    sources.push(planFile?{role:'Lage, Proben, Messwerte (PlanKit)',name:`${PLAENE}/${projectFileName(folder)}`,stand:stand(planFile.lastModified),sha:(await fileRevision(planFile))||''}:{role:'PlanKit-Projekt',name:`${PLAENE}/${projectFileName(folder)}`,stand:'–',sha:'nicht gefunden'});
    const lab=await findSubdir(folder.dir,LABOR);
    for(const r of project.labReports||[])for(const name of [r.sources.xml,r.sources.pdf].filter((x):x is string=>!!x))
      await hashSource(lab,LABOR,name,`Laborbericht ${r.bericht||''} ${r.labor?`(${r.labor})`:''}`.replace(/\s+/g,' ').trim(),sources,missing);
    const auftraege=await findSubdir(folder.dir,AUFTRAEGE),daten=auftraege?(await listFiles(auftraege,/_Daten\.json$/i))[0]:undefined;
    let bk:Map<string,string[]>|undefined;
    if(daten){const file=await daten.handle.getFile(),bytes=await file.arrayBuffer();sources.push({role:'Probenerfassung LabelKit (neueste Datei)',name:`${AUFTRAEGE}/${daten.name}`,stand:stand(file.lastModified),sha:await sha(bytes)});
      try{bk=bohrkernNummern(JSON.parse(new TextDecoder().decode(bytes)));}catch{/* unlesbar: Bohrkern-IDs auf Fotos bleiben unzugeordnet (Prüfprotokoll nennt sie) */}}
    const pj=o.projectDataSource===undefined?await fileInfo(folder.dir,'_Projekt.json'):o.projectDataSource;
    if(pj)sources.push({role:o.projectDataStale?'Projektdaten (möglicherweise veraltet; Verwendung bestätigt)':'Projektdaten (Projektzentrale)',name:'_Projekt.json',stand:stand(pj.lastModified),sha:await sha(await pj.arrayBuffer())});
    if(o.projectDataStale)extra.push({text:'Gemeinsame Projektdaten möglicherweise veraltet',ok:false,detail:'Die erneute Aktualisierung war nicht erfolgreich. Verwendung für diese Anlage ausdrücklich bestätigt.'});
    fotos=await photos(folder,o,samples,sources,bk);
  }else{
    sources.push({role:'PlanKit-Projekt (nicht im Projektordner gespeichert)',name:'Projektstand beim Erstellen',stand:stand(Date.now()),sha:await sha(new TextEncoder().encode(JSON.stringify(project)))});
  }
  if(missing.length)extra.push({text:'Laborbericht-Dateien nicht im Ordner „Laborergebnisse“ gefunden',ok:false,detail:missing.join(', ')});
  {const v=vorlaeufigeBerichte(project);if(v.length)extra.push({text:'Werte aus vorläufigem Prüfbericht – sie können sich mit dem endgültigen Bericht ändern',ok:false,detail:v.map(r=>r.bericht||'(ohne Nummer)').join(', ')});}
  const parameter=project.results?.parameter||'';
  const checks=annexChecks(samples,fotos||[],plans,parameter,!!fotos,extra);
  o.progress?.('Word-Datei wird erstellt …');
  const blocks=annexBlocks({title:o.title,nr:folder?.nr||project.report||'',ort:folder?.ort||'',projectData:o.projectData,parameter,scaleNotes:scaleNotes(project),plans,samples,photos:fotos||[],sources,checks,created,app:o.app,maxPhotos:o.maxPhotos,photosIncluded:!!fotos,vorlaeufig:vorlaeufigText(vorlaeufigeBerichte(project))});
  const bytes=build({title:`${o.title}: Probenahme und Laborergebnisse${folder?` – Projekt ${folder.nr}`:''}`,author:o.app,application:o.app,created,blocks});
  return {bytes,checks,warnings:checks.filter(c=>!c.ok).length,created,source:sources[0]};
}
/** Im Projektordner speichern: „Mitteilungen“, datierter Name, nie überschreibend, zurücklesen, protokollieren. */
export async function saveAnnex(folder:ProjectFolder,title:string,data:Uint8Array,source:AnnexSource,app:string,created:string){
  const bytes=new Uint8Array(data);   // eigener ArrayBuffer (für Dateischreiben und Prüfsumme)
  const dir=await findSubdir(folder.dir,ANNEX_DIR)||await folder.dir.getDirectoryHandle(ANNEX_DIR,{create:true}) as Dir;
  const names:string[]=[];for await(const h of dir.values())names.push(h.name);
  const name=annexFileName(folder.nr,title,today(),names);
  try{await dir.getFileHandle(name);throw Error(`„${name}“ existiert bereits – nichts überschrieben.`);}catch(e){if((e as DOMException).name!=='NotFoundError')throw e;}
  const fh=await dir.getFileHandle(name,{create:true}),w=await fh.createWritable();await w.write(bytes);await w.close();
  const digest=await sha(bytes);if(await sha(await (await fh.getFile()).arrayBuffer())!==digest)throw Error(`„${name}“ wurde nicht vollständig geschrieben – bitte erneut erstellen.`);
  try{const ph=await dir.getFileHandle(ANNEX_LOG,{create:true}),old=await ph.getFile();
    const head=old.size?'':'Anlagen-Protokoll (Projektzentrale) – je Zeile: Zeit (UTC) | Anlage | SHA-256 der Anlage | Quelle | SHA-256 der Quelle | Programm\r\n';
    const pw=await ph.createWritable({keepExistingData:true});await pw.write({type:'write',position:old.size,data:head+[created,name,digest,source.name,source.sha,app].join(' | ')+'\r\n'});await pw.close();}
  catch{/* Protokoll ist Zusatz – die Anlage enthält das Prüfprotokoll selbst */}
  return {name,sha:digest};
}

/** Weitere Dokumente (Raumbuch als Word oder CSV) wie die Anlage in „Mitteilungen“ ablegen: nie überschreibend,
 *  zurückgelesen und mit Zeile im Anlagen-Protokoll. name() erhält die vorhandenen Dateinamen. */
export async function saveDocument(folder:ProjectFolder,name:(taken:string[])=>string,data:Uint8Array,sourceName:string,app:string,created:string){
  const bytes=new Uint8Array(data);
  const dir=await findSubdir(folder.dir,ANNEX_DIR)||await folder.dir.getDirectoryHandle(ANNEX_DIR,{create:true}) as Dir;
  const names:string[]=[];for await(const h of dir.values())names.push(h.name);
  const file=name(names);
  try{await dir.getFileHandle(file);throw Error(`„${file}“ existiert bereits – nichts überschrieben.`);}catch(e){if((e as DOMException).name!=='NotFoundError')throw e;}
  const fh=await dir.getFileHandle(file,{create:true}),w=await fh.createWritable();await w.write(bytes);await w.close();
  const digest=await sha(bytes);if(await sha(await (await fh.getFile()).arrayBuffer())!==digest)throw Error(`„${file}“ wurde nicht vollständig geschrieben – bitte erneut erstellen.`);
  try{const ph=await dir.getFileHandle(ANNEX_LOG,{create:true}),old=await ph.getFile();
    const head=old.size?'':'Anlagen-Protokoll (Projektzentrale) – je Zeile: Zeit (UTC) | Anlage | SHA-256 der Anlage | Quelle | SHA-256 der Quelle | Programm\r\n';
    const pw=await ph.createWritable({keepExistingData:true});await pw.write({type:'write',position:old.size,data:head+[created,file,digest,sourceName,'–',app].join(' | ')+'\r\n'});await pw.close();}
  catch{/* Protokoll ist Zusatz */}
  return {name:file,sha:digest};
}
