// Beschriftung (ab 1.19): Schilder automatisch platzieren und Messwerte am Plan – beides je Plan schaltbar.
// Probenstelle bleibt exakt, nur das Schild weicht aus; berechnete Positionen werden nie gespeichert; von Hand gezogene
// Schilder bleiben; „Schilder neu anordnen“; Wertkästchen in der Ergebniskarte; Einstellungen im Projekt und Validierung.
import {chromium,webkit,savedProject,downloadedProject} from './runtime.mjs';
import {labRows,labXML} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const SUM='Summe 16 EPA-PAK exkl. BG',UNIT='µg/100 cm²',KEY=`${SUM}|${UNIT}`;
const fotokit={[KEY]:{name:'PAK',cats:[{name:'gering',from:0},{name:'mittel',from:5},{name:'hoch',from:50}],geaendert:'2026-10-01T00:00:00Z'}};
const W=1200,H=800;
// Raumname mitten im Plan: Schilder sollen ihn nicht überdecken.
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/><rect x="20" y="20" width="${W-40}" height="${H-40}" fill="none" stroke="#222" stroke-width="8"/><text x="600" y="410" font-family="Arial" font-size="60" text-anchor="middle" fill="#222">KÜCHE</text></svg>`;
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
/** Angezeigte Schilder: Mitte des Schilds, Probenstelle, Hinweislinie vorhanden. */
const badges=page=>page.locator('#marks').evaluate(g=>[...g.querySelectorAll(':scope > [data-id]')].map(m=>{const t=m.querySelector('text'),lab=m.querySelector('g[data-drag="label"]')||[...m.querySelectorAll(':scope > g[data-drag]')].pop();
  // sichtbare Teile des Schilds (ohne transparente Trefferfläche)
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const e of lab.querySelectorAll('ellipse,rect,path')){if(e.getAttribute('fill')==='transparent')continue;const b=e.getBBox();x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.x+b.width);y1=Math.max(y1,b.y+b.height);}
  return {label:t?.textContent||'',cx:(x0+x1)/2,cy:(y0+y1)/2,w:x1-x0,h:y1-y0,leader:!!m.querySelector(':scope > path')};}));
const overlaps=list=>{const out=[];for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];if(Math.abs(a.cx-b.cx)<(a.w+b.w)/2-1&&Math.abs(a.cy-b.cy)<(a.h+b.h)/2-1)out.push(`${a.label}/${b.label}`);}return out;};
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  await context.addInitScript(s=>{if(!localStorage.getItem('bu-scales'))localStorage.setItem('bu-scales',JSON.stringify(s));},fotokit);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('#file').setInputFiles({name:'eg.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await page.locator('#welcome').waitFor({state:'hidden'});
  if(await page.locator('#panel-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#panel-toggle').click();
  // Vier Proben eng beieinander auf dem Raumnamen, eine allein in freier Fläche
  // Beim Setzen ohne Automatik, damit kein bereits versetztes Schild an der nächsten Tippstelle liegt
  await page.locator('#auto-labels').uncheck();await page.evaluate(()=>document.activeElement?.blur());
  await page.keyboard.press('p');for(const [fx,fy] of [[.455,.5],[.5,.5],[.545,.5],[.5,.56],[.15,.2]])await tap(page,fx,fy);await page.keyboard.press('v');
  await page.locator('#auto-labels').check();
  await page.waitForTimeout(600);   // Tinte des Plans wird geladen, danach neu platziert

  await check(`${engine}: Standard an – Schilder überlappen nicht, freie Probe bleibt am Punkt, Gedränge mit Hinweislinien`,async()=>{
   assert.equal(await page.locator('#auto-labels').isChecked(),true);
   const b=await badges(page);assert.equal(b.length,5);assert.deepEqual(overlaps(b),[]);
   assert.equal(b.find(x=>x.label==='P5').leader,false,'P5 steht frei: Schild am Punkt');
   assert.ok(b.filter(x=>['P1','P2','P3','P4'].includes(x.label)&&x.leader).length>=3,'Gedränge auf dem Raumnamen: Schilder mit Hinweislinie');
  });
  await check(`${engine}: berechnete Positionen werden nicht gespeichert`,async()=>{
   const s=await savedProject(page);assert.equal(s.plan.autoLabels,undefined);assert.equal(s.plan.valueLabels,undefined);
   for(const m of s.markers){assert.equal(m.lx,m.x);assert.equal(m.ly,m.y);}
  });
  await check(`${engine}: ausschalten – Schilder wieder am Punkt, im Plan gespeichert, rückgängig machbar`,async()=>{
   await page.locator('#auto-labels').uncheck();const b=await badges(page);assert.equal(b.filter(x=>x.leader).length,0);
   assert.equal((await savedProject(page)).plan.autoLabels,false);
   await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Control+z');assert.equal(await page.locator('#auto-labels').isChecked(),true);
   assert.equal((await savedProject(page)).plan.autoLabels,undefined);
  });
  await check(`${engine}: automatisch versetztes Schild ziehen – startet an der angezeigten Stelle und bleibt danach fest`,async()=>{
   await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('e');const before=(await badges(page)).find(x=>x.label==='P2'&&x.leader)||(await badges(page)).find(x=>x.leader);
   const label=before.label,box=await page.locator('#marks [data-id]').filter({has:page.locator(`text="${label}"`)}).locator('g[data-drag="label"]').first().boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+5,{steps:4});await page.mouse.up();
   const after=(await badges(page)).find(x=>x.label===label),k=await page.locator('#drawing').evaluate(e=>e.getScreenCTM().a);
   assert.ok(Math.abs((after.cx-before.cx)*k-30)<4,`Schild sprang: ${before.cx} → ${after.cx}`);
   const s=await savedProject(page),m=s.markers.find(x=>x.label===label);assert.ok(Math.hypot(m.lx-m.x,m.ly-m.y)>1,'von Hand versetzt = gespeichert');
   assert.match(await page.locator('#labels-reset').textContent(),/1 von Hand/);
   await page.locator('#labels-reset').click();
   const s2=await savedProject(page);for(const m of s2.markers){assert.equal(m.lx,m.x);assert.equal(m.ly,m.y);}
   assert.equal(await page.locator('#labels-reset').isDisabled(),true);
  });
  await check(`${engine}: Messwerte am Plan – Wertkästchen in der Ergebniskarte, ein-/ausschaltbar, auch im Export`,async()=>{
   const values=['< 0,50','3,2','45','1.300,0'],rows=labRows.slice(0,4).map((r,i)=>({...r,lines:[{p:SUM,r:values[i],u:UNIT}]}));
   // frisches Projekt: Laborproben P1–P4 ohne Kennungskonflikt
   await page.locator('#file').setInputFiles({name:'og.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await page.locator('#replace-yes').click().catch(()=>{});await page.locator('#welcome').waitFor({state:'hidden'});
   await page.locator('#lab-files').setInputFiles([{name:'bericht.xml',mimeType:'application/xml',buffer:Buffer.from(labXML(rows))}]);await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
   await page.evaluate(()=>document.activeElement?.blur());
   for(const [fx,fy] of [[.7,.3],[.75,.3],[.3,.7],[.85,.75]]){await page.locator('[data-pending]').first().click();await tap(page,fx,fy);}
   await page.keyboard.press('Escape');await page.keyboard.press('v');
   await page.locator('#value-labels').check();assert.equal((await savedProject(page)).plan.valueLabels,true);
   assert.equal(await page.locator('#results-toggle').getAttribute('aria-pressed'),'true','Ergebniskarte schaltet sich mit Messwerten selbst ein');await page.locator('#results-toggle').click();
   assert.equal(await page.locator('#marks text',{hasText:'1.300,0'}).count(),0,'ohne Ergebniskarte keine Wertkästchen');
   await page.locator('#results-toggle').click();
   await page.locator('#marks text',{hasText:'1.300,0'}).first().waitFor();
   const text=await page.locator('#marks').textContent();for(const t of ['< 0,50','3,2','45','1.300,0','µg/100 cm²','hoch','mittel','gering'])assert.ok(text.includes(t),t);
   const b=await badges(page);assert.deepEqual(overlaps(b),[]);
   // Exportkarte: gleicher Schalter
   await page.locator('#export-open').click();await page.locator('#export').waitFor();await page.locator('#view').selectOption('results');
   assert.equal(await page.locator('#values-field').isVisible(),true);assert.equal(await page.locator('#values-export').isChecked(),true);
   const dl=page.waitForEvent('download');await page.locator('#export').click();const d=await dl;assert.match(d.suggestedFilename(),/Ergebniskarte/);
   await page.locator('#values-export').uncheck();assert.equal(await page.locator('#value-labels').isChecked(),false);assert.equal(await page.locator('#marks text',{hasText:'1.300,0'}).count(),0);
   await page.locator('#export-dialog .close').click();
   await page.locator('#value-labels').check();
  });
  await check(`${engine}: Einstellungen in der Projektdatei, unbekannte Werte werden abgewiesen`,async()=>{
   await page.locator('#auto-labels').uncheck();const file=await downloadedProject(page);assert.equal(file.plan.autoLabels,false);assert.equal(file.plan.valueLabels,true);
   await page.locator('#project-file').setInputFiles({name:'x.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.locator('#replace-yes').click();
   await page.locator('#welcome').waitFor({state:'hidden'});assert.equal(await page.locator('#auto-labels').isChecked(),false);assert.equal(await page.locator('#value-labels').isChecked(),true);
   const bad=structuredClone(file);bad.plan.valueLabels='ja';
   await page.locator('#project-file').setInputFiles({name:'bad.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
   await page.locator('#toast.error',{hasText:'Beschriftung'}).waitFor();
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
