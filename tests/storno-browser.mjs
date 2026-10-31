// Stornierte Proben aus LabelKit im Browser (ab 1.51): nicht angeboten, nicht als offen gezählt; ein schon gesetzter Punkt
// zeigt „P7 ist storniert – Punkt entfernen?“ mit Entfernen (nach Rückfrage, rückgängig) und Behalten; Storno aufgehoben →
// wieder angeboten. Freier Plan in Chromium und WebKit, Projektordner (privates Browser-Dateisystem) in Chromium. Synthetische Daten.
import {chromium,webkit,savedProject} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173',NAME='26.0101 Muster';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
const tap=async(page,x,y)=>{const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);};
async function until(page,test,what){let p;for(let i=0;i<60;i++){p=await savedProject(page);if(test(p))return p;await page.waitForTimeout(100);}assert.fail(`${what||'Projektstand'}: ${JSON.stringify({markers:p.markers.map(m=>m.label),pending:(p.pending||[]).map(r=>r.label)})}`);}
const SVG=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/></svg>');
const fest={am:'2026-10-29T09:00:00.000Z',anlass:'Etiketten'};
const storno=(grund='')=>({am:'2026-10-30T14:05:00.000Z',kuerzel:'Dr. Ka',grund});
/** LabelKit-Projektdatei (ab 4.49.0) mit P1–P4; `st` = stornierte Nummern. */
const daten=(st=[])=>({nrSchutz:1,projekt:{nr:'26.0101'},proben:[1,2,3,4].map(n=>({id:n,_nr:n,z2:n<3?'EG Flur':'EG Küche',z3:'Decke',matrix:'Wischprobe',nrFest:fest,...(st.includes(n)?{storniert:storno(n===1?'falscher Raum':'')}:{})}))});
const file=st=>({name:'26.0101_Daten.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(daten(st)))});
const offen=page=>page.locator('#pending-list [data-pending-del]').evaluateAll(b=>b.map(x=>x.dataset.pendingDel));
const zeilen=page=>page.locator('#storno-hinweis .storno-zeile').evaluateAll(r=>r.map(x=>x.querySelector('span').textContent));
async function platzieren(page,label,x,y){await page.locator('.pending-item',{has:page.locator(`[data-pending-del="${label}"]`)}).locator('.pending-row').click();await tap(page,x,y);await page.locator('#stage[data-mode=navigate]').waitFor();}
async function uebernehmen(page,files,{konflikte=false}={}){
 await page.locator('#lab-files').setInputFiles(files);await page.locator('#lab-review').waitFor();
 if(konflikte)await page.locator('#lab-update-all').click();
 const warnungen=await page.locator('#lab-warnings').innerText(),rows=await page.locator('#lab-review [data-field=label]').evaluateAll(i=>i.map(x=>x.value));
 await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});return {warnungen,rows};
}
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#file').setInputFiles({name:'eg.svg',mimeType:'image/svg+xml',buffer:SVG});await page.locator('#welcome').waitFor({state:'hidden'});

  await check(`${engine}: stornierte Probe P2 wird nicht angeboten und nicht als „noch zu platzieren“ gezählt`,async()=>{
   const r=await uebernehmen(page,file([2]));
   assert.deepEqual(r.rows,['P1','P3','P4']);assert.match(r.warnungen,/P2 ist in LabelKit storniert und wird nicht übernommen – die Nummer bleibt vergeben\./);
   assert.deepEqual(await offen(page),['P1','P3','P4']);
   assert.equal(await page.locator('#pending-count').textContent(),'0 von 3 platziert');
   assert.doesNotMatch(await page.locator('#pending-list').innerText(),/P2/);
   const p=await until(page,p=>(p.pending||[]).length===3);assert.equal(p.nextSample,5,'P2 wird nicht neu vergeben');
   assert.equal(await page.locator('#storno-hinweis').isHidden(),true,'kein Punkt im Plan – kein Hinweis');
  });
  await check(`${engine}: P1 und P3 gesetzt, danach in LabelKit storniert – Hinweis je Punkt, nichts entfernt`,async()=>{
   await platzieren(page,'P1',200,200);await platzieren(page,'P3',600,400);await until(page,p=>p.markers.length===2);
   const r=await uebernehmen(page,file([1,3,4]));   // P2 aufgehoben, P4 (offen) storniert
   assert.deepEqual(r.rows,['P2'],'aufgehobenes Storno: P2 wird wieder angeboten');
   assert.match(r.warnungen,/P1, P3, P4 sind in LabelKit storniert/);assert.match(r.warnungen,/P4 ist in LabelKit storniert und wird aus „Noch zu platzieren“ genommen\./);
   assert.deepEqual(await offen(page),['P2']);assert.equal(await page.locator('#pending-count').textContent(),'2 von 3 platziert');
   await page.locator('#storno-hinweis').waitFor();
   assert.deepEqual(await zeilen(page),['⚠ P1 ist storniert – Punkt entfernen?','⚠ P3 ist storniert – Punkt entfernen?']);
   assert.equal(await page.locator('#storno-hinweis [data-storno="P1"] span').getAttribute('title'),'In LabelKit storniert am 30.10.2026 (Dr. Ka) – Grund: falscher Raum. Die Nummer bleibt vergeben.');
   assert.deepEqual(await page.locator('#storno-hinweis [data-storno="P1"] button').allTextContents(),['Punkt entfernen …','Behalten']);
   const p=await until(page,p=>(p.pending||[]).length===1);assert.deepEqual(p.markers.map(m=>m.label).sort(),['P1','P3'],'Punkte bleiben, bis du entscheidest');
  });
  await check(`${engine}: „Behalten“ – Punkt bleibt und wird normal gezeigt, Hinweis für P1 weg`,async()=>{
   await page.locator('#storno-hinweis [data-storno="P1"] [data-storno-behalten]').click();
   assert.deepEqual(await zeilen(page),['⚠ P3 ist storniert – Punkt entfernen?']);
   const p=await savedProject(page);assert.deepEqual(p.markers.map(m=>m.label).sort(),['P1','P3']);
   const id=p.markers.find(m=>m.label==='P1').id;assert.equal(await page.locator(`#drawing [data-id="${id}"]`).count(),1,'P1 wird weiter gezeichnet');
  });
  await check(`${engine}: „Punkt entfernen …“ fragt; Abbrechen lässt ihn, Bestätigen entfernt ihn, Strg+Z holt ihn zurück`,async()=>{
   await page.locator('#storno-hinweis [data-storno="P3"] [data-storno-weg]').click();await page.locator('#ask-dialog').waitFor();
   assert.equal(await page.locator('#ask-title').textContent(),'Punkt entfernen?');assert.match(await page.locator('#ask-text').textContent(),/^P3 ist in LabelKit storniert\. Den Punkt aus dem Plan entfernen\?/);
   assert.deepEqual(await page.locator('#ask-actions button').allTextContents(),['Abbrechen','Punkt entfernen']);
   await page.locator('#ask-actions button',{hasText:'Abbrechen'}).click();await page.locator('#ask-dialog').waitFor({state:'hidden'});
   assert.deepEqual((await savedProject(page)).markers.map(m=>m.label).sort(),['P1','P3']);assert.deepEqual(await zeilen(page),['⚠ P3 ist storniert – Punkt entfernen?']);
   await page.locator('#storno-hinweis [data-storno="P3"] [data-storno-weg]').click();await page.locator('#ask-actions button',{hasText:'Punkt entfernen'}).click();
   const p=await until(page,p=>p.markers.length===1);assert.deepEqual(p.markers.map(m=>m.label),['P1']);assert.deepEqual(p.pending.map(r=>r.label),['P2'],'nicht zurück in die offene Liste');
   await page.locator('#storno-hinweis').waitFor({state:'hidden'});await page.locator('#toast',{hasText:'P3 aus dem Plan entfernt – rückgängig mit Strg+Z.'}).waitFor();
   await page.evaluate(()=>document.activeElement?.blur?.());await page.keyboard.press('Control+z');
   await until(page,p=>p.markers.length===2,'Strg+Z');await page.locator('#storno-hinweis').waitFor();assert.deepEqual(await zeilen(page),['⚠ P3 ist storniert – Punkt entfernen?']);
  });
  await check(`${engine}: Storno aufgehoben – Hinweis weg, Probe wieder offen angeboten`,async()=>{
   const r=await uebernehmen(page,file([]),{konflikte:true});   // P1, P3 platziert (Konflikt: aktualisieren), P2 offen, P4 wieder da
   assert.deepEqual(r.rows,['P1','P2','P3','P4']);assert.doesNotMatch(r.warnungen,/storniert/);
   assert.deepEqual(await offen(page),['P2','P4']);await page.locator('#storno-hinweis').waitFor({state:'hidden'});
   const p=await until(page,p=>(p.pending||[]).length===2);assert.deepEqual(p.markers.map(m=>m.label).sort(),['P1','P3']);
  });
  await check(`${engine}: alle Proben platziert, dann alle storniert – Übernehmen geht, Hinweis je Punkt (freier Plan)`,async()=>{
   await platzieren(page,'P2',300,500);await platzieren(page,'P4',900,300);await until(page,p=>p.markers.length===4&&!(p.pending||[]).length);
   const r=await uebernehmen(page,file([1,2,3,4]));   // keine Zeile übrig – „Übernehmen“ darf trotzdem nicht gesperrt sein
   assert.deepEqual(r.rows,[]);assert.match(r.warnungen,/Alle Proben der LabelKit-Datei sind storniert\./);assert.doesNotMatch(r.warnungen,/noch keine PAK/);
   await page.locator('#storno-hinweis').waitFor();
   // P1 wurde oben für genau diese Stornierung (gleicher Zeitpunkt) behalten – kein Hinweis
   assert.deepEqual(await zeilen(page),['⚠ P2 ist storniert – Punkt entfernen?','⚠ P3 ist storniert – Punkt entfernen?','⚠ P4 ist storniert – Punkt entfernen?']);
   assert.equal((await savedProject(page)).markers.length,4,'nichts still entfernt');
  });
  await check(`${engine}: LabelKit korrigiert Kürzel/Grund (gleicher Zeitpunkt) – Tooltip zeigt den neuen Stand`,async()=>{
   const d=daten([1,2,3,4]);for(const p of d.proben)p.storniert={...p.storniert,kuerzel:'Ric',grund:'Raum korrigiert'};
   await uebernehmen(page,{name:'26.0101_Daten.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});
   await page.locator('#storno-hinweis [data-storno="P2"] span[title*="Raum korrigiert"]').waitFor();
   assert.equal(await page.locator('#storno-hinweis [data-storno="P2"] span').getAttribute('title'),'In LabelKit storniert am 30.10.2026 (Ric) – Grund: Raum korrigiert. Die Nummer bleibt vergeben.');
  });
  assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}
}

// Projektordner: PlanKit liest die LabelKit-Projektdatei selbst (Öffnen, Fenster, alle 20 s) – auch ohne erneutes Übernehmen.
if(engines.includes('chromium')){
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const schreiben=(st,nr='26.0101')=>page.evaluate(async({name,text})=>{const p=await(await(await navigator.storage.getDirectory()).getDirectoryHandle('Storno-Testarchiv')).getDirectoryHandle(name),lab=await p.getDirectoryHandle('Laboraufträge');const w=await(await lab.getFileHandle('26.0101_Daten.json',{create:true})).createWritable();await w.write(text);await w.close();},{name:NAME,text:JSON.stringify({...daten(st),projekt:{nr}})});
  await page.evaluate(async({name,svg})=>{
   const root=await navigator.storage.getDirectory(),archiv=await root.getDirectoryHandle('Storno-Testarchiv',{create:true}),p=await archiv.getDirectoryHandle(name,{create:true});
   const plaene=await p.getDirectoryHandle('Pläne',{create:true});await p.getDirectoryHandle('Laboraufträge',{create:true});
   const w=await(await plaene.getFileHandle('Muster.svg',{create:true})).createWritable();await w.write(svg);await w.close();
   await new Promise((resolve,reject)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const t=r.result.transaction('kv','readwrite');t.objectStore('kv').put(archiv,'archiv');t.oncomplete=()=>{r.result.close();resolve();};t.onerror=()=>reject(t.error);};r.onerror=()=>reject(r.error);});
  },{name:NAME,svg:SVG.toString()});
  await schreiben([2]);
  await page.goto(`${base}/#projekt=${encodeURIComponent(NAME)}`);await page.reload();await page.locator('#folder-plans button',{hasText:'Muster.svg'}).click();await page.locator('#welcome').waitFor({state:'hidden'});
  await check('chromium Projektordner: „Proben übernehmen …“ aus LabelKit ohne die stornierte P2',async()=>{
   await page.locator('#lab-import').click();await page.locator('#lab-folder-dialog [data-labelkit]').click();await page.locator('#lab-review').waitFor();
   assert.deepEqual(await page.locator('#lab-review [data-field=label]').evaluateAll(i=>i.map(x=>x.value)),['P1','P3','P4']);
   await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
   assert.deepEqual(await offen(page),['P1','P3','P4']);assert.equal(await page.locator('#pending-count').textContent(),'0 von 3 platziert');
  });
  await check('chromium Projektordner: Storno in LabelKit gespeichert → Hinweis ohne erneutes Übernehmen, auch für eine offene Probe',async()=>{
   await platzieren(page,'P1',200,200);await schreiben([1,3]);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await page.locator('#storno-hinweis .storno-zeile').nth(1).waitFor();
   assert.deepEqual(await zeilen(page),['⚠ P1 ist storniert – Punkt entfernen?','⚠ P3 ist storniert – aus „Noch zu platzieren“ nehmen?']);
   assert.deepEqual(await page.locator('#storno-hinweis [data-storno="P3"] button').allTextContents(),['Aus der Liste nehmen','Behalten']);
   assert.deepEqual(await offen(page),['P3','P4'],'nichts still geändert');
   await page.locator('#storno-hinweis [data-storno="P3"] [data-storno-weg]').click();assert.deepEqual(await offen(page),['P4']);
   await page.locator('#storno-hinweis [data-storno="P1"] [data-storno-behalten]').click();await page.locator('#storno-hinweis').waitFor({state:'hidden'});
   const gemerkt=JSON.parse(await page.evaluate(()=>localStorage.getItem('plankit-storno-behalten')));assert.deepEqual(gemerkt[NAME],['P1|2026-10-30T14:05:00.000Z']);
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(500);assert.equal(await page.locator('#storno-hinweis').isHidden(),true,'behalten bleibt behalten');
  });
  await check('chromium Projektordner: Datei eines anderen Projekts löst keinen Hinweis aus, die eigene schon',async()=>{
   await schreiben([4],'26.0999');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(500);assert.equal(await page.locator('#storno-hinweis').isHidden(),true);
   await schreiben([4],'26.0101 Musterstraße');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await page.locator('#storno-hinweis').waitFor();assert.deepEqual(await zeilen(page),['⚠ P4 ist storniert – aus „Noch zu platzieren“ nehmen?'],'Projektnummer mit Adresse zählt als Nummer');
  });
  assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}
}
