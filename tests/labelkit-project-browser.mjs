// Verbindlicher F1-Fall und Altdateien am echten Importdialog, nur synthetisches OPFS.
import {chromium} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173',NAME='26.0101 Muster';
const browser=await chromium.launch();
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await page.evaluate(async name=>{
  const root=await navigator.storage.getDirectory(),archiv=await root.getDirectoryHandle('F1-Testarchiv',{create:true}),p=await archiv.getDirectoryHandle(name,{create:true});
  const plaene=await p.getDirectoryHandle('Pläne',{create:true});await p.getDirectoryHandle('Laboraufträge',{create:true});
  const w=await(await plaene.getFileHandle('Muster.svg',{create:true})).createWritable();await w.write('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/></svg>');await w.close();
  await new Promise((resolve,reject)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const t=r.result.transaction('kv','readwrite');t.objectStore('kv').put(archiv,'archiv');t.oncomplete=()=>{r.result.close();resolve();};t.onerror=()=>reject(t.error);};r.onerror=()=>reject(r.error);});
 },NAME);
 await page.goto(`${base}/#projekt=${encodeURIComponent(NAME)}`);await page.locator('#folder-plans button',{hasText:'Muster.svg'}).click();await page.locator('#welcome').waitFor({state:'hidden'});
 async function write(nr){await page.evaluate(async({name,nr})=>{const p=await(await(await navigator.storage.getDirectory()).getDirectoryHandle('F1-Testarchiv')).getDirectoryHandle(name),lab=await p.getDirectoryHandle('Laboraufträge');const w=await(await lab.getFileHandle('26.0999_Daten.json',{create:true})).createWritable();await w.write(JSON.stringify({projekt:{nr},proben:[{id:1,_nr:1,z2:'FREMDES PROJEKT',matrix:'Wischprobe'}]}));await w.close();},{name:NAME,nr});}
 async function select(){await page.locator('#lab-import').click();await page.locator('#lab-folder-dialog [data-labelkit]').click();}
 async function disk(){return page.evaluate(async name=>{const p=await(await(await navigator.storage.getDirectory()).getDirectoryHandle('F1-Testarchiv')).getDirectoryHandle(name),d=await p.getDirectoryHandle('Pläne');return(await(await d.getFileHandle(`Probenplan ${name}.probenplan`)).getFile()).text();},NAME);}
 await page.locator('#save-project').click();await page.locator('#toast',{hasText:'Gespeichert'}).waitFor();const before=await disk();
 await write('26.0999');await select();await page.locator('#toast.error',{hasText:'Projektzuordnung blockiert'}).waitFor();
 assert.match(await page.locator('#toast').textContent(),/26\.0999.*26\.0101/);assert.equal(await page.locator('#lab-review').isVisible(),false);assert.equal(await disk(),before);assert.doesNotMatch(await page.locator('body').innerText(),/FREMDES PROJEKT/);
 console.log('OK F1 Browser: 26.0999 bleibt in 26.0101 blockiert, Datei und Proben unverändert');
 await write('');const rejected=page.waitForEvent('dialog').then(async d=>{assert.match(d.message(),/keine Projektnummer/);assert.match(d.message(),/26\.0101/);await d.dismiss();});await select();await rejected;await page.locator('#toast.error',{hasText:'abgebrochen'}).waitFor();assert.equal(await page.locator('#lab-review').isVisible(),false);assert.equal(await disk(),before);
 console.log('OK F1 Browser: alte Datei abgelehnt, bisheriger Stand erhalten');
 const accepted=page.waitForEvent('dialog').then(d=>d.accept());await select();await accepted;await page.locator('#lab-review').waitFor();assert.match(await page.locator('#lab-review').innerText(),/FREMDES PROJEKT/);await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
 await page.locator('#saved',{hasText:/^✓ In „Pläne“ gespeichert$/}).waitFor({state:'attached'});const imported=JSON.parse(await disk());assert.equal(imported.pending[0].desc,'FREMDES PROJEKT');assert.equal(imported.report,NAME);
 console.log('OK F1 Browser: alte Datei erst nach ausdrücklichem OK und Prüftabelle übernommen');
 assert.deepEqual(errors,[]);await context.close();
}finally{await browser.close();}
