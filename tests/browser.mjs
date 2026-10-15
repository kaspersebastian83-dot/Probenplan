import {chromium,webkit,savedProject,openExport,closeExport} from './runtime.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {syntheticPolycam} from './fixtures.mjs';
const base=process.env.TEST_URL||'http://localhost:4173';
const out=resolve('.test-output');await mkdir(out,{recursive:true});
const zip=syntheticPolycam(),originalSVG=zip.svg;
const summary=[];
async function checkpoint(name,fn){await fn();summary.push(name);console.log(`OK ${name}`);}
async function readProject(page,name='state'){
  if(name==='state')return savedProject(page);
  const d=page.waitForEvent('download');await page.locator('#save-project').click();const file=await d;const path=resolve(out,`${name}.probenplan`);await file.saveAs(path);return JSON.parse(await readFile(path,'utf8'));
}
async function planPoint(page,x,y){await page.locator('#drawing').scrollIntoViewIfNeeded();return page.locator('#drawing').evaluate((el,{x,y})=>{const p=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};},{x,y});}
async function clickPlan(page,x,y){const p=await planPoint(page,x,y);await page.mouse.click(p.x,p.y);}
async function importZip(page){await page.locator('#file').setInputFiles({name:zip.name,mimeType:zip.mimeType,buffer:zip.buffer});await page.locator('#choose-dialog').waitFor();assert.equal(await page.locator('#choices .choice').count(),2);assert.match(await page.locator('#choices .choice').first().textContent(),/SVG.*Ground Floor.svg/);await page.locator('#choices .choice').first().click();await page.waitForFunction(()=>document.querySelector('#base-plan').hasAttribute('href'));}
async function exportDownload(page,format,quality,path){await openExport(page);await page.locator('#format').selectOption(format);await page.locator('#quality').selectOption(String(quality));const d=page.waitForEvent('download');await page.locator('#export').click();await (await d).saveAs(path);const size=await page.evaluate(async({bytes,mime})=>{const blob=new Blob([Uint8Array.from(atob(bytes),c=>c.charCodeAt(0))],{type:mime});const bitmap=await createImageBitmap(blob);return {width:bitmap.width,height:bitmap.height};},{bytes:(await readFile(path)).toString('base64'),mime:`image/${format}`});assert.equal(Math.max(size.width,size.height),quality);await closeExport(page);return size;}
for(const channel of ['chromium','webkit']){
 const browser=await (channel==='webkit'?webkit:chromium).launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1480,height:1020},acceptDownloads:true});const page=await context.newPage();const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))external.push(r.url());});
  await page.goto(base);await page.locator('#offline.ready').waitFor();await page.screenshot({path:resolve(out,`${channel}-empty.png`),fullPage:true});
  await checkpoint(`${channel}: ZIP-Import, SVG bevorzugt und Schrift erhalten`,async()=>{await importZip(page);assert.equal(await page.locator('#file-type').textContent(),'SVG · VEKTOR');assert.equal(await page.locator('#choose-dialog').isVisible(),false);const data=await page.locator('#base-plan').getAttribute('href');const content=Buffer.from(data.split(',')[1],'base64').toString('utf8');assert.match(content,/data:font\/woff/);assert.match(content,/Badezimmer/);assert.match(content,/data:image\/png/);assert.equal(await page.evaluate(async content=>{const data=content.match(/data:font\/woff;base64,[A-Za-z0-9+/=]+/)[0];const font=new FontFace('Fixture Validation',`url(${data})`);await font.load();return font.status;},content),'loaded');assert.equal((await readProject(page)).plan.width,914);});
  await checkpoint(`${channel}: Marker, Zoom, Löschung und Nummernfolge`,async()=>{
    await page.locator('[data-mode="sample"]').click();await clickPlan(page,300,450);await clickPlan(page,550,650);await clickPlan(page,700,800);
    let p=await readProject(page);assert.deepEqual(p.markers.map(m=>m.label),['P1','P2','P3']);const coords=p.markers.map(m=>[m.x,m.y]);
    await page.locator('#zoom-in').click();await page.locator('#zoom-in').click();await page.locator('#zoom-out').click();assert.deepEqual((await readProject(page)).markers.map(m=>[m.x,m.y]),coords);
    await page.locator('.marker-row').nth(1).click();await page.locator('#delete').click();assert.deepEqual((await readProject(page)).markers.map(m=>m.label),['P1','P3']);
    await page.locator('#fit').click();await page.locator('[data-mode="sample"]').click();await clickPlan(page,400,700);assert.deepEqual((await readProject(page)).markers.map(m=>m.label),['P1','P3','P4']);
    await page.locator('#label').fill('P1');await page.locator('#label').dispatchEvent('change');assert.equal(await page.locator('#label').inputValue(),'P4');
    await page.locator('#next').fill('20');await page.locator('#next').dispatchEvent('change');await clickPlan(page,650,400);assert.equal((await readProject(page)).markers.at(-1).label,'P20');
    await page.locator('[data-mode="fire"]').click();await clickPlan(page,350,850);assert.equal((await readProject(page)).markers.at(-1).label,'B1');
  });
  await checkpoint(`${channel}: Punkt und Beschriftung getrennt verschieben, Undo/Redo`,async()=>{
    await page.locator('.marker-row').first().click();await page.locator('#note').fill('Wischprobe Fensterbank');await page.locator('#note').dispatchEvent('change');
    await page.locator('#offset').click();let p=await readProject(page),m=p.markers[0];const label=await planPoint(page,m.lx,m.ly);await page.mouse.move(label.x,label.y);await page.mouse.down();await page.mouse.move(label.x+35,label.y+30,{steps:8});await page.mouse.up();
    const changed=(await readProject(page)).markers[0];assert.ok(changed.lx>m.lx);assert.equal(changed.x,m.x);assert.equal(changed.y,m.y);
    await page.locator('#undo').click();assert.equal((await readProject(page)).markers[0].lx,m.lx);await page.locator('#redo').click();assert.equal((await readProject(page)).markers[0].lx,changed.lx);
    const pt=await planPoint(page,m.x,m.y);await page.mouse.move(pt.x,pt.y);await page.mouse.down();await page.mouse.move(pt.x+20,pt.y+15,{steps:5});await page.mouse.up();const moved=(await readProject(page)).markers[0];assert.ok(moved.x>m.x);assert.equal(moved.lx,changed.lx);
  });
  await checkpoint(`${channel}: Projektdatei, Wiederöffnen und automatische Sicherung`,async()=>{
    await openExport(page);await page.locator('#report').fill('TEST-2026-0142');await page.locator('#report').dispatchEvent('change');await page.locator('#date').fill('2026-10-12');await page.locator('#date').dispatchEvent('change');await closeExport(page);
    const p=await readProject(page,`${channel}-roundtrip`);await page.locator('#project-file').setInputFiles(resolve(out,`${channel}-roundtrip.probenplan`));await page.locator('#replace-yes').click();await page.locator('#import-status').waitFor({state:'hidden'});assert.deepEqual(await readProject(page),p);
    await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.marker-row').length===5);assert.deepEqual(await readProject(page),p);
  });
  await checkpoint(`${channel}: PNG 3500 und JPG 4600, vollständiger Export`,async()=>{
    await page.locator('#zoom-in').click();await page.locator('#zoom-in').click();
    const png=await exportDownload(page,'png',3500,resolve(out,`${channel}-plan-3500.png`));const jpg=await exportDownload(page,'jpeg',4600,resolve(out,`${channel}-plan-4600.jpg`));summary.push(`${channel}: PNG ${png.width}×${png.height}, JPG ${jpg.width}×${jpg.height}`);await page.locator('#fit').click();await page.screenshot({path:resolve(out,`${channel}-workspace.png`),fullPage:true});
  });
  await checkpoint(`${channel}: Netzwerk deaktiviert, Offline-Neustart und Export`,async()=>{
    await context.setOffline(true);await page.reload();await page.locator('.marker-row').first().waitFor();await page.locator('#offline.ready').waitFor();assert.match(await page.locator('#offline').textContent(),/Offline bereit/);await exportDownload(page,'png',3500,resolve(out,`${channel}-offline.png`));await context.setOffline(false);
  });
  assert.deepEqual(errors,[],'Keine JS-Fehler');assert.deepEqual(external,[],'Keine externen Netzwerkanfragen');
  await context.close();
 }finally{await browser.close();}
}

const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,acceptDownloads:true});const page=await context.newPage();await page.goto(base);await importZip(page);
await checkpoint('Mobile Chromium-Ansicht: Touch, Layout und Zweifinger-Zoom',async()=>{
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('[data-mode="sample"]').click();await page.locator('#drawing').scrollIntoViewIfNeeded();const p=await planPoint(page,450,580);await page.touchscreen.tap(p.x,p.y);assert.equal(await page.locator('.marker-row').count(),1);
  const before=await readProject(page);await page.locator('#drawing').scrollIntoViewIfNeeded();const box=await page.locator('#drawing').boundingBox();const cdp=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y,id:1},{x:x+60,y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.deepEqual((await readProject(page)).markers,before.markers);
  await page.locator('#fit').click();await page.screenshot({path:resolve(out,'mobile.png'),fullPage:true});
});await context.close();

const security=await browser.newContext({acceptDownloads:true});const sp=await security.newPage();const external=[];sp.on('request',r=>{if(r.url().startsWith('https://example.invalid'))external.push(r.url());});await sp.goto(base);
const font=originalSVG.match(/<style>[\s\S]*?<\/style>/)?.[0]||'';
const pixel=await sp.evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=32;const ctx=c.getContext('2d');ctx.fillStyle='#d73d27';ctx.fillRect(0,0,32,32);ctx.fillStyle='#f4c84a';ctx.fillRect(0,0,16,16);return c.toDataURL().split(',')[1];});
const fixture=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs>${font}</defs><rect width="600" height="400" fill="white"/><script>alert('bad')</script><image href="https://example.invalid/remote.png"/><image x="350" y="60" width="160" height="160" href="data:image/png;base64,${pixel}"/><rect x="350" y="60" width="160" height="160" fill="none" stroke="green" stroke-width="4"/><text x="30" y="100" style="font-family:'Synthetic Plan';font-size:32px" onload="alert('bad')">Badezimmer ÄÖÜ</text><text x="30" y="180" font-size="20">Eingebettetes Bild →</text><path d="M20 20H580V380H20Z" fill="none" stroke="black" stroke-width="2"/><style>@import url('https://example.invalid/style.css');</style></svg>`;
await checkpoint('SVG-Sicherheit und eingebettetes Bild + Schrift im Export',async()=>{
 await sp.locator('#file').setInputFiles({name:'ressourcen-test.svg',mimeType:'image/svg+xml',buffer:Buffer.from(fixture)});await sp.waitForFunction(()=>document.querySelector('#base-plan').hasAttribute('href'));const p=await readProject(sp);const xml=Buffer.from(p.plan.data.split(',')[1],'base64').toString('utf8');assert.doesNotMatch(xml,/<script|onload|https:\/\/example.invalid/);assert.match(xml,/data:image\/png/);assert.match(xml,/data:font\/woff/);assert.deepEqual(external,[]);
 await exportDownload(sp,'png',3500,resolve(out,'embedded-resources.png'));
});await security.close();
}finally{await browser.close();}
await writeFile(resolve(out,'results.json'),JSON.stringify({date:new Date().toISOString(),checks:summary},null,2));
console.log(`\n${summary.length} Nachweise erfolgreich. Ergebnisse unter .test-output/`);
