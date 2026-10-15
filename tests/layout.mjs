// Layout „Karte zuerst“: Kartenanteil, eingeklappte Liste, automatisches Aufklappen, Tastenkürzel und Exportkarte.
import {chromium,webkit} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560"><rect width="800" height="560" fill="white"/><path d="M40 40H760V520H40Z" fill="none" stroke="black" stroke-width="8"/></svg>');
const share=page=>page.evaluate(()=>{const r=document.getElementById('stage').getBoundingClientRect();return r.width*r.height/(innerWidth*innerHeight);});
const panelOpen=page=>page.locator('#side-panel').isVisible();
async function check(name,fn){await fn();console.log(`OK ${name}`);}
for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const page=await browser.newPage({viewport:{width:1366,height:658},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/?layout-default`);
  await page.locator('#file').setInputFiles({name:'raum.svg',mimeType:'image/svg+xml',buffer:svg});await page.locator('#welcome').waitFor({state:'hidden'});
  await check(`${engine}: Liste standardmäßig eingeklappt, Karte ≥ 80 % und keine Seitenscrollleiste bei 1366 × 658`,async()=>{
   assert.equal(await panelOpen(page),false);assert.ok(await share(page)>=.8,`Kartenanteil ${await share(page)}`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true);
   for(const id of ['load','open-project','save-project','lab-import','undo','redo','export-open','panel-toggle','rotate-right','crop-start'])assert.equal(await page.locator(`#${id}`).isVisible(),true,id);
  });
  await check(`${engine}: Tastenkürzel wählen Werkzeuge, Setzen öffnet die Liste nicht, Auswahl öffnet sie`,async()=>{
   const stage=await page.locator('#drawing').boundingBox(),at=(fx,fy)=>({x:stage.x+stage.width*fx,y:stage.y+stage.height*fy});
   await page.keyboard.press('p');assert.equal(await page.locator('.rail [data-mode="sample"]').getAttribute('aria-pressed'),'true');
   const p1=at(.4,.5);await page.mouse.click(p1.x,p1.y);await page.keyboard.press('b');await page.mouse.click(...Object.values(at(.6,.5)));
   assert.equal(await page.locator('.rail [data-mode="fire"]').getAttribute('aria-pressed'),'true');assert.equal(await panelOpen(page),false);
   await page.keyboard.press('Escape');await page.keyboard.press('e');await page.mouse.click(p1.x,p1.y);
   await page.locator('#inspector').waitFor();assert.equal(await panelOpen(page),true);assert.equal(await page.locator('#label').inputValue(),'P1');
   assert.ok(await share(page)>=.6);
  });
  await check(`${engine}: L klappt die Liste um, Zustand bleibt nach Neuladen erhalten, Eingaben lösen keine Kürzel aus`,async()=>{
   await page.keyboard.press('Escape');await page.keyboard.press('l');assert.equal(await panelOpen(page),false);
   await page.reload();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal(await panelOpen(page),false);
   await page.locator('#panel-toggle').click();assert.equal(await panelOpen(page),true);await page.reload();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal(await panelOpen(page),true);
   await page.locator('#next').focus();await page.keyboard.press('b');assert.equal(await page.locator('.rail [data-mode="navigate"]').getAttribute('aria-pressed'),'true');
   await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('f');await page.locator('#toolbar #area-draft').waitFor();await page.keyboard.press('v');
  });
  await check(`${engine}: Exportkarte öffnen, exportieren und mit Esc schließen`,async()=>{
   await page.locator('#export-open').click();await page.locator('#export').waitFor();const d=page.waitForEvent('download');await page.locator('#export').click();assert.match((await d).suggestedFilename(),/\.png$/);
   await page.locator('#export-link').waitFor();await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Escape');await page.locator('#export').waitFor({state:'hidden'});
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
