// Nachzeichnen (ab 2.3.0): Räume über einem geladenen Bildplan – Bedienung im Browser, erfundene Daten.
//  • Knopf in Schritt ①, Leiste mit „Raum“/„Auswählen“, Dreifach-Schalter, Rückgängig, Prüfschritt mit Datum und Kürzel.
//  • Das Planbild ändert sich nie; kein Maßstab; Format 7 nur mit Nachzeichnung; Ausgabe mit und ohne Nachzeichnung gleich.
//  • Geometrie ändern nimmt „geprüft“ weg, Umbenennen nicht; Drehen nimmt die Nachzeichnung mit; Ausrichten/Entzerren gesperrt.
//  • Probe im nachgezeichneten Raum bekommt den Raum; Umbenennen zieht sie nach.
import * as pk from './pk-ui.mjs';
import {chromium,webkit,savedProject,downloadedProject,openExport} from './runtime.mjs';
import {syntheticPNG} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
async function drag(page,a,b){const p=await toScreen(page,...a),q=await toScreen(page,...b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move((p.x+q.x)/2,(p.y+q.y)/2,{steps:3});await page.mouse.move(q.x,q.y,{steps:3});await page.mouse.up();}
async function tap(page,x,y){const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);}
const near=(a,b,tol,what)=>assert.ok(Math.abs(a-b)<=tol,`${what}: ${a} ≈ ${b}`);
const heute=()=>new Date().toLocaleDateString('sv-SE');
const trace=async page=>(await savedProject(page)).plan.trace;
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('#file').setInputFiles({name:'eg.png',mimeType:'image/png',buffer:syntheticPNG(1200,900)});await page.locator('#welcome').waitFor({state:'hidden'});
  await page.locator('#crop-offer').waitFor();await page.getByRole('button',{name:'Ganzen Plan behalten'}).click();
  const start=await savedProject(page),bild=start.plan.data;
  // 2 Bildschirmpixel in Planeinheiten (WebKit rundet Klicks auf ganze Pixel)
  const tol=async()=>2/await page.locator('#drawing').evaluate(el=>el.getScreenCTM().a)+.5;

  await check(`${engine}: Schritt ① zeigt „Räume nachzeichnen“ bei einem Bildplan, ohne Stand; Datei bleibt im bisherigen Format`,async()=>{
   await pk.schritt(page,1);
   assert.equal(await page.locator('#trace-edit').isVisible(),true);assert.equal(await page.locator('#trace-edit').textContent(),'Räume nachzeichnen');
   assert.equal(await page.locator('#sketch-edit').isVisible(),false);assert.equal(await page.locator('#trace-status').isVisible(),false);
   assert.equal(start.version,1);assert.equal(start.plan.trace,undefined);
   assert.equal(await page.locator('#align-start').isEnabled(),true);assert.equal(await page.locator('#warp-start').isEnabled(),true);
  });
  await check(`${engine}: Leiste öffnet sich, Schritte sind gesperrt, Öffnen allein ändert nichts`,async()=>{
   await page.locator('#trace-edit').click();await page.locator('#trace-actions').waitFor();
   assert.equal(await page.locator('#sketch-actions').isVisible(),false);
   assert.equal(await page.locator('[data-trace-tool="room"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('#trace-hint').textContent(),/Zieh ein Rechteck über einen Raum/);
   assert.match(await page.locator('#trace-count').textContent(),/Noch nichts nachgezeichnet/);
   assert.doesNotMatch(await page.locator('#trace-actions').textContent(),/\bm\b|m²|Breite|Tiefe|Maß/,'keine Maße in der Leiste');
   await page.locator('[data-pk-step="2"]').click({force:true}).catch(()=>{});assert.equal(await pk.aktuell(page),'1','Schritte gesperrt');
   const p=await savedProject(page);assert.equal(p.plan.trace,undefined);assert.equal(p.version,1);
  });
  let kueche;
  await check(`${engine}: Raum aufziehen und benennen – Format 7, Planbild und Maßstab unberührt`,async()=>{
   await drag(page,[100,100],[400,300]);const t=await tol();
   await page.locator('#trace-room-fields').waitFor();await page.waitForFunction(()=>document.activeElement?.id==='trace-name');
   await page.locator('#trace-name').fill('Küche');await page.keyboard.press('Enter');
   const p=await savedProject(page),r=p.plan.trace.rooms[0];kueche=r.id;
   assert.equal(p.plan.trace.rooms.length,1);assert.equal(r.name,'Küche');near(r.x,100,t,'x');near(r.y,100,t,'y');near(r.w,300,t*2,'w');near(r.h,200,t*2,'h');
   assert.equal(p.version,7);assert.equal(p.plan.data,bild,'Planbild unverändert');assert.equal(p.plan.calibration,undefined,'kein Maßstab');assert.equal(p.plan.sketch,undefined);
   assert.equal(p.plan.trace.checked,undefined,'neu = ungeprüft');assert.deepEqual(Object.keys(p.plan.trace).sort(),['openings','rooms','walls']);
   assert.equal(await page.locator('#sketch-overlay [data-trace-room]').count(),1);
   assert.match(await page.locator('#sketch-overlay').textContent(),/Küche/);
   assert.equal(await page.locator('[data-trace-tool="room"]').getAttribute('aria-pressed'),'true','Werkzeug „Raum“ bleibt gewählt');
  });
  await check(`${engine}: zweiter Raum rastet an der Kante des ersten ein (kein Raster)`,async()=>{
   const k=await page.locator('#drawing').evaluate(el=>1/el.getScreenCTM().a);   // Planeinheiten je Bildschirmpixel
   const r1=(await trace(page)).rooms[0];
   await drag(page,[r1.x+r1.w+5*k,r1.y-4*k],[733.3,r1.y+r1.h+3*k]);
   const t=await trace(page),r=t.rooms[1];assert.equal(t.rooms.length,2);
   assert.equal(r.x,r1.x+r1.w,'linke Kante auf der rechten Kante der Küche');assert.equal(r.y,r1.y,'obere Kante bündig');assert.equal(r.y+r.h,r1.y+r1.h,'untere Kante bündig');
   assert.equal(r.name,'Raum 2');
   await page.locator('#trace-name').fill('Flur');await page.keyboard.press('Enter');assert.equal((await trace(page)).rooms[1].name,'Flur');
  });
  await check(`${engine}: Rückgängig und Wiederholen wirken je Aktion, auch in der Leiste`,async()=>{
   await page.locator('#trace-hint').click();   // Fokus aus dem Feld
   await page.keyboard.press('Control+z');assert.equal((await trace(page)).rooms[1].name,'Raum 2','Umbenennen zurück');
   await page.keyboard.press('Control+z');assert.equal((await trace(page)).rooms.length,1,'zweiter Raum zurück');
   assert.equal(await page.locator('#sketch-overlay [data-trace-room]').count(),1);
   await page.keyboard.press('Control+y');await page.keyboard.press('Control+y');const t=await trace(page);assert.equal(t.rooms.length,2);assert.equal(t.rooms[1].name,'Flur');
  });
  await check(`${engine}: Dreifach-Schalter – nur Plan, nur Nachzeichnung, beides`,async()=>{
   await page.locator('[data-trace-view="plan"]').click();assert.equal(await page.locator('#sketch-overlay [data-trace-room]').count(),0);
   assert.equal(await page.locator('#base-plan').evaluate(el=>getComputedStyle(el).visibility),'visible');
   await page.locator('[data-trace-view="zeichnung"]').click();assert.equal(await page.locator('#sketch-overlay [data-trace-room]').count(),2);
   assert.equal(await page.locator('#base-plan').evaluate(el=>getComputedStyle(el).visibility),'hidden');
   await page.locator('[data-trace-view="beides"]').click();assert.equal(await page.locator('#base-plan').evaluate(el=>getComputedStyle(el).visibility),'visible');
   assert.equal(await page.locator('#sketch-overlay [data-trace-room]').count(),2);
   const fill=await page.locator('#sketch-overlay [data-trace-room]').first().getAttribute('fill');assert.match(fill,/rgba\(65,121,178,\.12\)/,'halb durchsichtig, PlanKit-Blau');
  });
  await check(`${engine}: Tipp wählt einen Raum; Brandraum`,async()=>{
   await tap(page,250,200);await page.locator('#trace-room-fields').waitFor();assert.equal(await page.locator('#trace-name').inputValue(),'Küche');
   await page.locator('#trace-fire').check();const t=await trace(page);assert.equal(t.rooms[0].fire,true);assert.equal(t.rooms[1].fire,undefined);
   assert.match(await page.locator('#sketch-overlay').textContent(),/Brandraum/);
  });
  await check(`${engine}: Prüfen – Werkzeuge gesperrt, ohne Kürzel keine Bestätigung, dann Datum und Kürzel in der Datei`,async()=>{
   await page.keyboard.press('Escape');   // Auswahl aufheben
   await page.locator('#trace-done').click();await page.locator('#trace-check').waitFor();
   assert.equal(await page.locator('#trace-tools').isVisible(),false);assert.equal(await page.locator('#trace-done').isVisible(),false);
   assert.match(await page.locator('#trace-check').textContent(),/Stimmen Wände und Räume mit dem Plan überein/);
   assert.equal(await page.locator('#sketch-overlay [data-trace-room]').first().getAttribute('fill'),'none','Prüfen: nur Umrisse');
   await drag(page,[700,500],[1000,800]);assert.equal((await trace(page)).rooms.length,2,'Ziehen zeichnet beim Prüfen nichts');
   assert.equal(await page.locator('#trace-wer-feld').isVisible(),true,'kein Kürzel gemerkt: einmal fragen');
   await page.locator('#trace-ok').click();await page.locator('#toast.error').waitFor();assert.match(await page.locator('#toast').textContent(),/Kürzel/);
   assert.equal((await trace(page)).checked,undefined);assert.equal(await page.locator('#trace-actions').isVisible(),true);
   await page.locator('#trace-kuerzel').fill('Ben');await page.locator('#trace-ok').click();await page.locator('#trace-actions').waitFor({state:'hidden'});
   assert.deepEqual((await trace(page)).checked,{date:heute(),by:'Ben'});
   assert.equal(await page.evaluate(()=>localStorage.getItem('plankit-kuerzel')),'Ben');
   const d=heute().split('-');assert.equal(await page.locator('#trace-status').textContent(),`Nachzeichnung: geprüft am ${d[2]}.${d[1]}.${d[0]} (Ben)`);
   assert.equal(await page.locator('#base-plan').evaluate(el=>getComputedStyle(el).visibility),'visible');
  });
  await check(`${engine}: Ausrichten und Entzerren gesperrt; Drehen nimmt die Nachzeichnung mit, „geprüft“ bleibt`,async()=>{
   for(const id of ['align-start','warp-start']){assert.equal(await page.locator(`#${id}`).isDisabled(),true);assert.match(await page.locator(`#${id}`).getAttribute('title'),/Erst ausrichten, dann nachzeichnen/);}
   assert.equal(await page.locator('#rotate-right').isEnabled(),true);assert.equal(await page.locator('#crop-start').isEnabled(),true);
   const vor=await trace(page);await page.locator('#rotate-right').click();const p=await savedProject(page),r=p.plan.trace.rooms[0];
   assert.equal(p.plan.width,900);near(r.x,900-(vor.rooms[0].y+vor.rooms[0].h),.02,'x gedreht');near(r.y,vor.rooms[0].x,.02,'y gedreht');near(r.w,vor.rooms[0].h,.02,'w');near(r.h,vor.rooms[0].w,.02,'h');
   assert.deepEqual(p.plan.trace.checked,vor.checked);
   await page.locator('#rotate-left').click();const zur=await trace(page);for(const k of ['x','y','w','h'])near(zur.rooms[0][k],vor.rooms[0][k],.02,`zurück ${k}`);
  });
  await check(`${engine}: Umbenennen lässt „geprüft“ stehen, Verschieben nimmt es weg; zweite Prüfung fragt nicht mehr nach dem Kürzel`,async()=>{
   await page.locator('#trace-edit').click();await page.locator('#trace-actions').waitFor();
   await tap(page,250,200);await page.locator('#trace-name').fill('Küche EG');await page.keyboard.press('Enter');
   let t=await trace(page);assert.equal(t.rooms[0].name,'Küche EG');assert.deepEqual(t.checked,{date:heute(),by:'Ben'});
   await page.locator('[data-trace-tool="select"]').click();await drag(page,[250,200],[250,420]);
   t=await trace(page);assert.ok(t.rooms[0].y>250,'verschoben');assert.equal(t.checked,undefined,'Geometrie geändert: ungeprüft');
   await page.keyboard.press('Escape');await page.locator('#trace-done').click();await page.locator('#trace-check').waitFor();
   assert.equal(await page.locator('#trace-wer').textContent(),'Geprüft von: Ben');assert.equal(await page.locator('#trace-wer-feld').isVisible(),false);
   await page.locator('#trace-later').click();await page.locator('#trace-actions').waitFor({state:'hidden'});
   assert.equal(await page.locator('#trace-status').textContent(),'Nachzeichnung: noch nicht geprüft');assert.equal(await page.locator('#trace-status').evaluate(el=>el.classList.contains('offen')),true);
   assert.equal((await trace(page)).checked,undefined);
  });
  await check(`${engine}: einmaliger Hinweis beim Wechsel nach ③, sperrt nichts`,async()=>{
   await pk.schritt(page,3);await page.locator('#toast').filter({hasText:'Nachzeichnung noch nicht geprüft'}).waitFor();
   await pk.schritt(page,2);await page.evaluate(()=>{document.getElementById('toast').hidden=true;});await pk.schritt(page,3);
   assert.equal(await page.locator('#toast').isVisible(),false,'nur einmal');
  });
  let exportMit;
  await check(`${engine}: Probe im nachgezeichneten Raum bekommt den Raum; außerhalb nicht; Umbenennen zieht nach`,async()=>{
   const r=(await trace(page)).rooms[0];
   await pk.modus(page,'sample');await tap(page,r.x+r.w/2,r.y+r.h/2);await tap(page,900,700);
   let p=await savedProject(page);assert.equal(p.markers[0].raum,'Küche EG');assert.equal(p.markers[0].raumSkizze,kueche);assert.equal(p.markers[1].raum,undefined);
   await pk.modus(page,'navigate');
   await openExport(page);await page.locator('#format').selectOption('png');const d=page.waitForEvent('download');await pk.ausgeben(page);exportMit=await readFile(await (await d).path());
   await pk.vorbereiten(page,'trace-edit');await page.locator('#trace-actions').waitFor();
   await tap(page,r.x+r.w/2,r.y+r.h/2);await page.locator('#trace-name').fill('Teeküche');await page.keyboard.press('Enter');
   p=await savedProject(page);assert.equal(p.markers[0].raum,'Teeküche');assert.equal(p.markers[1].raum,undefined);assert.equal(p.markers[0].label,'P1','Kennung unberührt');
  });
  let datei;
  await check(`${engine}: Projektdatei – Format 7, wieder öffnen; ohne Format 7 abgelehnt; noch neuere Fassung abgelehnt`,async()=>{
   await page.keyboard.press('Escape');await page.locator('#trace-done').click();await page.locator('#trace-ok').click();await page.locator('#trace-actions').waitFor({state:'hidden'});
   datei=await downloadedProject(page);assert.equal(datei.version,7);assert.equal(datei.plan.trace.rooms.length,2);assert.deepEqual(datei.plan.trace.checked,{date:heute(),by:'Ben'});
   for(const [change,text] of [[p=>{p.version=6;},/Nachzeichnung benötigt Projektformat 7/],[p=>{p.version=8;},/neueren PlanKit-Version/],[p=>{p.plan.trace.rooms[0].x=5000;},/Ungültige Nachzeichnung/],[p=>{p.plan.trace.rooms[1].joins='gibt-es-nicht';},/Ungültige Nachzeichnung/]]){
    const bad=structuredClone(datei);change(bad);await page.locator('#project-file').setInputFiles({name:'kaputt.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
    await page.locator('#toast.error').waitFor();assert.match(await page.locator('#toast').textContent(),text);await page.evaluate(()=>{document.getElementById('toast').hidden=true;document.getElementById('toast').classList.remove('error');});
   }
   assert.deepEqual((await savedProject(page)).plan.trace,datei.plan.trace,'abgelehnte Dateien ändern nichts');
   await page.locator('#project-file').setInputFiles({name:'plan.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(datei))});
   await page.locator('#replace-dialog[open]').waitFor();assert.match(await page.locator('#replace-dialog p').first().textContent(),/Auch die Nachzeichnung/,'Ersetzen nennt die Nachzeichnung');
   await page.locator('#replace-yes').click();await page.waitForFunction(()=>!document.getElementById('replace-dialog').open);
   const p=await savedProject(page);assert.equal(p.version,7);assert.deepEqual(p.plan.trace,datei.plan.trace);assert.equal(p.markers[0].raum,'Teeküche');
  });
  await check(`${engine}: „Nachzeichnung löschen …“ – Rückfrage, danach keine Nachzeichnung, Ausrichten wieder frei; Ausgabe gleich wie mit Nachzeichnung`,async()=>{
   await pk.vorbereiten(page,'trace-edit');await page.locator('#trace-actions').waitFor();
   await page.locator('#trace-clear').click();await page.locator('#ask-dialog[open]').waitFor();await page.locator('#ask-actions button',{hasText:'Abbrechen'}).click();
   assert.equal((await trace(page)).rooms.length,2);
   await page.locator('#trace-clear').click();await page.locator('#ask-dialog[open]').waitFor();await page.locator('#ask-actions button',{hasText:'Löschen'}).click();
   await page.waitForFunction(()=>!document.querySelector('#sketch-overlay [data-trace-room]'));
   const p=await savedProject(page);assert.equal(p.plan.trace,undefined);assert.equal(p.markers[0].raum,'Teeküche','Raumangabe an der Probe bleibt');
   await page.locator('#trace-done').click();await page.locator('#trace-actions').waitFor({state:'hidden'});
   assert.equal(await page.locator('#align-start').isEnabled(),true);assert.equal(await page.locator('#warp-start').isEnabled(),true);assert.equal(await page.locator('#trace-status').isVisible(),false);
   await openExport(page);await page.locator('#format').selectOption('png');const d=page.waitForEvent('download');await pk.ausgeben(page);const ohne=await readFile(await (await d).path());
   assert.ok(exportMit.length>1000);assert.ok(exportMit.equals(ohne),'PNG-Ausgabe mit und ohne Nachzeichnung ist bytegleich');
   await pk.schritt(page,1);await page.keyboard.press('Control+z');assert.equal((await trace(page)).rooms.length,2,'Rückgängig stellt die Nachzeichnung wieder her');
  });
  await check(`${engine}: Skizzen-Plan hat kein „Räume nachzeichnen“; keine Seitenfehler`,async()=>{
   await page.locator('#sheet-sketch').click();await page.locator('#sketch-actions').waitFor();assert.equal(await page.locator('#trace-actions').isVisible(),false);
   await page.locator('#sketch-done').click();await pk.schritt(page,1);
   assert.equal(await page.locator('#trace-edit').isVisible(),false);assert.equal(await page.locator('#sketch-edit').isVisible(),true);
   assert.deepEqual(errors,[]);
  });
  await context.close();
 }finally{await browser.close();}
}
