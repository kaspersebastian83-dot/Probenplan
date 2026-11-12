// Nachzeichnung und Ausgaben (E24, ab 2.4.0): die Word-„Anlage Probenahme“ desselben Projekts mit und ohne Nachzeichnung.
// Projekt im Ordner (OPFS), drei Proben im Plan, Laborbericht. Erst die Anlage ohne Nachzeichnung, dann nachzeichnen
// (Räume, verbundener Raum, schräge Wand, Tür, Fenster, geprüft, Schalter „Nachgezeichnete Räume zeigen“ an) und die Anlage noch einmal.
// Erwartet: alle Bilder (Planseite, Lageausschnitte) bytegleich, der Text gleich – bis auf die Prüfsumme und den Stand der PlanKit-Datei
// im Prüfprotokoll (die Datei enthält jetzt die Nachzeichnung; diese eine Zeile MUSS sich ändern). Nur Chromium (Ordnerzugriff).
// PNG und PDF vergleicht nachzeichnen-waende-browser.mjs. ANLAGE_DUMP=<Ordner> legt beide .docx zur Sichtprüfung ab.
import * as pk from './pk-ui.mjs';
import {chromium,openExport} from './runtime.mjs';
import {labXML,labRows,labErgebnisse} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://localhost:4173';
const NAME='26.0143 Teststadt',PARAM='Summe 16 EPA-PAK exkl. BG',UNIT='µg/100 cm²';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="white"/><path d="M30 30H1570V970H30Z M800 30V970 M800 500L1300 970" fill="none" stroke="black" stroke-width="10"/><text x="300" y="500" font-size="60">Küche</text><text x="1100" y="300" font-size="60">Wohnzimmer</text></svg>';
const rows=labRows.slice(0,3).map((r,i)=>({...r,lines:[{p:PARAM,r:['38,5','< 0,50','120'][i],u:UNIT}]}));
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
async function drag(page,a,b){const p=await toScreen(page,...a),q=await toScreen(page,...b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move((p.x+q.x)/2,(p.y+q.y)/2,{steps:3});await page.mouse.move(q.x,q.y,{steps:3});await page.mouse.up();}
async function tap(page,x,y){const p=await toScreen(page,x,y);await page.mouse.click(p.x,p.y);}
/** Minimaler ZIP-Leser (Methode „stored“, wie der Word-Schreiber) → {Name: Buffer}. */
function unzip(buf){const out={};let p=0;while(buf.readUInt32LE(p)===0x04034b50){assert.equal(buf.readUInt16LE(p+8),0);const size=buf.readUInt32LE(p+18),n=buf.readUInt16LE(p+26),e=buf.readUInt16LE(p+28),name=buf.subarray(p+30,p+30+n).toString('utf8');out[name]=buf.subarray(p+30+n+e,p+30+n+e+size);p+=30+n+e+size;}return out;}
const text=xml=>xml.replace(/<w:br\/>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
const fs=(page,action,...args)=>page.evaluate(async([action,args])=>{
 const root=await navigator.storage.getDirectory(),archiv=await root.getDirectoryHandle('Mosaik Archivordner',{create:true});
 const dir=async path=>{let d=archiv;for(const p of path)d=await d.getDirectoryHandle(p,{create:true});return d;};
 const write=async(d,n,data)=>{const w=await(await d.getFileHandle(n,{create:true})).createWritable();await w.write(data);await w.close();};
 if(action==='setup'){const [name,svg,xml,erg]=args;for await(const [n] of archiv.entries())await archiv.removeEntry(n,{recursive:true});
  const proj=await dir([name]);for(const sub of ['Pläne','Laborergebnisse','Laboraufträge','Fotos'])await proj.getDirectoryHandle(sub,{create:true});
  await write(proj,'_Projekt.json',JSON.stringify({format:'mosaik-projekt',version:1,objekt:'EFH, Musterweg 7',auftraggeber:'Beispiel AG',schadendatum:'2026-10-02'}));
  await write(await dir([name,'Pläne']),'Grundriss EG.svg',svg);await write(await dir([name,'Laborergebnisse']),'AR-999.xml',xml);if(erg)await write(await dir([name,'Laborergebnisse']),'_Ergebnisse.json',erg);
  await new Promise((res,rej)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const tx=r.result.transaction('kv','readwrite');tx.objectStore('kv').put(archiv,'archiv');tx.oncomplete=()=>{r.result.close();res();};tx.onerror=()=>rej(tx.error);};r.onerror=()=>rej(r.error);});return true;}
 if(action==='list'){const d=await dir(args[0]);const out=[];for await(const h of d.values())out.push(h.name);return out.sort();}
 if(action==='bytes'){const d=await dir(args[0]);const b=new Uint8Array(await(await(await d.getFileHandle(args[1])).getFile()).arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);}
 if(action==='text'){const d=await dir(args[0]);return await(await(await d.getFileHandle(args[1])).getFile()).text();}
},[action,args]);

const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await fs(page,'setup',NAME,svg,labXML(rows),labErgebnisse(rows));
 await page.evaluate(([k])=>{localStorage.setItem('bu-scales',JSON.stringify({[k]:{name:'PAK Wischproben',cats:[{name:'gering',from:0},{name:'mittel',from:5},{name:'hoch',from:50}]}}));localStorage.setItem('plankit-kuerzel','Ben');},[`${PARAM}|${UNIT}`]);
 await page.goto(`${base}/?projekt=${encodeURIComponent(NAME)}`);await page.locator('#project-badge:not([hidden])').waitFor({state:'attached'});
 await page.locator('#folder-plans button',{hasText:'Grundriss EG.svg'}).click();await page.locator('#welcome').waitFor({state:'hidden'});
 await page.keyboard.press('p');await tap(page,320,300);await tap(page,400,700);await tap(page,1120,500);await page.keyboard.press('v');
 await pk.proben(page);await page.locator('#lab-folder-dialog [data-ergebnis]',{hasText:'AR-999.xml'}).click();await page.locator('#lab-review').waitFor();await page.locator('#lab-update-all:visible').click();
 await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
 await page.locator('#saved',{hasText:/gespeichert/}).waitFor();
 const datei=`Probenplan ${NAME}.probenplan`,lesen=async()=>JSON.parse(await fs(page,'text',[NAME,'Pläne'],datei));
 const anlage=async titel=>{const vorher=await fs(page,'list',[NAME,'Mitteilungen']).catch(()=>[]);
  await openExport(page);await page.locator('#format').selectOption('anlage');await page.locator('#annex-title').fill(titel);
  await page.evaluate(()=>{document.getElementById('toast').hidden=true;});await pk.ausgeben(page);await page.locator('#toast',{hasText:'Anlage gespeichert'}).waitFor({timeout:90000});
  const neu=(await fs(page,'list',[NAME,'Mitteilungen'])).filter(n=>n.endsWith('.docx')&&!vorher.includes(n));assert.equal(neu.length,1,'eine neue Anlage');
  const buf=Buffer.from(await fs(page,'bytes',[NAME,'Mitteilungen'],neu[0]),'base64');if(process.env.ANLAGE_DUMP)await writeFile(`${process.env.ANLAGE_DUMP}/${neu[0]}`,buf);return unzip(buf);};

 await page.clock.setFixedTime(new Date('2026-11-12T10:00:00'));   // Erstellungszeit der Anlage festhalten
 const ohne=await anlage('Anlage 3');
 const vorher=await lesen();assert.equal(vorher.plan.trace,undefined);assert.ok(vorher.version<7,'ohne Nachzeichnung: bisheriges Format');

 let mit;
 await check('Nachzeichnung mit Räumen, verbundenem Raum, schräger Wand, Tür und Fenster – geprüft, in ② eingeblendet; Proben unverändert',async()=>{
  await pk.vorbereiten(page,'trace-edit');await page.locator('#trace-actions').waitFor();
  await drag(page,[30,30],[800,970]);await page.locator('#trace-name').fill('Küche');await page.keyboard.press('Enter');
  await drag(page,[800,30],[1570,500]);await page.locator('#trace-name').fill('Wohnzimmer');await page.keyboard.press('Enter');
  await drag(page,[1300,500],[1570,970]);   // Rechteck unter dem Wohnzimmer → gehört dazu
  await page.locator('#trace-join').click();await tap(page,1200,200);
  await page.locator('[data-trace-tool="wall"]').click();await drag(page,[800,500],[1300,970]);
  await page.locator('[data-trace-tool="door"]').click();await tap(page,800,300);
  await page.locator('[data-trace-tool="window"]').click();await drag(page,[950,641],[1100,782]);
  await page.keyboard.press('Escape');await page.locator('#trace-done').click();await page.locator('#trace-ok').click();await page.locator('#trace-actions').waitFor({state:'hidden'});
  if(await page.locator('#trace-nicht-jetzt').isVisible())await page.locator('#trace-nicht-jetzt').click();if(await page.locator('#trace-proben-zu').isVisible())await page.locator('#trace-proben-zu').click();
  await pk.schritt(page,2);await page.locator('#trace-toggle').click();assert.ok(await page.locator('#trace-view [data-trace-room]').count()>=3);
  // warten, bis die Nachzeichnung in der Datei im Projektordner steht (Speichern läuft verzögert)
  let p;for(let i=0;i<120;i++){p=await lesen();if(p.plan.trace?.checked)break;await page.waitForTimeout(250);}
  const t=p.plan.trace;assert.ok(t,'Nachzeichnung steht in der Projektdatei');assert.equal(p.version,7);assert.equal(t.rooms.length,3);assert.ok(t.rooms[2].joins);assert.equal(t.walls.length,1);
  assert.deepEqual(t.openings.map(o=>o.kind),['door','window']);assert.equal(t.checked.by,'Ben');
  assert.deepEqual(p.markers,vorher.markers,'Proben wie vor dem Nachzeichnen („Nicht jetzt“)');assert.equal(p.plan.data,vorher.plan.data,'Planbild unverändert');
 });
 await check('Anlage mit Nachzeichnung: alle Bilder bytegleich, Text gleich bis auf Prüfsumme/Stand der PlanKit-Datei',async()=>{
  mit=await anlage('Anlage 3');
  assert.deepEqual(Object.keys(mit).sort(),Object.keys(ohne).sort(),'dieselben Teile in der Word-Datei');
  const bilder=Object.keys(ohne).filter(n=>n.startsWith('word/media/'));assert.ok(bilder.length>=4,'Planseite und Lageausschnitte');
  for(const n of bilder)assert.equal(Buffer.compare(ohne[n],mit[n]),0,`${n} bytegleich`);
  for(const n of Object.keys(ohne))if(!n.startsWith('word/media/')&&n!=='word/document.xml'&&n!=='docProps/core.xml')assert.equal(Buffer.compare(ohne[n],mit[n]),0,`${n} gleich`);
  const a=text(ohne['word/document.xml'].toString('utf8')).split('\n'),b=text(mit['word/document.xml'].toString('utf8')).split('\n');
  assert.equal(a.length,b.length,'gleich viele Zeilen');
  const anders=a.map((z,i)=>[z,b[i],i]).filter(([x,y])=>x!==y);
  // Erlaubt ist nur der Eintrag der PlanKit-Projektdatei im Prüfprotokoll: ihre Prüfsumme (64 Hex-Zeichen) und ihr Stand (Datum Uhrzeit).
  const kopf=a.findIndex(z=>z.includes(`Pläne/${datei}`));assert.ok(kopf>=0,'die PlanKit-Datei steht im Prüfprotokoll');
  for(const [x,y,i] of anders){assert.ok(i>kopf&&i<=kopf+4,`Unterschied nur am Eintrag der PlanKit-Datei (Zeile ${i}: „${x}“ / „${y}“)`);
   assert.ok((/^[0-9a-f]{64}$/.test(x)&&/^[0-9a-f]{64}$/.test(y))||(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(x)&&/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(y)),`nur Prüfsumme oder Stand: „${x}“ / „${y}“`);}
  assert.ok(anders.some(([x])=>/^[0-9a-f]{64}$/.test(x)),'die Prüfsumme der PlanKit-Datei hat sich geändert (sie enthält jetzt die Nachzeichnung)');
  const t=b.join('\n');assert.doesNotMatch(t,/Nachzeichnung|nachgezeichnet|geprüft am/,'die Nachzeichnung wird in der Anlage nirgends genannt');
  assert.equal((ohne['word/document.xml'].toString('utf8').match(/<wp:docPr /g)||[]).length,(mit['word/document.xml'].toString('utf8').match(/<wp:docPr /g)||[]).length);
 });
 assert.deepEqual(errors,[],'keine Seitenfehler');
}finally{await browser.close();}
