// Layout 2.0 (einfache Oberfläche): Kopfband kompakt 56 px, Karte randlos zwischen Kopfband und Fußleiste, Schritte schweben auf der Karte.
// Kartenanteil je Schritt bei 1366 × 658 und 1920 × 1080, Spalte rechts zu/offen; Spalte beim ersten Start offen, danach gemerkt (L);
// Kürzel wechseln in ihren Schritt; „Einpassen“ legt den Plan unter die schwebenden Leisten. Synthetischer Plan.
import * as pk from './pk-ui.mjs';
import {chromium,webkit} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560"><rect width="800" height="560" fill="white"/><path d="M40 40H760V520H40Z" fill="none" stroke="black" stroke-width="8"/></svg>');
const share=page=>page.evaluate(()=>{const r=document.getElementById('stage').getBoundingClientRect();return r.width*r.height/(innerWidth*innerHeight);});
const panelOpen=page=>page.locator('#side-panel').isVisible();
const box=(page,sel)=>page.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};});
async function check(name,fn){await fn();console.log(`OK ${name}`);}
for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const page=await browser.newPage({viewport:{width:1366,height:658},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/?layout-default`);
  await page.locator('#file').setInputFiles({name:'raum.svg',mimeType:'image/svg+xml',buffer:svg});await page.locator('#welcome').waitFor({state:'hidden'});
  await check(`${engine}: Kopfband 56 px, Karte randlos bis zur Fußleiste, keine Seitenscrollleiste; Spalte beim ersten Start offen`,async()=>{
   const band=await box(page,'#mosaikLeiste'),stage=await box(page,'#stage'),fuss=await box(page,'#pk-fuss');
   assert.equal(Math.round(band.height),56,'Kopfband kompakt');assert.ok(Math.abs(stage.top-band.bottom)<=1,`Karte direkt unter dem Kopfband (${stage.top}/${band.bottom})`);
   assert.ok(Math.abs(stage.bottom-fuss.top)<=1,'Karte bis an die Fußleiste');assert.ok(fuss.height<=66,`Fußleiste ${fuss.height}`);assert.equal(Math.round(stage.left),0,'Karte bis an den linken Rand – keine Werkzeugleiste');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true);
   assert.equal(await panelOpen(page),true,'erster Start: Spalte offen');assert.equal(await pk.aktuell(page),'1','frischer Plan: Schritt ①');
  });
  for(const [w,h,zu,offen] of [[1366,658,.80,.62],[1920,1080,.87,.73]]){
   await page.setViewportSize({width:w,height:h});
   for(const s of [1,2,3]){
    await check(`${engine}: ${w} × ${h}, Schritt ${s}: Kartenanteil Spalte offen ≥ ${Math.round(offen*100)} %, zu ≥ ${Math.round(zu*100)} %`,async()=>{
     await pk.schritt(page,s);await pk.spalte(page);const a=await share(page);assert.ok(a>=offen,`offen ${a}`);
     await page.locator('#panel-close').click();const b=await share(page);assert.ok(b>=zu,`zu ${b}`);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1),true,'keine Scrollleiste');
     await page.locator('#panel-toggle').click();assert.equal(await panelOpen(page),true,'Lasche öffnet die Spalte');
    });
   }
  }
  await page.setViewportSize({width:1366,height:658});
  await check(`${engine}: „Einpassen“ legt den Plan unter die Schritte und über Hinweiskarte und Zoom`,async()=>{
   await pk.schritt(page,2);await page.locator('#fit').click();const plan=await box(page,'#plan-view'),oben=await box(page,'#pk-oben'),zoom=await box(page,'.zoom-controls');
   assert.ok(plan.top>=oben.bottom-1,`Plan ${plan.top} unter den Schritten ${oben.bottom}`);assert.ok(plan.bottom<=zoom.top+1,`Plan ${plan.bottom} über dem Zoom ${zoom.top}`);
  });
  await check(`${engine}: Kürzel wechseln in ihren Schritt (P → ②, C → ①), Setzen öffnet keine Spalte, Auswahl zeigt „Probe P1“`,async()=>{
   await page.locator('#panel-close').click();await pk.schritt(page,3);
   await page.keyboard.press('p');assert.equal(await pk.aktuell(page),'2');assert.equal(await page.locator('button[data-mode="sample"]').getAttribute('aria-pressed'),'true');
   const stage=await page.locator('#drawing').boundingBox(),at=(fx,fy)=>({x:stage.x+stage.width*fx,y:stage.y+stage.height*fy});
   const p1=at(.4,.5);await page.mouse.click(p1.x,p1.y);await page.keyboard.press('b');await page.mouse.click(...Object.values(at(.6,.5)));
   assert.equal(await page.locator('button[data-mode="fire"]').getAttribute('aria-pressed'),'true');assert.equal(await panelOpen(page),false);
   await page.keyboard.press('Escape');await page.keyboard.press('e');await page.mouse.click(p1.x,p1.y);
   await page.locator('#inspector').waitFor();assert.equal(await panelOpen(page),true);assert.equal(await page.locator('#label').inputValue(),'P1');
   assert.equal((await page.locator('#pk-probe-titel').textContent()).trim(),'Probe P1');
   await page.keyboard.press('Escape');await page.keyboard.press('c');assert.equal(await pk.aktuell(page),'1','C wechselt nach ①');await page.locator('#crop-actions').waitFor();
   assert.equal(await page.locator('#pk-oben').isVisible(),false,'Schritte sind während des Zuschnitts ausgeblendet');
   await page.locator('#crop-cancel').click();assert.equal(await page.locator('#pk-oben').isVisible(),true);
  });
  await check(`${engine}: L klappt die Spalte um, Zustand bleibt nach Neuladen erhalten, Eingaben lösen keine Kürzel aus`,async()=>{
   await pk.spalte(page);await page.keyboard.press('l');assert.equal(await panelOpen(page),false);
   await page.reload();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal(await panelOpen(page),false);
   await page.locator('#panel-toggle').click();assert.equal(await panelOpen(page),true);await page.reload();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal(await panelOpen(page),true);
   await pk.schritt(page,3);await page.locator('#report').focus();await page.keyboard.press('b');assert.equal(await pk.aktuell(page),'3','Tippen im Feld wechselt nicht den Schritt');
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
