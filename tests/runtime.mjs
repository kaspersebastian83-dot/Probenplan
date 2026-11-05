// Shared Playwright diagnostics; uses the existing test dependency.
import {chromium as chromiumType,webkit as webkitType,devices} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export {devices};
const suite=process.env.TEST_SUITE||'standalone',out=resolve('.test-output/diagnostics',suite);
let sequence=0;
// Nur lokal: PK_CHROMIUM=<Pfad zu chrome> nimmt ein vorhandenes Chromium; ohne installiertes WebKit läuft der WebKit-Teil dann ebenfalls darauf. Die CI setzt die Variable nicht.
// Lokal je Kontext ein persistentes Profil: das neuere Chromium stürzt im Inkognito-Kontext ab, sobald ein Ordnergriff (OPFS) aus IndexedDB gelesen wird.
const lokal=process.env.PK_CHROMIUM||'';
async function lokalBrowser(options){
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),offen=[];
 const roh=async(o={})=>{const dir=await mkdtemp(resolve(tmpdir(),'pk-profil-')),c=await chromiumType.launchPersistentContext(dir,{...options,...o,executablePath:lokal});for(const p of c.pages())await p.close();offen.push(c);
  const zu=c.close.bind(c);c.close=async()=>{await zu().catch(()=>{});await rm(dir,{recursive:true,force:true}).catch(()=>{});};return c;};
 return {newContext:roh,async newPage(o){return (await roh(o)).newPage();},async close(){for(const c of offen)await c.close();},contexts:()=>offen,isConnected:()=>true};
}
function instrument(type){return new Proxy(type,{get(target,key){if(key!=='launch')return typeof target[key]==='function'?target[key].bind(target):target[key];return async options=>{
 const browser=lokal?await lokalBrowser(options):await target.launch(options),newContext=browser.newContext.bind(browser),contexts=new Map();
 browser.newContext=async options=>{const context=await newContext(options),id=++sequence,logs=[];
  // Die Liste rechts ist standardmäßig eingeklappt. Die Funktionssuites arbeiten mit geöffneter Liste;
  // layout.mjs prüft den Standard (Aufruf mit ?layout-default).
  await context.addInitScript(()=>{try{if(!location.search.includes('layout-default')&&localStorage.getItem('plankit:panel')===null)localStorage.setItem('plankit:panel','open');}catch{}});
  // Weiter-Platzieren ist ab 1.47 standardmäßig an; die übrigen Suites prüfen das Platzieren einzeln (Ansicht danach), weiter-platzieren-browser.mjs den Standard (?weiter-default).
  await context.addInitScript(()=>{try{if(!location.search.includes('weiter-default')&&localStorage.getItem('plankit-weiter-platzieren')===null)localStorage.setItem('plankit-weiter-platzieren','0');}catch{}});
  // Ab 2.0 gibt es nur noch die Probenliste (Schalter „Neue Liste (Test)“ entfällt).
  // Ausgabe (③): ab 2.0 ist ohne Projektordner „PDF · A4“ vorgewählt, im Ordner die Anlage; die übrigen Suites starten wie bisher mit PNG, oberflaeche-browser.mjs prüft die Vorwahl (?format-default).
  await context.addInitScript(()=>{try{if(!location.search.includes('format-default')&&localStorage.getItem('plankit-format')===null)localStorage.setItem('plankit-format','png');}catch{}});
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  context.on('page',page=>{page.on('pageerror',e=>logs.push({type:'pageerror',message:e.stack||e.message}));page.on('console',m=>{if(m.type()==='error')logs.push({type:'console',message:m.text()});});});
  let captured=false;const capture=async()=>{if(captured)return;captured=true;await mkdir(out,{recursive:true});for(const [i,page] of context.pages().entries()){await page.screenshot({path:resolve(out,`${type.name()}-${id}-page-${i}.png`),fullPage:true,timeout:5000}).catch(()=>{});}await context.tracing.stop({path:resolve(out,`${type.name()}-${id}-trace.zip`)}).catch(()=>{});await writeFile(resolve(out,`${type.name()}-${id}-console.json`),JSON.stringify(logs,null,2));};contexts.set(context,capture);
  const close=context.close.bind(context);context.close=async()=>{await capture();contexts.delete(context);await close();};return context;};
 const close=browser.close.bind(browser);browser.close=async()=>{await Promise.allSettled([...contexts.values()].map(capture=>capture()));await close();};return browser;
 };}});}
export const chromium=instrument(chromiumType),webkit=instrument(webkitType);

// Ab 2.0 ist die Ausgabe Schritt ③ (Exportkarte offen in der rechten Spalte); „Schließen“ = zurück zu ② Proben setzen.
export async function openExport(page){if(await page.evaluate(()=>document.body.dataset.pkSchritt)!=='3')await page.locator('[data-pk-step="3"]').click();await page.locator('#format').waitFor();}
export async function closeExport(page){if(await page.evaluate(()=>document.body.dataset.pkSchritt)==='3')await page.locator('[data-pk-step="2"]').click();}

// Observe durable state for repeated assertions; project downloads are tested separately.
// Ab 1.52 trägt die freie Sicherung den Vermerk browserKopie (nur Browser, nie in der Projektdatei) – für den Vergleich mit dem Projekt weglassen.
export async function savedProject(page){
 await page.locator('#save-project').click({trial:true});
 await page.locator('#saved').filter({hasText:'Lokal gesichert'}).waitFor({state:'attached'});
 return page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('probenplan',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,read=db.transaction('projects').objectStore('projects').get('current');read.onsuccess=()=>{db.close();const r=read.result;if(r&&typeof r==='object'){const {browserKopie,...p}=r;resolve(p);}else resolve(r);};read.onerror=()=>{db.close();reject(read.error);};};}));
}
export async function downloadedProject(page){
 const pending=page.waitForEvent('download');await page.locator('#save-project').click();
 const download=await pending;const {readFile}=await import('node:fs/promises');return JSON.parse(await readFile(await download.path(),'utf8'));
}
