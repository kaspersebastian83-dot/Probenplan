// Maßstäbliches PDF (A4/A3): Kalibrierung per Strecke, Nordpfeil, Schriftfeld, exakter Maßstab auf dem Blatt, mehrere Pläne.
import {chromium,webkit,savedProject,downloadedProject,openExport,closeExport} from './runtime.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
// Testplan: Rahmen bei 40 Einheiten, senkrechte Linien bei x=1000 und x=3000 (2000 Einheiten Abstand).
const plan=(w,h,label,lines=true)=>({name:`${label}.svg`,mimeType:'image/svg+xml',buffer:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="white"/><path d="M40 40H${w-40}V${h-40}H40Z" fill="none" stroke="black" stroke-width="20"/>${lines?`<path d="M1000 300V${h-300}M3000 300V${h-300}" stroke="black" stroke-width="6"/>`:''}</svg>`)});
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
/** Minimaler Leser für PlanKits eigene PDFs: Seitengröße in mm und das Seitenbild als RGB. */
function readPdf(buffer){
 const text=buffer.toString('latin1');assert.match(text,/^%PDF-1\.4/);assert.match(text,/%%EOF\s*$/);
 const xref=Number(/startxref\n(\d+)\n%%EOF/.exec(text)[1]);assert.equal(text.slice(xref,xref+4),'xref','startxref zeigt auf die xref-Tabelle');
 // Jeder xref-Eintrag zeigt auf den Anfang seines Objekts.
 const entries=[...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map(m=>Number(m[1]));entries.forEach((off,i)=>assert.ok(text.startsWith(`${i+1} 0 obj`,off),`xref ${i+1}`));
 const pages=[];
 for(const m of text.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\][^\n]*\/Im0 (\d+) 0 R/g)){
  const id=Number(m[3]),start=entries[id-1],head=/\/Width (\d+) \/Height (\d+).*?\/Length (\d+) >>\nstream\n/s.exec(text.slice(start));
  const at=start+head.index+head[0].length,raw=inflateSync(buffer.subarray(at,at+Number(head[3])));
  const width=Number(head[1]),height=Number(head[2]);assert.equal(raw.length,width*height*3);
  pages.push({mmW:Number(m[1])*25.4/72,mmH:Number(m[2])*25.4/72,width,height,raw});
 }
 return pages;
}
/** Mittelpunkte dunkler Strecken in einer Bildzeile, in mm. */
function darkRuns(pg,yMm){const k=pg.width/pg.mmW,y=Math.round(yMm*k),runs=[];for(let x=0;x<pg.width;x++){const i=(y*pg.width+x)*3;if(pg.raw[i]<170&&pg.raw[i+1]<170){if(runs.length&&x-runs.at(-1).at(-1)<=1)runs.at(-1).push(x);else runs.push([x]);}}return runs.map(r=>(r[0]+r.at(-1))/2/k);}
/** Abstand zwischen den beiden Testlinien (die Linien liegen zwischen den Rahmenlinien des Plans). */
function lineGap(pg){for(let y=pg.mmH*.3;y<pg.mmH*.75;y+=1.3){const runs=darkRuns(pg,y);for(let i=0;i+3<runs.length;i++){const [a,b,c,d]=runs.slice(i,i+4),u=(d-a)/3920;if(u>0&&Math.abs((b-a)-960*u)<.6&&Math.abs((c-b)-2000*u)<.6)return c-b;}}return null;}
// PDF_DUMP=<Ordner> legt die erzeugten PDFs zur Sichtprüfung ab.
let dumped=0;
// Bleibt der Download aus, nennt der Fehler, was die App angezeigt hat (Meldung, Schaltfläche, Browserfehler).
async function pdfExport(page){
 // Diagnose: Klickziel, angekommene Klicks und Starttext der Schaltfläche mitschreiben.
 await page.evaluate(()=>{const b=document.getElementById('export');window.__diag={clicks:0,texts:[],hit:''};b.addEventListener('click',()=>window.__diag.clicks++);new MutationObserver(()=>window.__diag.texts.push(b.textContent)).observe(b,{childList:true,characterData:true,subtree:true});const r=b.getBoundingClientRect(),el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);window.__diag.hit=el?(el.id||el.tagName+'.'+el.className):'none';window.__diag.rect=[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height),innerWidth,innerHeight];});
 const started=Date.now(),pending=page.waitForEvent('download',{timeout:60000}).catch(e=>e);await page.locator('#export').click();let dl=await pending;
 if(dl instanceof Error){const first=await page.evaluate(()=>window.__diag);const retry=page.waitForEvent('download',{timeout:60000}).catch(e=>e);await page.locator('#export').evaluate(b=>b.click());const second=await retry;
  throw Error(`Kein PDF-Download nach Klick (${Math.round((Date.now()-started)/1000)} s). Diagnose: ${JSON.stringify(first)} · programmatischer Klick ${second instanceof Error?'ebenfalls ohne Download':'lädt herunter'} · danach ${JSON.stringify(await page.evaluate(()=>({diag:window.__diag,toast:document.getElementById('toast')?.textContent})))}`);}
 if(dl instanceof Error){const state=await page.evaluate(()=>({toast:document.getElementById('toast')?.textContent,toastError:document.getElementById('toast')?.className,button:document.getElementById('export')?.textContent,disabled:document.getElementById('export')?.disabled,ua:navigator.userAgent.slice(-40),result:!document.getElementById('export-result')?.hidden})).catch(e=>({evaluate:String(e)}));throw Error(`Kein PDF-Download nach ${Math.round((Date.now()-started)/1000)} s: ${JSON.stringify(state)} · Konsole: ${JSON.stringify(page.__log||[])}`);}
 if(Date.now()-started>25000)console.log(`Hinweis: PDF-Export dauerte ${Math.round((Date.now()-started)/1000)} s`);if(process.env.PDF_DUMP)await dl.saveAs(`${process.env.PDF_DUMP}/${++dumped}-${dl.suggestedFilename()}`);return {name:dl.suggestedFilename(),pages:readPdf(await readFile(await dl.path()))};}

for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.__log=[];page.on('console',m=>{if(['error','warning'].includes(m.type()))page.__log.push(`${m.type()}: ${m.text()}`.slice(0,300));});page.on('pageerror',e=>page.__log.push(`pageerror: ${e.message}`.slice(0,300)));
  await page.goto(base);
  await page.locator('#file').setInputFiles(plan(4000,3000,'EG'));await page.locator('#welcome').waitFor({state:'hidden'});
  await page.keyboard.press('p');await tap(page,.3,.4);await page.keyboard.press('v');
  if(await page.locator('#panel-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#panel-toggle').click();
  await check(`${engine}: ohne Kalibrierung zeigt die Liste den Hinweis, PDF bleibt möglich`,async()=>{
   assert.match(await page.locator('#scale-status').textContent(),/Nicht kalibriert/);assert.equal(await page.locator('#scale-clear').isHidden(),true);
   await openExport(page);await page.locator('#report').fill('26.0142');await page.locator('#format').selectOption('pdf-a4');
   assert.equal(await page.locator('#quality-field').isHidden(),true);assert.match(await page.locator('#export').textContent(),/PDF/);assert.match(await page.locator('#dimensions').textContent(),/A4 quer · ohne Maßstab/);
   const {name,pages}=await pdfExport(page);assert.equal(name,'26.0142.pdf');assert.equal(pages.length,1);assert.ok(Math.abs(pages[0].mmW-297)<.05&&Math.abs(pages[0].mmH-210)<.05);
   assert.match(await page.locator('#toast').textContent(),/Ohne Maßstab/);await closeExport(page);
  });
  await check(`${engine}: Messen – Esc bricht ab, ungültige Länge wird abgewiesen, gültige setzt den Maßstab`,async()=>{
   await page.locator('#measure-start').click();assert.match(await page.locator('#mode-hint').textContent(),/ersten Punkt/);await tap(page,.25,.5);await page.keyboard.press('Escape');assert.match(await page.locator('#mode-hint').textContent(),/Ansicht bewegen/);
   assert.equal(await page.locator('#measure-layer circle').count(),0);
   await page.locator('#measure-start').click();await tap(page,.25,.5);assert.match(await page.locator('#mode-hint').textContent(),/zweiten Punkt/);await tap(page,.75,.5);
   await page.locator('#measure-dialog').waitFor();await page.locator('#measure-length').fill('zehn');await page.locator('#measure-ok').click();
   assert.equal(await page.locator('#measure-error').isVisible(),true);assert.equal(await page.locator('#measure-dialog').evaluate(d=>d.open),true);
   await page.locator('#measure-length').fill('10,0');await page.locator('#measure-ok').click();await page.locator('#measure-dialog').waitFor({state:'hidden'});
   await page.locator('#scale-status',{hasText:'Gemessen: 10 m'}).waitFor();assert.match(await page.locator('#scale-status').textContent(),/20 × 15 m/);
   const saved=await savedProject(page);assert.equal(saved.plan.calibration.meters,10);assert.ok(Math.abs(saved.plan.calibration.units-2000)<1);
  });
  await check(`${engine}: erneutes Messen zeigt die Länge nach bisherigem Maßstab; Abbrechen ändert nichts`,async()=>{
   await page.locator('#measure-start').click();await tap(page,.25,.3);await tap(page,.5,.3);await page.locator('#measure-dialog').waitFor();
   assert.equal(await page.locator('#measure-length').inputValue(),'5');await page.locator('#measure-cancel').click();await page.keyboard.press('Escape');
   assert.equal((await savedProject(page)).plan.calibration.meters,10);
  });
  await check(`${engine}: Nordpfeil je Plan, Drehen dreht den Pfeil mit, Rückgängig`,async()=>{
   await page.locator('#north-on').check();assert.equal(await page.locator('#north-controls').isVisible(),true);await page.locator('#north-right').click();await page.locator('#north-right').click();
   assert.equal((await savedProject(page)).plan.north,30);await page.locator('#north-angle').fill('400');await page.locator('#north-angle').press('Enter');assert.equal((await savedProject(page)).plan.north,40);
   await page.locator('#north-angle').fill('30');await page.locator('#north-angle').press('Enter');
   await page.locator('#rotate-right').click();assert.equal((await savedProject(page)).plan.north,120);await page.keyboard.press('Control+z');assert.equal((await savedProject(page)).plan.north,30);
  });
  await check(`${engine}: A4 wählt 1:200, A3 1:100 – Strecken auf dem Blatt stimmen auf 0,2 mm`,async()=>{
   await openExport(page);await page.locator('#format').selectOption('pdf-a4');assert.match(await page.locator('#dimensions').textContent(),/A4 quer · M 1:200/);assert.match(await page.locator('#dimensions-note').textContent(),/Nordpfeil/);
   let {pages}=await pdfExport(page);assert.equal(pages[0].width,3508);let gap=lineGap(pages[0]);assert.ok(gap&&Math.abs(gap-50)<.2,`A4: 10 m bei 1:200 = 50 mm, gemessen ${gap}`);
   await page.locator('#format').selectOption('pdf-a3');assert.match(await page.locator('#dimensions').textContent(),/A3 quer · M 1:100/);
   ({pages}=await pdfExport(page));assert.ok(Math.abs(pages[0].mmW-420)<.05&&Math.abs(pages[0].mmH-297)<.05);gap=lineGap(pages[0]);assert.ok(gap&&Math.abs(gap-100)<.2,`A3: 10 m bei 1:100 = 100 mm, gemessen ${gap}`);
   await closeExport(page);
  });
  await check(`${engine}: Maßstab und Norden überstehen Speichern/Öffnen; ungültige Werte werden abgewiesen`,async()=>{
   const file=await downloadedProject(page);assert.equal(file.plan.calibration.meters,10);assert.equal(file.plan.north,30);
   for(const [field,value] of [['calibration',{units:0,meters:5}],['calibration',{units:100,meters:-1}],['calibration','x'],['north',360],['north','N']]){
    const bad=structuredClone(file);bad.plan[field]=value;
    await page.locator('#project-file').setInputFiles({name:'bad.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.locator('#toast.error').waitFor();assert.match(await page.locator('#toast').textContent(),/Maßstab|Nordrichtung/,`${field}=${JSON.stringify(value)}`);await page.locator('#toast').evaluate(t=>{t.hidden=true;t.className='';});
   }
   const old=structuredClone(file);delete old.plan.calibration;delete old.plan.north;
   await page.locator('#project-file').setInputFiles({name:'old.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await page.locator('#replace-yes').click().catch(()=>{});await page.locator('#scale-status',{hasText:'Nicht kalibriert'}).waitFor();
   await page.locator('#project-file').setInputFiles({name:'ok.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click().catch(()=>{});await page.locator('#scale-status',{hasText:'Gemessen: 10 m'}).waitFor();
   assert.equal(await page.locator('#north-on').isChecked(),true);
  });
  await check(`${engine}: hoher Plan → Hochformat; Flächenlegende; „Alle Pläne“ = ein PDF mit einem Blatt je Plan`,async()=>{
   await page.locator('#sheet-add').click();await page.locator('#sheet-file').setInputFiles(plan(4000,9000,'OG'));await page.locator('#sheet-ok').click().catch(()=>{});await page.waitForTimeout(500);
   await page.locator('#measure-start').click();await tap(page,.25,.5);await tap(page,.75,.5);await page.locator('#measure-length').fill('10');await page.locator('#measure-ok').click();await page.locator('#scale-status',{hasText:'Gemessen'}).waitFor();
   // Fläche über eine Projektdatei ergänzen (Zeichnen ist in areas.mjs getestet).
   const file=await downloadedProject(page),og=file.plan;assert.equal(og.calibration.meters,10);
   file.version=5;file.areas=[{id:'area-1',label:'F1',name:'Rußbelag auf Wandflächen',color:'#d34c42',opacity:.3,points:[{x:500,y:500},{x:2000,y:500},{x:2000,y:2500},{x:500,y:2500}]}];file.nextArea=2;
   await page.locator('#project-file').setInputFiles({name:'f.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click().catch(()=>{});await page.waitForTimeout(800);
   await openExport(page);await page.locator('#format').selectOption('pdf-a4');assert.match(await page.locator('#dimensions').textContent(),/A4 hoch · M 1:250/);
   let {pages}=await pdfExport(page);assert.ok(Math.abs(pages[0].mmW-210)<.05&&Math.abs(pages[0].mmH-297)<.05,'Hochformat');let gap=lineGap(pages[0]);assert.ok(gap&&Math.abs(gap-40)<.2,`1:250 → 40 mm, gemessen ${gap}`);
   await page.locator('#scope').selectOption('all');assert.match(await page.locator('#dimensions-note').textContent(),/eigenen Maßstab/);
   const all=await pdfExport(page);assert.equal(all.pages.length,2);assert.equal(all.name,'26.0142.pdf');
   const sizes=all.pages.map(p=>`${Math.round(p.mmW)}x${Math.round(p.mmH)}`).sort();assert.deepEqual(sizes,['210x297','297x210']);
   await closeExport(page);
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
