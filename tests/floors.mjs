// Mehrere Pläne (Geschosse) in einem Projekt: Leiste, fortlaufende Nummern, Laborproben, Undo, Export, Speichern/Öffnen, mehrseitige PDF.
import {chromium,webkit,savedProject,downloadedProject,openExport,closeExport} from './runtime.mjs';
import {labXML} from './lab-fixtures.mjs';
import {syntheticPDF} from './fixtures.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
const plan=(w,h,label)=>({name:`${label}.svg`,mimeType:'image/svg+xml',buffer:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="white"/><path d="M20 20H${w-20}V${h-20}H20Z" fill="none" stroke="black" stroke-width="6"/></svg>`)});
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const tabs=page=>page.locator('#sheet-list [data-sheet]');
const activeName=page=>page.locator('#sheet-list .sheet.active b').textContent();
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('#file').setInputFiles(plan(800,560,'Erdgeschoss'));await page.locator('#welcome').waitFor({state:'hidden'});
  await check(`${engine}: ein Plan – schmale Leiste, Projekt bleibt im bisherigen Format`,async()=>{
   await page.locator('#sheet-strip.single').waitFor();assert.equal(await tabs(page).count(),1);assert.equal(await activeName(page),'EG');
   assert.ok((await page.locator('#sheet-strip').boundingBox()).height<=40);
   await page.keyboard.press('p');await tap(page,.4,.5);
   const saved=await savedProject(page);assert.ok(saved.version<=4);assert.equal(saved.sheets,undefined);assert.equal(saved.markers[0].label,'P1');
  });
  await check(`${engine}: ＋ Plan legt ein Obergeschoss an, Nummern laufen über alle Pläne weiter`,async()=>{
   await page.locator('#sheet-add').click();await page.locator('#sheet-file').setInputFiles(plan(600,600,'OG'));
   await page.locator('#sheet-strip:not(.single)').waitFor();assert.equal(await tabs(page).count(),2);assert.equal(await activeName(page),'1. OG');
   assert.equal(await page.locator('#count').textContent(),'0');assert.match(await page.locator('.markers-section h2').textContent(),/1\. OG/);
   await page.keyboard.press('p');await tap(page,.5,.5);
   const saved=await savedProject(page);assert.equal(saved.version,5);assert.equal(saved.active,1);assert.equal(saved.sheets.length,2);
   assert.equal(saved.markers[0].label,'P2');assert.deepEqual(saved.sheets[0].markers.map(m=>m.label),['P1']);assert.equal(saved.sheets[1].plan,undefined);
   await page.locator('#sheet-list .sheet.active img').waitFor();
  });
  await check(`${engine}: Wechseln per Klick und Bild↓, Kennungen bleiben gebäudeweit eindeutig`,async()=>{
   await tabs(page).nth(0).click();assert.equal(await activeName(page),'EG');assert.equal(await page.locator('#marker-list .marker-row').count(),1);assert.match(await page.locator('#marker-list').textContent(),/P1/);
   await page.keyboard.press('PageDown');assert.equal(await activeName(page),'1. OG');await page.keyboard.press('PageDown');assert.equal(await activeName(page),'1. OG');
   await page.keyboard.press('e');await page.locator('#marker-list [data-select]').first().click();await page.locator('#label').fill('P1');await page.locator('#label').press('Enter');await page.locator('#label').blur();
   await page.locator('#toast.error').waitFor();assert.equal((await savedProject(page)).markers[0].label,'P2');await page.keyboard.press('Escape');
  });
  await check(`${engine}: Umbenennen per Doppelklick, Rückgängig springt zum betroffenen Plan`,async()=>{
   await page.locator('#sheet-list .sheet.active [data-sheet]').dblclick();await page.locator('#sheet-dialog').waitFor();
   await page.locator('#sheet-name').fill('Obergeschoss');await page.locator('#sheet-name').press('Enter');await page.locator('#sheet-dialog').waitFor({state:'hidden'});
   assert.equal(await activeName(page),'Obergeschoss');
   await tabs(page).nth(0).click();assert.equal(await activeName(page),'EG');
   await page.keyboard.press('Control+z');assert.equal(await activeName(page),'1. OG');assert.equal((await savedProject(page)).active,1);
   await page.keyboard.press('Control+Shift+z');assert.equal(await activeName(page),'Obergeschoss');
  });
  await check(`${engine}: Laborbericht einmal importieren, Probe im Obergeschoss platzieren, Plan löschen gibt sie zurück`,async()=>{
   await page.locator('#lab-files').setInputFiles([{name:'bericht.xml',mimeType:'application/xml',buffer:Buffer.from(labXML())}]);await page.locator('#lab-confirm').waitFor();
   // P1/P2 sind belegt: Konflikte mit „Nächste freie P-Nummer“ auflösen.
   for(const select of await page.locator('#lab-review .lab-conflict select').all())await select.selectOption('next');
   await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
   const before=(await savedProject(page)).pending.length;assert.ok(before>=2);
   const row=page.locator('[data-pending]').first(),label=(await row.locator('span').first().textContent()).trim();
   await row.click();await tap(page,.3,.3);
   let saved=await savedProject(page);assert.equal(saved.pending.length,before-1);assert.ok(saved.markers.some(m=>m.label===label&&m.lab));
   assert.match(await page.locator('#lab-panel').textContent(),/Obergeschoss: 1/);
   await page.locator('#sheet-list .sheet.active [data-sheet]').click({button:'right'});await page.locator('#sheet-dialog').waitFor();
   await page.locator('#sheet-delete').click();await page.locator('#sheet-dialog').waitFor({state:'hidden'});
   saved=await savedProject(page);assert.equal(await tabs(page).count(),1);assert.equal(saved.pending.length,before);assert.ok(saved.pending.some(r=>r.label===label));assert.deepEqual(saved.markers.map(m=>m.label),['P1']);
   await page.keyboard.press('Control+z');saved=await savedProject(page);assert.equal(saved.sheets.length,2);assert.equal(saved.pending.length,before-1);assert.equal(await activeName(page),'Obergeschoss');
  });
  await check(`${engine}: Export „Alle Pläne“ liefert je Plan ein Bild mit Plannamen`,async()=>{
   await openExport(page);await page.locator('#scope-field').waitFor();await page.locator('#report').fill('26.0123');await page.locator('#report').press('Tab');
   await page.locator('#scope').selectOption('all');const names=[];page.on('download',d=>names.push(d.suggestedFilename()));
   await page.locator('#export').click();await page.locator('#export:has-text("Bild exportieren")').waitFor({timeout:60000});await page.waitForTimeout(300);
   assert.deepEqual(names.sort(),['26.0123 - EG.png','26.0123 - Obergeschoss.png']);
   await page.locator('#scope').selectOption('one');const one=page.waitForEvent('download');await page.locator('#export').click();assert.equal((await one).suggestedFilename(),'26.0123 - Obergeschoss.png');
   await closeExport(page);
  });
  await check(`${engine}: Projektdatei mit zwei Plänen speichern und wieder öffnen`,async()=>{
   const file=await downloadedProject(page);assert.equal(file.version,5);assert.equal(file.sheets.length,2);
   await page.reload();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal(await tabs(page).count(),2);
   await page.locator('#project-file').setInputFiles({name:'haus.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click();
   await page.locator('#sheet-strip:not(.single)').waitFor();assert.equal(await activeName(page),'Obergeschoss');await tabs(page).nth(0).click();assert.equal(await page.locator('#count').textContent(),'1');
   const bad=structuredClone(file);bad.sheets[0].markers[0].label=bad.markers[0].label;
   await page.locator('#project-file').setInputFiles({name:'kaputt.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.locator('#toast.error').waitFor();assert.match(await page.locator('#toast').textContent(),/Doppelte|doppelte/);
  });
  await check(`${engine}: mehrseitige PDF als einzelne Pläne übernehmen`,async()=>{
   await page.locator('#file').setInputFiles({name:'haus.pdf',mimeType:'application/pdf',buffer:syntheticPDF([{width:600,height:800},{width:800,height:600},{width:700,height:700}])});
   await page.locator('#pdf-all:visible').click();await page.locator('#replace-yes').click();await page.locator('#import-status').waitFor({state:'hidden',timeout:60000});
   assert.equal(await tabs(page).count(),3);assert.equal(await activeName(page),'Seite 1');const saved=await savedProject(page);assert.deepEqual(saved.sheets.map(s=>s.name),['Seite 1','Seite 2','Seite 3']);assert.equal(saved.plan.pdf.page,1);assert.equal(saved.sheets[2].plan.pdf.page,3);
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
