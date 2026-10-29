// Weiter-Platzieren im Browser (ab 1.47): nach dem Platzieren gleich die nächste offene Probe – erst im selben Raum, dann im
// nächsten; Hinweisfeld mit Überspringen/Fertig/Esc, „Nächste Probe“-Feld weg, Ziehen aus der Liste platziert nur eine Probe,
// Schalter aus = wie bisher, Undo, Projektdatei unverändert. Synthetische Daten.
import {chromium,webkit,devices,savedProject} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
const tap=async(page,x,y)=>{const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);};
// Der lokale Speicherstand folgt der Änderung asynchron: warten, bis er zur Erwartung passt.
async function until(page,test,what){let p;for(let i=0;i<60;i++){p=await savedProject(page);if(test(p))return p;await page.waitForTimeout(100);}assert.fail(`${what||'Projektstand'}: ${JSON.stringify({markers:p.markers.map(m=>m.label),pending:(p.pending||[]).map(r=>r.label)})}`);}
// Reihenfolge der Räume: EG Flur (P1, P4) · EG Küche (P2, P5) · 1. OG Kind (P3) · ohne Raum (P6)
const RAEUME=['EG Flur','EG Küche','1. OG Kind','EG Flur','EG Küche',''];
const lk={version:'4.34.0',projekt:{nr:''},proben:RAEUME.map((raum,i)=>({id:i+1,_nr:i+1,z2:raum,z3:'Decke',z4:'Untersicht',matrix:'Wischprobe',datum:'2026-10-20'}))};
async function start(page,url){
 await page.goto(url);
 await page.locator('#file').setInputFiles({name:'eg.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/></svg>')});await page.locator('#welcome').waitFor({state:'hidden'});
 if(await page.locator('#panel-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#panel-toggle').click();
 page.once('dialog',d=>d.accept());
 await page.locator('#lab-files').setInputFiles([{name:'x_Daten.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lk))}]);await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
}
const chip=page=>page.locator('#weiter-chip');
const chipText=async page=>(await page.locator('#weiter-text').textContent())||'';
const mode=page=>page.locator('#stage').getAttribute('data-mode');
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,`${base}/?weiter-default`);

  await check(`${engine}: Standard an – Schalter im Panel angehakt, Hinweisfeld erst nach Auswahl`,async()=>{
   assert.equal(await page.locator('#weiter-switch').isChecked(),true);assert.equal(await chip(page).isHidden(),true);
   assert.equal(await page.locator('#stage').getAttribute('data-weiter'),'on');
  });
  await check(`${engine}: Auswahl in der Liste zeigt „JETZT …“ mit Raum, Bauteil und Oberfläche; „Nächste Probe“ ist weg`,async()=>{
   await page.locator('[data-pending]').first().click();   // P1 · EG Flur – die Liste bleibt in Importreihenfolge
   await chip(page).waitFor();assert.match(await chipText(page),/^JETZT P1 · EG Flur · Decke · Untersicht – In den Plan tippen$/);
   assert.equal(await mode(page),'lab-place');
   assert.equal(await page.locator('#next-field').isVisible(),false);
   assert.equal(await page.locator('#weiter-skip').isVisible(),true);assert.equal(await page.locator('#weiter-done').isVisible(),true);
  });
  await check(`${engine}: Platzieren wählt die nächste Probe im selben Raum; Modus bleibt, Marker nicht ausgewählt`,async()=>{
   await tap(page,200,200);   // P1 platziert → P4 (zweite Probe im EG Flur)
   const p=await until(page,p=>p.markers.length===1);assert.deepEqual(p.markers.map(m=>m.label),['P1']);
   assert.match(await chipText(page),/^JETZT P4 · EG Flur/);assert.equal(await mode(page),'lab-place');
   assert.equal(await page.locator('#inspector').isVisible(),false,'kein Inspektor, die Fläche bleibt frei');
   assert.equal(await page.locator('[data-pending][aria-pressed=true]').count(),1);
   assert.match(await page.locator('#pending-count').textContent(),/1 von 6/);
  });
  await check(`${engine}: Raum fertig → nächster Raum in Sortierreihenfolge, Hinweis nennt den fertigen Raum`,async()=>{
   await tap(page,300,200);   // P4 platziert → EG Flur fertig → EG Küche (P2)
   await until(page,p=>p.markers.length===2);
   assert.match(await chipText(page),/^Raum „EG Flur“ fertig · JETZT P2 · EG Küche/);
  });
  await check(`${engine}: Überspringen wechselt im Raum, ohne etwas zu platzieren`,async()=>{
   await page.locator('#weiter-skip').click();assert.match(await chipText(page),/^JETZT P5 · EG Küche/);
   assert.equal(await page.locator('[data-pending][aria-pressed=true]').count(),1);
   await page.locator('#weiter-skip').click();assert.match(await chipText(page),/^JETZT P2 · EG Küche/);
   assert.deepEqual((await savedProject(page)).markers.map(m=>m.label),['P1','P4']);
  });
  await check(`${engine}: Esc beendet das Platzieren – Hinweisfeld weg, zurück zur Ansicht, offene Proben bleiben`,async()=>{
   await page.keyboard.press('Escape');
   assert.equal(await chip(page).isHidden(),true);assert.equal(await mode(page),'navigate');
   assert.deepEqual((await savedProject(page)).pending.map(r=>r.label),['P2','P3','P5','P6']);
   assert.equal(await page.locator('#next-field').isVisible(),true,'„Nächste Probe“ ist in der Ansicht wie bisher da');
  });
  await check(`${engine}: Raum für Raum bis zum Ende; Fertig-Knopf wie Esc`,async()=>{
   await page.locator('[data-pending]').first().click();   // P2 · EG Küche
   await tap(page,400,300);await until(page,p=>p.markers.length===3);assert.match(await chipText(page),/^JETZT P5 · EG Küche/);
   await tap(page,500,300);await until(page,p=>p.markers.length===4);assert.match(await chipText(page),/^Raum „EG Küche“ fertig · JETZT P3 · 1\. OG Kind/);
   await tap(page,600,300);await until(page,p=>p.markers.length===5);assert.match(await chipText(page),/^Raum „1\. OG Kind“ fertig · JETZT P6 · Decke · Untersicht/);
   await page.locator('#weiter-done').click();assert.equal(await chip(page).isHidden(),true);assert.equal(await mode(page),'navigate');
   assert.deepEqual((await savedProject(page)).pending.map(r=>r.label),['P6']);
  });
  await check(`${engine}: letzte Probe platziert → wie bisher zurück zur Ansicht mit ausgewähltem Punkt`,async()=>{
   await page.locator('[data-pending]').first().click();await tap(page,700,300);
   const p=await until(page,p=>p.markers.length===6);assert.deepEqual(p.pending||[],[]);
   assert.equal(await chip(page).isHidden(),true);assert.equal(await mode(page),'navigate');
   assert.equal(await page.locator('#inspector').isVisible(),true);assert.match(await page.locator('#pending-count').textContent(),/6 von 6/);
  });
  await check(`${engine}: Rückgängig nimmt einen Punkt zurück; Projektdatei ohne Spuren des Schalters`,async()=>{
   await page.locator('#undo').click();const p=await until(page,p=>p.markers.length===5);
   assert.deepEqual(p.pending.map(r=>r.label),['P6']);assert.equal(p.version,4);
   assert.equal(JSON.stringify(p).toLowerCase().includes('weiter'),false);
  });
  await check(`${engine}: Ziehen aus der Liste platziert genau eine Probe und beendet das Platzieren`,async()=>{
   const row=page.locator('[data-pending]').first();await row.scrollIntoViewIfNeeded();const r=await row.boundingBox(),t=await toScreen(page,900,400);
   await page.mouse.move(r.x+20,r.y+20);await page.mouse.down();await page.mouse.move(t.x,t.y,{steps:10});await page.mouse.up();
   await until(page,p=>p.markers.length===6);assert.equal(await chip(page).isHidden(),true);assert.equal(await mode(page),'navigate');
  });

  // Schalter aus: genau das bisherige Verhalten
  await check(`${engine}: Schalter aus – ein Punkt, dann zurück zur Ansicht; kein Hinweisfeld; Einstellung je Browser gemerkt`,async()=>{
   await page.locator('#undo').click();await until(page,p=>p.markers.length===5);
   await page.locator('#weiter-switch').uncheck();assert.equal(await page.locator('#stage').getAttribute('data-weiter'),'off');
   assert.equal(await page.evaluate(()=>localStorage.getItem('plankit-weiter-platzieren')),'0');
   await page.locator('[data-pending]').first().click();assert.equal(await chip(page).isHidden(),true);assert.equal(await mode(page),'lab-place');
   assert.equal(await page.locator('#next-field').isVisible(),true,'ohne Weiter-Platzieren bleibt das Feld wie bisher');
   await tap(page,800,300);await until(page,p=>p.markers.length===6);assert.equal(await mode(page),'navigate');
   await page.locator('#weiter-switch').check();assert.equal(await page.evaluate(()=>localStorage.getItem('plankit-weiter-platzieren')),'1');
  });
  assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}
}

// Touch (iPad): Tippen platziert und wählt weiter; die Knöpfe im Hinweisfeld sind groß genug
{
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext({...devices['iPad Pro 11'],acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,`${base}/?weiter-default`);
  await check('Touch: Tippen platziert, nächste Probe gewählt, Knöpfe mindestens 36 px hoch',async()=>{
   await page.locator('[data-pending]').first().tap();await chip(page).waitFor();
   const p=await toScreen(page,200,200);await page.touchscreen.tap(p.x,p.y);
   await until(page,s=>s.markers.length===1);assert.match(await chipText(page),/^JETZT P4 · EG Flur/);
   for(const id of ['#weiter-skip','#weiter-done'])assert.ok((await page.locator(id).boundingBox()).height>=36);
   await page.locator('#weiter-done').tap();assert.equal(await chip(page).isHidden(),true);
  });
  assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}
}
