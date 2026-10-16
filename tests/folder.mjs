// Projektordner: Öffnen aus der Projektzentrale (?projekt=), automatisches Speichern in „Pläne“, Bilder dorthin,
// Grundrisse und Laborberichte aus dem Projekt, Konflikt bei fremder Änderung, Sicherungskopie beim Ersetzen.
// Der Archivordner wird im privaten Dateisystem des Browsers (OPFS) nachgebildet; nur Chromium kennt die Ordner-API.
import {chromium} from './runtime.mjs';
import {labXML} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
const NAME='26.0123 Köln',FILE=`Probenplan ${NAME}.probenplan`;
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><path d="M20 20H780V580H20Z" fill="none" stroke="black" stroke-width="8"/></svg>';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
// Hilfsfunktionen im Browser: Dateien im nachgebildeten Archiv lesen/schreiben.
const fs=(page,action,...args)=>page.evaluate(async([action,args])=>{
 const root=await navigator.storage.getDirectory(),archiv=await root.getDirectoryHandle('Mosaik Archivordner',{create:true});
 const dir=async path=>{let d=archiv;for(const p of path)d=await d.getDirectoryHandle(p,{create:true});return d;};
 if(action==='setup'){const [name,svg,xml]=args;const proj=await dir([name]);for(const sub of ['Pläne','Laborergebnisse','Laboraufträge','Fotos'])await proj.getDirectoryHandle(sub,{create:true});
  const write=async(d,n,t)=>{const w=await(await d.getFileHandle(n,{create:true})).createWritable();await w.write(t);await w.close();};
  await write(proj,'_Projekt.json',JSON.stringify({format:'mosaik-projekt',version:1,objekt:'Wohnhaus Musterstraße 1'}));await write(await dir([name,'Pläne']),'Grundriss EG.svg',svg);await write(await dir([name,'Laborergebnisse']),'AR-999.xml',xml);await write(await dir([name,'Laboraufträge']),'26.0123_15.10.2026_Daten.json',JSON.stringify({version:'4.24.0',projekt:{nr:'26.0123'},proben:[{id:1,_nr:1,matrix:'Wischprobe',z2:'Küche',z3:'Fensterbank',cm2:'400',datum:'2026-10-15'}],chloridProben:[{id:7,_nr:2,chloridNr:2,matrix:'Wischprobe',z2:'Flur',z3:'Wand',cm2:'100',datum:'2026-10-15'}],asbestProben:[],sonstigeProben:[]}));
  await new Promise((res,rej)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const tx=r.result.transaction('kv','readwrite');tx.objectStore('kv').put(archiv,'archiv');tx.oncomplete=()=>{r.result.close();res();};tx.onerror=()=>rej(tx.error);};r.onerror=()=>rej(r.error);});return true;}
 if(action==='list'){const d=await dir(args[0]);const out=[];for await(const h of d.values())out.push(h.name);return out.sort();}
 if(action==='read'){const d=await dir(args[0]);try{return await(await(await d.getFileHandle(args[1])).getFile()).text();}catch{return null;}}
 if(action==='write'){const d=await dir(args[0]);const w=await(await d.getFileHandle(args[1],{create:true})).createWritable();await w.write(args[2]);await w.close();return true;}
},[action,args]);
const saved=async page=>{await page.locator('#saved',{hasText:'gespeichert'}).waitFor({state:'attached'});for(let i=0;i<40;i++){const t=await fs(page,'read',[NAME,'Pläne'],FILE);if(t)return JSON.parse(t);await page.waitForTimeout(100);}throw Error('Projektdatei fehlt');};
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await fs(page,'setup',NAME,svg,labXML());
 await check('?projekt= öffnet das Projekt, zeigt Nummer/Ort und bietet Grundrisse aus „Pläne“ an',async()=>{
  await page.goto(`${base}/?projekt=${encodeURIComponent(NAME)}`);await page.locator('#project-badge:not([hidden])').waitFor();
  assert.equal((await page.locator('#project-badge').textContent()).trim(),'26.0123 Köln');
  await page.locator('#folder-plans button',{hasText:'Grundriss EG.svg'}).click();await page.locator('#welcome').waitFor({state:'hidden'});
  const file=await saved(page);assert.equal(file.report,NAME);assert.equal(file.plan.name,'Grundriss EG.svg');
 });
 await check('Jede Änderung landet automatisch in „Pläne“; „Speichern“ lädt nichts herunter',async()=>{
  await page.keyboard.press('p');await tap(page,.3,.4);await page.waitForTimeout(900);
  let file=await saved(page);assert.deepEqual(file.markers.map(m=>m.label),['P1']);
  let downloaded=false;page.once('download',()=>{downloaded=true;});await page.locator('#save-project').click();await page.locator('#toast',{hasText:'Gespeichert'}).waitFor();assert.equal(downloaded,false);
 });
 await check('Export schreibt das Bild in „Pläne“ mit Projektnamen',async()=>{
  await page.locator('#export-open').click();await page.locator('#export').click();await page.locator('#toast',{hasText:'Bild gespeichert'}).waitFor({timeout:60000});
  assert.ok((await fs(page,'list',[NAME,'Pläne'])).includes(`Probenplan ${NAME}.png`));await page.locator('#export-dialog .close').click();
 });
 await check('Probenerfassung aus LabelKit wird vorab zu offenen Proben',async()=>{
  await page.locator('#lab-import').click();await page.locator('#lab-folder-dialog [data-labelkit]').click();await page.locator('#lab-review').waitFor();await page.locator('#lab-update-all:visible').click();
  await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});await page.waitForTimeout(900);
  const file=await saved(page);assert.equal(file.markers[0].lab.desc,'Küche, Fensterbank, 400 cm²');assert.deepEqual(file.pending.map(r=>[r.label,r.ref,r.desc,r.art,r.datum]),[['P2','Probe 2','Flur, Wand, 100 cm²','Chlorid · Wischprobe','2026-10-15']]);
 });
 await check('Laborbericht aus „Laborergebnisse“ ergänzt die LabelKit-Proben per „Alle Konflikte: Aktualisieren“',async()=>{
  await page.locator('#lab-import').click();await page.locator('#lab-folder-dialog [data-lab-file]',{hasText:'AR-999.xml'}).click();await page.locator('#lab-review').waitFor();await page.locator('#lab-update-all:visible').click();
  await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
  await page.waitForTimeout(900);const file=await saved(page);assert.equal(file.pending.length,8);const p2=file.pending.find(r=>r.label==='P2');assert.ok(p2.labNr&&p2.werte?.length,'P2 mit Labordaten');assert.ok(file.markers[0].lab.werte?.length,'P1 mit Messwerten');
 });
 await check('Neu laden mit ?projekt= öffnet die Datei aus dem Ordner',async()=>{
  await page.reload();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal(await page.locator('#count').textContent(),'1');assert.match(await page.locator('#saved').textContent(),/Pläne/);
 });
 await check('Fremde Änderung wird nicht überschrieben – andere Fassung laden',async()=>{
  const other=JSON.parse(await fs(page,'read',[NAME,'Pläne'],FILE));other.markers[0].label='P77';await page.waitForTimeout(1600);await fs(page,'write',[NAME,'Pläne'],FILE,JSON.stringify(other));
  await page.keyboard.press('p');await tap(page,.6,.6);await page.locator('#ask-dialog').waitFor();assert.match(await page.locator('#ask-text').textContent(),/an anderer Stelle gespeichert/);
  await page.locator('#ask-actions button',{hasText:'Andere Fassung laden'}).click();await page.locator('#marker-list',{hasText:'P77'}).waitFor();
  const file=JSON.parse(await fs(page,'read',[NAME,'Pläne'],FILE));assert.deepEqual(file.markers.map(m=>m.label),['P77']);
 });
 await check('Neuer Grundriss ersetzt den Plan nur mit Sicherungskopie',async()=>{
  await page.locator('#file').setInputFiles({name:'Neu.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await page.locator('#replace-dialog').waitFor();assert.match(await page.locator('#replace-dialog p').textContent(),/vorher/);
  await page.locator('#replace-yes').click();await page.waitForTimeout(1000);const names=await fs(page,'list',[NAME,'Pläne']);
  assert.ok(names.some(n=>/^Probenplan 26\.0123 Köln \(vorher .*\)\.probenplan$/.test(n)),names.join(', '));assert.equal((await saved(page)).markers.length,0);
 });
 await check('Interrupted close preserves the main file, browser draft and recovery candidate',async()=>{
  const before=await fs(page,'read',[NAME,'Pläne'],FILE);
  await page.evaluate(file=>{const original=FileSystemFileHandle.prototype.createWritable;window.failMainClose=true;
   FileSystemFileHandle.prototype.createWritable=async function(...args){const stream=await original.apply(this,args);if(this.name!==file)return stream;return new Proxy(stream,{get(target,key){if(key==='close')return async()=>{if(window.failMainClose)throw Error('Synthetic interrupted close');return target.close();};return typeof target[key]==='function'?target[key].bind(target):target[key];}});};
  },FILE);
  await page.locator('[data-mode=sample]').click();await tap(page,.4,.4);await page.locator('#saved',{hasText:'Nicht im Projektordner gespeichert'}).waitFor();
  assert.equal(await fs(page,'read',[NAME,'Pläne'],FILE),before);
  const names=await fs(page,'list',[NAME,'Pläne']),recovery=names.find(n=>n.includes('(Wiederherstellung '));assert.ok(recovery,JSON.stringify({names,toast:await page.locator('#toast').textContent()}));assert.equal(JSON.parse(await fs(page,'read',[NAME,'Pläne'],recovery)).markers.length,1);
  const local=await page.evaluate(name=>new Promise((res,rej)=>{const r=indexedDB.open('probenplan',1);r.onsuccess=()=>{const q=r.result.transaction('projects').objectStore('projects').get(`projekt:${name}`);q.onsuccess=()=>{r.result.close();res(q.result);};q.onerror=()=>rej(q.error);};}),NAME);assert.equal(local.dirty,true);assert.equal(local.project.markers.length,1);
  const d=page.waitForEvent('download');await page.locator('#emergency-copy').click();assert.match((await d).suggestedFilename(),/Notfallkopie/);
  page.once('dialog',dialog=>dialog.accept());await page.reload();await page.locator('#ask-title',{hasText:'Ungespeicherte Browser-Fassung'}).waitFor();await page.locator('#ask-actions button',{hasText:'Browser-Fassung verwenden'}).click();
  await page.locator('#saved',{hasText:'Wiederhergestellt'}).waitFor();assert.equal(await fs(page,'read',[NAME,'Pläne'],FILE),before);assert.equal(await page.locator('#count').textContent(),'1');
  await page.locator('#save-project').click();await page.locator('#toast',{hasText:'Gespeichert'}).waitFor();assert.equal((await saved(page)).markers.length,1);
 });
 await check('Repeated edits during a conflict prompt ask again and backup the accepted external file',async()=>{
  const other=JSON.parse(await fs(page,'read',[NAME,'Pläne'],FILE));other.report='External A';await fs(page,'write',[NAME,'Pläne'],FILE,JSON.stringify(other));
  await page.locator('[data-mode=sample]').click();await tap(page,.6,.6);await page.locator('#ask-dialog').waitFor();
  other.report='External B';await fs(page,'write',[NAME,'Pläne'],FILE,JSON.stringify(other));await page.locator('#ask-actions button',{hasText:'Meine Fassung übernehmen'}).click();
  await page.locator('#ask-dialog').waitFor({state:'visible'});assert.equal(JSON.parse(await fs(page,'read',[NAME,'Pläne'],FILE)).report,'External B');
  await page.locator('#ask-actions button',{hasText:'Meine Fassung übernehmen'}).click();await page.locator('#saved',{hasText:'gespeichert'}).waitFor();assert.equal((await saved(page)).markers.length,2);
  const names=await fs(page,'list',[NAME,'Pläne']),backups=await Promise.all(names.filter(n=>n.includes('(vorher ')).map(n=>fs(page,'read',[NAME,'Pläne'],n)));assert.ok(backups.some(t=>JSON.parse(t).report==='External B'));
  assert.equal(JSON.parse(await fs(page,'read',[NAME],'_Projekt.json')).objekt,'Wohnhaus Musterstraße 1');
 });
 await check('Damaged primary is recovered only by explicit selection; its original bytes are backed up',async()=>{
  const candidate=`Probenplan ${NAME} (Wiederherstellung synthetic).probenplan`,valid=await fs(page,'read',[NAME,'Pläne'],FILE);
  await fs(page,'write',[NAME,'Pläne'],candidate,valid);await fs(page,'write',[NAME,'Pläne'],FILE,'{interrupted');
  await page.evaluate(name=>new Promise((res,rej)=>{const r=indexedDB.open('probenplan',1);r.onsuccess=()=>{const tx=r.result.transaction('projects','readwrite');tx.objectStore('projects').delete(`projekt:${name}`);tx.oncomplete=()=>{r.result.close();res();};tx.onerror=()=>rej(tx.error);};}),NAME);
  await page.reload();await page.locator('#ask-title',{hasText:'Projektdatei fehlt oder ist beschädigt'}).waitFor();assert.equal(await fs(page,'read',[NAME,'Pläne'],FILE),'{interrupted');
  await page.locator('#ask-actions button',{hasText:candidate}).click();await page.locator('#saved',{hasText:'Wiederhergestellt'}).waitFor();assert.equal(await page.locator('#count').textContent(),'2');assert.equal(await fs(page,'read',[NAME,'Pläne'],FILE),'{interrupted');
  await page.locator('#save-project').click();await page.locator('#toast',{hasText:'Gespeichert'}).waitFor();assert.equal((await saved(page)).markers.length,2);
  const names=await fs(page,'list',[NAME,'Pläne']);assert.ok((await Promise.all(names.filter(n=>n.includes('(vorher ')).map(n=>fs(page,'read',[NAME,'Pläne'],n)))).includes('{interrupted'));
 });
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
