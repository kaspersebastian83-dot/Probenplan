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
export const PLAENE='Pläne',LABOR='Laborergebnisse',AUFTRAEGE='Laboraufträge',PJ_FILE='_Projekt.json';
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
export async function writeFile(dir:Dir,name:string,data:Blob|string){const h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();try{await w.write(data);await w.close();}catch(e){await w.abort().catch(()=>{});throw e;}return (await h.getFile()).lastModified;}
/** Read errors must propagate; an empty object is only valid JSON or a verified missing file. */
export async function readProjectData(f:ProjectFolder):Promise<Record<string,unknown>>{
 const file=await fileInfo(f.dir,PJ_FILE);
 if(!file){for await(const h of f.dir.values())if(h.name===PJ_FILE)throw Error('Die vorhandene _Projekt.json ist nicht lesbar.');return {};}
 const data:unknown=JSON.parse(await file.text());
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ungültige gemeinsame Projektdaten.');
 return data as Record<string,unknown>;
}

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

/** Content identity detects deletion and replacements even with equal/older timestamps. */
export async function fileRevision(file:File|null):Promise<string|null>{
 if(!file)return null;
 const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
 return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export class FolderConflict extends Error{
 constructor(public current:File|null,public revision:string|null){super('Die Projektdatei wurde an anderer Stelle gespeichert, ersetzt oder gelöscht.');}
}
/** Zeitstempel in Ortszeit („2026-10-16 21-37-16-853“), wie die Uhr im Büro – UTC („19-37“) verwirrte beim Wiederherstellen. */
export function localStamp(d=new Date()){const z=(n:number,l=2)=>String(n).padStart(l,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}-${z(d.getMinutes())}-${z(d.getSeconds())}-${z(d.getMilliseconds(),3)}`;}
/** Zeitpunkt aus dem Namen einer Sicherung: neue Namen in Ortszeit, ältere (bis 1.12.0) in UTC mit „T…Z“. */
export function stampTime(rest:string):number|null{
 let m=rest.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/);if(m)return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],+m[7]);
 m=rest.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})-(\d{3})(?=[ )])/);if(m)return new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],+m[7]).getTime();
 return null;
}
const uniqueName=(f:ProjectFolder,kind:string)=>`Probenplan ${f.name} (${kind} ${localStamp()} ${crypto.randomUUID().slice(0,8)}).probenplan`;
/** Always use a fresh filename: backups/recovery files are never recycled. */
export async function writeProjectCopy(f:ProjectFolder,kind:string,text:string){const name=uniqueName(f,kind);await writeFile(f.plaene,name,text);if(await (await fileInfo(f.plaene,name))?.text()!==text)throw Error('Sicherungsdatei konnte nicht bestätigt werden.');return name;}
/** Serialize cooperating tabs; detect external changes again immediately before replacement.
 * File System Access commits a writable stream on close. A recovery file survives a failed close. */
export async function saveFolderProject(f:ProjectFolder,text:string,expected:string|null){
 if(!navigator.locks)throw Error('Sicheres Speichern benötigt Chrome oder Edge mit Web Locks.');
 return navigator.locks.request(`plankit:project:${f.name}`,async()=>{
  if(!await permission(f.dir))throw Error('Schreibzugriff fehlt. Bitte „Speichern“ klicken und den Zugriff erneut erlauben.');
  const name=projectFileName(f),current=await fileInfo(f.plaene,name),revision=await fileRevision(current);
  if(revision!==expected)throw new FolderConflict(current,revision);
  // A failed backup must stop the save before touching the canonical project file.
  const backup=current?await writeProjectCopy(f,'vorher',await current.text()):null;
  const recovery=await writeProjectCopy(f,'Wiederherstellung',text);
  const latest=await fileInfo(f.plaene,name),latestRevision=await fileRevision(latest);
  if(latestRevision!==expected)throw new FolderConflict(latest,latestRevision);
  await writeFile(f.plaene,name,text);
  const committed=await fileInfo(f.plaene,name),wanted=await fileRevision(new File([text],name));
  if(await fileRevision(committed)!==wanted)throw Error('Die geschriebene Datei konnte nicht bestätigt werden. Wiederherstellungsdatei bleibt erhalten.');
  // Cleanup failure does not invalidate a verified save; the candidate remains available.
  await f.plaene.removeEntry(recovery).catch(()=>{});
  // Older interrupted attempts with the exact committed bytes are resolved too.
  // Different candidates and all previous-file backups remain untouched.
  try{for(const candidate of await listFiles(f.plaene,/\.probenplan$/i))if(candidate.name.startsWith(`Probenplan ${f.name} (Wiederherstellung `)&&await fileRevision(await candidate.handle.getFile())===wanted)await f.plaene.removeEntry(candidate.name);}catch{/* Keep candidates if cleanup is unavailable. */}
  await pruneBackups(f);
  return {revision:wanted,backup};
 });
}

/** Every save keeps the previous file as a backup. To stop them piling up in the shared folder, keep the newest
 * KEEP_RECENT plus the newest one of each of the last KEEP_DAYS days. Only "(vorher …)" backups are touched –
 * recovery files, manual copies and the project file itself are never removed. Failures here never fail a save. */
export const KEEP_RECENT=10,KEEP_DAYS=30;
export async function pruneBackups(f:ProjectFolder){
 try{
  const prefix=`Probenplan ${f.name} (vorher `,names:string[]=[];
  for await(const h of f.plaene.values())if(h.kind==='file'&&h.name.startsWith(prefix)&&h.name.endsWith(').probenplan'))names.push(h.name);
  // Nach Zeitpunkt sortieren (alte UTC- und neue Ortszeit-Namen gemischt), Tag in Ortszeit
  const time=new Map(names.map(n=>[n,stampTime(n.slice(prefix.length))]));
  names.sort((a,b)=>(time.get(b)??-1)-(time.get(a)??-1)||b.localeCompare(a));
  const keep=new Set(names.slice(0,KEEP_RECENT)),days=new Set<string>();
  for(const n of names){const t=time.get(n);
   if(t==null){keep.add(n);continue;}
   const d=new Date(t),day=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
   if(!days.has(day)&&days.size<KEEP_DAYS){days.add(day);keep.add(n);}}
  for(const n of names)if(!keep.has(n))await f.plaene.removeEntry(n).catch(()=>{});
 }catch{/* pruning is best effort */}
}
