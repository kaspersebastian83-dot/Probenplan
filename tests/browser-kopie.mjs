// Browser-Zwischenspeicherung ohne Projektordner (ab 1.52): kein stilles Wiederherstellen einer Kopie unbekannter Herkunft,
// Projekte aus dem Projektordner überschreiben die freie Sicherung nicht, und der Knopf oben sagt, dass er ersetzt.
// Der Archivordner wird im privaten Dateisystem des Browsers (OPFS) nachgebildet; nur Chromium kennt die Ordner-API.
import {chromium} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
const NAME='26.0123 Köln';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><path d="M20 20H780V580H20Z" fill="none" stroke="black" stroke-width="8"/></svg>';
const plan=name=>({name,mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const idb=(page,key)=>page.evaluate(key=>new Promise((resolve,reject)=>{const r=indexedDB.open('probenplan',1);r.onsuccess=()=>{const q=r.result.transaction('projects').objectStore('projects').get(key);q.onsuccess=()=>{r.result.close();resolve(q.result??null);};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}),key);
const idbDelete=(page,key)=>page.evaluate(key=>new Promise((resolve,reject)=>{const r=indexedDB.open('probenplan',1);r.onsuccess=()=>{const tx=r.result.transaction('projects','readwrite');tx.objectStore('projects').delete(key);tx.oncomplete=()=>{r.result.close();resolve();};tx.onerror=()=>reject(tx.error);};r.onerror=()=>reject(r.error);}),key);
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
const gesichert=page=>page.locator('#saved').filter({hasText:'nicht in einem Projektordner'}).waitFor({state:'attached'});
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await check('Knopf oben: ohne Plan „＋ Plan“, mit Plan „Grundriss ersetzen …“ (ein weiteres Geschoss legt „＋ Plan“ unter dem Plan an)',async()=>{
  assert.equal((await page.locator('#load').textContent()).trim(),'＋ Plan');
  await page.locator('#file').setInputFiles(plan('Erdgeschoss.svg'));await page.locator('#welcome').waitFor({state:'hidden'});
  assert.equal((await page.locator('#load').innerText()).trim(),'Plan ersetzen …','im schmalen Fenster die kürzere Fassung (die Statusanzeige bleibt sichtbar)');
  await page.setViewportSize({width:1800,height:900});assert.equal((await page.locator('#load').innerText()).trim(),'Grundriss ersetzen …');await page.setViewportSize({width:1366,height:768});
  assert.match(await page.locator('#load').getAttribute('title'),/Markierungen und Flächen.*weiteres Geschoss.*„＋ Plan“/s);
  await page.locator('#sheet-add').first().waitFor({state:'attached'}).catch(()=>{});
 });
 await check('Freie Sicherung: Status sagt „nicht in einem Projektordner“, Vermerk zur Herkunft wird geschrieben',async()=>{
  await page.keyboard.press('p');await tap(page,.4,.5);await gesichert(page);
  assert.equal((await idb(page,'current')).markers.length,1);
  const meta=await idb(page,'current-meta');assert.ok(meta&&meta.savedAt>0&&typeof meta.name==='string','Vermerk vorhanden');
 });
 await check('„Grundriss ersetzen …“ fragt und sagt, was verloren geht; Abbrechen ändert nichts',async()=>{
  await page.locator('#file').setInputFiles(plan('Neu.svg'));await page.locator('#replace-dialog').waitFor();
  assert.equal((await page.locator('#replace-dialog h2').textContent()).trim(),'Aktuellen Plan ersetzen?');
  assert.match(await page.locator('#replace-dialog p').textContent(),/mit allen Markierungen und Flächen.*nur in diesem Browser/s);
  await page.locator('#replace-cancel').click();assert.equal(await page.locator('.marker-row').count(),1);
 });
 await check('Neustart ohne Projektordner: freier Plan mit Vermerk kommt zurück – ausdrücklich als „nicht in einem Projektordner“',async()=>{
  await page.reload();await page.locator('.marker-row').first().waitFor();
  assert.match(await page.locator('#saved').textContent(),/nicht in einem Projektordner/);
  assert.match(await page.locator('#toast').textContent(),/Browser-Zwischenspeicherung.*in keinem Projektordner/);
 });
 await check('Sicherung ohne Herkunftsvermerk (ältere Version): wird nicht still geöffnet – erst fragen, Datei sichern geht ohne Öffnen',async()=>{
  await idbDelete(page,'current-meta');await page.reload();
  await page.locator('#ask-dialog[open]').waitFor();
  assert.equal((await page.locator('#ask-title').textContent()).trim(),'Browser-Zwischenspeicherung gefunden');
  assert.match(await page.locator('#ask-text').textContent(),/Kopie eines Projekts.*Projektzentrale/s);
  assert.equal(await page.locator('#welcome').isHidden(),false,'noch kein Plan geöffnet');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#ask-actions button',{hasText:'Als Datei sichern'}).click()]);
  assert.match(download.suggestedFilename(),/\(Browserkopie\)\.probenplan$/);
  await page.locator('#ask-dialog[open]').waitFor({state:'detached'}).catch(()=>{});
  assert.equal(await page.locator('#welcome').isHidden(),false,'Sichern öffnet nichts');
  assert.equal((await idb(page,'current')).markers.length,1,'die Sicherung bleibt unverändert liegen');
 });
 await check('… „Trotzdem öffnen“ öffnet sie als freien Plan und schreibt ab jetzt den Vermerk; der nächste Start fragt nicht mehr',async()=>{
  await page.reload();await page.locator('#ask-dialog[open]').waitFor();
  await page.locator('#ask-actions button',{hasText:'Trotzdem öffnen'}).click();await page.locator('.marker-row').first().waitFor();
  await gesichert(page);for(let i=0;i<30&&!await idb(page,'current-meta');i++)await page.waitForTimeout(100);assert.ok(await idb(page,'current-meta'));
  await page.reload();await page.locator('.marker-row').first().waitFor();assert.equal(await page.locator('#ask-dialog[open]').count(),0);
 });
 await check('Projekt aus dem Projektordner überschreibt die freie Sicherung nicht und kommt nie als freier Plan zurück',async()=>{
  const vorher=JSON.stringify(await idb(page,'current'));const metaVorher=JSON.stringify(await idb(page,'current-meta'));
  await page.evaluate(async([name,svg])=>{const root=await navigator.storage.getDirectory(),archiv=await root.getDirectoryHandle('Mosaik Archivordner',{create:true});
   const proj=await archiv.getDirectoryHandle(name,{create:true});
   for(const sub of ['Pläne','Laborergebnisse','Laboraufträge','Fotos'])await proj.getDirectoryHandle(sub,{create:true});
   const write=async(d,n,t)=>{const w=await(await d.getFileHandle(n,{create:true})).createWritable();await w.write(t);await w.close();};
   await write(proj,'_Projekt.json',JSON.stringify({format:'mosaik-projekt',version:1,objekt:'Wohnhaus Musterstraße 1'}));await write(await proj.getDirectoryHandle('Pläne'),'Grundriss EG.svg',svg);
   await new Promise((res,rej)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const tx=r.result.transaction('kv','readwrite');tx.objectStore('kv').put(archiv,'archiv');tx.oncomplete=()=>{r.result.close();res();};tx.onerror=()=>rej(tx.error);};r.onerror=()=>rej(r.error);});},[NAME,svg]);
  await page.goto(`${base}/?projekt=${encodeURIComponent(NAME)}`);await page.locator('#project-badge:not([hidden])').waitFor();
  await page.locator('#folder-plans button',{hasText:'Grundriss EG.svg'}).click();await page.locator('#welcome').waitFor({state:'hidden'});
  await page.keyboard.press('p');await tap(page,.3,.4);await page.locator('#saved',{hasText:/^✓ In „Pläne“ gespeichert$/}).waitFor({state:'attached'});
  assert.ok(await idb(page,`projekt:${NAME}`),'Fassung liegt unter dem Ordnerschlüssel');
  assert.equal(JSON.stringify(await idb(page,'current')),vorher,'freie Sicherung unverändert');assert.equal(JSON.stringify(await idb(page,'current-meta')),metaVorher);
 });
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
