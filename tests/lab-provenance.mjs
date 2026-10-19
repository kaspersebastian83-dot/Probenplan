import {chromium,webkit,savedProject,downloadedProject,openExport,closeExport} from './runtime.mjs';
import {labRows,labXML,labPDF} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const base=process.env.TEST_URL||'http://localhost:4173',checks=[];
async function check(name,fn){await fn();checks.push(name);console.log(`OK ${name}`);}
const out=resolve('.test-output/lab-provenance');await mkdir(out,{recursive:true});
for(const name of ['model','lab-provenance']){
 const code=ts.transpileModule(await readFile(`src/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from '\.\/([\w-]+)'/g,"from './$1.mjs'");
 await writeFile(resolve(out,`${name}.mjs`),code);
}
const model=await import(pathToFileURL(resolve(out,'model.mjs'))),origins=await import(pathToFileURL(resolve(out,'lab-provenance.mjs')));
const metadata={bericht:labRows[0].bericht,labor:'Eurofins',auftragsreferenz:'99.9001 Musterort',batch:'999-2099-000001',sources:{xml:'synthetic.xml'}};
const report={...metadata,quelle:'synthetic.xml',rows:labRows,results:[{result:'NEVER PERSIST RAW RESULTS'}]};
await check('Modell: isolierte Berichte, atomare Konflikte, Deep-Clone und Herkunft in Undo/Redo',()=>{
 const p=model.createProject({name:'synthetic.svg',width:600,height:800,data:'',vector:true});
 const a=origins.applyLabImport(p,report,new Map()),old=structuredClone(a),id=a.labReports[0].id;
 assert.equal(a.pending.length,9);assert.ok(a.pending.every(r=>r.reportId===id));assert.equal(p.labReports,undefined);
 const importedHistory=new model.History();importedHistory.push(p);const empty=importedHistory.undo(a);assert.deepEqual(empty,p);assert.deepEqual(importedHistory.redo(empty),a);
 assert.throws(()=>origins.applyLabImport(a,report,new Map()),/konflikt/i);assert.deepEqual(a,old);
 assert.strictEqual(origins.applyLabImport(a,report,new Map(labRows.map(r=>[r,'skip']))),a);
 const b=origins.applyLabImport(a,report,new Map(labRows.map(r=>[r,'next'])));assert.notEqual(b.labReports[1].id,id);assert.equal(b.pending[9].label,'P10');
 const clone=model.clone(a);clone.labReports[0].sources.xml='changed.xml';clone.labReports[0].labor='Other';clone.pending[0].reportId='other';assert.deepEqual(a,old);
 const history=new model.History();history.push(a);b.labReports[1].labor='Changed';const prev=history.undo(b);assert.deepEqual(prev,a);assert.deepEqual(history.redo(prev),b);
 assert.doesNotMatch(JSON.stringify(b),/NEVER PERSIST|results/);
});
await check('Modell: Herkunft validieren, Felder erlauben, Dateipfade und Rohdateien verwerfen',()=>{
 const r={id:'stable-report-id',...metadata};assert.ok(origins.validOrigin(r));assert.ok(origins.validOrigin({...r,bericht:'',batch:undefined,sources:{}}));
 for(const patch of [{id:''},{id:'bad/id'},{bericht:5},{labor:null},{auftragsreferenz:'x'.repeat(2001)},{batch:[]},{sources:[]},{sources:{xml:'C:\\private\\report.xml'}},{sources:{pdf:'/private/report.pdf'}},{sources:{xml:'../report.xml'}},{sources:{xml:''}},{sources:{pdf:'bad\u0000.pdf'}}])assert.equal(origins.validOrigin({...r,...patch}),false,JSON.stringify(patch));
 assert.equal(origins.sourceFilename('C:\\private\\report.xml'),'report.xml');assert.equal(origins.sourceFilename('/private/report.pdf'),'report.pdf');
 assert.deepEqual(origins.copyOrigin({...r,rawXML:'private',results:[1],sources:{xml:'synthetic.xml',rawPDF:'private'}}),r);
});

const file=(name,buffer)=>({name,mimeType:name.endsWith('.xml')?'application/xml':name.endsWith('.svg')?'image/svg+xml':'application/pdf',buffer:Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer)});
async function plan(page){await page.locator('#file').setInputFiles(file('synthetic.svg','<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="white"/></svg>'));await page.locator('#lab-panel').waitFor();return savedProject(page);}
async function review(page,files,meta={}){await page.locator('#lab-files').setInputFiles(files);await page.locator('#lab-review').waitFor();for(const [key,value] of Object.entries(meta))await page.locator(`[data-meta=${key}]`).fill(value);}
async function accept(page){assert.equal(await page.locator('#lab-confirm').isEnabled(),true);await page.locator('#lab-confirm').click();await page.locator('#lab-review').waitFor({state:'hidden'});return savedProject(page);}
async function placeFirst(page,x,y){await page.locator('[data-pending]').first().click();await page.locator('#drawing').scrollIntoViewIfNeeded();const q=await page.locator('#drawing').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},{x,y});await page.mouse.click(q.x,q.y);return savedProject(page);}
async function openProject(page,p,replace=false){await page.locator('#project-file').setInputFiles({name:'synthetic.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});if(replace)await page.locator('#replace-yes').click();await page.locator('#import-status').waitFor({state:'hidden'});return savedProject(page);}
async function jsonExport(page,id,edits={}){
 await page.locator('#lab-panel').getByText('Probenliste speichern',{exact:true}).click();
 if(id)await page.locator('#lab-report-select').selectOption(id);
 const values={};for(const key of ['bericht','labor','auftragsreferenz','quelle'])values[key]=await page.locator(`[data-summary=${key}]`).inputValue();
 for(const [key,value] of Object.entries(edits))await page.locator(`[data-summary=${key}]`).fill(value);
 await page.evaluate(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
 const d=page.waitForEvent('download');await page.locator('#lab-summary').getByText('Speichern',{exact:true}).click();
 const download=await d,json=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.deepEqual(Object.keys(json).sort(),['format','version','bericht','labor','auftragsreferenz','quelle','erstellt','proben'].sort());
 for(const row of json.proben)assert.deepEqual(Object.keys(row).sort(),['label','referenz','beschreibung','art','laborNr','datum'].sort());
 return {json,values};
}

for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  await check(`${engine}: ausschließlich Überspringen erhält Projekt, Undo/Redo und schreibt nicht in IndexedDB`,async()=>{
   const context=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true});
   try{
    const page=await context.newPage();await page.goto(base);const empty=await plan(page);
    const files=[file('noop.xml',labXML(labRows.slice(0,2)))];await review(page,files);const imported=await accept(page);
    await openExport(page);await page.locator('#report').fill('Synthetischer Redo-Schritt');await page.locator('#report').press('Tab');await closeExport(page);const edited=await savedProject(page);
    await page.locator('#undo').click();assert.deepEqual(await savedProject(page),imported);
    const skipAll=async()=>{
     const before=await savedProject(page),buttons={undo:await page.locator('#undo').isEnabled(),redo:await page.locator('#redo').isEnabled()};
     await page.evaluate(()=>{window.noopWrites=0;window.noopOriginalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='projects')window.noopWrites++;return window.noopOriginalPut.apply(this,args);};});
     try{
      await review(page,files);for(const row of await page.locator('[data-lab-row]').all())await row.locator('.lab-conflict select').selectOption('skip');await accept(page);
      assert.deepEqual(await savedProject(page),before);assert.equal(await page.evaluate(()=>window.noopWrites),0,'No-op darf keine Autosicherung auslösen');
      assert.deepEqual({undo:await page.locator('#undo').isEnabled(),redo:await page.locator('#redo').isEnabled()},buttons);
     }finally{await page.evaluate(()=>{IDBObjectStore.prototype.put=window.noopOriginalPut;delete window.noopOriginalPut;delete window.noopWrites;});}
    };
    await skipAll();
    // Check actual history contents, not just the state of the history buttons.
    await page.locator('#redo').click();assert.deepEqual(await savedProject(page),edited);
    await page.locator('#undo').click();assert.deepEqual(await savedProject(page),imported);
    await page.locator('#undo').click();assert.deepEqual(await savedProject(page),empty);assert.equal(await page.locator('#undo').isEnabled(),false);
    await page.locator('#redo').click();assert.deepEqual(await savedProject(page),imported);
    await page.locator('#redo').click();assert.deepEqual(await savedProject(page),edited);assert.equal(await page.locator('#redo').isEnabled(),false);
    await openProject(page,imported,true);assert.equal(await page.locator('#undo').isEnabled(),false);assert.equal(await page.locator('#redo').isEnabled(),false);
    await skipAll();assert.deepEqual(await downloadedProject(page),imported);
   }finally{await context.close();}
  });
  // Fresh contexts ensure no report objects, dialog state or IndexedDB survive a file roundtrip.
  for(const mode of ['xml','pdf','combined'])await check(`${engine}: ${mode}, P1–P9 mit drei platzierten Proben, Datei/Neustart/JSON ohne Nacherfassung`,async()=>{
   let context=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true}),page=await context.newPage();await page.goto(base);await plan(page);
   const files=mode==='xml'?[file('synthetic.xml',labXML())]:mode==='pdf'?[file('synthetic.pdf',labPDF({batch:metadata.batch}))]:[file('synthetic.xml',labXML()),file('synthetic.pdf',labPDF())];
   await review(page,files);await accept(page);for(let i=0;i<3;i++)await placeFirst(page,160+i*120,220+i*150);
   const saved=await downloadedProject(page),origin=saved.labReports[0];assert.equal(saved.version,4);assert.equal(saved.markers.length,3);assert.equal(saved.pending.length,6);
   assert.deepEqual(saved.markers.map(m=>m.label),['P1','P2','P3']);assert.deepEqual(saved.pending.map(r=>r.label),['P4','P5','P6','P7','P8','P9']);
   assert.ok([...saved.pending,...saved.markers.map(m=>m.lab)].every(r=>r.reportId===origin.id));
   assert.deepEqual(origin,{id:origin.id,bericht:metadata.bericht,labor:metadata.labor,auftragsreferenz:metadata.auftragsreferenz,batch:metadata.batch,sources:mode==='xml'?{xml:'synthetic.xml'}:mode==='pdf'?{pdf:'synthetic.pdf'}:{xml:'synthetic.xml',pdf:'synthetic.pdf'}});
   // Messwerte je Probe werden seit 1.7 bewusst gespeichert (Ergebniskarte); Rohdateien weiterhin nicht.
   assert.doesNotMatch(JSON.stringify(saved),/AnalyticalReportLine|%PDF|<AnalyticalReport|"loq"/);
   await context.close();context=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true});page=await context.newPage();await page.goto(base);assert.deepEqual(await openProject(page,saved),saved);
   await page.reload();await page.locator('[data-pending]').first().waitFor();assert.deepEqual(await savedProject(page),saved);
   const {json,values}=await jsonExport(page);assert.equal(values.labor,metadata.labor);assert.equal(values.auftragsreferenz,metadata.auftragsreferenz);assert.equal(values.quelle,origins.sourceText(origin.sources));
   assert.equal(json.bericht,metadata.bericht);assert.equal(json.proben.length,9);assert.deepEqual(json.proben.map(r=>r.label),labRows.map(r=>r.label));assert.equal(json.proben[8].beschreibung,labRows[8].desc);
   assert.deepEqual(await savedProject(page),saved);await context.close();
  });
  const context=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true}),page=await context.newPage();await page.goto(base);await plan(page);
  await check(`${engine}: vier getrennte Berichte bei gleicher/fehlender Nummer und gleicher Datei, eindeutiger JSON-Export`,async()=>{
   for(let i=0;i<4;i++){
    await review(page,[file('shared.xml',labXML(labRows.slice(0,i<2?2:1)))],{bericht:i<2?metadata.bericht:'',labor:`Synthetisches Labor ${i+1}`,auftragsreferenz:`99.90${String(i+1).padStart(2,'0')} Vollständige Referenz ${i+1}`});
    for(const row of await page.locator('[data-lab-row]').all()){const select=row.locator('.lab-conflict select');if(await select.count())await select.selectOption('next');}
    await accept(page);
   }
   const p=await downloadedProject(page);assert.equal(p.labReports.length,4);assert.equal(new Set(p.labReports.map(r=>r.id)).size,4);assert.equal(p.pending.length,6);
   await page.reload();await page.locator('[data-pending]').first().waitFor();
   for(const r of p.labReports){const {json}=await jsonExport(page,r.id);assert.equal(json.bericht,r.bericht);assert.equal(json.labor,r.labor);assert.equal(json.auftragsreferenz,r.auftragsreferenz);assert.deepEqual(json.proben.map(r=>r.label),p.pending.filter(row=>row.reportId===r.id).map(r=>r.label));}
   const selected=p.labReports[1],edited=await jsonExport(page,selected.id,{bericht:'Manuell korrigierte Nummer',quelle:'C:\\private\\manual.xml'});assert.equal(edited.json.bericht,'Manuell korrigierte Nummer');assert.equal(edited.json.quelle,'manual.xml');assert.equal(edited.json.proben.length,2);assert.deepEqual(await savedProject(page),p);
  });
  await check(`${engine}: Abbruch und Überspringen bewahren Zuordnungen, Ersetzen ist explizit und undo-fähig`,async()=>{
   const before=await savedProject(page);await review(page,[file('replacement.xml',labXML(labRows.slice(0,2)))]);
   assert.equal(await page.locator('#lab-confirm').isDisabled(),true);await page.locator('#lab-review').getByText('Abbrechen',{exact:true}).click();assert.deepEqual(await savedProject(page),before);
   await review(page,[file('replacement.xml',labXML(labRows.slice(0,2)))]);for(const row of await page.locator('[data-lab-row]').all())await row.locator('.lab-conflict select').selectOption('skip');await accept(page);assert.deepEqual(await savedProject(page),before);
   await review(page,[file('replacement.xml',labXML(labRows.slice(0,2)))]);await page.locator('[data-lab-row]').nth(0).locator('.lab-conflict select').selectOption('update');await page.locator('[data-lab-row]').nth(1).locator('.lab-conflict select').selectOption('skip');assert.match(await page.locator('#lab-warnings').textContent(),/Herkunft.*ersetzt/);
   const after=await accept(page);assert.notEqual(after.pending[0].reportId,before.pending[0].reportId);assert.equal(after.pending[1].reportId,before.pending[1].reportId);assert.deepEqual(after.labReports.slice(0,4),before.labReports);
   await page.locator('#undo').click();assert.deepEqual(await savedProject(page),before);await page.locator('#redo').click();assert.deepEqual(await savedProject(page),after);
  });
  await check(`${engine}: platzierte Probe ersetzen/umnummerieren, History und Herkunftsexport bleiben konsistent`,async()=>{
   await placeFirst(page,210,310);const before=await savedProject(page),m=before.markers[0];
   await review(page,[file('placed.xml',labXML(labRows.slice(0,1)))]);await page.locator('[data-lab-row]').first().locator('.lab-conflict select').selectOption('update');const after=await accept(page);
   assert.notEqual(after.markers[0].lab.reportId,m.lab.reportId);for(const k of ['id','x','y','lx','ly','label','kind'])assert.equal(after.markers[0][k],m[k]);
   await page.locator('#undo').click();assert.deepEqual(await savedProject(page),before);await page.locator('#redo').click();assert.deepEqual(await savedProject(page),after);
   await page.locator('[data-select]').first().click();await page.locator('#label').fill('P20');await page.locator('#label').press('Tab');const numbered=await savedProject(page);assert.equal(numbered.markers[0].lab.reportId,after.markers[0].lab.reportId);
   await page.locator('#undo').click();assert.deepEqual(await savedProject(page),after);await page.locator('#redo').click();assert.deepEqual(await savedProject(page),numbered);
   const {json}=await jsonExport(page,numbered.markers[0].lab.reportId);assert.deepEqual(json.proben.map(r=>r.label),['P20']);
  });
  await check(`${engine}: ungültige/fehlende/doppelte Herkunft abweisen; bisheriges Projekt bleibt erhalten`,async()=>{
   const current=await savedProject(page),cases=[];
   for(const mutate of [p=>delete p.labReports,p=>p.labReports.push({...p.labReports[0]}),p=>p.labReports[0].id='bad/id',p=>p.labReports[0].labor=null,p=>delete p.labReports[0].labor,p=>p.labReports[0].batch=5,p=>p.labReports[0].sources=null,p=>p.labReports[0].sources.xml='C:\\secret\\source.xml',p=>p.pending[0].reportId='unknown',p=>p.pending[0].reportId=7,p=>p.markers[0].lab.reportId='unknown',p=>p.markers[0].lab.bericht='wrong',p=>p.labReports={}]){const p=structuredClone(current);mutate(p);cases.push(p);}
   for(const p of cases){await page.locator('#project-file').setInputFiles({name:'invalid.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await page.locator('#toast.error').waitFor();await page.locator('#import-status').waitFor({state:'hidden'});assert.deepEqual(await savedProject(page),current);}
   // Unknown fields are never retained as raw lab files, analyses or paths.
   const extra=structuredClone(current);extra.labReports[0].rawXML='<PRIVATE>';extra.labReports[0].sources.rawPDF='%PDF';extra.pending[0].rawResults=['PRIVATE'];extra.markers[0].lab.rawXML='PRIVATE';
   assert.deepEqual(await openProject(page,extra,true),current);
  });
  await check(`${engine}: ältere Formate 1–4 und alte Laborproben ohne Herkunft weiterhin lesbar`,async()=>{
   const current=await savedProject(page);
   for(const version of [1,2,3,4]){const p={...current,version,markers:[]};delete p.labReports;delete p.pending;delete p.areas;delete p.nextArea;if(version===3){p.areas=[];p.nextArea=1;}assert.deepEqual(await openProject(page,p,true),p);}
   const legacy=structuredClone(current);delete legacy.labReports;legacy.pending.forEach(r=>delete r.reportId);legacy.markers.forEach(m=>delete m.lab.reportId);assert.deepEqual(await openProject(page,legacy,true),legacy);
   await page.locator('#lab-panel').getByText('Probenliste speichern',{exact:true}).click();assert.equal(await page.locator('[data-summary=labor]').inputValue(),'');await page.locator('#lab-summary').getByText('Abbrechen',{exact:true}).click();
  });
  await check(`${engine}: widersprüchliches XML/PDF-Paar verworfen; Abbruch legt keine Herkunft an`,async()=>{
   const before=await savedProject(page);
   for(const [xml,pdf,message] of [[labXML().replaceAll(metadata.bericht,'AR-999-2099-DIFFERENT'),labPDF(),'unterschiedlichen Berichten'],[labXML().replaceAll(metadata.auftragsreferenz,'99.9999 Anderer Auftrag'),labPDF(),'unterschiedliche Auftragsreferenzen'],[labXML(),labPDF({batch:'OTHER-BATCH'}),'unterschiedliche Batchkennungen']]){await page.locator('#lab-files').setInputFiles([file('different.xml',xml),file('synthetic.pdf',pdf)]);await page.locator('#toast.error').filter({hasText:message}).waitFor();assert.deepEqual(await savedProject(page),before);assert.equal(await page.locator('#lab-review').isVisible(),false);}
   await review(page,[file('cancel.xml',labXML())]);await page.locator('[data-meta=labor]').fill('Nur im abgebrochenen Dialog');await page.locator('#lab-review').press('Escape');assert.deepEqual(await savedProject(page),before);
  });
  await context.close();
 }finally{await browser.close();}
}
await writeFile(resolve(out,'results.json'),JSON.stringify({checks},null,2));console.log(`${checks.length} Herkunfts-Prüfgruppen erfolgreich.`);
