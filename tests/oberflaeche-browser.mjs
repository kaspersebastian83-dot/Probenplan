// Einfache Oberfläche (PlanKit 2.0, Spektron Schritt 3): Startkarte, drei Schritte, Hinweiskarte „Als Nächstes setzen …“ (E5 mit den
// Schutzregeln aus 6.1), Probe von Hand, Brandherd, Punkte verschieben, Kennung von Laborproben schreibgeschützt (E12), Plan-Chips,
// Ausgabe mit Hauptaktion und gebundenem „erledigt“ (E10), Format gemerkt, Kürzel wechseln in ihren Schritt (E17), Flächen-Ansicht,
// „Mehr …“ vollständig, Breiten 1920–390. Synthetische Daten.
import * as pk from './pk-ui.mjs';
import {chromium,webkit,savedProject} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/><path d="M40 40H1160V760H40Z" fill="none" stroke="black" stroke-width="8"/></svg>');
const RAEUME=['EG Flur','EG Küche','EG Flur'];
const lk={version:'4.34.0',projekt:{nr:''},proben:RAEUME.map((raum,i)=>({id:i+1,_nr:i+11,z2:raum,z3:'Wand',z4:'Ansicht',matrix:'Wischprobe',datum:'2026-10-20'}))};
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
const tap=async(page,x,y)=>{const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);};
const text=async(page,sel)=>((await page.locator(sel).textContent())||'').replace(/\s+/g,' ').trim();
async function until(page,test,what){let p;for(let i=0;i<60;i++){p=await savedProject(page);if(test(p))return p;await page.waitForTimeout(100);}assert.fail(`${what||'Projektstand'}: ${JSON.stringify({markers:p.markers.map(m=>m.label),pending:(p.pending||[]).map(r=>r.label)})}`);}
const mehrEintraege=async page=>{await page.locator('#pk-mehr').click();const t=(await page.locator('#mosaikMehrPop').locator('a,button').allTextContents()).map(s=>s.trim());await page.keyboard.press('Escape');return t;};
for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(`${base}/?weiter-default&format-default`);

  await check(`${engine}: ohne Plan – Schritt ①, Startkarte, ②/③ gesperrt, Hauptaktion „Grundriss auswählen …“, „Mehr …“ vollständig`,async()=>{
   assert.equal(await pk.aktuell(page),'1');assert.equal(await page.locator('#welcome').isVisible(),true);
   assert.equal(await page.locator('[data-pk-step="2"]').isDisabled(),true);assert.equal(await page.locator('[data-pk-step="3"]').isDisabled(),true);
   assert.equal(await text(page,'#pk-haupt'),'Grundriss auswählen …');assert.equal(await page.locator('#welcome-sketch').isVisible(),true,'Skizze gleichwertig auf der Startkarte');
   for(const id of ['pk-werkzeuge','pk-plaene','pk-hinweis'])assert.equal(await page.locator(`#${id}`).isVisible(),false,id);
   assert.equal(await page.locator('#save-project').isVisible(),false,'ohne Plan nichts zu speichern');
   const m=await mehrEintraege(page);
   for(const t of ['Schadensflächen …','Projektdatei öffnen …','Nach jeder Probe gleich die nächste wählen','Kurzanleitung und Tastenkürzel','Version, Offline und Änderungen','📘 Handbuch ↗','💬 Rückmeldung ↗','⌂ Alle Projekte ↗'])assert.ok(m.some(x=>x.endsWith(t)),`Mehr: ${t} in ${m.join(' | ')}`);
   await page.locator('#pk-mehr').click();assert.equal(await page.locator('#pk-m-flaechen').isDisabled(),true,'Flächen erst mit Plan');await page.keyboard.press('Escape');
  });
  await page.locator('#file').setInputFiles({name:'eg.svg',mimeType:'image/svg+xml',buffer:svg});await page.locator('#welcome').waitFor({state:'hidden'});
  await check(`${engine}: frischer Plan bleibt in ① – Planliste, weitere Pläne, Plan vorbereiten, „Diesen Plan ersetzen …“`,async()=>{
   assert.equal(await pk.aktuell(page),'1');await pk.spalte(page);
   assert.equal(await page.locator('#pk-plankarte .sheet').count(),1);assert.equal(await text(page,'#sheet-add'),'＋ Weiteren Plan (Geschoss) …');assert.equal(await text(page,'#sheet-sketch'),'＋ Skizze als weiteren Plan');
   for(const id of ['rotate-left','rotate-right','crop-start','align-start','warp-start','measure-start'])assert.equal(await page.locator(`#${id}`).isVisible(),true,id);
   assert.equal(await text(page,'#load'),'Diesen Plan ersetzen …');assert.equal(await text(page,'#pk-haupt'),'Weiter: Proben setzen →');
   assert.equal(await text(page,'#pk-plaene'),'EG','ein Plan: nur der Name oben rechts');
   assert.match(await text(page,'#pk-stand-text'),/Nur im Browser gesichert/);assert.equal(await text(page,'#save-project'),'Als Datei speichern');
  });
  await check(`${engine}: ② ohne Laborproben pausiert (6.1 b) – „Probe von Hand“ mit Nummer und Form, Pause`,async()=>{
   await page.locator('#pk-haupt').click();assert.equal(await pk.aktuell(page),'2');assert.equal(await page.locator('#stage').getAttribute('data-mode'),'navigate','kein automatisches Setzen ohne offene Probe');
   assert.equal(await text(page,'#pk-hinweis-text'),'„Probe von Hand“ wählen, dann in den Plan tippen');assert.equal(await text(page,'#pk-w-setzen'),'Probe von Hand');
   assert.equal(await page.locator('#pk-import-gross').isVisible(),true,'Leer-Zustand: großer Knopf');
   await page.locator('#pk-w-setzen').click();assert.equal(await page.locator('#stage').getAttribute('data-mode'),'sample');
   assert.equal(await text(page,'#pk-hinweis-text'),'Nächste eigene Probe:');assert.equal(await page.locator('#next').isVisible(),true);assert.equal(await page.locator('#next-shape').isVisible(),true);
   await tap(page,300,300);await until(page,p=>p.markers.some(m=>m.label==='P1'),'P1 von Hand');
   await page.locator('#pk-pause').click();assert.equal(await page.locator('#stage').getAttribute('data-mode'),'navigate');
   await page.locator('#pk-w-brand').click();assert.equal(await page.locator('#pk-w-brand').getAttribute('aria-pressed'),'true');await tap(page,900,300);await until(page,p=>p.markers.some(m=>m.kind==='fire'),'Brandherd');
   await page.keyboard.press('Escape');await page.keyboard.press('v');assert.equal(await page.locator('#stage').getAttribute('data-mode'),'navigate','V = Pause');
  });
  await check(`${engine}: Proben übernehmen → ② setzt gleich die nächste (E5): „Als Nächstes setzen …“, Tipp setzt, Überspringen, Pause, Weiter setzen`,async()=>{
   await page.locator('#lab-files').setInputFiles([{name:'x_Daten.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lk))}]);await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
   assert.equal(await pk.aktuell(page),'2');await page.locator('#weiter-chip').waitFor();
   assert.equal(await text(page,'#weiter-text'),'Als Nächstes setzen: P11 · EG Flur · Wand · Ansicht · einfach in den Plan tippen');
   assert.equal(await page.locator('#stage').getAttribute('data-mode'),'lab-place','Platziermodus ist beim Öffnen schon an');
   assert.equal(await text(page,'#pk-kopf-zahl'),'0 gesetzt · 3 offen');assert.equal(await text(page,'#pk-w-setzen'),'Proben setzen');
   await tap(page,200,200);await until(page,p=>p.markers.some(m=>m.label==='P11'),'P11 gesetzt');
   await page.locator('#weiter-chip').waitFor();assert.match(await text(page,'#weiter-text'),/^Als Nächstes setzen: P13 · EG Flur/,'gleicher Raum zuerst');
   await page.locator('#weiter-skip').click();assert.match(await text(page,'#weiter-text'),/P12 · EG Küche/,'Überspringen');
   await page.locator('#weiter-done').click();assert.equal(await page.locator('#stage').getAttribute('data-mode'),'navigate');
   assert.match(await text(page,'#pk-hinweis-text'),/^Pause – nächste wäre P12 · EG Küche/);
   await page.locator('#pk-weiter-setzen').click();assert.match(await text(page,'#weiter-text'),/P12/);assert.equal(await page.locator('#stage').getAttribute('data-mode'),'lab-place');
  });
  await check(`${engine}: Tipp auf einen vorhandenen Punkt beim Setzen wählt ihn (6.1 a) – Karte „Probe P11“, Kennung schreibgeschützt (E12)`,async()=>{
   const vorher=(await savedProject(page)).markers.length;await tap(page,200,200);
   await page.locator('#inspector').waitFor();assert.equal(await text(page,'#pk-probe-titel'),'Probe P11');
   assert.equal(await page.locator('#label').evaluate(e=>e.readOnly),true,'Laborprobe: Kennung nur anzeigen');assert.equal(await page.locator('#pk-kennung-fest').isVisible(),true);
   await page.waitForTimeout(150);assert.equal((await savedProject(page)).markers.length,vorher,'keine Probe auf den Punkt gesetzt');
   assert.equal(await page.locator('#stage').getAttribute('data-mode'),'lab-place','Setzen läuft weiter');
   await page.locator('#pk-probe-zurueck').click();assert.equal(await page.locator('#inspector').isVisible(),false);
   await page.locator('#weiter-done').click();await pk.modus(page,'edit');await tap(page,300,300);await page.locator('#inspector').waitFor();
   assert.equal(await text(page,'#pk-probe-titel'),'Probe P1');assert.equal(await page.locator('#label').evaluate(e=>e.readOnly),false,'eigene Probe bleibt umbenennbar');
   await page.keyboard.press('Escape');
  });
  await check(`${engine}: Plan-Chips – zweiter Plan in ①, Wechsel oben rechts`,async()=>{
   await pk.schritt(page,1);const chooser=page.waitForEvent('filechooser');await page.locator('#sheet-add').click();await (await chooser).setFiles({name:'og.svg',mimeType:'image/svg+xml',buffer:svg});
   await page.locator('#pk-plaene [data-pk-sheet="1"]').waitFor();assert.equal(await page.locator('#pk-plaene [data-pk-sheet]').count(),2);
   assert.equal(await page.locator('#pk-plaene [data-pk-sheet="1"]').getAttribute('aria-pressed'),'true','neuer Plan ist aktiv');
   await page.locator('#pk-plaene [data-pk-sheet="0"]').click();assert.equal(await page.locator('#pk-plaene [data-pk-sheet="0"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#pk-plankarte .sheet').count(),2,'Planliste in ①');
  });
  await check(`${engine}: ③ Ausgabe – PDF A4 vorgewählt (ohne Ordner), Hinweis auf offene Proben, Hauptaktion folgt dem Format, „erledigt“ an den Datenstand gebunden`,async()=>{
   await page.locator('[data-pk-step="2"]').click();await page.locator('#pk-haupt').click();assert.equal(await pk.aktuell(page),'3');
   assert.equal(await page.locator('#format').inputValue(),'pdf-a4');assert.equal(await text(page,'#pk-haupt'),'PDF speichern →');
   assert.match(await text(page,'#pk-offen-warnung'),/^2 Proben noch nicht im Plan/);
   await page.locator('#format').selectOption('png');assert.equal(await text(page,'#pk-haupt'),'Bild speichern →');
   await page.locator('#format').selectOption('anlage');assert.equal(await text(page,'#pk-haupt'),'Anlage Probenahme speichern →');
   await page.locator('#format').selectOption('png');const d=page.waitForEvent('download');await page.locator('#pk-haupt').click();assert.match((await d).suggestedFilename(),/\.png$/);
   await page.locator('#pk-erledigt:not([hidden])').waitFor();assert.equal(await text(page,'#pk-haupt'),'Bild erneut speichern','ohne Projektordner kein „Weiter“ des Kopfbands');
   await page.locator('#report').fill('G-1');await page.locator('#report').blur();await page.waitForFunction(()=>document.getElementById('pk-erledigt').hidden);
   assert.equal(await text(page,'#pk-haupt'),'Bild speichern →','Änderung nach der Ausgabe: wieder „… speichern“');
   await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Escape');assert.equal(await page.locator('#export-dialog').evaluate(d=>d.open),true,'Esc schließt die Ausgabe in ③ nicht');
  });
  await check(`${engine}: Format bleibt gemerkt; Kürzel wechseln in ihren Schritt (C → ①, B → ②, F → Flächen); Flächen-Ansicht mit „Fertig“`,async()=>{
   await page.reload();await page.locator('#welcome').waitFor({state:'hidden'});assert.equal(await pk.aktuell(page),'2','Projekt mit Proben öffnet in ②');
   await pk.schritt(page,3);assert.equal(await page.locator('#format').inputValue(),'png','letzte Wahl je Browser');
   await page.keyboard.press('c');assert.equal(await pk.aktuell(page),'1');await page.locator('#crop-cancel').click();
   await page.keyboard.press('b');assert.equal(await pk.aktuell(page),'2');assert.equal(await page.locator('#stage').getAttribute('data-mode'),'fire');
   await page.keyboard.press('f');assert.equal(await pk.aktuell(page),'f');assert.equal(await page.locator('#stage').getAttribute('data-mode'),'area-draw');
   assert.equal(await page.locator('#pk-w-fzeichnen').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.areas-section').isVisible(),true);
   await page.locator('#pk-w-ffertig').click();assert.equal(await pk.aktuell(page),'2','Fertig: zurück');assert.equal(await page.locator('#stage').getAttribute('data-mode'),'lab-place','zurück in ②: die nächste offene Probe ist gleich dran');
  });
  await check(`${engine}: „Mehr …“ – „Nach jeder Probe gleich die nächste wählen“ schaltet um`,async()=>{
   await pk.mehr(page,'pk-m-weiter');assert.equal(await page.evaluate(()=>localStorage.getItem('plankit-weiter-platzieren')),'0');
   await page.locator('#pk-mehr').click();assert.match(await text(page,'#pk-m-weiter'),/^Nach jeder Probe/);await page.locator('#pk-m-weiter').click();
   assert.equal(await page.evaluate(()=>localStorage.getItem('plankit-weiter-platzieren')),'1');
   await pk.mehr(page,'pk-m-hilfe');assert.equal(await page.locator('#help-dialog').evaluate(d=>d.open),true);assert.match(await text(page,'#help-dialog ol'),/① Plan laden.*② Proben setzen.*③ Plan ausgeben/);
   await page.keyboard.press('Escape');
  });
  for(const [w,h] of [[1920,1080],[1280,800],[1024,768],[768,900],[390,844]]){
   await check(`${engine}: ${w} px – keine waagerechte Scrollleiste, Hauptaktion und „Mehr …“ erreichbar`,async()=>{
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(150);
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1,null,{timeout:3000}).catch(()=>assert.fail(`Überbreite bei ${w}px`));
    for(const sel of ['#pk-haupt','#pk-mehr','[data-pk-step="1"]','[data-pk-step="3"]']){await page.locator(sel).scrollIntoViewIfNeeded();const b=await page.locator(sel).boundingBox();assert.ok(b&&b.x>=0&&b.x+b.width<=w+1,`${sel} bei ${w}px`);}
   });
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
