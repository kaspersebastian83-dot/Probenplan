// Anlage Probenahme (Word): Projekt aus dem Ordner, drei Proben im Plan, Laborbericht, Fotos aus FotoKit (eins verändert,
// eins mit unbekannter Probe-Nr., eins aussortiert). Prüft Inhalt, Bilder, Prüfprotokoll, Ablage in „Mitteilungen“ und
// dass nichts überschrieben wird. Nur Chromium (Ordnerzugriff). ANLAGE_DUMP=<Ordner> legt die .docx zur Sichtprüfung ab.
import {chromium,openExport} from './runtime.mjs';
import {labXML,labRows} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://localhost:4173';
const NAME='26.0142 Teststadt',PARAM='Summe 16 EPA-PAK exkl. BG',UNIT='µg/100 cm²';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="white"/><path d="M30 30H1570V970H30Z M800 30V970" fill="none" stroke="black" stroke-width="10"/><text x="300" y="500" font-size="60">Küche</text><text x="1100" y="500" font-size="60">Wohnzimmer</text></svg>';
const values=['38,5','< 0,50','120','n. n.'];
const rows=labRows.slice(0,4).map((r,i)=>({...r,lines:[{p:PARAM,r:values[i],u:UNIT},{p:'Benzo[a]pyren',r:i===1?'< 0,05':'2,1',u:UNIT}]}));
async function check(name,fn){await fn();console.log(`OK ${name}`);}
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
/** Minimaler ZIP-Leser (Methode „stored“, wie der Word-Schreiber) → {Name: Buffer}. */
function unzip(buf){const out={};let p=0;while(buf.readUInt32LE(p)===0x04034b50){assert.equal(buf.readUInt16LE(p+8),0);const size=buf.readUInt32LE(p+18),n=buf.readUInt16LE(p+26),e=buf.readUInt16LE(p+28),name=buf.subarray(p+30,p+30+n).toString('utf8');out[name]=buf.subarray(p+30+n+e,p+30+n+e+size);p+=30+n+e+size;}
 assert.equal(buf.readUInt32LE(buf.length-22),0x06054b50,'Zentralverzeichnis');assert.equal(buf.readUInt16LE(buf.length-12),Object.keys(out).length);return out;}
const text=xml=>xml.replace(/<w:br\/>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');

const fs=(page,action,...args)=>page.evaluate(async([action,args])=>{
 const root=await navigator.storage.getDirectory(),archiv=await root.getDirectoryHandle('Mosaik Archivordner',{create:true});
 const dir=async path=>{let d=archiv;for(const p of path)d=await d.getDirectoryHandle(p,{create:true});return d;};
 const write=async(d,n,data)=>{const w=await(await d.getFileHandle(n,{create:true})).createWritable();await w.write(data);await w.close();};
 const hex=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(action==='setup'){const [name,svg,xml]=args;for await(const [n] of archiv.entries())await archiv.removeEntry(n,{recursive:true});
  const proj=await dir([name]);for(const sub of ['Pläne','Laborergebnisse','Laboraufträge','Fotos'])await proj.getDirectoryHandle(sub,{create:true});
  await write(proj,'_Projekt.json',JSON.stringify({format:'mosaik-projekt',version:1,objekt:'EFH, Musterweg 7',auftraggeber:'Beispiel AG',schadendatum:'2026-10-02'}));
  await write(await dir([name,'Pläne']),'Grundriss EG.svg',svg);await write(await dir([name,'Laborergebnisse']),'AR-999.xml',xml);
  // Fotos: echte JPEGs (querformatig), Prüfsummen wie FotoKit sie speichert
  const fotos=await dir([name,'Fotos']),bilder={},jpeg=async(label,color)=>{const c=new OffscreenCanvas(1200,800),g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,1200,800);g.fillStyle='#fff';g.font='120px sans-serif';g.fillText(label,80,450);return new Uint8Array(await (await c.convertToBlob({type:'image/jpeg',quality:.8})).arrayBuffer());};
  const add=async(file,label,probe,extra={})=>{const b=await jpeg(label,'#3a6ea5');await write(fotos,file,b);bilder[file]={beschreibung:`Foto ${label}`,probe,original:{name:`IMG_${file}`,aufnahme:'2026-10-14 10:42'},sha256:{wert:await hex(b),bytes:b.length},...extra};};
  await add('26.0142_001.jpg','P1 Übersicht','P1');await add('26.0142_002.jpg','P1 Detail','p 1');await add('26.0142_003.jpg','P2','P2, P3');
  await add('26.0142_004.jpg','alt','P2',{aussortiert:true});await add('26.0142_005.jpg','unbekannt','P42');await add('26.0142_006.jpg','gedreht','P3',{drehung:90});
  bilder['26.0142_003.jpg'].sha256.wert='0'.repeat(64);   // Datei „verändert“ gegenüber FotoKit
  await write(fotos,'_Bildumbenenner.json',JSON.stringify({app:'Bildumbenenner',format:1,reihenfolge:Object.keys(bilder),bilder}));
  await new Promise((res,rej)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const tx=r.result.transaction('kv','readwrite');tx.objectStore('kv').put(archiv,'archiv');tx.oncomplete=()=>{r.result.close();res();};tx.onerror=()=>rej(tx.error);};r.onerror=()=>rej(r.error);});return true;}
 if(action==='list'){const d=await dir(args[0]);const out=[];for await(const h of d.values())out.push(h.name);return out.sort();}
 if(action==='bytes'){const d=await dir(args[0]);const b=new Uint8Array(await(await(await d.getFileHandle(args[1])).getFile()).arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);}
 if(action==='text'){const d=await dir(args[0]);return await(await(await d.getFileHandle(args[1])).getFile()).text();}
 if(action==='sha'){const d=await dir(args[0]);return hex(await(await(await d.getFileHandle(args[1])).getFile()).arrayBuffer());}
},[action,args]);

const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await fs(page,'setup',NAME,svg,labXML(rows));
 // Skala wie aus FotoKit (gemeinsamer Browser-Speicher)
 await page.evaluate(([k])=>localStorage.setItem('bu-scales',JSON.stringify({[k]:{name:'PAK Wischproben',cats:[{name:'gering',from:0},{name:'mittel',from:5},{name:'hoch',from:50}]}})),[`${PARAM}|${UNIT}`]);
 await page.goto(`${base}/?projekt=${encodeURIComponent(NAME)}`);await page.locator('#project-badge:not([hidden])').waitFor();
 await page.locator('#folder-plans button',{hasText:'Grundriss EG.svg'}).click();await page.locator('#welcome').waitFor({state:'hidden'});
 await page.keyboard.press('p');await tap(page,.2,.3);await tap(page,.25,.7);await tap(page,.7,.5);await page.keyboard.press('v');
 await page.locator('#lab-import').click();await page.locator('#lab-folder-dialog [data-lab-file]',{hasText:'AR-999.xml'}).click();await page.locator('#lab-review').waitFor();await page.locator('#lab-update-all:visible').click();
 await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
 await page.locator('#saved',{hasText:/gespeichert/}).waitFor();

 let docName='';
 await check('Export „Word · Anlage Probenahme“ speichert in „Mitteilungen“',async()=>{
  await openExport(page);await page.locator('#format').selectOption('anlage');
  assert.equal(await page.locator('#annex-fields').isVisible(),true);assert.equal(await page.locator('#quality-field').isHidden(),true);
  assert.match(await page.locator('#dimensions-note').textContent(),/4 Proben · 1 Planseite · gespeichert in „Mitteilungen“/);
  assert.equal(await page.locator('#export').textContent(),'↓ Anlage erstellen');
  await page.locator('#annex-title').fill('Anlage 3');
  await page.locator('#export').click();await page.locator('#toast',{hasText:'Anlage gespeichert'}).waitFor({timeout:90000});
  const list=await fs(page,'list',[NAME,'Mitteilungen']);docName=list.find(n=>n.endsWith('.docx'));
  assert.match(docName,/^26-0142_Anlage-3_Probenahme_\d{4}-\d{2}-\d{2}\.docx$/);assert.ok(list.includes('_Anlagen-Protokoll.txt'));
  assert.match(await page.locator('#toast').textContent(),/Hinweise? im Prüfprotokoll/);
 });
 await check('Inhalt: Lageplan, Verzeichnis mit Rohwerten und Einordnung, Probenblätter, Fotos, Prüfprotokoll',async()=>{
  const buf=Buffer.from(await fs(page,'bytes',[NAME,'Mitteilungen'],docName),'base64');if(process.env.ANLAGE_DUMP)await writeFile(`${process.env.ANLAGE_DUMP}/${docName}`,buf);
  const files=unzip(buf),xml=files['word/document.xml'].toString('utf8'),t=text(xml);
  assert.match(t,/^Anlage 3: Probenahme und Laborergebnisse\nProjekt 26\.0142 · Teststadt/m);
  assert.match(t,/Objekt\nEFH, Musterweg 7/);assert.match(t,/Schadendatum\n02\.10\.2026/);
  assert.match(t,/1\. Lageplan der Probenahmestellen/);assert.match(t,/Ohne Maßstab \(Plan nicht kalibriert\)/);
  assert.match(t,/Parameter: Summe 16 EPA-PAK exkl\. BG/);
  assert.match(t,/P1\nTestbereich 1, fiktive Oberfläche/);
  assert.doesNotMatch(t,/Probe\nGeschoss\nProbenahmestelle/,"nur ein Plan: keine Geschoss-Spalte");
  assert.match(t,/38,5 µg\/100 cm²\nmittel/,'Rohwert und Einordnung');assert.match(t,/< 0,50 µg\/100 cm²\nunter BG/);assert.match(t,/120 µg\/100 cm²\nhoch/);
  assert.match(t,/P4\nTestbereich 4[^\n]*\n?[^\n]*\(nicht im Plan\)/,'nicht platzierte Probe wird genannt');
  assert.match(t,/Skala „PAK Wischproben“ \(Vorgabe des Sachverständigen\)/);
  for(const l of ['P1','P2','P3','P4'])assert.match(t,new RegExp(`Probenblatt ${l}\\n`));
  assert.match(t,/Foto P1 Übersicht\n26\.0142_001\.jpg · 2026-10-14 10:42\nSHA-256 [0-9a-f]{16}… · unverändert seit FotoKit/);
  assert.match(t,/26\.0142_003\.jpg[\s\S]*VERÄNDERT seit FotoKit/);
  assert.doesNotMatch(t,/26\.0142_004\.jpg/,'aussortiertes Foto nicht in der Anlage');
  assert.match(t,/Benzo\[a\]pyren\n2,1\nµg\/100 cm²/);
  assert.match(t,/4\. Prüfprotokoll und Herkunftsnachweis/);
  assert.match(t,/!\nProben ohne Lage im Plan\nP4/);
  assert.match(t,/!\nFotos mit Probe-Nr\., die im Projekt nicht vorkommt\nP42/);
  assert.match(t,/!\nFotos verändert seit der Prüfsumme in FotoKit\n26\.0142_003\.jpg/);
  assert.match(t,/!\nProben ohne zugeordnetes Foto \(FotoKit „Probe-Nr\.“\)\nP4/);
  const planSha=await fs(page,'sha',[NAME,'Pläne'],`Probenplan ${NAME}.probenplan`),xmlSha=await fs(page,'sha',[NAME,'Laborergebnisse'],'AR-999.xml');
  assert.ok(t.includes(`Pläne/Probenplan ${NAME}.probenplan`)&&t.includes(planSha),'Prüfsumme der gespeicherten PlanKit-Datei');
  assert.ok(t.includes('Laborergebnisse/AR-999.xml')&&t.includes(xmlSha),'Prüfsumme des Laborberichts');
  assert.ok(t.includes(await fs(page,'sha',[NAME,'Fotos'],'26.0142_001.jpg')),'volle Prüfsumme jedes Fotos');
  // Bilder: 1 Planseite (PNG) + 3 Lageausschnitte + Fotos (P1: 2, P2: 1, P3: 2) – Planseite exakt im Format der Anlage
  const media=Object.keys(files).filter(n=>n.startsWith('word/media/'));assert.equal(media.filter(n=>n.endsWith('.png')).length,1);assert.equal(media.length,1+3+4,'jedes Bild nur einmal in der Datei (Foto 003 gehört zu P2 und P3)');
  assert.equal((xml.match(/<wp:docPr /g)||[]).length,1+3+5,'aber fünfmal ein Foto gezeigt');
  assert.match(xml,/<wp:extent cx="5724000" cy="6912000"\/>/,'Planseite 159 × 192 mm in Originalgröße');
  assert.doesNotMatch(xml,/headerReference|<w:pStyle /);
  // Gedrehtes Foto (drehung 90): hochkant in der Anlage
  const dims=media.filter(n=>n.endsWith('.jpeg')).map(n=>{const b=files[n];let i=2;while(i<b.length){const m=b[i+1],len=b.readUInt16BE(i+2);if(m===0xC0||m===0xC2)return [b.readUInt16BE(i+7),b.readUInt16BE(i+5)];i+=2+len;}return null;});
  assert.ok(dims.some(d=>d&&d[1]>d[0]),'mindestens ein Foto hochkant (FotoKit-Drehung angewendet)');
  const log=await fs(page,'text',[NAME,'Mitteilungen'],'_Anlagen-Protokoll.txt'),docSha=await fs(page,'sha',[NAME,'Mitteilungen'],docName);
  assert.ok(log.includes(`| ${docName} | ${docSha} | Pläne/Probenplan ${NAME}.probenplan | ${planSha} | PlanKit 1.12.0`),'Protokollzeile');
 });
 await check('Zweites Erstellen überschreibt nichts',async()=>{
  await page.locator('#export').click();await page.locator('#toast',{hasText:'_2.docx'}).waitFor({timeout:90000});
  const list=await fs(page,'list',[NAME,'Mitteilungen']);assert.equal(list.filter(n=>n.endsWith('.docx')).length,2);
  assert.equal((await fs(page,'text',[NAME,'Mitteilungen'],'_Anlagen-Protokoll.txt')).trim().split(/\r?\n/).length,3);
  assert.equal(await page.locator('#annex-title').inputValue(),'Anlage 3');
 });
 await check('Zwei Geschosse: je Geschoss eine Planseite, Spalte „Geschoss“, Probe im OG mit Lage',async()=>{
  await page.locator('#export-dialog .close').click();
  await page.locator('#sheet-add').click();await page.locator('#sheet-file').setInputFiles({name:'OG.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg.replace('Küche','Bad'))});
  await page.locator('#sheet-strip:not(.single)').waitFor();await page.keyboard.press('p');await tap(page,.4,.4);await page.keyboard.press('v');
  await openExport(page);await page.locator('#format').selectOption('anlage');assert.match(await page.locator('#dimensions-note').textContent(),/5 Proben · 2 Planseiten/);
  await page.locator('#export').click();await page.locator('#toast',{hasText:'_3.docx'}).waitFor({timeout:90000});
  const name=(await fs(page,'list',[NAME,'Mitteilungen'])).find(n=>n.endsWith('_3.docx'));
  const files=unzip(Buffer.from(await fs(page,'bytes',[NAME,'Mitteilungen'],name),'base64')),t=text(files['word/document.xml'].toString('utf8'));
  assert.equal(Object.keys(files).filter(n=>/media\/.*\.png$/.test(n)).length,2,'zwei Planseiten');
  assert.match(t,/1\. Lageplan der Probenahmestellen – EG \(1\/2\)/);assert.match(t,/1\. Lageplan der Probenahmestellen – 1\. OG \(2\/2\)/);
  assert.match(t,/Probe\nGeschoss\nProbenahmestelle/);assert.match(t,/P5\n1\. OG/);assert.match(t,/P1\nEG/);assert.match(t,/P4\nnicht im Plan/);
  assert.match(t,/Probenblatt P5\n[\s\S]*?Lage im Plan \(1\. OG\)/);
 });
 await check('Aus der Projektzentrale (?aktion=anlage) ist der Export mit der Anlage gleich offen',async()=>{
  await page.locator('#saved',{hasText:/gespeichert/}).waitFor();await page.waitForTimeout(1500);
  await page.goto(`${base}/?projekt=${encodeURIComponent(NAME)}&aktion=anlage`);await page.locator('button',{hasText:'Datei verwenden'}).click({timeout:4000}).catch(()=>{});
  await page.locator('#export-dialog[open]').waitFor();assert.equal(await page.locator('#format').inputValue(),'anlage');assert.ok(await page.locator('#annex-fields').isVisible());
 });
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
