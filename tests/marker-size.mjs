// Punktgröße je Plan: Regler, Tasten < und >, Rückgängig, Speichern/Laden je Geschoss, Modellwerte und Validierung.
import {chromium,webkit,savedProject,downloadedProject} from './runtime.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const plan=(w,h,label)=>({name:`${label}.svg`,mimeType:'image/svg+xml',buffer:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="white"/><path d="M20 20H${w-20}V${h-20}H20Z" fill="none" stroke="black" stroke-width="8"/></svg>`)});
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
const ry=page=>page.locator('#marks [data-id] ellipse').last().evaluate(e=>Number(e.getAttribute('ry')));
const pct=page=>page.locator('#marker-size').inputValue();

// Modell ohne Browser: Faktor wirkt auf Größe, Grenzen, Tastenschritte
const model=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(await readFile('src/model.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));
await check('Modell: Größe = Grundgröße × Faktor, Faktor begrenzt, Standard 1',async()=>{
 const p={plan:{width:6500,height:3000}};assert.equal(model.markerSize(p),100);
 p.plan.markerScale=.5;assert.equal(model.markerSize(p),50);p.plan.markerScale=2;assert.equal(model.markerSize(p),200);
 p.plan.markerScale=99;assert.equal(model.markerScale(p),model.MARKER_SCALE.max);p.plan.markerScale=0;assert.equal(model.markerScale(p),model.MARKER_SCALE.min);p.plan.markerScale=NaN;assert.equal(model.markerScale(p),1);
});
await check('Modell: Tastenschritte bewegen sich immer und bleiben in den Grenzen',async()=>{
 assert.equal(model.stepMarkerScale(1,1),1.2);assert.equal(model.stepMarkerScale(1.2,1),1.45);assert.ok(model.stepMarkerScale(1,-1)<1);
 let v=1;for(let i=0;i<40;i++)v=model.stepMarkerScale(v,-1);assert.equal(v,model.MARKER_SCALE.min);for(let i=0;i<60;i++)v=model.stepMarkerScale(v,1);assert.equal(v,model.MARKER_SCALE.max);
 assert.equal(model.stepMarkerScale(.2,-1),.2);assert.ok(model.stepMarkerScale(.2,1)>.2);
});

for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  // großer Plan: Grundgröße liegt über der Mindestgröße auf dem Bildschirm
  await page.locator('#file').setInputFiles(plan(4000,3000,'EG'));await page.locator('#welcome').waitFor({state:'hidden'});
  await page.keyboard.press('p');await tap(page,.3,.4);await tap(page,.6,.6);await page.keyboard.press('v');
  if(await page.locator('#panel-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#panel-toggle').click();
  let base0=0;
  await check(`${engine}: Standard 100 %, nichts im Projekt gespeichert`,async()=>{
   base0=await ry(page);assert.ok(Math.abs(base0-4000/65)<.5,`ry ${base0}`);assert.equal(await pct(page),'100');assert.equal((await savedProject(page)).plan.markerScale,undefined);
  });
  await check(`${engine}: Taste > vergrößert, Taste < verkleinert, Anzeige und Toast folgen`,async()=>{
   
   await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'>',bubbles:true})));
   assert.equal(await pct(page),'120');assert.ok(Math.abs(await ry(page)-base0*1.2)<.5);await page.locator('#toast',{hasText:'120 %'}).waitFor();
   await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'>',bubbles:true})));assert.equal(await pct(page),'145');
   for(let i=0;i<3;i++)await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'<',bubbles:true})));
   assert.ok(Number(await pct(page))<100);
  });
  await check(`${engine}: Tasten in Eingabefeldern oder mit Strg verändern nichts`,async()=>{
   const before=await pct(page);const field=page.locator('#side-panel input[type=text]:visible, #side-panel input:not([type]):visible').first();await field.focus();const old=await field.inputValue();await page.keyboard.type('<>');assert.equal(await pct(page),before);
   await field.fill(old);await page.locator('#drawing').evaluate(e=>e.blur());
   await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'>',ctrlKey:true,bubbles:true})));assert.equal(await pct(page),before);
  });
  await check(`${engine}: Regler wirkt sofort proportional (50 % = halbe Größe, 200 % = doppelte)`,async()=>{
   await page.locator('#marker-size').fill('50');assert.ok(Math.abs(await ry(page)-base0*.5)<.6,`50% → ${await ry(page)}`);
   await page.locator('#marker-size').fill('200');assert.ok(Math.abs(await ry(page)-base0*2)<1);assert.match(await page.locator('#size-value').textContent(),/200/);
   await page.locator('#size-reset').click();assert.equal(await pct(page),'100');assert.ok(Math.abs(await ry(page)-base0)<.5);
  });
  await check(`${engine}: aufeinanderfolgende Änderungen sind ein Rückgängig-Schritt, auch im gespeicherten Projekt`,async()=>{
   await page.waitForTimeout(1300);await page.locator('#marker-size').fill('60');await page.locator('#marker-size').fill('70');await page.locator('#marker-size').fill('80');await page.waitForTimeout(500);
   assert.equal((await savedProject(page)).plan.markerScale,.8);await page.locator('#marker-size').evaluate(e=>e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true})));assert.equal(await page.evaluate(()=>document.activeElement?.id==='marker-size'),false);
   await page.keyboard.press('Control+z');assert.equal(await pct(page),'100');assert.equal((await savedProject(page)).plan.markerScale,undefined);
   await page.keyboard.press('Control+y').catch(()=>{});await page.keyboard.press('Control+Shift+z');assert.equal(await pct(page),'80');
  });
  await check(`${engine}: je Plan – Obergeschoss bleibt 100 %, EG behält 80 %, Speichern und Öffnen erhalten beides`,async()=>{
   await page.locator('#sheet-add').click();await page.locator('#sheet-file').setInputFiles(plan(2000,1500,'OG'));await page.locator('#sheet-ok').click().catch(()=>{});
   await page.waitForTimeout(600);assert.equal(await pct(page),'100');
   await page.locator('#marker-size').fill('150');await page.waitForTimeout(500);
   const saved=await savedProject(page);const scales=[saved.plan,...saved.sheets.filter((_,i)=>i!==saved.active).map(s=>s.plan)].map(p=>p.markerScale).sort();assert.deepEqual(scales,[.8,1.5]);
   const file=await downloadedProject(page);
   await page.locator('#project-file').setInputFiles({name:'x.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click().catch(()=>{});await page.waitForTimeout(800);
   assert.equal(await pct(page),'150');await page.keyboard.press('PageUp');await page.waitForTimeout(300);assert.equal(await pct(page),'80');
  });
  await check(`${engine}: ungültige Punktgröße in der Projektdatei wird abgewiesen, alte Dateien ohne Wert laden unverändert`,async()=>{
   const file=await downloadedProject(page),bad=structuredClone(file);bad.plan.markerScale=17;
   await page.locator('#project-file').setInputFiles({name:'bad.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.locator('#toast.error').waitFor();assert.match(await page.locator('#toast').textContent(),/Punktgröße/);
   const old=structuredClone(file);for(const p of [old.plan,...(old.sheets||[]).map(s=>s.plan).filter(Boolean)])delete p.markerScale;
   await page.locator('#project-file').setInputFiles({name:'old.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await page.locator('#replace-yes').click().catch(()=>{});await page.waitForTimeout(800);assert.equal(await pct(page),'100');
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
