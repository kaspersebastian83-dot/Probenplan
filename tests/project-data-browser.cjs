// Real app UI, exports and independent delayed reads over a synthetic in-memory filesystem.
// The same test runs in both repositories, fully in Chromium and WebKit (no FSA skips).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),plan=fs.existsSync(path.join(root,'src/main.ts')),engine=process.argv[2]||'chromium';
const pw=plan?require('@playwright/test'):require('playwright');
const names={A:'26.0101 Muster A',B:'26.0999 Muster B',C:'26.0707 Neues Projekt'};
const pj=(objekt)=>JSON.stringify({format:'mosaik-projekt',version:1,objekt,auftraggeber:'AG '+objekt,ortstermin:'2026-10-21'});
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect x="1" y="1" width="298" height="198" fill="white" stroke="black"/></svg>';
let browser,server;
(async()=>{
 let url=process.env.TEST_URL;
 if(!url){const dir=plan?path.join(root,'dist'):root;server=http.createServer((req,res)=>{
   const file=path.resolve(dir,new URL(req.url,'http://x').pathname.replace(/^\/+/, '')||'index.html');
   if(!file.startsWith(dir+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.statusCode=404;return res.end();}
   res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;}
 browser=await pw[engine].launch();let count=0;
 async function scenario(title,run){
  const context=await browser.newContext({viewport:{width:1500,height:1100},acceptDownloads:true,serviceWorkers:'block'});
  const files=new Map(),dirs=new Set(['']),faults={},writes=[],errors=[],confirmations=[];let hold=null;
  const bytes=s=>Array.from(Buffer.from(s));
  for(const [key,name]of Object.entries(names)){
   dirs.add(name);dirs.add(name+'/Laboraufträge');dirs.add(name+'/Pläne');
   if(key!=='C')files.set(name+'/_Projekt.json',bytes(pj(key==='A'?'ALT':'B aktuell')));
   const project={format:'probenplan',version:1,plan:{name:'Test.svg',width:300,height:200,vector:true,data:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),calibration:{units:100,meters:10}},
    markers:[{id:'synthetisch',kind:'sample',label:'P1',x:80,y:70,lx:80,ly:70,note:'Test'}],nextSample:2,nextFire:1,report:name,date:'2026-10-21'};
   files.set(name+'/Pläne/Probenplan '+name+'.probenplan',bytes(JSON.stringify(project)));
  }
  try{
   await context.exposeBinding('__f7io',async(_,a)=>{
    const rel=a.rel||'',project=rel.split('/')[0],fault=faults[project]||{},isPJ=rel.endsWith('/_Projekt.json');
    const error=name=>({error:name});
    if(rel.startsWith('/')||rel.split('/').some(p=>p==='..'))throw Error('outside synthetic filesystem');
    switch(a.op){
     case'permission':return a.mode==='read'&&fault.permission?'denied':'granted';
     case'request':if(fault.grant){delete fault.permission;return 'granted';}return 'denied';
     case'file':if(!files.has(rel)){if(!a.create)return error('NotFoundError');files.set(rel,[]);writes.push(rel);}return true;
     case'dir':if(!dirs.has(rel)){if(!a.create)return error('NotFoundError');dirs.add(rel);}return true;
     case'read':{
      const value=files.get(rel);if(!value)return error('NotFoundError');
      if(isPJ&&hold&&hold.project===project&&!hold.started){hold.started=true;hold.arrived();await hold.wait;}
      else if(isPJ&&fault.name)return error(fault.name);
      return {bytes:value,modified:1234567890000};
     }
     case'write':files.set(rel,a.bytes);writes.push(rel);return true;
     case'list':{
      if(fault.list&&rel===project)return error('NetworkError');
      const prefix=rel?rel+'/':'';return [...new Set([...dirs,...files.keys()])].filter(p=>p.startsWith(prefix)&&p!==rel&&!p.slice(prefix.length).includes('/')).map(p=>({name:p.slice(prefix.length),kind:dirs.has(p)?'directory':'file'}));
     }
     case'remove':files.delete(rel);dirs.delete(rel);return true;
    }
   });
   await context.addInitScript(({names})=>{
    localStorage.setItem('willkommen-gelesen','1');localStorage.setItem('plankit:panel','open');
    const io=async a=>{const r=await window.__f7io(a);if(r&&r.error)throw new DOMException('Synthetischer Dateifehler',r.error);return r;};
    class Dir{
     constructor(rel){this.rel=rel;this.name=rel.split('/').at(-1);this.kind='directory';}
     queryPermission(o){return io({op:'permission',rel:this.rel,mode:o.mode});}requestPermission(){return io({op:'request',rel:this.rel});}
     async getDirectoryHandle(n,o={}){const rel=this.rel+'/'+n;await io({op:'dir',rel,create:o.create});return new Dir(rel);}
     async getFileHandle(n,o={}){const rel=this.rel+'/'+n;await io({op:'file',rel,create:o.create});return new FH(rel);}
     async *values(){for(const h of await io({op:'list',rel:this.rel}))yield h.kind==='file'?new FH(this.rel+'/'+h.name):new Dir(this.rel+'/'+h.name);}
     async *entries(){for await(const h of this.values())yield[h.name,h];}[Symbol.asyncIterator](){return this.entries();}
     async isSameEntry(other){return this.rel===other.rel;}async resolve(other){return other.rel===this.rel?[]:other.rel.startsWith(this.rel+'/')?other.rel.slice(this.rel.length+1).split('/'):null;}
     removeEntry(n){return io({op:'remove',rel:this.rel+'/'+n});}
    }
    class FH{
     constructor(rel){this.rel=rel;this.name=rel.split('/').at(-1);this.kind='file';}
     async getFile(){const r=await io({op:'read',rel:this.rel});return new File([new Uint8Array(r.bytes)],this.name,{lastModified:r.modified});}
     async createWritable(){const chunks=[];return{write:async value=>{chunks.push(value);},close:async()=>{await io({op:'write',rel:this.rel,bytes:Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))});},abort:async()=>{}};}
    }
    window.__f7next='A';window.showDirectoryPicker=async()=>new Dir(names[window.__f7next]);
    window.__f7drawn=[];const draw=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...rest){window.__f7drawn.push(String(text));return draw.call(this,text,...rest);};
   },{names});
   const page=await context.newPage();let allow=false;
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   page.on('dialog',d=>{if(d.type()==='confirm'&&d.message().includes('möglicherweise veraltet')){confirmations.push(d.message());void(allow?d.accept():d.dismiss());}else void d.accept();});
   await page.goto(url);if(!plan)await page.evaluate(()=>{document.querySelectorAll('.modal-overlay.open').forEach(e=>e.classList.remove('open'));});
   const button=plan?'#project-badge':'#pj-refresh',warning=plan?'#project-data-warning':'#pj-warning';
   const open=async key=>{await page.evaluate(key=>window.__f7next=key,key);await page.locator(plan?'#open-folder':'#projekt-ordner').click();await page.waitForFunction(({button,name})=>document.querySelector(button)?.dataset.status==='ok'&&window.SpektronProjectData(name)?.data.objekt!==undefined,{button,name:names[key]});};
   const status=async()=>page.evaluate(name=>{const s=window.SpektronProjectData(name);return s?{status:s.status,stale:s.stale,checking:s.checking,data:s.data}:null;},names[await page.evaluate(()=>window.__f7next)]);
   const refresh=async()=>{await page.locator(button).click();await page.waitForFunction(button=>!document.querySelector(button).disabled,button);};
   const put=(key,data)=>files.set(names[key]+'/_Projekt.json',bytes(data));
   const exported=()=>[...files.keys()].filter(p=>/\.(png|pdf|docx)$/.test(p));
   const exportStart=async(format='png')=>{
    if(!plan){if(!await page.evaluate(()=>proben.length))await page.evaluate(()=>{proben.push({id:1,datum:'2026-10-21',z1:PROJEKTORDNER.state.proj.nr,z2:'Raum',z3:'Test',z4:'Glas',matrix:'Wischprobe',cm2:'100',notiz:''});});return page.evaluate(()=>exportAuftragsscheinRTF());}
    if(!await page.locator('#export-dialog').evaluate(d=>d.open))await page.locator('#export-open').click();
    await page.locator('#format').selectOption(format);if(format==='png')await page.locator('#framed').uncheck();
    await page.locator('#export').click();
   };
   const acceptPlan=async accept=>{await page.locator('#ask-dialog[open]').waitFor();await page.getByRole('button',{name:accept?'Für diesen Export ausdrücklich verwenden':'Abbrechen',exact:true}).click();};
   const deferred=()=>{let arrived,release;const reached=new Promise(r=>{arrived=r;}),wait=new Promise(r=>{release=r;});hold={project:names.A,started:false,arrived,wait};return{reached,release};};
   await run({page,open,refresh,status,put,faults,files,writes,warning,button,exportStart,exported,acceptPlan,confirmations,consent:value=>{allow=value;},deferred});
   assert.equal(writes.filter(p=>p.endsWith('/_Projekt.json')).length,0,'Keine automatischen Schreib-/Create-/Reparaturversuche an _Projekt.json');
   assert.deepEqual(errors,[]);count++;console.log(`OK F7 ${plan?'PlanKit':'LabelKit'} (${engine}): ${title}`);
  }finally{if(hold)hold.arrived=()=>{};await context.close();}
 }
 await scenario('A: Lesefehler erhält ALT mit dauerhaft sichtbarer Warnung',async t=>{
  await t.open('A');t.put('A',pj('NEU'));t.faults[names.A]={name:'NetworkError'};await t.refresh();
  assert.equal((await t.status()).data.objekt,'ALT');assert.equal((await t.status()).stale,true);assert.equal((await t.status()).status,'network');assert.match(await t.page.locator(t.warning).textContent(),/möglicherweise veraltet/);
  assert.match(await t.page.locator('#mosaikLeiste .ml-obj').textContent(),/ALT.*möglicherweise veraltet/);
  if(!plan){await t.page.evaluate(()=>fbVorbelegen(true));assert.doesNotMatch(await t.page.locator('#flash').textContent().catch(()=>''),/übernommen ✓/);}
 });
 await scenario('B: erneute Prüfung, Exportabbruch und ausdrückliche Zustimmung',async t=>{
  await t.open('A');t.put('A',pj('NEU'));t.faults[names.A]={name:'NetworkError'};await t.refresh();
  await t.exportStart();if(plan){await t.acceptPlan(false);assert.deepEqual(t.exported(),[]);}else assert.equal(t.confirmations.length,1);
  assert.equal((await t.status()).stale,true);
  if(plan){await t.exportStart();await t.acceptPlan(true);await t.page.waitForFunction(()=>!document.querySelector('#export').disabled);assert.ok(t.exported().some(p=>p.endsWith('.png')));assert.ok((await t.page.evaluate(()=>window.__f7drawn)).some(s=>s.includes('ALT')));}
  else{t.consent(true);const dl=t.page.waitForEvent('download');await t.exportStart();assert.match(fs.readFileSync(await(await dl).path(),'latin1'),/Objekt: \\b ALT/);assert.equal(t.confirmations.length,2);}
  assert.equal(await t.page.locator(t.warning).isVisible(),true,'Zustimmung löscht keine Warnung');
 });
 await scenario('C: Wiederholung übernimmt NEU und entfernt Warnung, Export nutzt NEU',async t=>{
  await t.open('A');t.faults[names.A]={name:'NetworkError'};await t.refresh();t.put('A',pj('NEU'));delete t.faults[names.A];await t.refresh();
  assert.equal((await t.status()).data.objekt,'NEU');assert.equal((await t.status()).stale,false);assert.equal(await t.page.locator(t.warning).isVisible(),false);
  if(plan){await t.exportStart('pdf-a4');await t.page.waitForFunction(()=>!document.querySelector('#export').disabled);const pdf=t.exported().find(p=>p.endsWith('.pdf'));assert.ok(pdf,await t.page.locator('#toast').textContent());const subjectHex=/\/Subject <FEFF([A-F0-9]+)>/.exec(Buffer.from(t.files.get(pdf)).toString('latin1'))[1];const subject=Buffer.from(subjectHex,'hex').swap16().toString('utf16le');assert.match(subject,/NEU/);assert.doesNotMatch(subject,/ALT/);}
  else{const dl=t.page.waitForEvent('download');await t.exportStart();const text=fs.readFileSync(await(await dl).path(),'latin1');assert.match(text,/Objekt: \\b NEU/);assert.doesNotMatch(text,/Objekt: \\b ALT/);assert.equal(t.confirmations.length,0);}
 });
 await scenario('D: verspätetes A-Ergebnis bleibt nach Projektwechsel ohne Wirkung',async t=>{
  await t.open('A');t.put('A',pj('A verspätet'));const delay=t.deferred();await t.page.locator(t.button).click();await delay.reached;
  await t.open('B');delay.release();await t.page.waitForTimeout(100);assert.equal((await t.status()).data.objekt,'B aktuell');assert.equal((await t.status()).stale,false);
  assert.doesNotMatch(await t.page.locator('#mosaikLeiste').textContent(),/A verspätet/);
 });
 for(const [fault,expected]of [['NotReadableError','read-error'],['NotAllowedError','permission']])await scenario('Fehlerklasse '+fault+' und anschließende Wiederholung',async t=>{
  await t.open('A');t.faults[names.A]={name:fault};await t.refresh();assert.equal((await t.status()).status,expected);assert.equal((await t.status()).data.objekt,'ALT');delete t.faults[names.A];await t.refresh();assert.equal((await t.status()).stale,false);
 });
 await scenario('Ungültiges JSON erhält ALT; erfolgreiches leeres Objekt entfernt ALT',async t=>{
  await t.open('A');t.put('A','{');await t.refresh();assert.equal((await t.status()).status,'invalid');assert.equal((await t.status()).data.objekt,'ALT');
  t.put('A','{}');await t.refresh();assert.equal((await t.status()).status,'ok');assert.deepEqual((await t.status()).data,{});assert.equal(await t.page.locator(t.warning).isVisible(),false);
 });
 await scenario('Fehlende Datei: neues Projekt ohne Warnung, nach geladenem Stand mit Warnung',async t=>{
  await t.open('A');t.files.delete(names.A+'/_Projekt.json');await t.refresh();assert.equal((await t.status()).status,'missing');assert.equal((await t.status()).stale,true);
  await t.page.evaluate(()=>window.__f7next='C');await t.page.locator(plan?'#open-folder':'#projekt-ordner').click();await t.page.waitForFunction(({button,name})=>document.querySelector(button)?.dataset.status==='missing'&&window.SpektronProjectData(name),{button:t.button,name:names.C});
  assert.equal((await t.status()).stale,false);assert.deepEqual((await t.status()).data,{});assert.equal(await t.page.locator(t.warning).isVisible(),false);
 });
 await scenario('Später Erfolg darf neueren Lesefehler nicht als Erfolg überdecken',async t=>{
  await t.open('A');const delay=t.deferred();await t.page.locator(t.button).click();await delay.reached;t.faults[names.A]={name:'NetworkError'};
  await t.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await t.page.waitForFunction(button=>document.querySelector(button).dataset.stale==='true',t.button);delay.release();await t.page.waitForTimeout(100);
  assert.equal((await t.status()).status,'network');assert.equal((await t.status()).stale,true);
 });
 if(plan)await scenario('Word-Anlage mit bestätigten alten Angaben und zutreffendem Quellenhinweis',async t=>{
  await t.open('A');t.faults[names.A]={name:'NetworkError'};await t.refresh();await t.exportStart('anlage');await t.acceptPlan(true);
  await t.page.waitForFunction(()=>!document.querySelector('#export').disabled);const file=t.exported().find(n=>n.endsWith('.docx'));assert.ok(file,'Anlage trotz ausschließlich gestörter _Projekt-Lesung möglich');
  const bytes=Buffer.from(t.files.get(file)),text=bytes.toString('utf8');assert.match(text,/ALT/);assert.match(text,/möglicherweise veraltet/);assert.match(text,/Verwendung bestätigt/);
 });
 else await scenario('Feldbögen: aktualisierte automatische Vorgaben, manuelle Werte und Druck',async t=>{
  await t.open('A');await t.page.evaluate(async()=>{switchMainTab('feldboegen');await fbVorbelegen(true);});await t.page.locator('#fb-ag').fill('Manuell');
  t.put('A',pj('NEU'));await t.refresh();assert.equal(await t.page.locator('#fb-objekt').inputValue(),'NEU');assert.equal(await t.page.locator('#fb-ag').inputValue(),'Manuell');
  const popup=t.page.waitForEvent('popup');await t.page.evaluate(()=>fbDrucken());const print=await popup;await print.waitForLoadState();assert.match(await print.locator('body').textContent(),/NEU/);assert.doesNotMatch(await print.locator('body').textContent(),/ALT/);
 });
 if(!plan)await scenario('Feldprotokoll: fehlendes Kürzel wird vor verzögertem Lesen endgültig abgelehnt',async t=>{
  await t.open('A');await t.page.evaluate(async()=>{switchMainTab('feldboegen');await fbVorbelegen(true);fbZurErfassung();fbeKuerzelSetzen('');document.getElementById('fbe-kuerzel').value='';});
  const delay=t.deferred(),pending=t.page.evaluate(()=>fbeAnlegen());
  await Promise.race([pending,delay.reached]);await t.page.locator('#fbe-kuerzel').fill('SK');delay.release();await pending;
  assert.equal(await t.page.evaluate(()=>feldprotokolle.length),0,'Spätere Kürzeleingabe startet keine vorher abgelehnte Erfassung');assert.equal(await t.page.locator('#fbe-neu-n').isVisible(),true);
 });
 console.log(`F7: ${count} vollständige ${plan?'PlanKit':'LabelKit'}-${engine}-Szenarien bestanden, keine API-Skips`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
