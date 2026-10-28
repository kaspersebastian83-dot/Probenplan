// Skizze (ab 1.21): Plan zeichnen, wenn kein Grundriss vorliegt – Räume mit Maßen, Türen, Maßstab automatisch,
// Proben wie auf jedem Plan, später weiter bearbeitbar, Rückgängig, Projektdatei mit Validierung.
import {chromium,webkit,savedProject,downloadedProject} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
async function drag(page,a,b){const p=await toScreen(page,...a),q=await toScreen(page,...b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move((p.x+q.x)/2,(p.y+q.y)/2,{steps:3});await page.mouse.move(q.x,q.y,{steps:3});await page.mouse.up();}
async function tapPlan(page,x,y){const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);}
const blur=page=>page.evaluate(()=>document.activeElement?.blur());
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();await context.addInitScript(()=>{try{localStorage.setItem('plankit-schnellskizze','0');}catch{}});   // klassische Skizze; Schnellskizze: tests/schnellskizze.mjs
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);

  await check(`${engine}: ohne Plan ist „✎ Skizze“ oben und auf der Startseite sichtbar`,async()=>{
   assert.ok(await page.locator('#sketch-tb').isVisible());assert.ok(await page.locator('#sketch-tb').isEnabled());assert.match(await page.locator('#sketch-tb').getAttribute('title'),/Kein Plan vorhanden/);
   assert.ok(await page.locator('#welcome-sketch').isVisible());
  });
  await check(`${engine}: „Kein Plan? Skizze zeichnen“ öffnet eine leere Skizze mit Maßstab`,async()=>{
   await page.locator('#welcome-sketch').click();await page.locator('#sketch-actions').waitFor();
   assert.equal(await page.locator('[data-sketch-tool="room"]').getAttribute('aria-pressed'),'true');
   const s=await savedProject(page);assert.deepEqual(s.plan.sketch,{width:2500,height:1800,rooms:[],walls:[],openings:[],texts:[]});assert.deepEqual(s.plan.calibration,{units:100,meters:1});assert.equal(s.plan.vector,true);
  });
  await check(`${engine}: Raum aufziehen (Raster 10 cm), Name eintippen; zweiter Raum rastet an der Wand ein`,async()=>{
   await drag(page,[103,98],[521,488]);
   await page.waitForFunction(()=>document.activeElement?.id==='sketch-name',null,{timeout:2000}).catch(()=>{});assert.equal(await page.evaluate(()=>document.activeElement?.id),'sketch-name','Name gleich eintippen');
   await page.locator('#sketch-name').fill('Wohnen');await page.locator('#sketch-name').press('Tab');
   await blur(page);await page.locator('[data-sketch-tool="room"]').click();
   await drag(page,[535,112],[781,476]);   // linke Kante 15 cm neben der Wand → rastet bei 520 ein, oben/unten an 100/490
   const s=(await savedProject(page)).plan.sketch;
   assert.deepEqual(s.rooms.map(r=>[r.name,r.x,r.y,r.w,r.h]),[['Wohnen',100,100,420,390],['Raum 2',520,100,260,390]]);
   assert.equal(await page.locator('#sketch-w').inputValue(),'2,60');
  });
  await check(`${engine}: Maße eintippen ändert den Raum`,async()=>{
   await page.locator('#sketch-h').fill('3,00');await page.locator('#sketch-h').press('Enter');await page.locator('#sketch-name').fill('Küche');await page.locator('#sketch-name').press('Enter');
   const s=(await savedProject(page)).plan.sketch;assert.deepEqual(s.rooms[1],{...s.rooms[1],name:'Küche',h:300});
  });
  await check(`${engine}: Tür auf die gemeinsame Wand, Aufschlag wechseln, löschen und Rückgängig`,async()=>{
   await blur(page);await page.locator('[data-sketch-tool="door"]').click();await tapPlan(page,515,300);
   let s=(await savedProject(page)).plan.sketch;assert.equal(s.openings.length,1);assert.deepEqual([s.openings[0].kind,s.openings[0].x,s.openings[0].a,s.openings[0].w],['door',520,90,90]);
   if(process.env.SHOT){await page.locator('[data-sketch-tool="select"]').click();await tapPlan(page,300,200);await page.waitForTimeout(200);await page.screenshot({path:process.env.SHOT+'-1.png'});const d=(await savedProject(page)).plan.sketch.openings[0];await tapPlan(page,d.x,d.y);}
   const side=s.openings[0].side;await page.locator('#sketch-door-flip').click();s=(await savedProject(page)).plan.sketch;assert.equal(s.openings[0].side,-side);
   await blur(page);await page.keyboard.press('Delete');assert.equal((await savedProject(page)).plan.sketch.openings.length,0);
   await page.keyboard.press('Control+z');assert.equal((await savedProject(page)).plan.sketch.openings.length,1,'Rückgängig auch im Skizzenmodus');
  });
  await check(`${engine}: schräge Wand (rastet auf 30° ein), Länge eintippen; Fenster auf der Außenwand; Text „Treppe“`,async()=>{
   await page.locator('[data-sketch-tool="wall"]').click();await drag(page,[102,603],[497,836]);
   let s=(await savedProject(page)).plan.sketch,w=s.walls[0];assert.equal(s.walls.length,1);assert.deepEqual([w.x1,w.y1],[100,600]);
   assert.ok(Math.abs(Math.atan2(w.y2-w.y1,w.x2-w.x1)*180/Math.PI-30)<.01,'30°');const len=Math.hypot(w.x2-w.x1,w.y2-w.y1);assert.ok(Math.abs(len/10-Math.round(len/10))<.05&&len>440&&len<490,`Länge ${len} in 10-cm-Schritten`);
   assert.equal(await page.locator('#sketch-wl').inputValue(),(Math.round(len)/100).toLocaleString('de-DE',{minimumFractionDigits:2}));await page.locator('#sketch-wl').fill('5,00');await page.locator('#sketch-wl').press('Enter');
   w=(await savedProject(page)).plan.sketch.walls[0];assert.ok(Math.abs(Math.hypot(w.x2-w.x1,w.y2-w.y1)-500)<.5);
   await blur(page);await page.locator('[data-sketch-tool="window"]').click();await tapPlan(page,300,486);
   s=(await savedProject(page)).plan.sketch;const win=s.openings.find(o=>o.kind==='window');assert.deepEqual([win.x,win.y,win.a,win.w],[300,490,0,120]);
   assert.equal(await page.locator('#sketch-ow-label').textContent(),'Fensterbreite');assert.equal(await page.locator('#sketch-door-flip').isVisible(),false);
   // Fenster auf der schrägen Wand: Mitte der Wand antippen
   w=(await savedProject(page)).plan.sketch.walls[0];await blur(page);await page.locator('[data-sketch-tool="window"]').click();await tapPlan(page,(w.x1+w.x2)/2,(w.y1+w.y2)/2);
   s=(await savedProject(page)).plan.sketch;assert.ok(s.openings.some(o=>o.kind==='window'&&Math.abs(o.a-30)<.01),'Fenster auf der schrägen Wand');
   await blur(page);await page.locator('[data-sketch-tool="text"]').click();await tapPlan(page,650,700);
   await page.waitForFunction(()=>document.activeElement?.id==='sketch-text',null,{timeout:2000});
   await page.locator('#sketch-text').fill('Treppe');await page.locator('#sketch-text').press('Enter');await page.locator('#sketch-text-size').selectOption('45');
   s=(await savedProject(page)).plan.sketch;assert.deepEqual(s.texts.map(t=>[t.text,t.x,t.y,t.size]),[['Treppe',650,700,45]]);
  });
  await check(`${engine}: Skizze fertig – Proben setzen wie auf jedem Plan; Drehen/Zuschnitt gesperrt`,async()=>{
   await page.locator('#sketch-done').click();assert.equal(await page.locator('#sketch-actions').isVisible(),false);
   await blur(page);await page.keyboard.press('p');await tapPlan(page,300,300);await page.keyboard.press('v');
   const s=await savedProject(page);assert.equal(s.markers.length,1);assert.ok(Math.abs(s.markers[0].x-300)<3&&Math.abs(s.markers[0].y-300)<3);
   assert.equal(await page.locator('#rotate-right').isDisabled(),true);assert.equal(await page.locator('#warp-start').isDisabled(),true);
   assert.equal(await page.locator('#sketch-edit').isVisible(),true);
   assert.deepEqual([s.plan.width,s.plan.height],[880,950],'Zeichenfläche auf den Inhalt zugeschnitten (1 m Rand)');
   assert.equal(await page.locator('#sketch-tb').isVisible(),false,'auf einer Skizze bearbeitet „✎ Skizze“ aus „Plan vorbereiten“ – kein doppelter Knopf');
   if(process.env.SHOT){await page.waitForTimeout(500);await page.screenshot({path:process.env.SHOT+'-2.png'});}
   // Planbild enthält Raumnamen und Fläche
   const svgText=await page.evaluate(d=>new TextDecoder().decode(Uint8Array.from(atob(d.split(',')[1]),c=>c.charCodeAt(0))),s.plan.data);assert.match(svgText,/Wohnen/);assert.match(svgText,/Küche/);assert.match(svgText,/Treppe/);assert.match(svgText,/rotate\(30\)/);assert.match(svgText,/16,4 m²/);
  });
  await check(`${engine}: später weiter bearbeiten – Raum verschieben, Proben bleiben an ihrer Stelle`,async()=>{
   await page.locator('#sketch-edit').click();await page.locator('#sketch-actions').waitFor();
   assert.equal(await page.locator('[data-sketch-tool="select"]').getAttribute('aria-pressed'),'true');
   await drag(page,[650,250],[650,350]);   // Küche 1 m nach unten
   const s=await savedProject(page);assert.equal(s.plan.sketch.rooms[1].y,200);assert.ok(Math.abs(s.markers[0].x-300)<3&&Math.abs(s.markers[0].y-300)<3);
   assert.deepEqual(s.plan.sketch.openings.filter(o=>o.kind==='door').map(d=>[d.x,d.y]),[[520,400]],'Tür auf der Küchenwand wandert mit');
  });
  await check(`${engine}: Maßstab im Export (PDF A4 mit genormtem Maßstab)`,async()=>{
   await page.locator('#sketch-done').click();await page.locator('#export-open').click();await page.locator('#export').waitFor();
   await page.locator('#format').selectOption('pdf-a4');await page.locator('#dimensions',{hasText:'M 1:'}).waitFor();
   await page.locator('#export-dialog .close').click();
  });
  await check(`${engine}: Projektdatei behält die Skizze; ungültige Skizze wird abgewiesen`,async()=>{
   const file=await downloadedProject(page);assert.equal(file.plan.sketch.rooms.length,2);
   await page.locator('#project-file').setInputFiles({name:'x.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click();
   await page.locator('#welcome').waitFor({state:'hidden'});assert.equal(await page.locator('#sketch-edit').isVisible(),true);assert.equal((await savedProject(page)).plan.sketch.rooms[0].name,'Wohnen');
   const bad=structuredClone(file);bad.plan.sketch.rooms[0].w=-5;
   await page.locator('#project-file').setInputFiles({name:'bad.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
   await page.locator('#toast.error',{hasText:'Skizze'}).waitFor();
  });
  await check(`${engine}: „＋ Skizze“ legt einen weiteren Plan an`,async()=>{
   await page.locator('#sheet-sketch').click();await page.locator('#sketch-actions').waitFor();
   const s=await savedProject(page);assert.equal(s.sheets.length,2);assert.deepEqual(s.plan.sketch.rooms,[]);assert.deepEqual(s.plan.sketch.walls,[]);
   await page.locator('#sketch-done').click();
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
