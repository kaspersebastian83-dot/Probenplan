import type {Project} from './model';
async function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('probenplan',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveLocal(p:Project|{savedAt:number;project:Project},key='current'){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(p,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export async function restoreLocal(key='current'):Promise<unknown>{const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function download(blob:Blob,name:string){
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
