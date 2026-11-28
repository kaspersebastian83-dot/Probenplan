// PlanKit 2.7.0 – Ortstermin je Probe im Browser (plankit-ortstermine-plan.md Abschnitt 3 und 4.11, T1–T18). Nur Chromium
// (Ordnerzugriff), Archiv im privaten Dateisystem des Browsers, nur erfundene Daten. Lokal mit LANG=C.UTF-8 (Umlaute in Ordnernamen).
//  A  Runde 1 mit einem Termin → Export wie bisher; Termin 2 kommt dazu; Runde 2 → Export „frühere grau“ → zwei Dateien, Plan von Termin 1
//     byte-gleich; Probenliste mit Tag je Zeile, P22 „ohne Termin“ und Rückfrage; Termin 1, „alle Termine“, Kopie „(2)“; zwei Geschosse,
//     eines ohne Probe des Tages (T7); Ergebniskarte; T14 (Datum aus dem Prüfbericht); Anlage Probenahme für den 20.08. nur mit P14–P21;
//     Link mitteilung=m2/m1; _Projekt.json byte-gleich; .probenplan ohne neue Felder.
//  B  Kette (Node, echte Module): BerichtKit 1.27.0 anlagen.js und Projektzentrale 1.56.0 mitteilungen.js mit den Dateinamen, die 2.7.0
//     wirklich geschrieben hat – planName, Plan je Mitteilung, nichts „nicht zugeordnet“, keine gelbe Zeile.
//  C  Ein Termin: Oberfläche ohne Termin-Teile, Exportnamen und .probenplan byte-gleich wie bis 2.6.3.
//  D  Legende (Module über einen eigenen Vite-Server): nur die Proben des Tages, „grau: Proben vom 12.08.2026“.
//  E  Plannamen-Schutz (Umbenennen abgelehnt, bestehender Name gelb).
import * as pk from './pk-ui.mjs';
import {chromium,openExport} from './runtime.mjs';
import {labXML,labErgebnisse} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const base=process.env.TEST_URL||'http://localhost:4173';
const NAME='26.0999 Teststadt Ka',NR='26.0999',VERGLEICH='26.0998 Vergleich Ka';
const svg=t=>`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="white"/><path d="M30 30H1570V970H30Z M800 30V970" fill="none" stroke="black" stroke-width="10"/><text x="300" y="500" font-size="60">${t}</text></svg>`;
const PJ1={format:'mosaik-projekt',version:1,objekt:'EFH, Musterweg 9',nutzung:'Wohnen',ortstermin:'2026-08-12'};
const PJ2={...PJ1,ortsterminBezeichnung:'Erstbegehung',weitereOrtstermine:[{id:'t2',datum:'2026-08-20',bezeichnung:'Nachbeprobung',wer:'Ka'}],ortsterminZaehler:2,
 weitereMitteilungen:[{id:'m1',nr:1,termine:['t1'],auftraege:[]},{id:'m2',nr:2,termine:['t2'],auftraege:[]},{id:'m3',nr:3,termine:['t1','t2'],auftraege:[]}],mitteilungZaehler:3};
const probe=(n,datum,raum,o={})=>({id:n,_nr:n,matrix:'Wischprobe',datum,z2:raum,z3:'verrußt',z4:'Ansicht',cm2:'100',...o});
const DATUM=n=>n<=13?'2026-08-12':n<=21?'2026-08-20':'2026-08-21';
const RAUM=n=>n===22?'EG Flur':`${n<=8||n>=14?'EG':'OG'} Raum ${n}`;
function labelkit(runde,nr=NR){const pak=[],chl=[],asb=[];
 for(let n=1;n<=8;n++)pak.push(probe(n,DATUM(n),RAUM(n)));for(let n=9;n<=13;n++)chl.push(probe(n,DATUM(n),RAUM(n),{chloridNr:n}));
 if(runde>1){for(let n=14;n<=17;n++)pak.push(probe(n,DATUM(n),RAUM(n)));for(let n=18;n<=21;n++)asb.push(probe(n,DATUM(n),RAUM(n),{matrix:'Material'}));pak.push(probe(22,DATUM(22),RAUM(22)));}
 return JSON.stringify({version:1,nrSchutz:1,projekt:{nr},proben:pak,chloridProben:chl,asbestProben:asb,sonstigeProben:[]});}
const desc=n=>`${RAUM(n)}, verrußt, Ansicht${n>=18&&n<=21?'':', 100 cm²'}`;
// Prüfbericht mit Messwerten; Probenahmedatum wie in LabelKit – nur P14 hat im Prüfbericht den 21.08. (T14: es zählt LabelKit)
function ergebnisse(n){const rows=Array.from({length:n},(_,i)=>({label:`P${i+1}`,ref:`Probe ${i+1}`,desc:desc(i+1),art:'Wischprobe',labNr:`999-1-${1000+i}`,lines:[{p:'Summe 16 EPA-PAK exkl. BG',r:String(3+i*4),u:'µg/100 cm²'}]}));
 const e=JSON.parse(labErgebnisse(rows,{ref:NAME,projekt:NR}));for(const p of e.berichte[0].proben)p.datum=p.label==='P14'?'2026-08-21':DATUM(Number(p.label.slice(1)));
 return {xml:labXML(rows),json:JSON.stringify(e)};}

const fs=(page,action,...args)=>page.evaluate(async([action,args])=>{
 const root=await navigator.storage.getDirectory(),archiv=await root.getDirectoryHandle('Mosaik Archivordner',{create:true});
 const dir=async path=>{let d=archiv;for(const p of path)d=await d.getDirectoryHandle(p,{create:true});return d;};
 const write=async(d,n,data)=>{const w=await(await d.getFileHandle(n,{create:true})).createWritable();await w.write(data);await w.close();};
 const hex=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(action==='setup'){const [name,pj,eg,lk,leeren]=args;if(leeren)for await(const [n] of archiv.entries())await archiv.removeEntry(n,{recursive:true});
  const proj=await dir([name]);for(const sub of ['Pläne','Laborergebnisse','Laboraufträge','Fotos'])await proj.getDirectoryHandle(sub,{create:true});
  await write(proj,'_Projekt.json',JSON.stringify(pj));await write(await dir([name,'Pläne']),'Grundriss EG.svg',eg);await write(await dir([name,'Laboraufträge']),`${name.split(' ')[0]}_Daten.json`,lk);
  await new Promise((res,rej)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const tx=r.result.transaction('kv','readwrite');tx.objectStore('kv').put(archiv,'archiv');tx.oncomplete=()=>{r.result.close();res();};tx.onerror=()=>rej(tx.error);};r.onerror=()=>rej(r.error);});return true;}
 if(action==='write'){await write(await dir(args[0]),args[1],args[2]);return true;}
 if(action==='list'){const d=await dir(args[0]);const out=[];for await(const h of d.values())if(h.kind==='file')out.push({name:h.name,t:(await h.getFile()).lastModified});return out.sort((a,b)=>a.name.localeCompare(b.name));}
 if(action==='text'){const d=await dir(args[0]);return (await(await d.getFileHandle(args[1])).getFile()).text();}
 if(action==='bytes'){const d=await dir(args[0]);const b=new Uint8Array(await(await(await d.getFileHandle(args[1])).getFile()).arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);}
 if(action==='sha'){const d=await dir(args[0]);return hex(await(await(await d.getFileHandle(args[1])).getFile()).arrayBuffer());}
},[action,args]);
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
function unzip(buf){const out={};let p=0;while(buf.readUInt32LE(p)===0x04034b50){const size=buf.readUInt32LE(p+18),n=buf.readUInt16LE(p+26),e=buf.readUInt16LE(p+28),name=buf.subarray(p+30,p+30+n).toString('utf8');out[name]=buf.subarray(p+30+n+e,p+30+n+e+size);p+=30+n+e+size;}return out;}
const text=xml=>xml.replace(/<w:br\/>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
async function check(name,fn){await fn();console.log(`OK ${name}`);}
async function uebernehmen(page){await pk.proben(page);await page.locator('#lab-folder-dialog [data-labelkit]').click();await page.locator('#lab-review').waitFor();
 if(await page.locator('#lab-update-all:visible').count())await page.locator('#lab-update-all:visible').click();await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});}
async function ergebnisseUebernehmen(page){const erg=page.locator('#lab-folder-dialog [data-ergebnis]',{hasText:'AR-999.xml'});
 for(let i=0;i<20;i++){await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(700);await pk.proben(page);await page.locator('#lab-folder-dialog').waitFor();if(await erg.count())break;await page.keyboard.press('Escape');await page.locator('#lab-folder-dialog').waitFor({state:'hidden'});}
 await erg.click();await page.locator('#lab-review').waitFor();if(await page.locator('#lab-update-all:visible').count())await page.locator('#lab-update-all:visible').click();await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});}
async function setzen(page,n,y0){await pk.schritt(page,2);await page.locator('#pk-w-setzen').click();for(let i=0;i<n;i++){await tap(page,.08+(i%10)*.09,y0+Math.floor(i/10)*.2);await page.waitForTimeout(60);}await page.keyboard.press('Escape');}
async function gespeichert(page){await page.locator('#save-project').click();await page.locator('#saved',{hasText:/gespeichert/}).waitFor();await page.waitForTimeout(400);}
/** Ausgabe in ③. dialoge: Antworten der Reihe nach (true = OK); gibt Meldung und Texte der Rückfragen zurück. */
async function ausgeben(page,format,{scope='one',view='plan',dialoge=[]}={}){
 await openExport(page);await page.locator('#format').selectOption(format);
 if(await page.locator('#scope-field').isVisible())await page.locator('#scope').selectOption(scope);
 if(await page.locator('#view-field').isVisible())await page.locator('#view').selectOption(view);
 const texte=[],antworten=[...dialoge];const h=d=>{texte.push(d.message());(antworten.shift()??false)?d.accept():d.dismiss();};page.on('dialog',h);
 await page.evaluate(()=>{document.getElementById('toast').textContent='';});
 await pk.ausgeben(page);await page.waitForFunction(()=>!document.querySelector('#export')?.disabled&&(document.querySelector('#toast')?.textContent||'').trim(),null,{timeout:120000}).catch(()=>{});
 await page.waitForTimeout(300);page.off('dialog',h);return {toast:(await page.locator('#toast').textContent()).trim(),texte};}
async function termin(page,tag,frueher){await pk.schritt(page,3);await page.locator('#termin-tag').selectOption(tag);if(frueher)await page.locator('#termin-frueher').selectOption(frueher);}
const namen=async(page,name=NAME)=>(await fs(page,'list',[name,'Pläne'])).map(f=>f.name).filter(n=>/^Probenplan .*\.(pdf|png|jpg)$/.test(n));
// .probenplan: nur Felder, die PlanKit 2.6.3 kennt (T1 – nichts Neues in der Datei)
const BEKANNT={oben:['format','version','plan','markers','nextSample','nextFire','report','date','areas','nextArea','pending','labReports','sheets','active','results','trials','raumbuch'],
 punkt:['id','kind','label','note','x','y','lx','ly','lab','shape','typ','surface','raum','raumSkizze'],lab:['ref','desc','art','labNr','datum','bericht','reportId','werte'],offen:['label','typ','shape','surface','raum','ref','desc','art','labNr','datum','bericht','reportId','werte']};
function nurBekannt(pp){for(const k of Object.keys(pp))assert.ok(BEKANNT.oben.includes(k),`neues Feld oben: ${k}`);
 for(const m of [...pp.markers,...(pp.sheets||[]).flatMap(s=>s.markers||[])]){for(const k of Object.keys(m))assert.ok(BEKANNT.punkt.includes(k),`neues Feld am Punkt: ${k}`);for(const k of Object.keys(m.lab||{}))assert.ok(BEKANNT.lab.includes(k),`neues Feld in lab: ${k}`);}
 for(const r of pp.pending||[])for(const k of Object.keys(r))assert.ok(BEKANNT.offen.includes(k),`neues Feld an offener Probe: ${k}`);}

const browser=await chromium.launch();
const geschrieben={plaene:[],probenplan:null,anlage:'',einTermin:''};
try{
 const context=await browser.newContext({viewport:{width:1366,height:820},acceptDownloads:true});
 await context.addInitScript(()=>{try{localStorage.setItem('plankit-weiter-platzieren','1');}catch{}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await fs(page,'setup',NAME,PJ1,svg('EG'),labelkit(1),true);
 await page.goto(`${base}/#projekt=${encodeURIComponent(NAME)}`);await page.reload();await page.locator('#project-badge:not([hidden])').waitFor({state:'attached'});
 await page.locator('#folder-plans button',{hasText:'Grundriss EG.svg'}).click();await page.locator('#welcome').waitFor({state:'hidden'});
 await uebernehmen(page);await setzen(page,10,.25);
 await pk.schritt(page,1);await page.locator('#sheet-add').click();await page.locator('#sheet-file').setInputFiles({name:'Grundriss OG.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg('OG'))});await page.locator('#sheet-ok').click().catch(()=>{});await page.waitForTimeout(400);
 await setzen(page,3,.25);await gespeichert(page);await pk.plan(page,0);
 const PLAN='Pläne',EG1=`Probenplan ${NAME} - EG.pdf`;let sha1='';
 await check('Runde 1, ein Termin: keine Termin-Wahl, Export wie bis 2.6.3',async()=>{
  await pk.schritt(page,2);assert.equal(await page.locator('#termin2').isVisible(),false);assert.equal(await page.locator('.pl-termin').count(),0,'kein Tag in der Probenliste');
  const r=await ausgeben(page,'pdf-a4');assert.deepEqual(r.texte,[]);assert.match(r.toast,new RegExp(`PDF gespeichert: Pläne/${EG1.replace(/[.()]/g,'\\$&')}`));
  assert.equal(await page.locator('#termin').isVisible(),false);sha1=await fs(page,'sha',[NAME,PLAN],EG1);
 });
 // Termin 2 in der Projektzentrale, Runde 2 in LabelKit
 const pjVorher=JSON.stringify(PJ2);await fs(page,'write',[NAME],'_Projekt.json',pjVorher);await fs(page,'write',[NAME,'Laboraufträge'],`${NR}_Daten.json`,labelkit(2));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('#termin').waitFor({state:'attached'});
 await page.waitForFunction(()=>!document.getElementById('termin')?.hidden,null,{timeout:30000});
 await uebernehmen(page);await pk.plan(page,0);await setzen(page,9,.65);await gespeichert(page);
 await check('Probenliste in ②: Tag je Zeile, P22 gelb „ohne Termin“ mit Grund; Termin-Wahl in ② und ③, Vorwahl 20.08., frühere grau',async()=>{
  await pk.schritt(page,2);await page.locator('#termin2').waitFor();
  const tag=async l=>{await pk.zeile(page,l);return page.locator(`.pl-item[data-label="${l}"] .pl-termin`).first();};
  for(const [l,t] of [['P1','12.08.'],['P11','12.08.'],['P14','20.08.'],['P21','20.08.']])assert.equal((await (await tag(l)).textContent()).trim(),t,l);
  const p22=await tag('P22');assert.equal((await p22.textContent()).trim(),'ohne Termin');assert.match(await p22.getAttribute('class'),/ohne/);assert.equal(await p22.getAttribute('title'),'Probenahmedatum 21.08.2026 passt zu keinem Ortstermin');
  const opts=await page.locator('#termin2-tag option').evaluateAll(o=>o.map(x=>[x.value,x.textContent]));
  assert.deepEqual(opts,[['2026-08-12','12.08. (Erstbegehung)'],['2026-08-20','20.08. (Nachbeprobung)'],['alle','Alle Termine']]);
  assert.equal(await page.locator('#termin2-tag').inputValue(),'2026-08-20');assert.equal(await page.locator('#termin2-frueher').inputValue(),'grau');
  if(process.env.ORTSTERMINE_DUMP)await page.screenshot({path:`${process.env.ORTSTERMINE_DUMP}/schritt2.png`});
  await openExport(page);await page.locator('#format').selectOption('pdf-a4');await page.locator('#scope').selectOption('one');
  if(process.env.ORTSTERMINE_DUMP)await page.screenshot({path:`${process.env.ORTSTERMINE_DUMP}/schritt3.png`});
  assert.equal(await page.locator('#termin-tag').inputValue(),'2026-08-20');
  assert.equal(await page.locator('#termin-satz').textContent(),'Ausgabe für den Ortstermin am 20.08.2026 – 8 Proben, 10 frühere grau');
  assert.match(await page.locator('#termin-fehlt').textContent(),/Ohne Ortstermin – nicht in diesem Plan: P22 \(Probenahmedatum 21\.08\.2026 passt zu keinem Ortstermin\)/);
  // Karte zeigt dieselbe Darstellung wie die Ausgabe: P1 grau, P22 blass (fehlt in der Ausgabe, bleibt greifbar)
  const stil=await page.evaluate(()=>{const g=l=>[...document.querySelectorAll('#marks [data-id]')].find(x=>x.textContent===l);const a=g('P1'),b=g('P22'),c=g('P14');return {p1:a?.querySelector('text')?.getAttribute('fill'),p22:b?.getAttribute('opacity'),p14:c?.getAttribute('opacity'),p14f:c?.querySelector('text')?.getAttribute('fill')};});
  assert.deepEqual(stil,{p1:'#9aa4ac',p22:'.35',p14:null,p14f:'#17665e'});
 });
 const EG20=`Probenplan ${NAME} - EG - Termin 20.08.2026.pdf`;
 await check('Runde 2 → Export „frühere grau“: Rückfrage nennt P22, neue Datei mit Termin, Plan von Termin 1 byte-gleich (T5, T6, T15)',async()=>{
  let r=await ausgeben(page,'pdf-a4',{dialoge:[false]});assert.equal(r.texte.length,1);assert.match(r.texte[0],/P22: Probenahmedatum 21\.08\.2026 passt zu keinem Ortstermin/);assert.match(r.texte[0],/Datum in LabelKit berichtigen|LabelKit berichtigen/);assert.match(r.texte[0],/„Alle Termine“/);
  assert.ok(!(await namen(page)).includes(EG20),'Abbrechen: nichts ausgegeben');
  r=await ausgeben(page,'pdf-a4',{dialoge:[true]});assert.equal(r.texte.length,1,'nur die Rückfrage, kein „ersetzen?“ – anderer Name');assert.match(r.toast,/PDF gespeichert: Pläne\/Probenplan 26\.0999 Teststadt Ka - EG - Termin 20\.08\.2026\.pdf/);
  assert.equal(await fs(page,'sha',[NAME,PLAN],EG1),sha1,'Plan von Termin 1 unverändert');
  // derselbe Termin noch einmal: heutige Rückfrage ersetzen / „(2)“
  r=await ausgeben(page,'pdf-a4',{dialoge:[true,false]});assert.equal(r.texte.length,2);assert.match(r.texte[1],/gibt es in „Pläne“ schon/);assert.match(r.toast,/Termin 20\.08\.2026 \(2\)\.pdf/);
 });
 await check('Termin 1 mit Zusatz, „alle Termine“; die alte Datei ohne Zusatz wird nie angefasst',async()=>{
  await termin(page,'2026-08-12');let r=await ausgeben(page,'pdf-a4',{dialoge:[true]});assert.match(r.toast,/EG - Termin 12\.08\.2026\.pdf/);assert.match(r.texte[0]||'',/P22/,'P22 fehlt auch am 12.08.');
  await termin(page,'alle');assert.equal(await page.locator('#termin-frueher').isVisible(),false,'bei „alle“ keine Wahl grau/ausblenden');
  assert.equal(await page.locator('#termin-satz').textContent(),'Ausgabe für alle Ortstermine – 19 Proben');assert.equal(await page.locator('#termin-fehlt').isVisible(),false);
  r=await ausgeben(page,'pdf-a4');assert.deepEqual(r.texte,[],'„alle“: keine Rückfrage');assert.match(r.toast,/EG - alle Termine\.pdf/);
  r=await ausgeben(page,'png',{scope:'all'});assert.deepEqual(r.texte,[]);assert.match(r.toast,/2 Bilder/);
  const n=await namen(page);for(const x of [`Probenplan ${NAME} - EG - alle Termine.png`,`Probenplan ${NAME} - 1. OG - alle Termine.png`])assert.ok(n.includes(x),x);
  assert.equal(await fs(page,'sha',[NAME,PLAN],EG1),sha1);
 });
 await check('Zwei Geschosse, eines ohne Probe des Tages (T7): „Alle Pläne“ lässt 1. OG weg und sagt es',async()=>{
  await termin(page,'2026-08-20','grau');await page.locator('#scope').selectOption('all');await page.locator('#format').selectOption('pdf-a4');
  assert.match(await page.locator('#termin-satz').textContent(),/1\. OG: keine Probe vom 20\.08\.2026 – nicht in der Ausgabe\./);
  let r=await ausgeben(page,'pdf-a4',{scope:'all',dialoge:[true]});assert.match(r.toast,new RegExp(`PDF gespeichert: Pläne/Probenplan ${NAME} - Termin 20\\.08\\.2026\\.pdf.*1\\. OG: keine Probe vom 20\\.08\\.2026 – nicht in der Ausgabe`));
  r=await ausgeben(page,'png',{scope:'all',dialoge:[true]});assert.match(r.toast,/1 Bilder|1 Bild/);assert.match(r.toast,/1\. OG: keine Probe vom 20\.08\.2026/);
  const n=await namen(page);assert.ok(n.includes(`Probenplan ${NAME} - EG - Termin 20.08.2026.png`));assert.ok(!n.includes(`Probenplan ${NAME} - 1. OG - Termin 20.08.2026.png`),'kein leeres/graues Blatt für 1. OG');
  await page.locator('#format').selectOption('anlage');assert.match(await page.locator('#dimensions-note').textContent(),/^8 Proben · 1 Planseite ·/);
 });
 await check('Ergebniskarte für den 20.08.; T14: Datum aus dem Prüfbericht (P14 am 21.08.) verschiebt nichts, gelbe Zeile',async()=>{
  const e=ergebnisse(21);await fs(page,'write',[NAME,'Laborergebnisse'],'AR-999.xml',e.xml);await fs(page,'write',[NAME,'Laborergebnisse'],'_Ergebnisse.json',e.json);await fs(page,'write',[NAME,'_Spektron','ResultKit'],'_Ergebnisse.json',e.json);
  await ergebnisseUebernehmen(page);await gespeichert(page);await pk.plan(page,0);
  await pk.schritt(page,2);await page.locator('#termin-hinweise').waitFor();assert.equal((await page.locator('#termin-hinweise').innerText()).trim(),'⚠ P14: laut LabelKit 20.08., am Punkt 21.08. – Proben übernehmen');
  await pk.zeile(page,'P14');assert.equal((await page.locator('.pl-item[data-label="P14"] .pl-termin').textContent()).trim(),'20.08.','es zählt LabelKit');
  const r=await ausgeben(page,'pdf-a4',{view:'results',dialoge:[true]});assert.match(r.toast,/PDF gespeichert: Pläne\/Probenplan 26\.0999 Teststadt Ka - EG - Termin 20\.08\.2026 - Ergebniskarte\.pdf/);
 });
 await check('Anlage Probenahme für den 20.08.: nur P14–P21, Deckblatt mit dem Termin, Prüfprotokoll nennt Wahl und ausgelassene Proben, Name mit Termin (T8)',async()=>{
  await openExport(page);await page.locator('#format').selectOption('anlage');await page.locator('#annex-title').fill('Anlage 3');
  const r=await ausgeben(page,'anlage',{dialoge:[true]});assert.match(r.texte[0]||'',/fehlt in der Anlage Probenahme für den 20\.08\.2026/);
  assert.match(r.toast,/Anlage gespeichert: Mitteilungen\/26-0999_Anlage-3_Termin-20-08-2026_Probenahme_\d{4}-\d{2}-\d{2}\.docx/);
  geschrieben.anlage=(await fs(page,'list',[NAME,'Mitteilungen'])).map(f=>f.name).find(n=>n.endsWith('.docx'));
  const files=unzip(Buffer.from(await fs(page,'bytes',[NAME,'Mitteilungen'],geschrieben.anlage),'base64')),t=text(files['word/document.xml'].toString('utf8'));
  assert.match(t,/Ortstermin\n20\.08\.2026 \(Nachbeprobung\)/,'Deckblatt');assert.doesNotMatch(t,/Ortstermin\n12\.08\.2026/);
  const proben=[...new Set([...t.matchAll(/\bP(\d+)\b/g)].map(m=>+m[1]))];
  const verzeichnis=t.slice(0,t.indexOf('Prüfprotokoll',t.indexOf('Prüfprotokoll')+1));const imVerzeichnis=[...new Set([...verzeichnis.matchAll(/\bP(\d+)\b/g)].map(m=>+m[1]))].sort((a,b)=>a-b);
  assert.deepEqual(imVerzeichnis,[14,15,16,17,18,19,20,21],`Probenverzeichnis/Probenblätter: ${imVerzeichnis}`);assert.ok(proben.includes(22)&&proben.includes(1),'Prüfprotokoll nennt die ausgelassenen');
  assert.match(t,/8 Proben auf 1 Plan\b/);
  assert.match(t,/Ortstermin: 20\.08\.2026 \(Nachbeprobung\) – frühere Termine im Lageplan grau/);
  assert.match(t,/Proben ohne Ortstermin – nicht in dieser Anlage\nP22 \(Probenahmedatum 21\.08\.2026 passt zu keinem Ortstermin\)/);
  assert.match(t,/Pläne ohne Probe dieses Ortstermins – keine Planseite\n1\. OG/);
  assert.match(t,/Proben anderer Ortstermine nicht im Probenverzeichnis\nP1 \(12\.08\.2026\), P2 \(12\.08\.2026\)/);
  assert.equal(Object.keys(files).filter(n=>n.startsWith('word/media/')).length,1+8,'eine Planseite und acht Lageausschnitte');
 });
 await check('Raumbuch und Wandansichten: über alle Termine, mit gelber Zeile (T9)',async()=>{
  await pk.schritt(page,3);await page.locator('#raumbuch-open').click();await page.locator('#raumbuch-dialog').waitFor();assert.equal((await page.locator('#raumbuch-termine').textContent()).trim(),'Enthält Proben aller Ortstermine.');assert.equal(await page.locator('#raumbuch-termine').isVisible(),true);await page.locator('#raumbuch-close').click();
 });
 const pp=JSON.parse(await fs(page,'text',[NAME,'_Spektron','PlanKit'],`Probenplan ${NAME}.probenplan`));geschrieben.probenplan=pp;
 await check('.probenplan: nichts Neues (T1) – nur Felder, die 2.6.3 kennt; Formatnummer bleibt',async()=>{nurBekannt(pp);assert.equal(pp.version,5);assert.equal(JSON.stringify(pp).includes('Termin'),false);});
 await check('Link mitteilung=m2 wählt den 20.08. vor (auch gegen eine gemerkte Wahl), m1 den 12.08.; _Projekt.json byte-gleich (T11)',async()=>{
  await termin(page,'2026-08-20','weg');await termin(page,'alle');await page.waitForTimeout(200);   // gemerkt: „alle“ (grau/ausblenden: ausblenden)
  for(const [m,tag] of [['m2','2026-08-20'],['m1','2026-08-12'],['m3','alle'],['m9','alle'],['','alle']]){
   await page.goto(`${base}/#projekt=${encodeURIComponent(NAME)}${m?`&mitteilung=${m}`:''}`);await page.reload();await page.locator('#project-badge:not([hidden])').waitFor({state:'attached'});
   await page.waitForFunction(()=>!document.getElementById('termin')?.hidden,null,{timeout:30000});await pk.schritt(page,3);
   assert.equal(await page.locator('#termin-tag').inputValue(),tag,m);
   if(m==='m2')assert.equal(await page.locator('#termin-frueher').inputValue(),'grau','Link: frühere grau');
   if(m)assert.match(decodeURIComponent(await page.evaluate(()=>location.hash)),new RegExp(`mitteilung=${m}`),'Teil bleibt im Link');}
  await page.locator('#termin-tag').selectOption('2026-08-20');assert.equal(await page.locator('#termin-tag').inputValue(),'2026-08-20','danach gilt die eigene Wahl');
  assert.equal(await fs(page,'text',[NAME],'_Projekt.json'),pjVorher,'PlanKit schreibt _Projekt.json nie');
 });
 geschrieben.plaene=await fs(page,'list',[NAME,PLAN]);
 if(process.env.ORTSTERMINE_DUMP){const {writeFile,mkdir}=await import('node:fs/promises');await mkdir(process.env.ORTSTERMINE_DUMP,{recursive:true});
  for(const f of geschrieben.plaene)if(/^Probenplan /.test(f.name))await writeFile(`${process.env.ORTSTERMINE_DUMP}/${f.name}`,Buffer.from(await fs(page,'bytes',[NAME,PLAN],f.name),'base64'));
  await writeFile(`${process.env.ORTSTERMINE_DUMP}/${geschrieben.anlage}`,Buffer.from(await fs(page,'bytes',[NAME,'Mitteilungen'],geschrieben.anlage),'base64'));}
 await check('Plannamen-Schutz: Umbenennen in „Termin 20.8.2026“/„alle Termine“/„EG Ergebniskarte“ abgelehnt, „Terminal“ geht; alter Name gelb',async()=>{
  await pk.schritt(page,1);
  const umbenennen=async name=>{await page.locator('#pk-plaene [data-pk-sheet="1"]').dblclick();await page.locator('#sheet-dialog').waitFor();await page.locator('#sheet-name').fill(name);await page.locator('#sheet-ok').click();await page.waitForTimeout(250);};
  for(const n of ['Termin 20.8.2026','alle Termine','EG Ergebniskarte']){await umbenennen(n);assert.match(await page.locator('#toast').textContent(),/geht als Name eines Plans nicht/,n);await page.keyboard.press('Escape');}
  await umbenennen('Terminal');assert.equal(await page.locator('#sheet-dialog').isVisible(),false);
  await page.locator('#undo').click();await page.waitForTimeout(300);
 });
 assert.deepEqual(errors,[]);
 // ---- C: ein Termin – Oberfläche, Exportnamen und .probenplan wie bis 2.6.3 ----
 await check('Ein Termin: keine Termin-Teile, Exportnamen wie bis 2.6.3, .probenplan nach Öffnen und Speichern byte-gleich',async()=>{
  const text1=JSON.stringify({...pp,report:VERGLEICH});
  await fs(page,'setup',VERGLEICH,PJ1,svg('EG'),labelkit(2,'26.0998'),false);await fs(page,'write',[VERGLEICH,'_Spektron','PlanKit'],`Probenplan ${VERGLEICH}.probenplan`,text1);
  await page.goto(`${base}/#projekt=${encodeURIComponent(VERGLEICH)}`);await page.reload();await page.locator('#project-badge:not([hidden])').waitFor({state:'attached'});await page.locator('#welcome').waitFor({state:'hidden'});
  await pk.schritt(page,2);assert.equal(await page.locator('#termin2').isVisible(),false);assert.equal(await page.locator('.pl-termin').count(),0);
  for(const [f,o] of [['pdf-a4',{}],['pdf-a4',{scope:'all'}],['png',{scope:'all'}],['pdf-a4',{view:'results'}],['jpeg',{}]]){const r=await ausgeben(page,f,o);assert.deepEqual(r.texte,[],JSON.stringify([f,o]));}
  assert.equal(await page.locator('#termin').isVisible(),false);
  assert.deepEqual((await namen(page,VERGLEICH)).sort(),[`Probenplan ${VERGLEICH} - 1. OG.png`,`Probenplan ${VERGLEICH} - EG - Ergebniskarte.pdf`,`Probenplan ${VERGLEICH} - EG.jpg`,`Probenplan ${VERGLEICH} - EG.pdf`,`Probenplan ${VERGLEICH} - EG.png`,`Probenplan ${VERGLEICH}.pdf`].sort(),'wie bis 2.6.3 (Schritt 0)');
  await openExport(page);await page.locator('#format').selectOption('anlage');await page.locator('#annex-title').fill('Anlage 3');const r=await ausgeben(page,'anlage');assert.deepEqual(r.texte,[]);assert.match(r.toast,/Mitteilungen\/26-0998_Anlage-3_Probenahme_\d{4}-\d{2}-\d{2}\.docx/);
  // ändern und zurücknehmen → PlanKit speichert. Danach: noch einmal öffnen und speichern – genau dieselben Bytes; und dieselbe Datei mit
  // zwei Ortsterminen geöffnet und gespeichert – ebenfalls dieselben Bytes (der Termin steht nie in der Datei; 2.6.3 schreibt sie genauso)
  const datei=()=>fs(page,'text',[VERGLEICH,'_Spektron','PlanKit'],`Probenplan ${VERGLEICH}.probenplan`);
  const speichern=async()=>{await pk.schritt(page,2);await page.keyboard.press('>');await page.waitForTimeout(150);await page.locator('#undo').click();await gespeichert(page);return datei();};
  const c1=await speichern();nurBekannt(JSON.parse(c1));
  await page.reload();await page.locator('#welcome').waitFor({state:'hidden'});const c2=await speichern();assert.ok(c2===c1,'ein Termin: erneut geöffnet und gespeichert – dieselben Bytes');
  await fs(page,'write',[VERGLEICH],'_Projekt.json',JSON.stringify(PJ2));await page.reload();await page.locator('#welcome').waitFor({state:'hidden'});await page.waitForFunction(()=>!document.getElementById('termin2')?.hidden,null,{timeout:30000});
  const c3=await speichern();assert.ok(c3===c1,'zwei Termine: dieselben Bytes wie mit einem Termin');
  await fs(page,'write',[VERGLEICH],'_Projekt.json',JSON.stringify(PJ1));geschrieben.einTermin=c1;
  if(process.env.ORTSTERMINE_DUMP){const {writeFile,mkdir}=await import('node:fs/promises');await mkdir(process.env.ORTSTERMINE_DUMP,{recursive:true});await writeFile(`${process.env.ORTSTERMINE_DUMP}/ein-termin.probenplan`,c1);await writeFile(`${process.env.ORTSTERMINE_DUMP}/zwei-termine.probenplan`,JSON.stringify(pp));await writeFile(`${process.env.ORTSTERMINE_DUMP}/plaene.json`,JSON.stringify(await fs(page,'list',[VERGLEICH,'Pläne'])));}
 });
 await check('Plannamen-Schutz: ein bestehender Plan „alle Termine“ wird gelb genannt, nie still umbenannt',async()=>{
  const alt=JSON.parse(await fs(page,'text',[VERGLEICH,'_Spektron','PlanKit'],`Probenplan ${VERGLEICH}.probenplan`));alt.sheets[1].name='alle Termine';const t=JSON.stringify(alt);
  await fs(page,'write',[VERGLEICH,'_Spektron','PlanKit'],`Probenplan ${VERGLEICH}.probenplan`,t);await page.reload();await page.locator('#welcome').waitFor({state:'hidden'});
  await pk.schritt(page,1);await page.locator('#plan-name-warnung').waitFor();assert.match(await page.locator('#plan-name-warnung').textContent(),/Plan „alle Termine“ bitte umbenennen/);
  await pk.schritt(page,3);assert.equal(await page.locator('#plan-name-warnung-3').isVisible(),true);
  await page.waitForTimeout(500);assert.equal(await fs(page,'text',[VERGLEICH,'_Spektron','PlanKit'],`Probenplan ${VERGLEICH}.probenplan`),t,'Datei unverändert');
 });
 assert.deepEqual(errors,[]);
}finally{await browser.close();}

// ---- B: Kette – BerichtKit 1.27.0 (anlagen.js) und Projektzentrale 1.56.0 (mitteilungen.js) mit den wirklich geschriebenen Namen ----
{
 const pz=new URL('../../projektzentrale/',import.meta.url);
 if(!existsSync(new URL('anlagen.js',pz))){assert.ok(process.env.PROJEKTZENTRALE_PFLICHT!=='1','../projektzentrale fehlt (PROJEKTZENTRALE_PFLICHT=1)');console.log('SKIP Kette: ../projektzentrale fehlt');}
 else{
  const req=createRequire(import.meta.url),A=req(new URL('anlagen.js',pz).pathname),M=req(new URL('mitteilungen.js',pz).pathname);
  const pdfs=geschrieben.plaene.filter(f=>/^Probenplan .*\.pdf$/.test(f.name));
  await check('Kette: planName liest Termin, Plan und Ergebniskarte bei jedem von 2.7.0 geschriebenen Namen richtig',async()=>{
   const erwartet={[`Probenplan ${NAME} - EG.pdf`]:['EG','',false,0],[`Probenplan ${NAME} - EG - Termin 20.08.2026.pdf`]:['EG','2026-08-20',false,0],[`Probenplan ${NAME} - EG - Termin 20.08.2026 (2).pdf`]:['EG','2026-08-20',false,2],
    [`Probenplan ${NAME} - EG - Termin 12.08.2026.pdf`]:['EG','2026-08-12',false,0],[`Probenplan ${NAME} - EG - alle Termine.pdf`]:['EG','alle',false,0],[`Probenplan ${NAME} - Termin 20.08.2026.pdf`]:['','2026-08-20',false,0],
    [`Probenplan ${NAME} - EG - Termin 20.08.2026 - Ergebniskarte.pdf`]:['EG','2026-08-20',true,0]};
   assert.deepEqual(pdfs.map(f=>f.name).sort(),Object.keys(erwartet).sort(),'alle PDFs dieser Sitzung');
   for(const f of pdfs){const z=A.planName(f.name,[NAME]);assert.deepEqual([z.plan,z.termin,z.ergebnis,z.kopie],erwartet[f.name],f.name);assert.equal(z.ordner,NAME);}
  });
  const pj=JSON.parse(JSON.stringify(PJ2)),plaene=geschrieben.plaene.filter(f=>f.name.endsWith('.pdf'));
  await check('Kette BerichtKit: Plan je Termin über planFinden(…, { termin }) – mit und ohne lesbare .probenplan; nichts ausgelassen',async()=>{
   const wo={frueher:[],geschosse:['EG','1. OG'],nr:NR};
   for(const w of [wo,undefined]){
    const f=(art,wahl)=>A.planFinden(art,plaene,{t:Date.now()},NAME,w,wahl);
    const t1=f('probenplan',{termin:'2026-08-12',ersterTermin:true}),t2=f('probenplan',{termin:'2026-08-20',ersterTermin:false}),alle=f('probenplan',{termin:'alle'}),erg=f('ergebniskarte',{termin:'2026-08-20',ersterTermin:false});
    for(const [k,soll] of [[t1,'2026-08-12'],[t2,'2026-08-20'],[alle,'alle'],[erg,'2026-08-20']]){assert.ok(k,`${soll} gefunden`);assert.ok(k.dateien.every(d=>A.planName(d.split('/').pop(),[NAME]).termin===soll),`${soll}: ${k.dateien}`);assert.equal((k.ausgelassen||[]).length,0,`nichts ausgelassen: ${k.ausgelassen}`);}
    assert.deepEqual(t1.dateien,[`Pläne/Probenplan ${NAME} - EG - Termin 12.08.2026.pdf`],'Termin 1: die Datei mit seinem Datum, nicht die alte ohne Zusatz');
    const ohne=A.planFinden('probenplan',plaene,{t:Date.now()},NAME,w);assert.equal((ohne.ausgelassen||[]).length,0);assert.equal(ohne.unklar,true,'BerichtKit hakt Termin-Pläne nicht vor (bis Stufe 4)');}
  });
  await check('Kette Projektzentrale: m1 → Plan vom 12.08., m2 → vom 20.08., Mitteilung über beide Tage → „alle Termine“; keine gelbe Zeile',async()=>{
   const vorhanden=new Set(plaene.map(f=>('pläne/'+f.name).normalize('NFC').toLowerCase())),l=M.liste(pj,[],[]);
   const L=M.anlagenListen(l,{pj,fotos:[],plaene,labor:[],vorhanden,fk:null,bk:[],ordnerName:NAME,projektNr:NR},A);
   const plan=k=>L.get(k).zeilen.filter(z=>z.art==='probenplan');
   for(const [k,soll] of [['m1','2026-08-12'],['m2','2026-08-20'],['m3','alle']]){const z=plan(k);assert.ok(z.length,k);
    for(const x of z){assert.ok(!x.fehlt,`${k}: ${x.grund}`);assert.ok(!x.warnung,`${k}: ${x.warnung}`);assert.ok(x.dateien.length&&x.dateien.every(d=>A.planName(d.split('/').pop(),[NAME]).termin===soll),`${k}: ${x.dateien}`);}}
   assert.deepEqual(plan('m3')[0].dateien,[`Pläne/Probenplan ${NAME} - EG - alle Termine.pdf`]);
   for(const m of l.mitteilungen){const k=M.kachelTexte(m,L.get(m.schluessel),pj);assert.equal(k.plan.luecke,false,`${m.schluessel}: ${k.plan.text}`);}
  });
  await check('Kette: Anlage Probenahme mit Termin im Namen wird als Anlage erkannt',async()=>{assert.ok(geschrieben.anlage);assert.equal(A.wordFinden('probenahme',[{name:geschrieben.anlage,t:1}],'',null).dateien[0],`Mitteilungen/${geschrieben.anlage}`);});
 }
}

// ---- D: Legende über die echten Module (eigener Vite-Server, nicht die Produktionsseite) ----
{
 const {createServer}=await import('vite'),server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'silent',appType:'spa'});await server.listen();
 const b=await chromium.launch();
 try{const page=await(await b.newContext()).newPage(),url=`http://127.0.0.1:${server.httpServer.address().port}/`;await page.goto(url);
  const r=await page.evaluate(async()=>{
   const E=await import('/src/export.ts'),T=await import('/src/termine.ts'),R=await import('/src/results.ts');
   const pj={ortstermin:'2026-08-12',weitereOrtstermine:[{id:'t2',datum:'2026-08-20',bezeichnung:'Nachbeprobung'}]},t=T.tage(pj);
   const m=(id,label,datum,form,surface,wert)=>({id,kind:'sample',label,note:'',x:100,y:100,lx:100,ly:100,shape:form,surface,lab:{ref:label,desc:'',datum,werte:[{p:'Summe 16 EPA-PAK exkl. BG',r:wert,u:'µg/100 cm²'}]}});
   const p={format:'probenplan',version:4,plan:{name:'EG',width:1000,height:800,data:'',vector:true},markers:[m('a','P1','2026-08-12','square','ceiling','80'),m('b','P14','2026-08-20','circle','wall','3'),m('c','P15','2026-08-20','circle','wall','5'),{id:'f',kind:'fire',label:'B1',note:'',x:5,y:5,lx:5,ly:5}],
    nextSample:16,nextFire:2,report:'',date:'',results:{usage:'residential',parameter:'Summe 16 EPA-PAK exkl. BG',scales:{}}};
   const w={tag:'2026-08-20',frueher:'grau'},v=T.ansicht(p,(l,d,h)=>T.zuordnen(l,d,null,t,h),w,T.terminKopf(w,t));
   const texte=l=>l.entries.flatMap(e=>[e.name,...e.variants.map(x=>x.text)]);
   const rated=R.rateMarkers(v);
   return {plan:texte(E.legendLayout(v,1000,10)),erg:texte(E.legendLayout(v,1000,10,rated)),alle:texte(E.legendLayout(p,1000,10)),ungrau:rated.unrated,fill:[...rated.fill.keys()]};
  });
  await check('Legende nur mit den Proben des Tages, „grau: Proben vom 12.08.2026“; Ergebniskarte bewertet nur P14/P15',async()=>{
   assert.ok(r.plan.includes('grau: Proben vom 12.08.2026'),r.plan.join(' | '));assert.equal(r.plan.some(x=>/P1\b/.test(x)),false,`P1 nicht in der Legende: ${r.plan.join(' | ')}`);
   assert.equal(r.plan.includes('Probenarten'),false,'nur noch eine Form (Kreis) – keine Legende der Formen');assert.ok(r.plan.includes('Ansicht: P14, P15'));assert.equal(r.plan.some(x=>/Untersicht/.test(x)),false);
   assert.ok(r.alle.includes('Probenarten'),'ohne Termin-Ansicht: Formen beider Termine');assert.ok(r.alle.some(x=>/Untersicht: P1/.test(x)));
   assert.deepEqual(r.fill.sort(),['b','c'],'nur die Proben des Tages bewertet');assert.equal(r.erg.some(x=>/\bP1\b/.test(x)),false,r.erg.join(' | '));
  });
 }finally{await b.close();await server.close();}
}
