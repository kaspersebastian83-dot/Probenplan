// Raumbuch im Browser: Raum aus LabelKit, Werte aus dem Laborbericht, Dialog mit Eingaben, Raum ohne Probe,
// Zusammenführen, CSV-Export und Projektdatei-Rundlauf. Synthetische Daten.
import {chromium,webkit,savedProject,downloadedProject} from './runtime.mjs';
import {labXML} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const SUM='Summe 16 EPA-PAK exkl. BG',U='µg/m²';
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('#file').setInputFiles({name:'eg.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/></svg>')});await page.locator('#welcome').waitFor({state:'hidden'});
  if(await page.locator('#panel-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#panel-toggle').click();
  const lk={version:'4.34.0',projekt:{nr:''},proben:[1,2,3,4].map(i=>({id:i,_nr:i,z2:['EG Küche','EG Kueche','EG Flur','EG Bad'][i-1],z4:['Untersicht','Ansicht','Ansicht','Ansicht'][i-1],matrix:'Wischprobe',cm2:'600',datum:'2026-10-20'}))};
  page.once('dialog',d=>d.accept());
  await page.locator('#lab-files').setInputFiles([{name:'x_Daten.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lk))}]);await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
  const pts=[[200,200],[300,200],[600,200],[900,500]];
  for(const [x,y] of pts){await page.locator('[data-pending]').first().click();const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);}
  await page.keyboard.press('Escape');
  const rows=[1,2,3,4].map(i=>({ref:`Probe ${i}`,desc:'',art:'Wischprobe',labNr:`L${i}`,lines:[{p:SUM,r:['480','210','38','6'][i-1],u:U}]}));
  await page.locator('#lab-files').setInputFiles([{name:'bericht.xml',mimeType:'application/xml',buffer:Buffer.from(labXML(rows))}]);
  await page.locator('#lab-review').waitFor();const conflicts=page.locator('[data-lab-row] .lab-conflict select');for(let i=0;i<await conflicts.count();i++)await conflicts.nth(i).selectOption('update');
  await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
  await page.locator('#results-toggle').click();await page.locator('#result-usage').selectOption('residential');await page.locator('#results-toggle').click();

  await check(`${engine}: Raum kommt aus LabelKit und bleibt mit Laborwerten am Marker`,async()=>{
   const s=await savedProject(page);assert.deepEqual(s.markers.map(m=>m.raum),['EG Küche','EG Kueche','EG Flur','EG Bad']);assert.ok(s.markers.every(m=>m.lab?.werte?.length));
  });
  await check(`${engine}: Raumbuch – gleiche Schreibweise zusammen, Bewertung, Maßnahme fehlt markiert`,async()=>{
   await page.locator('#raumbuch-open').click();await page.locator('#raumbuch-dialog').waitFor();
   const names=await page.locator('#raumbuch-rows td.raum').allTextContents();assert.deepEqual(names,['Küche','Flur','Bad']);
   const kueche=page.locator('#raumbuch-rows tr').nth(0);
   assert.match(await kueche.locator('td.befund').innerText(),/P1 480 µg\/m² · Untersicht[\s\S]*P2 210 µg\/m² · Ansicht/);
   assert.match(await kueche.innerText(),/Referenzwert erreicht/);assert.equal(await kueche.locator('input.missing').count(),1);
   assert.match(await page.locator('#raumbuch-rows tr').nth(2).innerText(),/unter Referenzwert/);
   assert.match(await page.locator('#raumbuch-hints').innerText(),/2 auffällige Räume ohne Maßnahme/);
  });
  await check(`${engine}: Maßnahme, Raum ohne Probe mit Status, doppelter Raum abgewiesen`,async()=>{
   const m=page.locator('#raumbuch-rows [data-f="massnahme"]').first();await m.fill('Reinigung, Kontrollmessung');await m.press('Tab');
   await page.locator('#raumbuch-add-floor').fill('EG');await page.locator('#raumbuch-add-name').fill('HWR');await page.locator('#raumbuch-add button').click();
   await page.locator('#raumbuch-rows td.raum',{hasText:'HWR'}).waitFor();
   const hwr=page.locator('#raumbuch-rows tr',{hasText:'HWR'});assert.match(await hwr.innerText(),/Sichtprüfung unauffällig/);
   await hwr.locator('select').selectOption('nicht_begangen');await page.locator('#raumbuch-rows tr',{hasText:'nicht begangen'}).waitFor();
   await page.locator('#raumbuch-add-name').fill('Küche');await page.locator('#raumbuch-add button').click();await page.locator('#toast.error').waitFor();await page.locator('#toast').evaluate(t=>{t.hidden=true;t.className='';});
   await page.locator('#raumbuch-close').click();
   const s=await savedProject(page);assert.deepEqual(s.raumbuch.rooms,[{floor:'EG',name:'Küche',massnahme:'Reinigung, Kontrollmessung'},{floor:'EG',name:'HWR',status:'nicht_begangen'}]);
   await page.locator('#raumbuch-open').click();await page.locator('#raumbuch-dialog').waitFor();
   if(process.env.SHOT){await page.waitForTimeout(300);await page.locator('#raumbuch-dialog').screenshot({path:process.env.SHOT+'-raumbuch.png'});}
  });
  await check(`${engine}: CSV-Export ohne Flächen, mit Hinweis zur Mengenermittlung`,async()=>{
   const dl=page.waitForEvent('download');await page.locator('#raumbuch-csv').click();const d=await dl;
   assert.match(d.suggestedFilename(),/_Raumbuch_\d{4}-\d{2}-\d{2}\.csv$/);
   const csv=await readFile(await d.path(),'utf8');assert.ok(csv.startsWith('﻿Geschoss;Raum;Status'));
   assert.match(csv,/EG;Küche;beprobt;P1, P2;.*Reinigung, Kontrollmessung/);assert.match(csv,/EG;HWR;nicht begangen/);assert.match(csv,/ausführenden Unternehmen/);
   const wd=page.waitForEvent('download');await page.locator('#raumbuch-word').click();const w=await wd;assert.match(w.suggestedFilename(),/_Raumbuch_.*\.docx$/);
   const bytes=await readFile(await w.path());assert.equal(bytes.subarray(0,2).toString(),'PK');
  });
  await check(`${engine}: Raum am Marker ändern; ähnliche Schreibweise zusammenführen`,async()=>{
   await page.locator('#raumbuch-close').click();
   await page.keyboard.press('e');const p=await toScreen(page,...pts[3]);await page.mouse.click(p.x,p.y);await page.locator('#inspector').waitFor();
   await page.locator('#raum').fill('EG Badezimer');await page.locator('#raum').press('Tab');
   assert.equal((await savedProject(page)).markers[3].raum,'EG Badezimer');
   const p2=await toScreen(page,...pts[2]);await page.mouse.click(p2.x,p2.y);await page.locator('#raum').fill('EG Badezimmer');await page.locator('#raum').press('Tab');
   await page.keyboard.press('Escape');
   await page.locator('#raumbuch-open').click();await page.locator('.raumbuch-merge').waitFor();
   await page.locator('.raumbuch-merge').first().click();
   await page.waitForFunction(()=>!document.querySelector('.raumbuch-merge'));
   const names=await page.locator('#raumbuch-rows td.raum').allTextContents();assert.equal(names.filter(n=>/^Badezim/.test(n)).length,1,names.join(', '));
  });
  await check(`${engine}: Projektdatei behält Raum und Raumbuch; Ungültiges abgewiesen`,async()=>{
   await page.locator('#raumbuch-close').click();
   const file=await downloadedProject(page);assert.ok(file.raumbuch.alias);assert.equal(file.markers[0].raum,'EG Küche');
   await page.locator('#project-file').setInputFiles({name:'x.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click();
   await page.locator('#welcome').waitFor({state:'hidden'});assert.deepEqual((await savedProject(page)).raumbuch,file.raumbuch);
   for(const bad of [(f=>{f.raumbuch.rooms[0].status='kaputt';return f;})(structuredClone(file)),(f=>{f.markers[0].raum=42;return f;})(structuredClone(file))]){
    await page.locator('#project-file').setInputFiles({name:'bad.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
    await page.locator('#toast.error').waitFor();await page.locator('#toast').evaluate(t=>{t.hidden=true;t.className='';});}
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
