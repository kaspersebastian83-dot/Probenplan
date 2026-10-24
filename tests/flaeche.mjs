// Oberflächenart (ab 1.23 Standard, vorher Testfunktion „Probenfläche“): Aufsicht/Ansicht/Untersicht je Probe, aus LabelKit oder
// von Hand; Balken am Schild, Wertkästchen, Projektdatei mit Validierung; ältere Dateien mit trials.surface bleiben lesbar.
import {chromium,webkit,savedProject,downloadedProject} from './runtime.mjs';
import {labRows,labXML} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const SUM='Summe 16 EPA-PAK exkl. BG',UNIT='µg/100 cm²',KEY=`${SUM}|${UNIT}`;
const fotokit={[KEY]:{name:'PAK',cats:[{name:'gering',from:0},{name:'mittel',from:5},{name:'hoch',from:50}],geaendert:'2026-10-01T00:00:00Z'}};
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
const blur=page=>page.evaluate(()=>document.activeElement?.blur());
const bars=page=>page.locator('#marks').evaluate(g=>[...g.querySelectorAll('rect[pointer-events="none"][rx]')].filter(r=>r.getAttribute('stroke')==='#ffffff').map(r=>{const b=r.getBBox();return {x:b.x+b.width/2,y:b.y+b.height/2,w:b.width,h:b.height};}));
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  await context.addInitScript(s=>{if(!localStorage.getItem('bu-scales'))localStorage.setItem('bu-scales',JSON.stringify(s));},fotokit);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('#file').setInputFiles({name:'eg.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/></svg>')});await page.locator('#welcome').waitFor({state:'hidden'});
  if(await page.locator('#panel-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#panel-toggle').click();
  const rows=labRows.slice(0,3).map((r,i)=>({...r,lines:[{p:SUM,r:['1.300,0','3,2','45'][i],u:UNIT}]}));
  await page.locator('#lab-files').setInputFiles([{name:'bericht.xml',mimeType:'application/xml',buffer:Buffer.from(labXML(rows))}]);await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
  const pts=[[300,300],[700,300],[500,600]];
  for(const [x,y] of pts){await page.locator('[data-pending]').first().click();const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);}
  await page.keyboard.press('Escape');
  const pick=async i=>{await blur(page);await page.keyboard.press('e');const p=await toScreen(page,...pts[i]);await page.mouse.click(p.x,p.y);await page.locator('#inspector').waitFor();};

  await check(`${engine}: Standard – Feld „Oberflächenart“ sichtbar, ohne Eingabe nichts im Projekt`,async()=>{
   await pick(0);assert.equal(await page.locator('#surface-row').isVisible(),true);
   const s=await savedProject(page);assert.equal(s.trials,undefined);assert.ok(s.markers.every(m=>!m.surface));assert.equal((await bars(page)).length,0);
  });
  await check(`${engine}: Untersicht/Ansicht/Aufsicht wählen – Balken oben, links, unten`,async()=>{
   for(const [i,v] of [[0,'ceiling'],[1,'wall'],[2,'floor']]){await pick(i);await page.locator('#surface').selectOption(v);}
   const s=await savedProject(page);assert.deepEqual(s.markers.map(m=>m.surface),['ceiling','wall','floor']);
   const b=await bars(page);assert.equal(b.length,3);
   const [ce,wa,fl]=pts.map(([x,y])=>b.find(r=>Math.hypot(r.x-x,r.y-y)<80));
   assert.ok(ce&&ce.y<pts[0][1]&&ce.w>ce.h,'Untersicht: waagerechter Balken oben');assert.ok(wa&&wa.x<pts[1][0]&&wa.h>wa.w,'Ansicht: senkrechter Balken links');assert.ok(fl&&fl.y>pts[2][1]&&fl.w>fl.h,'Aufsicht: waagerechter Balken unten');
  });
  await check(`${engine}: Wertkästchen nennt die Oberflächenart`,async()=>{
   await blur(page);await page.keyboard.press('v');await page.locator('#value-labels').check();await page.locator('#results-toggle').click();
   await page.locator('#marks text',{hasText:'Untersicht · hoch'}).waitFor();assert.ok((await page.locator('#marks').textContent()).includes('Ansicht · gering'));
   if(process.env.SHOT){await page.waitForTimeout(400);await page.screenshot({path:process.env.SHOT+'-1.png'});
    await page.locator('#export-open').click();await page.locator('#export').waitFor();await page.locator('#view').selectOption('results');
    const dl=page.waitForEvent('download');await page.locator('#export').click();const d=await dl;await d.saveAs(process.env.SHOT+'-2.png');await page.locator('#export-dialog .close').click();}
   await page.locator('#results-toggle').click();await page.locator('#value-labels').uncheck();
  });
  await check(`${engine}: Probe aus LabelKit bringt ihre Oberflächenart mit`,async()=>{
   const lk={version:'4.33.0',projekt:{nr:'26.0123'},proben:[{id:9,_nr:9,z2:'EG Flur',z4:'Ansicht',matrix:'Wischprobe',cm2:'600',datum:'2026-10-23'}]};
   await page.locator('#lab-files').setInputFiles([{name:'26.0123_Daten.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lk))}]);await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
   await page.locator('[data-pending]').first().click();const p=await toScreen(page,900,600);await page.mouse.click(p.x,p.y);await page.keyboard.press('Escape');
   const m=(await savedProject(page)).markers.find(x=>x.label==='P9');assert.equal(m?.surface,'wall');assert.equal((await bars(page)).length,4);
  });
  await check(`${engine}: ältere Projektdatei mit Testfunktion bleibt lesbar; ungültige Werte abgewiesen`,async()=>{
   const file=await downloadedProject(page);file.trials={surface:true};
   await page.locator('#project-file').setInputFiles({name:'x.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click();
   await page.locator('#welcome').waitFor({state:'hidden'});assert.equal((await bars(page)).length,4);
   for(const bad of [(f=>{f.markers[0].surface='decke';return f;})(structuredClone(file)),(f=>{f.trials={surface:true,raketen:true};return f;})(structuredClone(file))]){
    await page.locator('#project-file').setInputFiles({name:'bad.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
    await page.locator('#toast.error').waitFor();await page.locator('#toast').evaluate(t=>{t.hidden=true;t.className='';});}
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
