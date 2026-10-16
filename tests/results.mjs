// Ergebniskarte: Messwerte aus der Labor-XML, Skalen wie in FotoKit, eingefärbte Marker, Legende und Export.
import {chromium,webkit,savedProject,downloadedProject,openExport,closeExport} from './runtime.mjs';
import {labRows,labXML} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
const SUM='Summe 16 EPA-PAK exkl. BG',UNIT='µg/100 cm²',KEY=`${SUM}|${UNIT}`;
const values=['< 0,50','3,2','45','1.300,0'];
const rows=labRows.slice(0,5).map((r,i)=>({...r,lines:i<4?[{p:SUM,r:values[i],u:UNIT},{p:'Benzo[a]pyren',r:'0,8',u:UNIT}]:[{p:'Benzo[a]pyren',r:'2,0',u:UNIT}]}));
const fotokit={[KEY]:{name:'PAK Wischproben',cats:[{name:'gering',from:0},{name:'mittel',from:5},{name:'hoch',from:50}],geaendert:'2026-10-01T00:00:00Z'}};
async function check(name,fn){await fn();console.log(`OK ${name}`);}
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
const fills=page=>page.locator('#marks').evaluate(g=>Object.fromEntries([...g.querySelectorAll('[data-id]')].map(m=>[m.querySelector('text').textContent,m.querySelector('g[data-drag]').getAttribute('fill')])));
for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true});
  await context.addInitScript(scales=>{if(!localStorage.getItem('bu-scales'))localStorage.setItem('bu-scales',JSON.stringify(scales));},fotokit);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('#file').setInputFiles({name:'eg.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/></svg>')});await page.locator('#welcome').waitFor({state:'hidden'});
  await check(`${engine}: Labor-XML speichert Messwerte je Probe, Ergebnisse erst danach verfügbar`,async()=>{
   assert.equal(await page.locator('#results-toggle').isDisabled(),true);
   await page.locator('#lab-files').setInputFiles([{name:'bericht.xml',mimeType:'application/xml',buffer:Buffer.from(labXML(rows))}]);await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
   for(const [i,[fx,fy]] of [[.2,.3],[.4,.3],[.6,.3],[.8,.3],[.5,.7]].entries()){await page.locator('[data-pending]').first().click();await tap(page,fx,fy);void i;}
   const saved=await savedProject(page);assert.deepEqual(saved.markers.map(m=>m.label),['P1','P2','P3','P4','P5']);
   assert.deepEqual(saved.markers[3].lab.werte[0],{p:SUM,r:'1.300,0',u:UNIT});assert.equal(saved.results,undefined);
   assert.equal(await page.locator('#results-toggle').isDisabled(),false);
  });
  await check(`${engine}: K färbt nach FotoKit-Skala (grün → rot), ohne Wert grau`,async()=>{
   await page.keyboard.press('Escape');await page.keyboard.press('k');assert.equal(await page.locator('#results-toggle').getAttribute('aria-pressed'),'true');
   await page.locator('#results-section').waitFor();assert.equal(await page.locator('#result-param').inputValue(),SUM);
   assert.deepEqual(await fills(page),{P1:'#749bb5',P2:'#4caf50',P3:'#f2c94c',P4:'#e0453a',P5:'#c3ccd5'});
   const saved=await savedProject(page);assert.equal(saved.results.parameter,SUM);assert.deepEqual(saved.results.scales[KEY].cats.map(c=>[c.name,c.from,c.color]),[['gering',0,'#4caf50'],['mittel',5,'#f2c94c'],['hoch',50,'#e0453a']]);
   assert.match(await page.locator('#result-legend').textContent(),/gering.*mittel.*hoch.*ohne Bewertung/);
   assert.match(await page.locator('#result-scales').textContent(),/P2/);
  });
  await check(`${engine}: Skala bearbeiten wirkt sofort, ist rückgängig machbar und landet auch bei FotoKit`,async()=>{
   const from=page.locator('#result-scales [data-cat="1"] [data-cat-from]');await from.fill('2');await from.press('Tab');
   assert.equal((await fills(page)).P2,'#f2c94c');
   const shared=await page.evaluate(()=>JSON.parse(localStorage.getItem('bu-scales')));assert.deepEqual(shared['Summe 16 EPA-PAK exkl. BG|µg/100 cm²'].cats,[{name:'gering',from:0},{name:'mittel',from:2},{name:'hoch',from:50}]);
   await page.locator('#result-scales [data-cat="2"] [data-cat-color]').evaluate(el=>{el.value='#7b1fa2';el.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal((await fills(page)).P4,'#7b1fa2');
   await page.keyboard.press('Control+z');assert.equal((await fills(page)).P4,'#e0453a');await page.keyboard.press('Control+z');assert.equal((await fills(page)).P2,'#4caf50');
   await page.locator('#result-scales [data-cat-add]').click();assert.equal(await page.locator('#result-scales [data-cat]').count(),4);assert.equal((await fills(page)).P4,'#e0453a');
   await page.keyboard.press('Control+z');
  });
  await check(`${engine}: anderer Parameter ohne Skala bleibt grau, „Skala anlegen“ legt eine an`,async()=>{
   await page.locator('#result-param').selectOption('Benzo[a]pyren');assert.deepEqual(Object.values(await fills(page)),Array(5).fill('#c3ccd5'));
   await page.locator('#result-scales [data-scale-new]').click();assert.equal(await page.locator('#result-scales [data-cat]').count(),2);
   assert.deepEqual(await fills(page),{P1:'#4caf50',P2:'#4caf50',P3:'#4caf50',P4:'#4caf50',P5:'#e0453a'});
   await page.locator('#result-param').selectOption(SUM);assert.equal((await fills(page)).P4,'#e0453a');
  });
  await check(`${engine}: VdS usage, BG, undo/redo, roundtrip and FotoKit isolation`,async()=>{
   const before=await savedProject(page),shared=await page.evaluate(()=>localStorage.getItem('bu-scales'));
   await page.locator('#result-usage').selectOption('residential');
   assert.deepEqual(await fills(page),{P1:'#749bb5',P2:'#e0453a',P3:'#e0453a',P4:'#e0453a',P5:'#c3ccd5'});
   assert.match(await page.locator('#result-scales').textContent(),/Wohn-\/Büroräume/);assert.match(await page.locator('#result-scales').textContent(),/0,1/);
   assert.match(await page.locator('#result-legend').textContent(),/unter BG/);
   await page.locator('#result-usage').selectOption('industrial');assert.match(await page.locator('#result-scales').textContent(),/Industrie/);
   await page.locator('#undo').click();assert.equal(await page.locator('#result-usage').inputValue(),'residential');
   await page.locator('#redo').click();assert.equal(await page.locator('#result-usage').inputValue(),'industrial');
   const file=await downloadedProject(page);assert.equal(file.results.usage,'industrial');assert.deepEqual(file.results.scales,before.results.scales);assert.deepEqual(file.markers,before.markers);
   await page.locator('#project-file').setInputFiles({name:'usage.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click();await page.locator('#toast:not(.error)').waitFor();
   assert.equal((await savedProject(page)).results.usage,'industrial');
   await page.locator('#result-param').selectOption('Benzo[a]pyren');assert.equal(await page.locator('#result-usage').inputValue(),'industrial');assert.ok(Object.values(await fills(page)).every(c=>c==='#c3ccd5'));
   await page.locator('#result-param').selectOption(SUM);await page.locator('#result-usage').selectOption('');assert.deepEqual((await savedProject(page)).results,before.results);
   assert.equal(await page.evaluate(()=>localStorage.getItem('bu-scales')),shared);
   const bad=structuredClone(file);bad.results.usage='unknown';await page.locator('#project-file').setInputFiles({name:'bad-usage.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.locator('#toast.error').waitFor();assert.match(await page.locator('#toast').textContent(),/Nutzungskategorie/);
  });
  await check(`${engine}: Export als Ergebniskarte und als neutraler Probenplan`,async()=>{
   await openExport(page);await page.locator('#view-field').waitFor();await page.locator('#view').selectOption('results');
   let d=page.waitForEvent('download');await page.locator('#export').click();assert.match((await d).suggestedFilename().replace(/_/g,' '),/^Probenplan - Ergebniskarte\.png$/);
   await page.locator('#view').selectOption('plan');d=page.waitForEvent('download');await page.locator('#export').click();assert.equal((await d).suggestedFilename(),'Probenplan.png');await closeExport(page);
  });
  await check(`${engine}: Projektdatei behält Skala und Farben; ungültige Farbe wird abgewiesen`,async()=>{
   const file=await downloadedProject(page);assert.equal(file.results.parameter,SUM);assert.equal(file.markers[2].lab.werte[0].r,'45');
   await page.keyboard.press('k');assert.equal(await page.locator('#results-toggle').getAttribute('aria-pressed'),'false');assert.equal((await fills(page)).P4,'white');
   const bad=structuredClone(file);bad.results.scales[KEY].cats[0].color='red';
   await page.locator('#project-file').setInputFiles({name:'x.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.locator('#toast.error').waitFor();assert.match(await page.locator('#toast').textContent(),/Bewertungsskala/);
   await page.evaluate(()=>localStorage.removeItem('bu-scales'));
   await page.locator('#project-file').setInputFiles({name:'ok.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click();await page.locator('#toast:not(.error)').waitFor();
   await page.keyboard.press('k');assert.equal((await fills(page)).P4,'#e0453a');
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
