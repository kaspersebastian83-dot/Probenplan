// Projektordner: Öffnen aus der Projektzentrale (?projekt=), automatisches Speichern in „Pläne“, Bilder dorthin,
// Grundrisse und Laborberichte aus dem Projekt, Konflikt bei fremder Änderung, Sicherungskopie beim Ersetzen.
// Der Archivordner wird im privaten Dateisystem des Browsers (OPFS) nachgebildet; nur Chromium kennt die Ordner-API.
import {chromium,openExport,closeExport} from './runtime.mjs';
import {labXML,labErgebnisse} from './lab-fixtures.mjs';
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
 if(action==='setup'){const [name,svg,xml,erg]=args;const proj=await dir([name]);for(const sub of ['Pläne','Laborergebnisse','Laboraufträge','Fotos'])await proj.getDirectoryHandle(sub,{create:true});
  const write=async(d,n,t)=>{const w=await(await d.getFileHandle(n,{create:true})).createWritable();await w.write(t);await w.close();};
  await write(proj,'_Projekt.json',JSON.stringify({format:'mosaik-projekt',version:1,objekt:'Wohnhaus Musterstraße 1'}));await write(await dir([name,'Pläne']),'Grundriss EG.svg',svg);await write(await dir([name,'Laborergebnisse']),'AR-999.xml',xml);if(erg)await write(await dir([name,'Laborergebnisse']),'_Ergebnisse.json',erg);await write(await dir([name,'Laboraufträge']),'26.0123_15.10.2026_Daten.json',JSON.stringify({version:'4.24.0',projekt:{nr:'26.0123'},proben:[{id:1,_nr:1,matrix:'Wischprobe',z2:'Küche',z3:'Fensterbank',cm2:'400',datum:'2026-10-15'}],chloridProben:[{id:7,_nr:2,chloridNr:2,matrix:'Wischprobe',z2:'Flur',z3:'Wand',cm2:'100',datum:'2026-10-15'}],asbestProben:[],sonstigeProben:[]}));
  await new Promise((res,rej)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const tx=r.result.transaction('kv','readwrite');tx.objectStore('kv').put(archiv,'archiv');tx.oncomplete=()=>{r.result.close();res();};tx.onerror=()=>rej(tx.error);};r.onerror=()=>rej(r.error);});return true;}
 if(action==='list'){const d=await dir(args[0]);const out=[];for await(const h of d.values())out.push(h.name);return out.sort();}
 if(action==='read'){const d=await dir(args[0]);try{return await(await(await d.getFileHandle(args[1])).getFile()).text();}catch{return null;}}
 if(action==='write'){const d=await dir(args[0]);const w=await(await d.getFileHandle(args[1],{create:true})).createWritable();await w.write(args[2]);await w.close();return true;}
},[action,args]);
const saved=async page=>{await page.locator('#saved',{hasText:/^✓ In „Pläne“ gespeichert$/}).waitFor({state:'attached'});for(let i=0;i<40;i++){const t=await fs(page,'read',[NAME,'Pläne'],FILE);if(t)return JSON.parse(t);await page.waitForTimeout(100);}throw Error('Projektdatei fehlt');};
const editReport=async(page,text)=>{await openExport(page);await page.locator('#report').fill(text);await page.locator('#report').press('Tab');await closeExport(page);};
const browserDraft=page=>page.evaluate(name=>new Promise((resolve,reject)=>{const r=indexedDB.open('probenplan',1);r.onsuccess=()=>{const q=r.result.transaction('projects').objectStore('projects').get(`projekt:${name}`);q.onsuccess=()=>{r.result.close();resolve(q.result);};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}),NAME);
const recoveryProjects=async page=>Promise.all((await fs(page,'list',[NAME,'Pläne'])).filter(n=>n.includes('(Wiederherstellung ')||n.includes('(Speicherkandidat ')).map(async name=>{try{return {name,project:JSON.parse(await fs(page,'read',[NAME,'Pläne'],name))};}catch{return {name,project:null};}}));
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await fs(page,'setup',NAME,svg,labXML(),labErgebnisse());
 await check('Fragmentprojekt mit Sonderzeichen hat Vorrang; andere URL-Bestandteile bleiben erhalten',async()=>{
  const special='26.0987 Köln & Süd + 50% #Hof';await fs(page,'setup',special,svg,labXML());
  await page.goto(`${base}/?projekt=falsch&ansicht=liste#plan&projekt=${encodeURIComponent(special)}`);
  await page.locator('#project-badge:not([hidden])').waitFor();
  assert.equal((await page.locator('#project-badge').textContent()).trim(),special);
  const url=new URL(page.url());assert.equal(url.searchParams.has('projekt'),false);assert.equal(url.searchParams.get('ansicht'),'liste');assert.ok(url.hash.startsWith('#plan&'));
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('projekt'),special);
 });
 await check('?projekt= öffnet das Projekt, zeigt Nummer/Ort und bietet Grundrisse aus „Pläne“ an',async()=>{
  await page.goto(`${base}/?projekt=${encodeURIComponent(NAME)}`);await page.locator('#project-badge:not([hidden])').waitFor();
  assert.equal((await page.locator('#project-badge').textContent()).trim(),'26.0123 Köln');
  assert.equal(new URL(page.url()).searchParams.has('projekt'),false);assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('projekt'),NAME);
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
  await page.locator('#lab-import').click();await page.locator('#lab-folder-dialog [data-ergebnis]',{hasText:'AR-999.xml'}).click();await page.locator('#lab-review').waitFor();await page.locator('#lab-update-all:visible').click();
  await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
  await page.waitForTimeout(900);const file=await saved(page);assert.equal(file.pending.length,8);const p2=file.pending.find(r=>r.label==='P2');assert.ok(p2.labNr&&p2.werte?.length,'P2 mit Labordaten');assert.ok(file.markers[0].lab.werte?.length,'P1 mit Messwerten');
 });
 await check('Neuerer Stand in ResultKit (Bericht ersetzt): Warnleiste, Knopf öffnet „Proben übernehmen …“; wieder aktuell → weg',async()=>{
  assert.ok(await page.locator('#resultkit-warning').isHidden(),'Plan auf dem Stand der Übernahme');
  const roh=JSON.parse(labErgebnisse());const alt=roh.berichte[0].bericht;roh.berichte[0]={...roh.berichte[0],id:'b2',bericht:'AR-1000',sources:{xml:'AR-1000.xml'}};roh.ersetzt=[{bericht:alt,durch:['AR-1000']}];
  await fs(page,'write',[NAME,'Laborergebnisse'],'_Ergebnisse.json',JSON.stringify(roh));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.locator('#resultkit-warning:not([hidden])').waitFor();
  assert.match(await page.locator('#resultkit-warning-text').textContent(),new RegExp(`${alt} ist in ResultKit ersetzt durch AR-1000\\. Im Plan stehen noch die alten Werte`));
  await page.locator('#resultkit-warning-go').click();await page.locator('#lab-folder-dialog [data-ergebnis]',{hasText:'AR-1000'}).waitFor();await page.locator('#lab-folder-dialog .close').click();
  await fs(page,'write',[NAME,'Laborergebnisse'],'_Ergebnisse.json',labErgebnisse());await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.locator('#resultkit-warning').waitFor({state:'hidden'});
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
  await page.locator('#file').setInputFiles({name:'Neu.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await page.locator('#replace-dialog').waitFor();assert.match(await page.locator('#replace-dialog p').textContent(),/Kopie vor dem Ersetzen.*nie automatisch gelöscht/);
  const vorher=JSON.parse(await fs(page,'read',[NAME,'Pläne'],FILE));
  await page.locator('#replace-yes').click();await page.waitForTimeout(1000);const names=await fs(page,'list',[NAME,'Pläne']);
  assert.ok(names.some(n=>/^Probenplan 26\.0123 Köln \(vorher .*\)\.probenplan$/.test(n)),names.join(', '));assert.equal((await saved(page)).markers.length,0);
  const kopie=names.find(n=>/^Probenplan 26\.0123 Köln \(Kopie vor dem Ersetzen .*\)\.probenplan$/.test(n));assert.ok(kopie,'dauerhafte Kopie vor dem Ersetzen: '+names.join(', '));
  assert.deepEqual(JSON.parse(await fs(page,'read',[NAME,'Pläne'],kopie)).markers.map(m=>m.label),vorher.markers.map(m=>m.label),'Kopie enthält die bisherige Fassung');
 });
 await check('Interrupted close preserves the main file, browser draft and recovery candidate',async()=>{
  const before=await fs(page,'read',[NAME,'Pläne'],FILE);
  await page.evaluate(file=>{const original=FileSystemFileHandle.prototype.createWritable;window.failMainClose=true;
   FileSystemFileHandle.prototype.createWritable=async function(...args){const stream=await original.apply(this,args);if(this.name!==file)return stream;return new Proxy(stream,{get(target,key){if(key==='close')return async()=>{if(window.failMainClose)throw Error('Synthetic interrupted close');return target.close();};return typeof target[key]==='function'?target[key].bind(target):target[key];}});};
  },FILE);
  await page.locator('[data-mode=sample]').click();await tap(page,.4,.4);await page.locator('#saved',{hasText:/^⚠ Nicht im Projektordner gespeichert$/}).waitFor();
  assert.equal(await fs(page,'read',[NAME,'Pläne'],FILE),before);
  const recoveries=await recoveryProjects(page);assert.ok(recoveries.some(r=>r.project?.plan.name==='Neu.svg'&&r.project.markers.length===1),JSON.stringify({recoveries,toast:await page.locator('#toast').textContent()}));
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
  await page.locator('#ask-actions button',{hasText:'Meine Fassung übernehmen'}).click();await page.locator('#saved',{hasText:/^✓ In „Pläne“ gespeichert$/}).waitFor();assert.equal((await saved(page)).markers.length,2);
  const names=await fs(page,'list',[NAME,'Pläne']),backups=await Promise.all(names.filter(n=>n.includes('(vorher ')).map(n=>fs(page,'read',[NAME,'Pläne'],n)));assert.ok(backups.some(t=>JSON.parse(t).report==='External B'));
  const dauerhaft=await Promise.all(names.filter(n=>n.includes('(Kopie vor dem Ersetzen ')).map(n=>fs(page,'read',[NAME,'Pläne'],n)));assert.ok(dauerhaft.some(t=>JSON.parse(t).report==='External B'),'überschriebene Fassung des Kollegen dauerhaft gesichert');
  assert.equal(JSON.parse(await fs(page,'read',[NAME],'_Projekt.json')).objekt,'Wohnhaus Musterstraße 1');
 });
 await check('Damaged primary is recovered only by explicit selection; its original bytes are backed up',async()=>{
  const candidate=`Probenplan ${NAME} (Wiederherstellung synthetic).probenplan`,valid=await fs(page,'read',[NAME,'Pläne'],FILE);
  await fs(page,'write',[NAME,'Pläne'],candidate,valid);await fs(page,'write',[NAME,'Pläne'],FILE,'{interrupted');
  await page.evaluate(name=>new Promise((res,rej)=>{const r=indexedDB.open('probenplan',1);r.onsuccess=()=>{const tx=r.result.transaction('projects','readwrite');tx.objectStore('projects').delete(`projekt:${name}`);tx.oncomplete=()=>{r.result.close();res();};tx.onerror=()=>rej(tx.error);};}),NAME);
  await page.reload();await page.locator('#ask-title',{hasText:'Projektdatei fehlt oder ist beschädigt'}).waitFor();assert.equal(await fs(page,'read',[NAME,'Pläne'],FILE),'{interrupted');
  assert.match(await page.locator(`#ask-actions button[title="${candidate}"]`).textContent(),/^Wiederherstellung vom \d\d\.\d\d\.\d{4}, \d\d:\d\d:\d\d Uhr( \(\d+\))?$/);await page.locator(`#ask-actions button[title="${candidate}"]`).click();await page.locator('#saved',{hasText:'Wiederhergestellt'}).waitFor();assert.equal(await page.locator('#count').textContent(),'2');assert.equal(await fs(page,'read',[NAME,'Pläne'],FILE),'{interrupted');
  await page.locator('#save-project').click();await page.locator('#toast',{hasText:'Gespeichert'}).waitFor();assert.equal((await saved(page)).markers.length,2);
  const names=await fs(page,'list',[NAME,'Pläne']);assert.ok((await Promise.all(names.filter(n=>n.includes('(vorher ')).map(n=>fs(page,'read',[NAME,'Pläne'],n)))).includes('{interrupted'));
 });
 await check('Conflict choices preserve the current unsaved revision; failed recovery creation blocks replacement',async()=>{
  await page.evaluate(()=>{const original=FileSystemFileHandle.prototype.createWritable;window.failRecovery=true;FileSystemFileHandle.prototype.createWritable=async function(...args){if((this.name.includes('(Wiederherstellung ')||this.name.includes('(Speicherkandidat '))&&window.failRecovery)throw Error('Synthetic recovery creation failure');return original.apply(this,args);};});
  const external=JSON.parse(await fs(page,'read',[NAME,'Pläne'],FILE));external.report='External discard';await fs(page,'write',[NAME,'Pläne'],FILE,JSON.stringify(external));
  await editReport(page,'Unsaved protect');await page.locator('#saved',{hasText:/^⚠ Nicht im Projektordner gespeichert$/}).waitFor();
  assert.equal(await page.locator('#ask-dialog').isVisible(),false);assert.equal(await page.locator('#report').inputValue(),'Unsaved protect');const draft=await browserDraft(page);assert.equal(draft.dirty,true);assert.equal(draft.project.report,'Unsaved protect');assert.equal(JSON.parse(await fs(page,'read',[NAME,'Pläne'],FILE)).report,'External discard');
  await page.evaluate(()=>window.failRecovery=false);await page.locator('#save-project').click();await page.locator('#ask-dialog').waitFor();
  assert.ok((await recoveryProjects(page)).some(r=>JSON.stringify(r.project)===JSON.stringify(draft.project)),'Verified recovery must exist before the destructive option is offered');
  await page.evaluate(()=>{window.failRecovery=true;document.querySelector('#toast').hidden=true;});await page.locator('#ask-actions button',{hasText:'Andere Fassung laden'}).click();await page.locator('#toast.error',{hasText:'Synthetic recovery creation failure'}).waitFor();
  assert.equal(await page.locator('#report').inputValue(),'Unsaved protect');assert.deepEqual(await browserDraft(page),draft);
  await page.evaluate(async()=>{const root=await navigator.storage.getDirectory(),archive=await root.getDirectoryHandle('Mosaik Archivordner'),other=await archive.getDirectoryHandle('26.0456 Other',{create:true});await other.getDirectoryHandle('Pläne',{create:true});window.showDirectoryPicker=async()=>other;});
  await page.locator('#open-folder').click();await page.locator('#ask-title',{hasText:'Ungespeicherte Änderungen'}).waitFor();await page.evaluate(()=>document.querySelector('#toast').hidden=true);await page.locator('#ask-actions button',{hasText:'Sichern und wechseln'}).click();await page.locator('#toast.error',{hasText:'Synthetic recovery creation failure'}).waitFor();
  assert.equal(await page.locator('#project-badge').textContent(),NAME);assert.equal(await page.locator('#report').inputValue(),'Unsaved protect');assert.deepEqual(await browserDraft(page),draft);
  await page.evaluate(()=>window.failRecovery=false);await page.locator('#save-project').click();await page.locator('#ask-dialog').waitFor();await page.locator('#ask-actions button',{hasText:'Andere Fassung laden'}).click();await page.waitForFunction(()=>document.querySelector('#report').value==='External discard');
  await page.waitForFunction(name=>new Promise(resolve=>{const r=indexedDB.open('probenplan',1);r.onsuccess=()=>{const q=r.result.transaction('projects').objectStore('projects').get(`projekt:${name}`);q.onsuccess=()=>{r.result.close();resolve(q.result?.project.report==='External discard');};};}),NAME);
  assert.ok((await recoveryProjects(page)).some(r=>JSON.stringify(r.project)===JSON.stringify(draft.project)),'Replacing the browser draft must leave the unsaved project recoverable');
 });
 await check('Import cannot discard unsaved work when recovery-file creation fails',async()=>{
  await page.evaluate(()=>window.failRecovery=true);await editReport(page,'Unsaved import');
  await page.locator('#file').setInputFiles({name:'Discard.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await page.locator('#replace-yes').click();await page.locator('#import-status').waitFor({state:'hidden'});
  assert.equal(await page.locator('#report').inputValue(),'Unsaved import');assert.notEqual(await page.locator('#canvas-name').textContent(),'Discard.svg');assert.equal((await browserDraft(page)).project.report,'Unsaved import');
  await page.evaluate(()=>window.failRecovery=false);await page.locator('#save-project').click();assert.equal((await saved(page)).report,'Unsaved import');
 });
 await check('An outdated explicit save cannot confirm newer unsaved edits',async()=>{
  await page.evaluate(file=>{const original=FileSystemFileHandle.prototype.createWritable;window.holdMain=true;window.closeReleases=[];window.confirmations=[];
   new MutationObserver(()=>{const el=document.querySelector('#toast');if(!el.hidden&&/^Gespeichert:/.test(el.textContent))window.confirmations.push(el.textContent);}).observe(document.querySelector('#toast'),{childList:true,subtree:true,attributes:true});
   FileSystemFileHandle.prototype.createWritable=async function(...args){const stream=await original.apply(this,args);if(this.name!==file)return stream;return new Proxy(stream,{get(target,key){if(key==='close')return async()=>{if(window.holdMain)await new Promise(resolve=>window.closeReleases.push(resolve));return target.close();};return typeof target[key]==='function'?target[key].bind(target):target[key];}});};
  },FILE);
  await editReport(page,'Snapshot A');await page.locator('#save-project').click();await page.waitForFunction(()=>window.closeReleases.length===1);
  await editReport(page,'Snapshot B');await page.evaluate(()=>window.closeReleases.shift()());
  await page.waitForFunction(()=>window.closeReleases.length===1);assert.equal(JSON.parse(await fs(page,'read',[NAME,'Pläne'],FILE)).report,'Snapshot A');assert.equal((await browserDraft(page)).project.report,'Snapshot B');
  assert.deepEqual(await page.evaluate(()=>window.confirmations),[]);assert.doesNotMatch(await page.locator('#saved').textContent(),/^✓/);assert.equal((await browserDraft(page)).dirty,true);
  await page.evaluate(()=>{window.holdMain=false;window.closeReleases.shift()();});assert.equal((await saved(page)).report,'Snapshot B');
  await page.locator('#save-project').click();await page.locator('#toast',{hasText:/^Gespeichert:/}).waitFor();
 });
 await check('Choosing the file at startup preserves the only browser draft, and refuses a failed preservation',async()=>{
  // Isolate the cold-start draft from earlier, already asserted recovery candidates.
  await page.evaluate(async name=>{const root=await navigator.storage.getDirectory(),archive=await root.getDirectoryHandle('Mosaik Archivordner'),dir=await(await archive.getDirectoryHandle(name)).getDirectoryHandle('Pläne');for await(const h of dir.values())if(h.name!==`Probenplan ${name}.probenplan`&&h.name.endsWith('.probenplan'))await dir.removeEntry(h.name);},NAME);
  await context.addInitScript(()=>{window.failRecovery=localStorage.getItem('synthetic:failRecovery')==='yes';const original=FileSystemFileHandle.prototype.createWritable;FileSystemFileHandle.prototype.createWritable=async function(...args){if(window.failRecovery&&(this.name.includes('(Wiederherstellung ')||this.name.includes('(Speicherkandidat ')))throw Error('Synthetic recovery creation failure');return original.apply(this,args);};});
  await page.evaluate(()=>{window.failRecovery=true;localStorage.setItem('synthetic:failRecovery','yes');});await editReport(page,'Cold dirty draft');await page.locator('#saved',{hasText:/^⚠ Nicht im Projektordner gespeichert$/}).waitFor();const draft=await browserDraft(page);
  page.once('dialog',dialog=>dialog.accept());await page.reload();await page.locator('#ask-title',{hasText:'Ungespeicherte Browser-Fassung'}).waitFor();await page.locator('#ask-actions button',{hasText:'Datei verwenden'}).click();await page.locator('#toast.error',{hasText:'Synthetic recovery creation failure'}).waitFor();
  assert.deepEqual(await browserDraft(page),draft);assert.equal(JSON.parse(await fs(page,'read',[NAME,'Pläne'],FILE)).report,'Snapshot B');assert.equal(await page.locator('#welcome').isVisible(),true);
  await page.evaluate(async name=>{window.failRecovery=false;localStorage.removeItem('synthetic:failRecovery');const root=await navigator.storage.getDirectory(),archive=await root.getDirectoryHandle('Mosaik Archivordner'),dir=await(await archive.getDirectoryHandle(name)).getDirectoryHandle('Pläne');for await(const h of dir.values())if(h.name.includes('(Wiederherstellung ')&&(await h.getFile()).size===0)await dir.removeEntry(h.name);},NAME);await page.reload();await page.locator('#ask-title',{hasText:'Ungespeicherte Browser-Fassung'}).waitFor();await page.locator('#ask-actions button',{hasText:'Datei verwenden'}).click();await page.locator('#welcome').waitFor({state:'hidden'});
  assert.equal(await page.locator('#report').inputValue(),'Snapshot B');assert.ok((await recoveryProjects(page)).some(r=>JSON.stringify(r.project)===JSON.stringify(draft.project)));
 });
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
