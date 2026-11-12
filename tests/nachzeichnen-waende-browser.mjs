// Nachzeichnen, Stufe 2 (ab 2.4.0): Bedienung im Browser, erfundene Daten.
//  • Wände (auch schräg, 15°-Hilfe), Türen und Fenster von Kante zu Kante bzw. per Tipp mit ziehbaren Enden – nirgends Meter, Längen oder m².
//  • Einrasten an Ecken, Wandenden und Kanten (12 px); Nachbarräume teilen sich genau eine Kante.
//  • „gehört zu Raum …“ / „Verbindung lösen“: bewusst, in der Datei, je ein Rückgängig-Schritt; gleicher Name allein verbindet nichts.
//  • Schon gesetzte Proben: ein Angebot nur für Proben ohne Raum, daneben die Liste „Bitte nachsehen“ – die nie etwas ändert.
//  • Schalter „Nachgezeichnete Räume zeigen“ in ②, Standard aus. Jede Geometrie-Änderung nimmt „geprüft“ weg, Umbenennen/Brandraum nicht.
//  • Ausgaben (PNG, PDF) mit und ohne Nachzeichnung bytegleich – mit Wänden, Türen, Fenstern und eingeschaltetem Schalter.
import * as pk from './pk-ui.mjs';
import {chromium,webkit,savedProject,openExport} from './runtime.mjs';
import {syntheticPNG} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
async function drag(page,a,b){const p=await toScreen(page,...a),q=await toScreen(page,...b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move((p.x+q.x)/2,(p.y+q.y)/2,{steps:3});await page.mouse.move(q.x,q.y,{steps:3});await page.mouse.up();}
async function tap(page,x,y){const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);}
const near=(a,b,tol,what)=>assert.ok(Math.abs(a-b)<=tol,`${what}: ${a} ≈ ${b}`);
/** gleich bis auf die Rundung der Datei (0,01 Planeinheiten) – Summen wie x+w sind als Gleitkommazahl nicht bitgleich. */
const gleich=(a,b,what)=>near(a,b,.011,what);
const heute=()=>new Date().toLocaleDateString('sv-SE');
const trace=async page=>(await savedProject(page)).plan.trace;
const werkzeug=(page,t)=>page.locator(`[data-trace-tool="${t}"]`).click();
const grad=w=>Math.atan2(w.y2-w.y1,w.x2-w.x1)*180/Math.PI;
const KEIN_MASS=/\d\s*m\b|m²|\bMeter\b|Breite|Tiefe|Länge|Maß/;
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('#file').setInputFiles({name:'eg.png',mimeType:'image/png',buffer:syntheticPNG(1200,900)});await page.locator('#welcome').waitFor({state:'hidden'});
  await page.locator('#crop-offer').waitFor();await page.getByRole('button',{name:'Ganzen Plan behalten'}).click();
  const k=()=>page.locator('#drawing').evaluate(el=>1/el.getScreenCTM().a);   // Planeinheiten je Bildschirmpixel
  const tol=async()=>2*await k()+.5;
  /** Prüfen bestätigen (Kürzel wird beim ersten Mal gefragt) und die Karte „Proben und Räume“ schließen, falls sie kommt. */
  /** „Fertig – jetzt prüfen →“ (Auswahl vorher aufheben; Esc ohne Auswahl wäre selbst schon „Fertig“). */
  const fertig=async()=>{if(await page.locator('#trace-check').isVisible())return;if(await page.locator('#trace-room-fields').isVisible()||await page.locator('#trace-item-fields').isVisible())await page.keyboard.press('Escape');await page.locator('#trace-done').click();};
  const pruefen=async()=>{await fertig();await page.locator('#trace-check').waitFor();
   if(await page.locator('#trace-kuerzel').isVisible())await page.locator('#trace-kuerzel').fill('Ben');await page.locator('#trace-ok').click();await page.locator('#trace-actions').waitFor({state:'hidden'});
   assert.deepEqual((await trace(page)).checked,{date:heute(),by:'Ben'});};
  const kartezu=async()=>{if(await page.locator('#trace-nicht-jetzt').isVisible())await page.locator('#trace-nicht-jetzt').click();if(await page.locator('#trace-proben-zu').isVisible())await page.locator('#trace-proben-zu').click();await page.locator('#trace-proben').waitFor({state:'hidden'});};
  const oeffnen=async()=>{await pk.vorbereiten(page,'trace-edit');await page.locator('#trace-actions').waitFor();};

  // Drei Proben, BEVOR es eine Nachzeichnung gibt: P1 ohne Raum, P2 mit Raum „Küche“ von Hand (liegt später im Flur), P3 außerhalb aller Räume.
  await pk.modus(page,'sample');await tap(page,200,200);await tap(page,500,250);
  await page.locator('#raum').fill('Küche');await page.locator('#raum').press('Enter');await page.locator('#raum').blur();
  await pk.modus(page,'sample');await tap(page,1000,800);await pk.modus(page,'navigate');
  const start=await savedProject(page),bild=start.plan.data;
  assert.deepEqual(start.markers.map(m=>m.raum),[undefined,'Küche',undefined]);assert.equal(start.version<7,true);
  await pk.schritt(page,2);assert.equal(await page.locator('#trace-vergleich').isVisible(),false,'ohne Nachzeichnung kein Eintrag „Proben mit Räumen vergleichen …“');
  let kueche,flur;

  await check(`${engine}: Leiste – fünf Werkzeuge mit Wort, ein Satz Anleitung, nirgends ein Maß`,async()=>{
   await oeffnen();
   assert.deepEqual(await page.locator('#trace-tools button').allTextContents(),['▭ Raum','╱ Wand','◠ Tür','▭▭ Fenster','↖ Auswählen']);
   for(const t of ['room','wall','door','window','select']){await werkzeug(page,t);const satz=await page.locator('#trace-hint').textContent();
    assert.ok(satz.length>20&&satz.length<190,`ein kurzer Satz (${t})`);assert.doesNotMatch(satz,/[.!?]\s+\S/,`genau ein Satz (${t})`);assert.doesNotMatch(satz,KEIN_MASS,`kein Maß im Hinweis (${t})`);}
   assert.doesNotMatch(await page.locator('#trace-actions').textContent(),KEIN_MASS);
   assert.equal(await page.locator('#trace-actions input:visible').count(),0,'keine Eingabefelder, solange nichts gewählt ist');
   await werkzeug(page,'room');
  });
  await check(`${engine}: Nachbarräume teilen sich genau eine Kante`,async()=>{
   await drag(page,[100,100],[400,300]);await page.locator('#trace-name').fill('Küche');await page.keyboard.press('Enter');
   const e=await k(),r1=(await trace(page)).rooms[0];kueche=r1.id;
   await drag(page,[r1.x+r1.w+7*e,r1.y-5*e],[600,400]);await page.locator('#trace-name').fill('Flur');await page.keyboard.press('Enter');
   const t=await trace(page),r2=t.rooms[1];flur=r2.id;gleich(r2.x,r1.x+r1.w,'linke Kante des Flurs = rechte Kante der Küche');assert.equal(r2.y,r1.y);
   await page.keyboard.press('Escape');
   const senkrecht=await page.locator('#sketch-overlay [data-trace-edge]').evaluateAll((ls,x)=>ls.filter(l=>Math.abs(Number(l.getAttribute('x1'))-x)<.011&&Math.abs(Number(l.getAttribute('x2'))-x)<.011).length,r2.x);
   assert.equal(senkrecht,2,'eine Kante je Raum an derselben Stelle – keine zweite daneben');
  });
  let schraeg;
  await check(`${engine}: Wand – schräg, Enden rasten an Ecke und Kante ein, 15°-Hilfe`,async()=>{
   await werkzeug(page,'wall');const e=await k(),t0=await trace(page),f=t0.rooms[1];
   await drag(page,[f.x+f.w+6*e,f.y+f.h-5*e],[880,640]);   // Start 6/5 px neben der Ecke unten rechts des Flurs
   let t=await trace(page);assert.equal(t.walls.length,1);schraeg=t.walls[0];
   gleich(schraeg.x1,f.x+f.w,'Anfang auf der Raumecke');gleich(schraeg.y1,f.y+f.h,'Anfang auf der Raumecke (y)');
   assert.ok(Math.abs(grad(schraeg))>20&&Math.abs(grad(schraeg))<70,'bleibt schräg');
   assert.deepEqual(Object.keys(schraeg).sort(),['id','x1','x2','y1','y2']);
   assert.equal(await page.locator('#sketch-overlay [data-trace-wall]').count(),1);
   assert.equal(await page.locator('#trace-item-name').textContent(),'Wand gewählt');
   assert.equal(await page.locator('#trace-item-fields input').count(),0,'kein Längenfeld');
   // fast waagerecht gezogen → genau waagerecht; Anfang auf der Kante der Küche (nicht auf einer Ecke)
   const r=t.rooms[0];await drag(page,[r.x+150,r.y+r.h+5*e],[r.x+150+500,r.y+r.h+5*e+6]);
   t=await trace(page);assert.equal(t.walls.length,2);const w=t.walls[1];gleich(w.y1,r.y+r.h,'Anfang auf der Raumkante');assert.equal(w.y2,w.y1,'nahe 0° → genau waagerecht');
   await page.keyboard.press('Control+z');assert.equal((await trace(page)).walls.length,1,'eine Wand = ein Rückgängig-Schritt');
   assert.equal(t.checked,undefined);assert.equal((await savedProject(page)).plan.data,bild,'Planbild unverändert');
  });
  let tuer,fenster;
  await check(`${engine}: Tür per Tipp (Standardbreite), Fenster von Kante zu Kante – auch auf der schrägen Wand`,async()=>{
   const t0=await trace(page),r=t0.rooms[0];
   await werkzeug(page,'door');await tap(page,r.x+150,r.y+2*await k());
   let t=await trace(page);assert.equal(t.openings.length,1);tuer=t.openings[0];
   assert.equal(tuer.kind,'door');assert.equal(tuer.y,r.y,'liegt auf der Raumkante');assert.equal(tuer.a,0);near(tuer.w,1200*.025,.02,'Standardbreite = Anteil der längeren Planseite');near(tuer.x,r.x+150,await tol(),'dort, wo getippt wurde');
   assert.equal(await page.locator('#trace-item-name').textContent(),'Tür gewählt');assert.equal(await page.locator('#trace-item-fields input').count(),0,'kein Breitenfeld');
   await tap(page,900,200);await page.locator('#toast.error').waitFor();assert.match(await page.locator('#toast').textContent(),/Bitte auf eine Wand oder eine Raumkante tippen/);
   assert.equal((await trace(page)).openings.length,1);
   await werkzeug(page,'window');const m=p=>[schraeg.x1+(schraeg.x2-schraeg.x1)*p,schraeg.y1+(schraeg.y2-schraeg.y1)*p];
   await drag(page,m(.3),m(.6));t=await trace(page);assert.equal(t.openings.length,2);fenster=t.openings[1];
   assert.equal(fenster.kind,'window');near(fenster.a,grad(schraeg),.02,'Richtung der schrägen Wand');
   const len=Math.hypot(schraeg.x2-schraeg.x1,schraeg.y2-schraeg.y1);near(fenster.w,len*.3,2*await tol(),'so breit wie gezogen');
   near(fenster.x,m(.45)[0],await tol(),'Mitte x');near(fenster.y,m(.45)[1],await tol(),'Mitte y');
   assert.equal(await page.locator('#sketch-overlay [data-trace-opening="door"]').count(),1);assert.equal(await page.locator('#sketch-overlay [data-trace-opening="window"]').count(),1);
   assert.match(await page.locator('#trace-item-name').textContent(),/Fenster gewählt/);
   assert.doesNotMatch(await page.locator('#trace-actions').textContent(),KEIN_MASS);assert.doesNotMatch(await page.locator('#sketch-overlay').textContent(),KEIN_MASS,'keine Maße im Bild');
  });
  await check(`${engine}: Enden der Tür ziehen; Rückgängig je Aktion; Entf löscht`,async()=>{
   await werkzeug(page,'select');await tap(page,tuer.x,tuer.y);assert.equal(await page.locator('#trace-item-name').textContent(),'Tür gewählt');
   assert.equal(await page.locator('#sketch-overlay [data-trace-griff]').count(),2,'zwei Griffe an den Enden');
   await drag(page,[tuer.x+tuer.w/2,tuer.y],[tuer.x+tuer.w/2+60,tuer.y+25]);
   let o=(await trace(page)).openings[0];near(o.w,tuer.w+60,2*await tol(),'breiter');near(o.x-o.w/2,tuer.x-tuer.w/2,.02,'das andere Ende bleibt');assert.equal(o.y,tuer.y,'bleibt auf der Wand');
   await page.keyboard.press('Control+z');o=(await trace(page)).openings[0];assert.equal(o.w,tuer.w,'ein Schritt zurück');
   await page.keyboard.press('Control+y');assert.ok((await trace(page)).openings[0].w>tuer.w);await page.keyboard.press('Control+z');
   await tap(page,fenster.x,fenster.y);await page.keyboard.press('Delete');assert.equal((await trace(page)).openings.length,1);
   await page.keyboard.press('Control+z');assert.equal((await trace(page)).openings.length,2);
  });
  let teil;
  await check(`${engine}: „gehört zu Raum …“ – bewusst, in der Datei, ein Rückgängig-Schritt; die Kante dazwischen ist keine Wand mehr`,async()=>{
   await werkzeug(page,'room');const r=(await trace(page)).rooms[0];
   await drag(page,[r.x,r.y+r.h+3*await k()],[r.x+150,r.y+r.h+120]);let t=await trace(page);teil=t.rooms[2];
   gleich(teil.y,r.y+r.h,'liegt an der Küche an');assert.equal(teil.joins,undefined,'Anliegen allein verbindet nichts');assert.equal(teil.name,'Raum 3');
   const kante=()=>page.locator('#sketch-overlay [data-trace-edge]').evaluateAll((ls,[y,x0,x1])=>ls.filter(l=>Math.abs(Number(l.getAttribute('y1'))-y)<.011&&Math.abs(Number(l.getAttribute('y2'))-y)<.011&&Number(l.getAttribute('x1'))<x1-.011&&Number(l.getAttribute('x2'))>x0+.011).map(l=>[Number(l.getAttribute('x1')),Number(l.getAttribute('x2'))]),[teil.y,teil.x,teil.x+teil.w]);
   assert.equal((await kante()).length,2,'vorher: Wand zwischen den beiden');
   assert.equal(await page.locator('#trace-join').isVisible(),true);assert.equal(await page.locator('#trace-unjoin').isVisible(),false);
   await page.locator('#trace-join').click();assert.match(await page.locator('#trace-hint').textContent(),/Tipp jetzt den Raum an, zu dem dieses Rechteck gehört/);
   assert.equal((await trace(page)).rooms[2].joins,undefined,'der Knopf allein ändert nichts');
   await tap(page,r.x+250,r.y+60);t=await trace(page);
   assert.equal(t.rooms[2].joins,kueche,'steht ausdrücklich in der Datei');assert.equal(t.rooms[2].name,'Küche');assert.equal(t.rooms.length,3);
   assert.deepEqual(await kante(),[],'gemeinsame Kante weg');
   const rest=await page.locator('#sketch-overlay [data-trace-edge]').evaluateAll((ls,y)=>ls.filter(l=>Math.abs(Number(l.getAttribute('y1'))-y)<.011&&Math.abs(Number(l.getAttribute('y2'))-y)<.011).map(l=>[Number(l.getAttribute('x1')),Number(l.getAttribute('x2'))]),teil.y);
   assert.equal(rest.length,1,'unter der Küche bleibt nur ein Stück');gleich(rest[0][0],teil.x+teil.w,'es beginnt neben dem Teil');gleich(rest[0][1],r.x+r.w,'und reicht bis zur Ecke der Küche');
   assert.equal((await page.locator('#sketch-overlay').textContent()).match(/Küche/g).length,1,'ein Name, einmal angezeigt');
   assert.match(await page.locator('#trace-count').textContent(),/^2 Räume · 1 Wand · 1 Tür · 1 Fenster nachgezeichnet$/);
   await page.locator('#trace-hint').click();await page.keyboard.press('Control+z');t=await trace(page);assert.equal(t.rooms[2].joins,undefined,'ein Schritt zurück');assert.equal(t.rooms[2].name,'Raum 3');
   await page.keyboard.press('Control+y');assert.equal((await trace(page)).rooms[2].joins,kueche);
   // Ziel muss berühren
   await werkzeug(page,'select');await tap(page,teil.x+40,teil.y+60);await page.locator('#trace-unjoin').waitFor();
  });
  await check(`${engine}: gleicher Name ohne Verbinden bleibt ein eigener Raum mit Wand; „Verbindung lösen“ trennt wieder`,async()=>{
   await werkzeug(page,'room');const f=(await trace(page)).rooms[1];
   await drag(page,[f.x+f.w+4*await k(),f.y],[f.x+f.w+200,f.y+200]);await page.locator('#trace-name').fill('Flur');await page.keyboard.press('Enter');
   let t=await trace(page);const z=t.rooms[3];assert.equal(z.name,'Flur');assert.equal(z.joins,undefined,'gleicher Name verbindet nicht');gleich(z.x,f.x+f.w,'liegt am Flur an');
   await page.keyboard.press('Escape');
   const wand=await page.locator('#sketch-overlay [data-trace-edge]').evaluateAll((ls,x)=>ls.filter(l=>Math.abs(Number(l.getAttribute('x1'))-x)<.011&&Math.abs(Number(l.getAttribute('x2'))-x)<.011).length,z.x);
   assert.equal(wand,2,'Wand zwischen den beiden „Flur“ bleibt');
   assert.equal((await page.locator('#sketch-overlay').textContent()).match(/Flur/g).length,2,'zwei Räume, zwei Namen');
   // nicht berührende Rechtecke lassen sich nicht verbinden
   await werkzeug(page,'select');await tap(page,z.x+100,z.y+100);await page.locator('#trace-join').click();await tap(page,teil.x+40,teil.y+60);
   await page.locator('#toast.error').waitFor();assert.match(await page.locator('#toast').textContent(),/müssen sich berühren/);assert.equal((await trace(page)).rooms[3].joins,undefined);
   // lösen
   await tap(page,teil.x+40,teil.y+60);await page.locator('#trace-unjoin').click();t=await trace(page);
   assert.equal(t.rooms[2].joins,undefined);assert.equal(t.rooms[2].name,'Küche','eigener Raum mit dem bisherigen Namen');
   await page.locator('#trace-hint').click();await page.keyboard.press('Control+z');assert.equal((await trace(page)).rooms[2].joins,kueche,'Lösen ist ein Rückgängig-Schritt');
   // den Teil vom Raum wegziehen: die Verbindung löst sich im selben Schritt, mit Hinweis – ein Rückgängig stellt beides wieder her
   await tap(page,teil.x+40,teil.y+60);await drag(page,[teil.x+40,teil.y+60],[teil.x+40,teil.y+260]);
   await page.locator('#toast',{hasText:'berührt seinen Raum nicht mehr'}).waitFor();t=await trace(page);
   assert.ok(t.rooms[2].y>teil.y+100,'verschoben');assert.equal(t.rooms[2].joins,undefined,'ohne Kontakt keine Verbindung');assert.equal(t.rooms[2].name,'Küche');
   await page.locator('#trace-hint').click();await page.keyboard.press('Control+z');t=await trace(page);assert.equal(t.rooms[2].joins,kueche);assert.equal(t.rooms[2].y,teil.y,'ein Schritt: Lage und Verbindung zurück');
   const p=await savedProject(page);assert.equal(p.version,7,'weiter Format 7');assert.deepEqual(Object.keys(p.plan.trace).sort(),['openings','rooms','walls']);
   assert.deepEqual(p.markers,start.markers,'bis hierher wurde keine Probe angefasst');
  });
  await check(`${engine}: Prüfen fragt nach Wänden und Räumen; danach „Nicht jetzt“ lässt alle Proben, wie sie sind`,async()=>{
   await fertig();await page.locator('#trace-check').waitFor();
   assert.match(await page.locator('#trace-check').textContent(),/Stimmen Wände und Räume mit dem Plan überein\?/);
   assert.equal(await page.locator('#sketch-overlay [data-trace-griff]').count(),0);
   await page.locator('#trace-later').click();await page.locator('#trace-actions').waitFor({state:'hidden'});
   await page.locator('#trace-proben').waitFor();
   assert.equal(await page.locator('#trace-angebot-titel').textContent(),'1 Probe ohne Raum liegt in einem nachgezeichneten Raum – Raum übernehmen?');
   assert.deepEqual(await page.locator('#trace-angebot-liste li').allTextContents(),['P1 → Küche']);
   assert.deepEqual(await page.locator('#trace-angebot button').allTextContents(),['Übernehmen','Nicht jetzt']);
   assert.deepEqual(await page.locator('#trace-abweichung-liste li').allTextContents(),['P2: an der Probe steht „Küche“, der Punkt liegt in „Flur“']);
   assert.match(await page.locator('#trace-abweichung').textContent(),/Bitte nachsehen/);assert.match(await page.locator('#trace-abweichung').textContent(),/PlanKit ändert daran nichts/);
   assert.equal(await page.locator('#trace-abweichung button').count(),1,'je Abweichung nur ein Knopf zum Zeigen – kein Sammelknopf zum Ändern');
   assert.deepEqual((await savedProject(page)).markers,start.markers,'das Angebot allein ändert nichts');
   await page.locator('#trace-nicht-jetzt').click();assert.equal(await page.locator('#trace-angebot').isVisible(),false);assert.equal(await page.locator('#trace-abweichung').isVisible(),true);
   assert.deepEqual((await savedProject(page)).markers,start.markers,'„Nicht jetzt“ ändert nichts');
   await page.locator('#trace-proben-zu').click();await page.locator('#trace-proben').waitFor({state:'hidden'});
  });
  await check(`${engine}: „Proben mit Räumen vergleichen …“ in ② öffnet die Liste jederzeit – ohne die Nachzeichnung zu öffnen, Stand neu berechnet`,async()=>{
   await pk.schritt(page,2);const e=page.locator('#trace-vergleich');
   assert.equal(await e.isVisible(),true);assert.equal(await e.textContent(),'Proben mit Räumen vergleichen …');
   assert.equal(await e.evaluate(el=>el.parentElement===document.getElementById('trace-toggle').parentElement),true,'bei „Nachgezeichnete Räume zeigen“');
   const vor=await savedProject(page);
   await e.click();await page.locator('#trace-proben').waitFor();
   assert.equal(await page.locator('#trace-actions').isVisible(),false,'die Nachzeichnung wird nicht geöffnet');assert.equal(await pk.aktuell(page),'2','bleibt in Schritt ②');
   assert.deepEqual(await page.locator('#trace-angebot-liste li').allTextContents(),['P1 → Küche'],'eine Probe ohne Raum');
   assert.deepEqual(await page.locator('#trace-angebot button').allTextContents(),['Übernehmen','Nicht jetzt']);
   assert.deepEqual(await page.locator('#trace-abweichung-liste li').allTextContents(),['P2: an der Probe steht „Küche“, der Punkt liegt in „Flur“'],'eine Abweichung');
   assert.equal(await page.locator('#trace-proben-leer').isVisible(),false);
   assert.deepEqual(await savedProject(page),vor,'Öffnen ändert nichts – auch nicht „geprüft“ oder das Format');
   // Stand wird neu berechnet: P3 (bisher außerhalb, ohne Raum) in den Flur ziehen → nach erneutem Öffnen steht sie im Angebot
   await page.locator('#trace-proben-zu').click();await page.locator('#trace-proben').waitFor({state:'hidden'});
   await pk.modus(page,'edit');await drag(page,[1000,800],[520,180]);await pk.modus(page,'navigate');
   await e.click();await page.locator('#trace-proben').waitFor();
   assert.deepEqual(await page.locator('#trace-angebot-liste li').allTextContents(),['P1 → Küche','P3 → Flur']);
   assert.match(await page.locator('#trace-angebot-titel').textContent(),/^2 Proben ohne Raum liegen/);
   await page.locator('#trace-nicht-jetzt').click();await page.locator('#trace-proben-zu').click();await page.locator('#trace-proben').waitFor({state:'hidden'});
   await page.keyboard.press('Control+z');assert.deepEqual((await savedProject(page)).markers,start.markers,'P3 wieder an ihrem Platz, sonst nichts geändert');
  });
  await check(`${engine}: „Übernehmen“ – nur die Probe ohne Raum, ein Rückgängig-Schritt; Abweichung nur gezeigt`,async()=>{
   await oeffnen();await pruefen();await page.locator('#trace-proben').waitFor();
   await page.locator('#trace-uebernehmen').click();
   let p=await savedProject(page);
   assert.deepEqual(p.markers[0],{...start.markers[0],raum:'Küche',raumSkizze:kueche},'P1: nur raum und raumSkizze neu');
   assert.deepEqual(p.markers[1],start.markers[1],'P2 (Abweichung) unverändert');assert.deepEqual(p.markers[2],start.markers[2],'P3 (außerhalb) unverändert');
   assert.equal(await page.locator('#trace-angebot').isVisible(),false);assert.equal(await page.locator('#trace-abweichung').isVisible(),true,'Prüfliste bleibt stehen');
   assert.match(await page.locator('#toast').textContent(),/1 Probe hat jetzt ihren Raum/);
   // Klick auf die Abweichung zeigt die Probe, ändert nichts
   await page.locator('#trace-abweichung-liste button').click();
   assert.equal(await page.locator('#raum').inputValue(),'Küche','P2 ist gewählt – ihr Raum steht unverändert da');
   const mitte=await page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM()),r=el.getBoundingClientRect();return [q.x-(r.left+r.width/2),q.y-(r.top+r.height/2)];},[start.markers[1].x,start.markers[1].y]);
   near(mitte[0],0,3,'Probe in der Mitte (x)');near(mitte[1],0,3,'Probe in der Mitte (y)');
   assert.deepEqual((await savedProject(page)).markers[1],start.markers[1]);
   await page.locator('#trace-proben-zu').click();await page.locator('#trace-proben').waitFor({state:'hidden'});
   await pk.modus(page,'navigate');await page.locator('#drawing').focus().catch(()=>{});
   await page.keyboard.press('Control+z');p=await savedProject(page);assert.deepEqual(p.markers,start.markers,'ein Schritt zurück: P1 wieder ohne Raum');assert.deepEqual(p.plan.trace.checked,{date:heute(),by:'Ben'},'„geprüft“ bleibt');
   await page.keyboard.press('Control+y');assert.equal((await savedProject(page)).markers[0].raum,'Küche');
  });
  await check(`${engine}: jede Geometrie-Änderung nimmt „geprüft“ weg – Wand, Tür, Fenster, Ende ziehen, Verbinden, Lösen; Umbenennen und Brandraum nicht`,async()=>{
   const weg=async was=>assert.equal((await trace(page)).checked,undefined,`${was}: nicht mehr geprüft`);
   const t0=await trace(page),r=t0.rooms[0],f=t0.rooms[1];
   await oeffnen();await werkzeug(page,'wall');await drag(page,[700,600],[900,780]);await weg('Wand gezeichnet');await pruefen();await kartezu();
   await oeffnen();await werkzeug(page,'select');await tap(page,800,690);await page.keyboard.press('Delete');await weg('Wand gelöscht');await pruefen();await kartezu();
   await oeffnen();await werkzeug(page,'select');await tap(page,schraeg.x2,schraeg.y2);await drag(page,[schraeg.x2,schraeg.y2],[schraeg.x2+40,schraeg.y2-30]);await weg('Wandende gezogen');
   assert.equal((await trace(page)).openings.length,2,'das Fenster auf der Wand geht mit');await pruefen();await kartezu();
   await oeffnen();await werkzeug(page,'door');await tap(page,f.x+f.w/2,f.y+f.h);await weg('Tür gesetzt');await pruefen();await kartezu();
   await oeffnen();await werkzeug(page,'window');await drag(page,[r.x,r.y+60],[r.x,r.y+140]);await weg('Fenster gezogen');await pruefen();await kartezu();
   await oeffnen();await werkzeug(page,'select');await tap(page,r.x,r.y+100);await drag(page,[r.x,r.y+100],[r.x+2,r.y+70]);await weg('Fenster verschoben');await pruefen();await kartezu();
   await oeffnen();await werkzeug(page,'select');await tap(page,teil.x+40,teil.y+60);await page.locator('#trace-unjoin').click();await weg('Verbindung gelöst');await pruefen();await kartezu();
   await oeffnen();await werkzeug(page,'select');await tap(page,teil.x+40,teil.y+60);await page.locator('#trace-join').click();await tap(page,r.x+250,r.y+60);await weg('verbunden');
   assert.equal((await trace(page)).rooms[2].joins,kueche);await pruefen();await kartezu();
   await oeffnen();await werkzeug(page,'select');await tap(page,r.x+250,r.y+60);await page.locator('#trace-name').fill('Wohnküche');await page.keyboard.press('Enter');await page.locator('#trace-fire').check();
   const t=await trace(page);assert.deepEqual(t.checked,{date:heute(),by:'Ben'},'Umbenennen und Brandraum lassen „geprüft“ stehen');
   assert.equal(t.rooms[0].name,'Wohnküche');assert.equal(t.rooms[2].name,'Wohnküche','der Teil heißt mit');assert.equal(t.rooms[0].fire,true);assert.equal(t.rooms[2].fire,true);
   const p=await savedProject(page);assert.equal(p.markers[0].raum,'Wohnküche','Probe aus diesem Raum zieht beim Umbenennen nach (wie in 2.3.0)');assert.equal(p.markers[1].raum,'Küche','von Hand eingetragener Raum bleibt');
   await fertig();await page.locator('#trace-later').click();await kartezu();
   const d=heute().split('-');assert.equal(await page.locator('#trace-status').textContent(),`Nachzeichnung: geprüft am ${d[2]}.${d[1]}.${d[0]} (Ben)`);
  });
  await check(`${engine}: nichts zu zeigen – ein Satz statt einer leeren Liste; „Übernehmen“ geht auch von dort`,async()=>{
   // P2 bekommt von Hand den Raum, in dem sie liegt (das tut der Sachverständige, nie PlanKit) – danach gibt es keine Abweichung mehr
   await pk.schritt(page,2);await page.locator('#trace-vergleich').click();await page.locator('#trace-abweichung-liste button').click();
   await page.locator('#raum').fill('Flur');await page.locator('#raum').press('Enter');await page.locator('#raum').blur();
   await page.locator('#trace-proben-leer').waitFor();   // die offene Karte rechnet neu
   assert.equal(await page.locator('#trace-proben-leer').textContent(),'Nichts nachzusehen: Keine Probe ohne Raum liegt in einem nachgezeichneten Raum, und keine Raumangabe weicht ab.');
   assert.equal(await page.locator('#trace-angebot').isVisible(),false);assert.equal(await page.locator('#trace-abweichung').isVisible(),false);assert.equal(await page.locator('#trace-proben li').count()>=0&&await page.locator('#trace-proben li:visible').count(),0,'keine leere Liste');
   await page.locator('#trace-proben-zu').click();await page.locator('#trace-proben').waitFor({state:'hidden'});
   await pk.modus(page,'navigate');await page.locator('#trace-vergleich').click();await page.locator('#trace-proben-leer').waitFor();
   assert.equal(await page.locator('#trace-proben button:visible').count(),1,'nur „Schließen“');
   await page.locator('#trace-proben-zu').click();await page.locator('#trace-proben').waitFor({state:'hidden'});
   // eine neue Probe ohne Raum außerhalb setzen und in die Wohnküche ziehen → Angebot über den Eintrag, ein Rückgängig-Schritt
   const r=(await trace(page)).rooms[0];await pk.modus(page,'sample');await tap(page,1100,820);await pk.modus(page,'edit');await drag(page,[1100,820],[r.x+60,r.y+150]);await pk.modus(page,'navigate');
   const vor=await savedProject(page),neu=vor.markers[3];assert.equal(neu.raum,undefined);
   await page.locator('#trace-vergleich').click();assert.deepEqual(await page.locator('#trace-angebot-liste li').allTextContents(),[`${neu.label} → Wohnküche`]);
   await page.locator('#trace-uebernehmen').click();let p=await savedProject(page);
   assert.deepEqual(p.markers[3],{...neu,raum:'Wohnküche',raumSkizze:kueche},'nur raum und raumSkizze');assert.deepEqual(p.markers.slice(0,3),vor.markers.slice(0,3));assert.deepEqual(p.plan.trace,vor.plan.trace);assert.equal(p.version,vor.version);
   await page.locator('#trace-proben-leer').waitFor();await page.locator('#trace-proben-zu').click();
   await page.keyboard.press('Control+z');assert.deepEqual((await savedProject(page)).markers,vor.markers,'ein Schritt zurück');await page.keyboard.press('Control+y');
  });
  let pngMit,pdfMit,mitNachzeichnung;
  await check(`${engine}: Schalter „Nachgezeichnete Räume zeigen“ in ② – Standard aus, aus = Karte wie bisher`,async()=>{
   await pk.schritt(page,2);const s=page.locator('#trace-toggle');
   assert.equal(await s.isVisible(),true);assert.equal(await s.textContent(),'Nachgezeichnete Räume zeigen');assert.equal(await s.getAttribute('aria-pressed'),'false');
   assert.equal(await s.evaluate(el=>el.parentElement===document.getElementById('results-toggle').parentElement),true,'neben „Ergebnisfarben zeigen“');
   assert.equal(await page.locator('#trace-view > *').count(),0,'aus: nichts über dem Plan');assert.equal(await page.locator('#sketch-overlay > *').count(),0);
   const foto=async()=>{await page.evaluate(()=>{document.getElementById('toast').hidden=true;});await page.mouse.move(5,5);const b=await page.locator('#drawing').boundingBox();return page.screenshot({clip:{x:b.x,y:b.y+70,width:b.width,height:b.height-70}});};   // ohne den Streifen mit dem Modus-Hinweis oben links
   const aus=await foto();
   await s.click();assert.equal(await s.getAttribute('aria-pressed'),'true');
   const t=await trace(page);
   assert.equal(await page.locator('#trace-view [data-trace-room]').count(),t.rooms.length);assert.equal(await page.locator('#trace-view [data-trace-wall]').count(),t.walls.length);assert.equal(await page.locator('#trace-view [data-trace-opening]').count(),t.openings.length);
   assert.match(await page.locator('#trace-view').textContent(),/Wohnküche/);assert.doesNotMatch(await page.locator('#trace-view').textContent(),KEIN_MASS);
   assert.equal(await page.locator('#trace-view').evaluate(el=>el.getAttribute('pointer-events')),'none','Punkte bleiben bedienbar');
   assert.equal(Buffer.compare(aus,await foto())!==0,true,'an: sichtbar');
   await s.click();assert.equal(await page.locator('#trace-view > *').count(),0);
   assert.equal(await page.locator('#sketch-overlay > *').count(),0,'wieder aus: keine Ebene über dem Plan – die Karte besteht aus denselben Teilen wie ohne Nachzeichnung');
   await s.click();   // für den Ausgabe-Vergleich eingeschaltet lassen
   mitNachzeichnung=await savedProject(page);assert.equal(mitNachzeichnung.plan.data,bild);
  });
  const ausgabe=async format=>{await openExport(page);await page.locator('#format').selectOption(format);const d=page.waitForEvent('download');await pk.ausgeben(page);return readFile(await (await d).path());};
  await check(`${engine}: Ausgaben PNG und PDF – mit Nachzeichnung (Wände, Türen, Fenster, Schalter an) bytegleich wie ohne`,async()=>{
   await page.clock.setFixedTime(new Date('2026-11-12T10:00:00'));   // das PDF trägt sein Erstellungsdatum
   const t=mitNachzeichnung.plan.trace;assert.ok(t.walls.length>=1&&t.openings.some(o=>o.kind==='door')&&t.openings.some(o=>o.kind==='window')&&t.rooms.some(r=>r.joins),'Nachzeichnung mit Wand, Tür, Fenster, Verbindung');
   pngMit=await ausgabe('png');pdfMit=await ausgabe('pdf-a4');
   assert.equal(pdfMit.subarray(0,5).toString(),'%PDF-');
   await oeffnen();await page.locator('#trace-clear').click();await page.locator('#ask-dialog button',{hasText:'Löschen'}).click();
   await fertig();await page.locator('#trace-actions').waitFor({state:'hidden'});
   const ohne=await savedProject(page);assert.equal(ohne.plan.trace,undefined,'Nachzeichnung gelöscht');assert.deepEqual(ohne.markers,mitNachzeichnung.markers,'Proben wie vorher');
   assert.equal(await page.locator('#trace-toggle').isVisible(),false,'ohne Nachzeichnung kein Schalter');assert.equal(await page.locator('#trace-vergleich').isVisible(),false,'und kein Eintrag zum Vergleichen');
   const pngOhne=await ausgabe('png'),pdfOhne=await ausgabe('pdf-a4');
   assert.equal(Buffer.compare(pngMit,pngOhne),0,'PNG gleich');assert.equal(Buffer.compare(pdfMit,pdfOhne),0,'PDF gleich');
   assert.ok(pngMit.length>1000&&pdfMit.length>1000);
  });
  assert.deepEqual(errors,[],'keine Seitenfehler');
 }finally{await browser.close();}
}
