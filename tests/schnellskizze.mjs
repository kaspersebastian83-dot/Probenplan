// Schnellskizze (ab 1.41, abschaltbar): Räume aus Liste im Raster, „nicht maßstäblich“ (kein Maßstab, keine m², Stempel),
// Brandraum je Raum, Raum an der Probe beim Setzen, Umbenennen zieht die Proben mit, Projektdatei mit Validierung.
import {chromium,webkit,savedProject,downloadedProject} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
async function drag(page,a,b){const p=await toScreen(page,...a),q=await toScreen(page,...b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move((p.x+q.x)/2,(p.y+q.y)/2,{steps:3});await page.mouse.move(q.x,q.y,{steps:3});await page.mouse.up();}
async function tapPlan(page,x,y){const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);}
const blur=page=>page.evaluate(()=>document.activeElement?.blur());
const planSVG=(page,data)=>page.evaluate(d=>new TextDecoder().decode(Uint8Array.from(atob(d.split(',')[1]),c=>c.charCodeAt(0))),data);
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);

  await check(`${engine}: neue Skizze startet mit Raumliste und „nicht maßstäblich“`,async()=>{
   await page.locator('#welcome-sketch').click();await page.locator('#sketch-list-panel').waitFor();
   await page.waitForFunction(()=>document.activeElement?.id==='sketch-list',null,{timeout:2000});
   assert.equal(await page.locator('#sketch-quick').isChecked(),true);assert.equal(await page.locator('#sketch-schematic').isChecked(),true);
   const s=await savedProject(page);assert.equal(s.plan.sketch.schematic,true);assert.equal(s.plan.calibration,undefined,'kein Maßstab');
  });
  await check(`${engine}: Räume aus Liste – Raster, Brandraum erkannt`,async()=>{
   await page.locator('#sketch-list').fill('Flur\nKüche Brandraum\nWohnzimmer, Bad\nSchlafzimmer\nAbstellraum');await page.locator('#sketch-list-make').click();
   assert.equal(await page.locator('#sketch-list-panel').isVisible(),false);
   const s=(await savedProject(page)).plan.sketch;
   assert.deepEqual(s.rooms.map(r=>[r.name,r.x,r.y,r.w,r.h,!!r.fire]),[['Flur',100,100,400,350,false],['Küche',600,100,400,350,true],['Wohnzimmer',1100,100,400,350,false],['Bad',100,550,400,350,false],['Schlafzimmer',600,550,400,350,false],['Abstellraum',1100,550,400,350,false]]);
   assert.equal(await page.locator('[data-sketch-tool="select"]').getAttribute('aria-pressed'),'true','gleich anordnen');
  });
  await check(`${engine}: Raum ziehen rastet an der Nachbarwand ein; Brandraum per Haken`,async()=>{
   await drag(page,[1300,275],[1210,275]);   // Wohnzimmer 90 cm nach links → linke Kante rastet an der Küche (1000) ein
   let s=(await savedProject(page)).plan.sketch;assert.equal(s.rooms[2].x,1000);
   await tapPlan(page,300,725);await page.locator('#sketch-fire').check();
   s=(await savedProject(page)).plan.sketch;assert.equal(s.rooms[3].fire,true);
   await page.locator('#sketch-fire').uncheck();s=(await savedProject(page)).plan.sketch;assert.equal(s.rooms[3].fire,undefined);
  });
  await check(`${engine}: Plan zeigt Stempel und Brandraum, keine m², ohne Maßstab`,async()=>{
   await page.locator('#sketch-done').click();const s=await savedProject(page);const svg=await planSVG(page,s.plan.data);
   assert.match(svg,/SKIZZE – NICHT MASSSTÄBLICH/);assert.match(svg,/BRANDRAUM/);assert.doesNotMatch(svg,/m²/);assert.match(svg,/#fbe7d8/);
   assert.equal(s.plan.calibration,undefined);
  });
  await check(`${engine}: Probe in der Küche bekommt den Raum; Umbenennen zieht mit`,async()=>{
   await blur(page);await page.keyboard.press('p');await tapPlan(page,800,275);await page.keyboard.press('v');
   let s=await savedProject(page);assert.equal(s.markers.length,1);assert.equal(s.markers[0].raum,'Küche');assert.equal(s.markers[0].raumSkizze,s.plan.sketch.rooms[1].id);
   assert.equal(await page.locator('#raum').inputValue(),'Küche');
   // Probe im Flur, Raum von Hand auf „Küche“ gesetzt: gilt als Handeingabe und zieht beim Umbenennen nicht mit
   await page.keyboard.press('p');await tapPlan(page,300,275);await page.keyboard.press('v');
   await page.locator('#raum').fill('Küche');await page.locator('#raum').press('Enter');
   s=await savedProject(page);assert.equal(s.markers[1].raum,'Küche');assert.equal(s.markers[1].raumSkizze,undefined);
   assert.equal(await page.locator('#measure-start').isDisabled(),true,'nicht maßstäblich: kein Messen');
   await page.locator('#sketch-edit').click();await page.locator('#sketch-actions').waitFor();
   assert.equal(await page.locator('#sketch-list-panel').isVisible(),false,'mit Räumen keine Liste aufklappen');
   await tapPlan(page,700,150);await page.locator('#sketch-name').fill('Kochen');await page.locator('#sketch-name').press('Enter');
   s=await savedProject(page);assert.equal(s.markers[0].raum,'Kochen');assert.equal(s.markers[1].raum,'Küche','Handeingabe bleibt');
  });
  await check(`${engine}: Haken „nicht maßstäblich“ aus – Maßstab und m² wieder da`,async()=>{
   await blur(page);await tapPlan(page,1700,1700);await page.locator('#sketch-schematic').uncheck();
   const s=await savedProject(page);assert.equal(s.plan.sketch.schematic,undefined);assert.deepEqual(s.plan.calibration,{units:100,meters:1});
   assert.match(await planSVG(page,s.plan.data),/m²/);assert.equal(await page.locator('#measure-start').isDisabled(),false);
   await page.locator('#sketch-schematic').check();
  });
  await check(`${engine}: Schalter aus – Skizze wie bisher, kein Raum an der Probe`,async()=>{
   await page.locator('#sketch-quick').uncheck();
   assert.equal(await page.locator('#sketch-list-open').isVisible(),false);assert.equal(await page.locator('#sketch-schematic').isVisible(),false);
   assert.equal(await page.evaluate(()=>localStorage.getItem('plankit-schnellskizze')),'0');
   await page.locator('#sketch-done').click();await blur(page);await page.keyboard.press('p');await tapPlan(page,300,725);await page.keyboard.press('v');
   const s=await savedProject(page);assert.equal(s.markers.length,3);assert.equal(s.markers[2].raum,undefined);
   assert.equal(s.plan.sketch.schematic,true,'gesetzte Kennzeichen bleiben in der Skizze');
   await page.evaluate(()=>localStorage.setItem('plankit-schnellskizze','1'));
  });
  await check(`${engine}: Projektdatei behält Brandraum und „nicht maßstäblich“; ungültige Angabe wird abgewiesen`,async()=>{
   const file=await downloadedProject(page);assert.equal(file.plan.sketch.schematic,true);assert.equal(file.plan.sketch.rooms[1].fire,true);
   await page.locator('#project-file').setInputFiles({name:'x.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click();
   await page.locator('#welcome').waitFor({state:'hidden'});const s=await savedProject(page);assert.equal(s.plan.sketch.rooms[1].fire,true);assert.equal(s.plan.sketch.schematic,true);
   const bad=structuredClone(file);bad.plan.sketch.rooms[1].fire='ja';
   await page.locator('#project-file').setInputFiles({name:'bad.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
   await page.locator('#toast.error',{hasText:'Skizze'}).waitFor();
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
