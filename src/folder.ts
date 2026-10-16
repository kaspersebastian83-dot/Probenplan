// Projektordner: PlanKit arbeitet direkt im Ordner „Pläne“ eines Projekts (z. B. „26.0123 Köln“).
// Gemeinsame Absprache mit Projektzentrale und FotoKit (dort identisch halten):
//  • IndexedDB „mosaik-suite“ v1, Store „kv“, Schlüssel „archiv“ → Handle des Ordners „Mosaik Archivordner“
//    (alle Apps unter kaspersebastian83-dot.github.io teilen diese Datenbank)
//  • Projektordner „<JJ>.<Nummer> <Schadenort>“, Pläne im Unterordner „Pläne“, Laborberichte in „Laborergebnisse“
//  • _Projekt.json im Projektordner: gemeinsame Projektdaten – PlanKit liest sie nur.
type Mode={mode:'read'|'readwrite'};
type Handle=FileSystemHandle&{queryPermission?:(m:Mode)=>Promise<PermissionState>;requestPermission?:(m:Mode)=>Promise<PermissionState>};
type Dir=FileSystemDirectoryHandle&{values():AsyncIterable<FileSystemHandle>;resolve(h:FileSystemHandle):Promise<string[]|null>};
export interface ProjectFolder {dir:Dir;name:string;nr:string;ort:string;plaene:Dir}
export interface FolderFile {name:string;handle:FileSystemFileHandle;lastModified:number}
export const PLAENE='Pläne',LABOR='Laborergebnisse',PJ_FILE='_Projekt.json';
export const supported=()=>'showDirectoryPicker' in window;

export function parseProjName(name:string){const m=/^(\d{2})\.(\d{2,6})(?:[\s_-]+(.*))?$/.exec(String(name).normalize('NFC').trim());return m?{nr:`${m[1]}.${m[2]}`,ort:(m[3]||'').trim()}:null;}
export const projectFileName=(f:ProjectFolder)=>`Probenplan ${f.name}.probenplan`;
export const safeName=(s:string)=>s.replace(/[<>:"/\\|?*]/g,'_').trim();

function suite(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function archiv():Promise<Dir|null>{try{const db=await suite();try{return await new Promise<Dir|null>((resolve,reject)=>{const r=db.transaction('kv').objectStore('kv').get('archiv');r.onsuccess=()=>resolve((r.result as Dir)||null);r.onerror=()=>reject(r.error);});}finally{db.close();}}catch{return null;}}
/** Schreibrecht prüfen; mit request=true fragt der Browser (nur nach einem Klick erlaubt). */
export async function permission(h:FileSystemHandle,request=false){const x=h as Handle,o:Mode={mode:'readwrite'};try{if(!x.queryPermission||await x.queryPermission(o)==='granted')return true;return request&&!!x.requestPermission&&await x.requestPermission(o)==='granted';}catch{return false;}}

export async function findSubdir(dir:Dir,name:string):Promise<Dir|null>{try{return await dir.getDirectoryHandle(name) as Dir;}catch{/* Schreibweise abweichend? */}const want=name.normalize('NFC').toLowerCase();for await(const h of dir.values())if(h.kind==='directory'&&h.name.normalize('NFC').toLowerCase()===want)return h as Dir;return null;}
export async function listFiles(dir:Dir,pattern:RegExp):Promise<FolderFile[]>{const out:FolderFile[]=[];for await(const h of dir.values())if(h.kind==='file'&&pattern.test(h.name)){const f=await (h as FileSystemFileHandle).getFile();out.push({name:h.name,handle:h as FileSystemFileHandle,lastModified:f.lastModified});}return out.sort((a,b)=>b.lastModified-a.lastModified);}
export async function fileInfo(dir:Dir,name:string){try{const h=await dir.getFileHandle(name);return await h.getFile();}catch(e){if((e as DOMException).name==='NotFoundError')return null;throw e;}}
export async function writeFile(dir:Dir,name:string,data:Blob|string){const h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();try{await w.write(data);}catch(e){await w.abort().catch(()=>{});throw e;}await w.close();return (await h.getFile()).lastModified;}
export async function readProjectData(f:ProjectFolder):Promise<Record<string,unknown>>{try{const file=await fileInfo(f.dir,PJ_FILE);const text=file?await file.text():'';return text.trim()?JSON.parse(text):{};}catch{return {};}}

/** Projektordner öffnen; legt „Pläne“ bei Bedarf an (create). */
export async function openFolder(dir:Dir,create:boolean):Promise<ProjectFolder|'no-plaene'>{
  const p=parseProjName(dir.name);if(!p)throw Error(`„${dir.name}“ ist kein Projektordner (erwartet z. B. „26.0123 Köln“).`);
  let plaene=await findSubdir(dir,PLAENE);if(!plaene){if(!create)return 'no-plaene';plaene=await dir.getDirectoryHandle(PLAENE,{create:true}) as Dir;}
  return {dir,name:dir.name,nr:p.nr,ort:p.ort,plaene};
}
/** Aus einem gewählten Ordner (Projektordner oder dessen „Pläne“) den Projektordner bestimmen. */
export async function projectDirOf(dir:Dir):Promise<Dir|null>{
  if(parseProjName(dir.name))return dir;
  const root=await archiv();if(!root||!await permission(root))return null;
  try{const path=await root.resolve(dir);if(path&&path.length===2&&parseProjName(path[0]))return await root.getDirectoryHandle(path[0]) as Dir;}catch{/* außerhalb des Archivs */}
  return null;
}
export async function pickFolder():Promise<Dir|null>{
  const root=await archiv();const picker=(window as unknown as {showDirectoryPicker:(o:unknown)=>Promise<Dir>}).showDirectoryPicker;
  try{return await picker({mode:'readwrite',id:'plankit-projekt',...(root?{startIn:root}:{})});}catch(e){if((e as DOMException).name==='AbortError')return null;throw e;}
}
export async function fromArchiv(name:string):Promise<{root:Dir|null;dir?:Dir}>{const root=await archiv();if(!root)return {root:null};return {root,dir:await root.getDirectoryHandle(name) as Dir};}
