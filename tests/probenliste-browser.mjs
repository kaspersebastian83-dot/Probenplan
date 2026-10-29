// Probenliste und Reiter im Browser (ab 1.48): Reiter Proben / Plan & Ausgabe / Raumbuch, eine Liste für offene und platzierte
// Laborproben nach Geschoss → Raum, Fortschritt, Filter, Suche, fertige Räume zugeklappt ans Ende, ⋯-Menüs, Hervorheben,
// Brandherde, Schalter aus = Seitenleiste wie bisher. Synthetische Daten.
import {chromium,webkit,savedProject} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
const tap=async(page,x,y)=>{const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);};
async function until(page,test,what){let p;for(let i=0;i<60;i++){p=await savedProject(page);if(test(p))return p;await page.waitForTimeout(100);}assert.fail(`${what||'Projektstand'}: ${JSON.stringify({markers:p.markers.map(m=>m.label),pending:(p.pending||[]).map(r=>r.label)})}`);}
// EG Flur (P1, P4) · EG Küche (P2, P5) · 1. OG Kind (P3) · ohne Raum (P6)
const RAEUME=['EG Flur','EG Küche','1. OG Kind','EG Flur','EG Küche',''];
const lk={version:'4.34.0',projekt:{nr:''},proben:RAEUME.map((raum,i)=>({id:i+1,_nr:i+1,z2:raum,z3:'Decke',z4:'Untersicht',matrix:'Wischprobe',datum:'2026-10-20'}))};
async function start(page,url){
 await page.goto(url);
 await page.locator('#file').setInputFiles({name:'eg.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/></svg>')});await page.locator('#welcome').waitFor({state:'hidden'});
 if(await page.locator('#panel-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#panel-toggle').click();
 page.once('dialog',d=>d.accept());
 await page.locator('#lab-files').setInputFiles([{name:'x_Daten.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lk))}]);await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
}
const texts=(page,sel)=>page.locator(sel).allTextContents();
const gruppen=page=>texts(page,'.pl-gname');
const chipText=async page=>(await page.locator('#weiter-text').textContent())||'';
const row=(page,label)=>page.locator(`.pl-item[data-label="${label}"] .pl-row`);
const more=(page,label)=>page.locator(`.pl-item[data-label="${label}"] .pl-more`);
const menuItems=page=>texts(page,'.pl-menu button:visible');
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,`${base}/?weiter-default&liste-default`);

  await check(`${engine}: Reiter – Proben ist Standard; Plan & Ausgabe und Raumbuch zeigen ihre Abschnitte, nicht die Liste`,async()=>{
   assert.equal(await page.locator('#side-panel').getAttribute('data-liste'),'neu');assert.equal(await page.locator('#panel-tabs').isVisible(),true);
   assert.deepEqual(await texts(page,'.panel-tab'),['Proben6','Plan & Ausgabe','Raumbuch'],'Zähler der offenen Proben am Reiter');
   assert.equal(await page.locator('#tab-proben').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#proben-section').isVisible(),true);
   assert.equal(await page.locator('#lab-panel').isVisible(),false,'alte Laborliste ist weg');assert.equal(await page.locator('#raumbuch-section').isVisible(),false);
   await page.locator('#tab-plan').click();assert.equal(await page.locator('#proben-section').isVisible(),false);assert.equal(await page.locator('.areas-section').isVisible(),true);assert.equal(await page.locator('#raumbuch-section').isVisible(),false);
   await page.locator('#tab-raumbuch').click();assert.equal(await page.locator('#raumbuch-section').isVisible(),true);assert.equal(await page.locator('.areas-section').isVisible(),false);assert.equal(await page.locator('#proben-section').isVisible(),false);
   await page.locator('#tab-proben').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-plan').getAttribute('aria-selected'),'true','Pfeiltasten wechseln den Reiter');
   await page.locator('#tab-proben').click();assert.equal(await page.locator('#proben-section').isVisible(),true);
  });
  await check(`${engine}: Fortschritt, Filter-Zähler, Gruppen nach Geschoss → Raum`,async()=>{
   assert.equal((await page.locator('#proben-progress').textContent()).trim(),'0 von 6 platziert');
   assert.deepEqual(await texts(page,'.pl-chip'),['Offen 6','Platziert 0','Alle 6']);assert.equal(await page.locator('#filter-offen').getAttribute('aria-pressed'),'true','Standard: Offen');
   assert.deepEqual(await texts(page,'.pl-floor'),['EG','1. OG','Ohne Geschoss']);
   assert.deepEqual(await gruppen(page),['Flur','Küche','Kind','Ohne Raum']);assert.deepEqual(await texts(page,'.pl-gcount'),['0/2','0/2','0/1','0/1']);
   assert.equal(await page.locator('#proben-bar').getAttribute('aria-valuenow'),'0');
  });
  await check(`${engine}: kompakte Zeilen – Kennung, Bauteil · Oberfläche, Probenart; offene mit gestricheltem Rand`,async()=>{
   const first=row(page,'P1');assert.ok((await first.boundingBox()).height<=36,'Zeile höchstens 36 px');
   assert.equal((await first.locator('.pl-badge').textContent()).trim(),'P1');assert.equal((await first.locator('.pl-titel').textContent()).trim(),'Decke · Untersicht');assert.equal((await first.locator('.pl-art').textContent()).trim(),'PAK');
   assert.equal(await first.locator('.pl-badge.open').count(),1);assert.equal(await page.locator('.pl-row').count(),6);
   assert.equal(await page.locator('[data-pending]').count(),0,'keine zweite Liste mehr in der Seitenleiste');
  });
  await check(`${engine}: Zeile wählen → Platzieren mit Weiter-Platzieren; Liste, Fortschritt und Gruppenzähler folgen`,async()=>{
   await row(page,'P1').click();await page.locator('#weiter-chip').waitFor();assert.match(await chipText(page),/^JETZT P1 · EG Flur/);
   assert.equal(await row(page,'P1').getAttribute('aria-pressed'),'true');
   await tap(page,200,200);await until(page,p=>p.markers.length===1);
   assert.match(await chipText(page),/^JETZT P4 · EG Flur/);assert.equal(await row(page,'P4').getAttribute('aria-pressed'),'true');
   assert.equal(await row(page,'P1').count(),0,'Filter „Offen“ blendet platzierte aus');
   assert.equal((await page.locator('#proben-progress').textContent()).trim(),'1 von 6 platziert');assert.deepEqual(await texts(page,'.pl-gcount'),['1/2','0/2','0/1','0/1']);
   assert.deepEqual(await texts(page,'.panel-tab'),['Proben5','Plan & Ausgabe','Raumbuch']);
  });
  await check(`${engine}: Filter Platziert und Alle; platzierte Zeile mit durchgezogenem Rand`,async()=>{
   await page.locator('#filter-platziert').click();assert.deepEqual(await texts(page,'.pl-row .pl-badge'),['P1']);assert.equal(await row(page,'P1').locator('.pl-badge.open').count(),0);assert.equal(await row(page,'P1').getAttribute('data-art'),'platziert');
   await page.locator('#filter-alle').click();assert.equal(await page.locator('.pl-row').count(),6);
   assert.deepEqual(await texts(page,'.pl-row .pl-badge'),['P4','P1','P2','P5','P3','P6'],'offene vor platzierten im Raum');
  });
  await check(`${engine}: fertiger Raum wandert zugeklappt ans Ende, mit Haken; Klick klappt auf`,async()=>{
   await tap(page,300,200);await until(page,p=>p.markers.length===2);   // P4 platziert → EG Flur fertig
   assert.deepEqual(await gruppen(page),['Küche','Kind','Ohne Raum','Flur']);assert.deepEqual(await texts(page,'.pl-gcount'),['0/2','0/1','0/1','2/2 ✓']);
   assert.equal(await page.locator('.pl-group').last().getAttribute('aria-expanded'),'false');assert.equal(await row(page,'P1').count(),0,'zugeklappt: keine Zeilen');
   await page.locator('.pl-group').last().click();assert.equal(await page.locator('.pl-group').last().getAttribute('aria-expanded'),'true');assert.deepEqual(await texts(page,'.pl-row .pl-badge'),['P2','P5','P3','P6','P1','P4']);
   await page.locator('.pl-group').last().click();assert.equal(await row(page,'P1').count(),0);
   assert.match(await chipText(page),/^Raum „EG Flur“ fertig · JETZT P2 · EG Küche/);
  });
  await check(`${engine}: Suche nach Raum oder Kennung klappt Treffer auf; leere Suche stellt zurück`,async()=>{
   await page.locator('#proben-suche').fill('flur');assert.deepEqual(await gruppen(page),['Flur']);assert.deepEqual(await texts(page,'.pl-row .pl-badge'),['P1','P4'],'auch fertige Räume werden aufgeklappt gezeigt');
   await page.locator('#proben-suche').fill('p5');assert.deepEqual(await texts(page,'.pl-row .pl-badge'),['P5']);
   await page.locator('#proben-suche').fill('gibtsnicht');assert.equal(await page.locator('.pl-row').count(),0);assert.match(await page.locator('#proben-liste').textContent(),/Keine Treffer/);
   await page.locator('#proben-suche').fill('');assert.deepEqual(await gruppen(page),['Küche','Kind','Ohne Raum','Flur']);
  });
  await check(`${engine}: Zeile im Plan wählen und hervorheben – Liste ↔ Plan`,async()=>{
   await page.keyboard.press('Escape');   // Weiter-Platzieren beenden
   await page.locator('#filter-platziert').click();
   const p=await savedProject(page),id=p.markers.find(m=>m.label==='P1').id;
   await row(page,'P1').hover();assert.equal(await page.locator(`#marks [data-id="${id}"]`).evaluate(e=>e.classList.contains('pl-hl')),true,'Liste → Plan');
   await page.mouse.move(5,5);assert.equal(await page.locator(`#marks [data-id="${id}"]`).evaluate(e=>e.classList.contains('pl-hl')),false);
   const pt=await toScreen(page,200,200);await page.mouse.move(pt.x,pt.y);assert.equal(await row(page,'P1').evaluate(e=>e.classList.contains('hl')),true,'Plan → Liste');
   await page.mouse.move(5,5);
   await row(page,'P1').click();assert.equal(await page.locator('#inspector').isVisible(),true);assert.equal(await page.locator('#label').inputValue(),'P1');assert.equal(await row(page,'P1').getAttribute('aria-pressed'),'true');
  });
  await check(`${engine}: ⋯ bei platzierter Probe: Im Plan zeigen, Neu platzieren, Zurück zu offen, Punkt löschen`,async()=>{
   await more(page,'P1').click();assert.deepEqual(await menuItems(page),['Im Plan zeigen','Neu platzieren','Zurück zu offen','Punkt löschen']);
   await page.keyboard.press('Escape');assert.equal(await page.locator('.pl-menu').count(),0,'Esc schließt das Menü');
   await more(page,'P1').click();await page.getByRole('menuitem',{name:'Zurück zu offen'}).click();
   const p=await until(page,p=>p.markers.length===1);assert.deepEqual(p.pending.map(r=>r.label),['P1','P2','P3','P5','P6']);assert.equal(p.pending[0].raum,'EG Flur');
   await page.locator('#undo').click();const q=await until(page,p=>p.markers.length===2);assert.deepEqual(q.pending.map(r=>r.label),['P2','P3','P5','P6'],'Rückgängig stellt den Punkt wieder her');
  });
  await check(`${engine}: Neu platzieren setzt die Probe an eine andere Stelle`,async()=>{
   const before=(await savedProject(page)).markers.find(m=>m.label==='P1');
   await more(page,'P1').click();await page.getByRole('menuitem',{name:'Neu platzieren'}).click();
   await page.locator('#weiter-chip').waitFor();assert.match(await chipText(page),/^JETZT P1 · EG Flur/);
   await tap(page,500,500);const p=await until(page,p=>p.markers.find(m=>m.label==='P1')&&Math.abs(p.markers.find(m=>m.label==='P1').x-500)<2);
   assert.ok(Math.abs(before.x-500)>50);assert.equal(p.markers.length,2);assert.equal(p.markers.find(m=>m.label==='P1').lab.ref,'Probe 1');
   await page.keyboard.press('Escape');
  });
  await check(`${engine}: ⋯ bei offener Probe entfernt sie aus der Liste (rückgängig mit Undo); Menü oben: Liste leeren`,async()=>{
   await page.locator('#filter-offen').click();
   await more(page,'P6').click();assert.deepEqual(await menuItems(page),['Aus der Liste entfernen']);await page.getByRole('menuitem',{name:'Aus der Liste entfernen'}).click();
   let p=await until(page,p=>!p.pending.some(r=>r.label==='P6'));assert.deepEqual(p.pending.map(r=>r.label),['P2','P3','P5']);
   await page.locator('#undo').click();await until(page,p=>p.pending.some(r=>r.label==='P6'));
   await page.locator('#proben-more').click();assert.equal(await page.locator('#proben-clear').isVisible(),true);assert.equal(await page.locator('#proben-save').isVisible(),true);
   page.once('dialog',d=>d.accept());await page.locator('#proben-clear').click();p=await until(page,p=>p.pending.length===0);assert.equal(p.markers.length,2,'platzierte Punkte bleiben');
   assert.equal(await page.locator('#proben-more-menu').isVisible(),false);
   await page.locator('#undo').click();await until(page,p=>p.pending.length===4);
  });
  await check(`${engine}: Brandherde und Proben ohne Laborbezug stehen unter „Brandherde & weitere Markierungen“`,async()=>{
   await page.locator('#filter-alle').click();
   await page.locator('#stage').evaluate(()=>document.activeElement?.blur());await page.keyboard.press('b');await tap(page,900,600);
   await until(page,p=>p.markers.length===3);
   const g=await gruppen(page);assert.equal(g.at(-1),'Brandherde & weitere Markierungen');
   await page.locator('.pl-group').last().evaluate(e=>{if(e.getAttribute('aria-expanded')!=='true')e.click();});
   const brand=page.locator('.pl-row[data-art=weitere]');assert.equal(await brand.count(),1);assert.match(await brand.textContent(),/B1.*Brandherd/);
   await brand.click();assert.equal(await page.locator('#inspector').isVisible(),true);assert.equal(await page.locator('#label').inputValue(),'B1');
   await page.locator('#filter-offen').click();assert.equal(await page.locator('.pl-row[data-art=weitere]').count(),0,'Filter „Offen“ zeigt keine Brandherde');
  });
  await check(`${engine}: Ziehen einer offenen Zeile auf den Plan platziert genau diese Probe`,async()=>{
   const r=row(page,'P2'),box=await r.boundingBox(),t=await toScreen(page,700,300);
   await page.mouse.move(box.x+20,box.y+10);await page.mouse.down();await page.mouse.move(t.x,t.y,{steps:10});await page.mouse.up();
   const p=await until(page,p=>p.markers.some(m=>m.label==='P2'));assert.equal(p.markers.length,4);assert.equal(await page.locator('#weiter-chip').isHidden(),true);
  });
  await check(`${engine}: Schalter „Weiter-Platzieren (Test)“ liegt in der Probenliste`,async()=>{
   assert.equal(await page.locator('#weiter-switch').isVisible(),true);assert.equal(await page.locator('#proben-section #weiter-switch').count(),1);
  });
  await check(`${engine}: „Neue Liste (Test)“ aus – Seitenleiste wie bisher ohne Reiter; wieder an – Reiter zurück`,async()=>{
   await page.locator('#liste-switch').uncheck();
   assert.equal(await page.locator('#panel-tabs').isVisible(),false);assert.equal(await page.locator('#proben-section').isVisible(),false);assert.equal(await page.locator('#lab-panel').isVisible(),true);
   assert.equal(await page.locator('[data-pending]').count(),3,'alte Liste mit den noch offenen Proben');assert.equal(await page.locator('.markers-section #marker-list').isVisible(),true);assert.equal(await page.locator('#weiter-switch').isVisible(),true);
   assert.equal(await page.evaluate(()=>localStorage.getItem('plankit-neue-liste')),'0');
   await page.locator('#liste-switch').check();assert.equal(await page.locator('#panel-tabs').isVisible(),true);assert.equal(await page.locator('#proben-section').isVisible(),true);assert.equal(await page.locator('#lab-panel').isVisible(),false);
  });
  assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}
}
