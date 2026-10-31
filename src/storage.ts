import type {Project} from './model';
export interface BrowserDraft {savedAt:number;project:Project;dirty?:boolean;baseRevision?:string|null}
/** Herkunft der freien Browsersicherung („current“): nur Pläne ohne Projektordner schreiben sie (ab 1.52). Ohne Vermerk ist die Herkunft unbekannt. */
/** Freie Browsersicherung (ab 1.52): der Vermerk steht im selben Datensatz wie der Plan. Ältere Versionen bauen das Projekt beim
 *  Einlesen aus bekannten Feldern neu auf und schreiben es ohne Vermerk – was sie unter „current“ ablegen, gilt so nie als freier Plan. */
export type FreieKopie=Project&{browserKopie:{frei:true;savedAt:number}};
async function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('probenplan',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveLocal(p:Project|BrowserDraft|FreieKopie,key='current'){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(p,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export async function restoreLocal(key='current'):Promise<unknown>{const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function download(blob:Blob,name:string){
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
