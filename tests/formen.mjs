// 1.15: Formen der Probenahmestellen (Kreis/Quadrat/Raute), Probenart aus LabelKit, Brandherd als roter Stern ohne Kennung,
// LabelKit-Probenerfassung auch über „Andere Datei …“ (JSON), Legende „Probenarten“ im Export.
import {chromium,webkit,savedProject,openExport,closeExport} from './runtime.mjs';
import {labXML} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const plan={name:'EG.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><path d="M20 20H780V580H20Z" fill="none" stroke="black" stroke-width="8"/></svg>')};
const labelkit={name:'26.0123_19.10.2026_Daten.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:'4.30.4',projekt:{nr:'26.0123'},
 proben:[{id:1,_nr:1,matrix:'Wischprobe',z2:'Küche',z3:'Fensterbank',cm2:'400',datum:'2026-10-15'}],
 chloridProben:[{id:7,_nr:2,chloridNr:2,matrix:'Wischprobe',z2:'Flur',z3:'Wand',cm2:'100',datum:'2026-10-15'}],
 asbestProben:[{id:9,_nr:3,matrix:'Materialprobe',z2:'Keller',z3:'Fliesenkleber',datum:'2026-10-15'}],sonstigeProben:[]}))};
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
const byLabel=(p,l)=>p.markers.find(m=>m.label===l);
const svgShape=(page,id)=>page.locator(`#marks [data-id="${id}"] [data-drag] > :is(ellipse,rect,path):not([fill=transparent])`).last().evaluate(e=>e.tagName==='rect'?'square':e.tagName==='ellipse'?'circle':e.getAttribute('fill')==='#d42a1f'?'star':'diamond');
async function placeFirstPending(page,fx,fy){await page.locator('[data-pending]').first().click();await tap(page,fx,fy);await page.waitForTimeout(150);}

// Modell ohne Browser
const model=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(await readFile('src/model.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));
await check('Modell: Probenart → Form (PAK Kreis, Chlorid Quadrat, Asbest Raute, Sonstige Kreis), gespeicherte Form gewinnt',async()=>{
 assert.deepEqual(model.typeFromArt('PAK · Wischprobe'),{typ:'PAK',shape:'circle'});assert.deepEqual(model.typeFromArt('Chlorid · Wischprobe'),{typ:'Chlorid',shape:'square'});
 assert.deepEqual(model.typeFromArt('Asbest · Materialprobe'),{typ:'Asbest',shape:'diamond'});assert.deepEqual(model.typeFromArt('Sonstige'),{typ:'Sonstige',shape:'circle'});
 assert.equal(model.typeFromArt('Feststoff'),null);assert.equal(model.shapeOf({kind:'sample',lab:{art:'Chlorid · x'}}),'square');assert.equal(model.shapeOf({kind:'sample',shape:'diamond',lab:{art:'Chlorid · x'}}),'diamond');
 assert.equal(model.shapeForType('Asbest'),'diamond');assert.equal(model.shapeForType(undefined),'circle');
});

for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('#file').setInputFiles(plan);await page.locator('#welcome').waitFor({state:'hidden'});
  if(await page.locator('#panel-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#panel-toggle').click();

  await check(`${engine}: „Proben übernehmen …“ nimmt die LabelKit-Datei (JSON) auch ohne Projektordner`,async()=>{
   assert.equal((await page.locator('#lab-import').textContent()).trim(),'Proben übernehmen …');
   await page.locator('#lab-files').setInputFiles(labelkit);await page.locator('#lab-review').waitFor();await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
   const p=await savedProject(page);assert.deepEqual(p.pending.map(r=>[r.label,r.typ]),[['P1','PAK'],['P2','Chlorid'],['P3','Asbest']]);
  });
  await check(`${engine}: platzierte LabelKit-Proben bekommen die Form ihrer Probenart`,async()=>{
   await placeFirstPending(page,.2,.3);await placeFirstPending(page,.4,.3);
   const p=await savedProject(page);assert.deepEqual([byLabel(p,'P1'),byLabel(p,'P2')].map(m=>[m.typ,m.shape]),[['PAK',undefined],['Chlorid','square']]);
   assert.equal(await svgShape(page,byLabel(p,'P1').id),'circle');assert.equal(await svgShape(page,byLabel(p,'P2').id),'square');
   assert.match(await page.locator('.marker-row',{hasText:'P2'}).textContent(),/Probenahmestelle · Chlorid/);
  });
  await check(`${engine}: Laborbericht ergänzt die Proben – Probenart/Form aus LabelKit bleibt (platziert und offen)`,async()=>{
   await page.locator('#lab-files').setInputFiles({name:'AR-999.xml',mimeType:'application/xml',buffer:Buffer.from(labXML())});await page.locator('#lab-review').waitFor();
   await page.locator('#lab-update-all:visible').click();await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
   let p=await savedProject(page);assert.ok(byLabel(p,'P2').lab.labNr,'P2 hat Labordaten');assert.equal(byLabel(p,'P2').shape,'square');assert.equal(p.pending.find(r=>r.label==='P3').typ,'Asbest');
   await page.locator('[data-pending]',{hasText:'P3'}).click();await tap(page,.6,.3);await page.waitForTimeout(150);
   p=await savedProject(page);assert.deepEqual([byLabel(p,'P3').typ,byLabel(p,'P3').shape],['Asbest','diamond']);assert.equal(await svgShape(page,byLabel(p,'P3').id),'diamond');
  });
  await check(`${engine}: manuelle Probe mit gewählter Form, Form im Seitenfeld änderbar (Rückgängig)`,async()=>{
   await page.keyboard.press('p');await page.locator('#shape-field').waitFor();await page.locator('#next-shape').selectOption('diamond');
   const before=(await savedProject(page)).markers.length;await tap(page,.3,.7);await page.waitForTimeout(150);
   let p=await savedProject(page);const m=p.markers.at(-1);assert.equal(p.markers.length,before+1);assert.equal(m.shape,'diamond');assert.equal(m.typ,undefined);
   await page.keyboard.press('v');await page.locator('.marker-row',{hasText:'P1'}).first().click();await page.locator('#shape').selectOption('square');
   p=await savedProject(page);assert.equal(byLabel(p,'P1').shape,'square');await page.keyboard.press('Control+z');p=await savedProject(page);assert.equal(byLabel(p,'P1').shape,undefined);
  });
  await check(`${engine}: Brandherd ist ein roter Stern ohne Kennung`,async()=>{
   await page.keyboard.press('b');assert.equal(await page.locator('#shape-field').isVisible(),false);await tap(page,.7,.7);await page.waitForTimeout(150);await page.keyboard.press('v');
   const p=await savedProject(page),f=p.markers.find(m=>m.kind==='fire');assert.ok(f);assert.equal(f.shape,undefined);
   assert.equal(await svgShape(page,f.id),'star');assert.equal(await page.locator(`#marks [data-id="${f.id}"] text`).count(),0);
  });
  await check(`${engine}: Export-Legende „Probenarten“ mit Form je Probenart, Brandherd mit Stern`,async()=>{
   await page.evaluate(()=>{window.exportTexts=[];const orig=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.exportTexts.push(text);return orig.call(this,text,...args);};});
   await openExport(page);await page.locator('#format').selectOption('png');await page.locator('#framed').uncheck();const d=page.waitForEvent('download');await page.locator('#export').click();await d;await closeExport(page);
   const texts=(await page.evaluate(()=>window.exportTexts)).flatMap(t=>String(t).split('\n'));
   for(const t of ['Probenarten','PAK (Kreis)','Chlorid (Quadrat)','Asbest (Raute)','Brandherd','Legende'])assert.ok(texts.some(x=>x.includes(t)),`fehlt: ${t} in ${JSON.stringify(texts)}`);
   assert.ok(!texts.includes('B · Brandherd'));
  });
  await check(`${engine}: Form und Probenart überstehen Speichern/Öffnen (Projektdatei)`,async()=>{
   const p=await savedProject(page);const d=page.waitForEvent('download');await page.locator('#save-project').click();const file=await (await d).path();
   const text=await readFile(file,'utf8'),saved=JSON.parse(text);const flat=saved.sheets?saved.sheets.flatMap(s=>s.markers||[]):saved.markers;
   assert.deepEqual(flat.filter(m=>m.kind==='sample').map(m=>[m.label,m.shape||'',m.typ||'']).sort(),p.markers.filter(m=>m.kind==='sample').map(m=>[m.label,m.shape||'',m.typ||'']).sort());
   await page.locator('#project-file').setInputFiles({name:'x.probenplan',mimeType:'application/json',buffer:Buffer.from(text)});
   if(await page.locator('#replace-yes').isVisible().catch(()=>false))await page.locator('#replace-yes').click();await page.waitForTimeout(500);
   const q=await savedProject(page);assert.equal(byLabel(q,'P2').shape,'square');assert.equal(byLabel(q,'P3').typ,'Asbest');
   const bad=JSON.parse(text);(bad.sheets?bad.sheets[0].markers:bad.markers)[0].shape='hexagon';
   await page.locator('#project-file').setInputFiles({name:'bad.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.locator('#toast',{hasText:/Ungültige/}).waitFor();
  });
  assert.deepEqual(errors,[]);
  // 1.16: Form schon im Prüfdialog, offene Proben einzeln/alle entfernen, platzierte Punkte direkt in der Liste löschen
  const page2=await (await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true})).newPage();page2.on('pageerror',e=>errors.push(e.message));await page2.goto(base);
  await page2.locator('#file').setInputFiles(plan);await page2.locator('#welcome').waitFor({state:'hidden'});
  if(await page2.locator('#panel-toggle').getAttribute('aria-pressed')!=='true')await page2.locator('#panel-toggle').click();
  await check(`${engine}: Form im Prüfdialog wählen – für alle und je Zeile`,async()=>{
   await page2.locator('#lab-files').setInputFiles({name:'AR-999.xml',mimeType:'application/xml',buffer:Buffer.from(labXML())});await page2.locator('#lab-review').waitFor();
   const forms=page2.locator('#lab-review [data-field=shape]');const n=await forms.count();assert.ok(n>=3,`Formspalte für alle Zeilen (${n})`);assert.equal(await forms.first().inputValue(),'circle');
   await page2.locator('#lab-shape-all').selectOption('diamond');assert.deepEqual(new Set(await forms.evaluateAll(s=>s.map(x=>x.value))),new Set(['diamond']));
   await forms.nth(0).selectOption('circle');await forms.nth(1).selectOption('square');
   await page2.locator('#lab-confirm:enabled').click();await page2.locator('#lab-review').waitFor({state:'hidden'});
   const p=await savedProject(page2);assert.deepEqual(p.pending.slice(0,3).map(r=>r.shape),['circle','square','diamond']);
   assert.equal(await page2.locator('.pending-row').nth(1).evaluate(e=>e.classList.contains('square')),true);
  });
  await check(`${engine}: platzierte Laborproben bekommen die gewählte Form`,async()=>{
   for(const [fx,fy] of [[.2,.3],[.4,.3],[.6,.3]])await placeFirstPending(page2,fx,fy);
   const p=await savedProject(page2),ms=p.markers.filter(m=>m.kind==='sample');assert.deepEqual(ms.map(m=>m.shape),[undefined,'square','diamond']);
  });
  await check(`${engine}: offene Probe mit ✕ entfernen (rückgängig) und „Liste leeren“`,async()=>{
   let p=await savedProject(page2);const n=p.pending.length,first=p.pending[0].label;assert.ok(n>=2);
   await page2.locator(`[data-pending-del="${first}"]`).click();p=await savedProject(page2);assert.equal(p.pending.length,n-1);assert.ok(!p.pending.some(r=>r.label===first));
   await page2.keyboard.press('Control+z');p=await savedProject(page2);assert.equal(p.pending.length,n);
   page2.once('dialog',d=>d.accept());await page2.locator('#pending-clear').click();p=await savedProject(page2);
   assert.equal((p.pending||[]).length,0);assert.equal(p.markers.filter(m=>m.kind==='sample').length,3,'platzierte Punkte bleiben');
   await page2.keyboard.press('Control+z');p=await savedProject(page2);assert.equal(p.pending.length,n);
  });
  await check(`${engine}: platzierten Probenpunkt direkt in der Liste löschen – Punkt verschwindet aus dem Plan`,async()=>{
   let p=await savedProject(page2);const m=p.markers.find(x=>x.kind==='sample');
   await page2.locator(`#marker-list [data-del="${m.id}"]`).click();p=await savedProject(page2);
   assert.ok(!p.markers.some(x=>x.id===m.id));assert.equal(await page2.locator(`#marks [data-id="${m.id}"]`).count(),0);
   await page2.keyboard.press('Control+z');p=await savedProject(page2);assert.ok(p.markers.some(x=>x.id===m.id));
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
