// Anlage Probenahme mit Fotos in Unterordnern von „Fotos“ (FotoKit ab 2.7.0, O2/O3/O10): Schlüssel „Unterordner/Datei“,
// genau eine Ebene. Ein Weg, der nicht gelesen werden darf (leerer Ordnerteil, „..“, „_…“, „.…“, tiefer), oder ein
// fehlendes Foto gilt als „fehlt“ – die Anlage wird trotzdem erstellt. Nur Chromium (Ordnerzugriff), erfundene Daten.
import * as pk from './pk-ui.mjs';
import {chromium,openExport} from './runtime.mjs';
import {labXML,labRows,labErgebnisse} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
const NAME='26.0143 Teststadt',PARAM='Summe 16 EPA-PAK exkl. BG',UNIT='µg/100 cm²';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="white"/><path d="M30 30H1570V970H30Z M800 30V970" fill="none" stroke="black" stroke-width="10"/><text x="300" y="500" font-size="60">Küche</text><text x="1100" y="500" font-size="60">Wohnzimmer</text></svg>';
const rows=labRows.slice(0,3).map((r,i)=>({...r,lines:[{p:PARAM,r:['38,5','120','2,0'][i],u:UNIT}]}));
// Schlüssel, die nicht gelesen werden dürfen (die Datei liegt jeweils da, wo der Weg hinzeigen würde)
const UNGUELTIG=['_aussortiert/IMG_0003.jpg','.versteckt/IMG_0004.jpg','../IMG_0005.jpg','Bilder A/Tiefer/IMG_0006.jpg','/IMG_0007.jpg','Bilder A/'];
async function check(name,fn){await fn();console.log(`OK ${name}`);}
async function tap(page,fx,fy){const pt=await page.locator('#drawing').evaluate((el,[fx,fy])=>{const r=el.querySelector('#plan-clip rect'),q=new DOMPoint(fx*Number(r.getAttribute('width')),fy*Number(r.getAttribute('height'))).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};},[fx,fy]);await page.mouse.click(pt.x,pt.y);}
function unzip(buf){const out={};let p=0;while(buf.readUInt32LE(p)===0x04034b50){const size=buf.readUInt32LE(p+18),n=buf.readUInt16LE(p+26),e=buf.readUInt16LE(p+28),name=buf.subarray(p+30,p+30+n).toString('utf8');out[name]=buf.subarray(p+30+n+e,p+30+n+e+size);p+=30+n+e+size;}return out;}
const text=xml=>xml.replace(/<w:br\/>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');

const fs=(page,action,...args)=>page.evaluate(async([action,args])=>{
 const root=await navigator.storage.getDirectory(),archiv=await root.getDirectoryHandle('Mosaik Archivordner',{create:true});
 const dir=async path=>{let d=archiv;for(const p of path)d=await d.getDirectoryHandle(p,{create:true});return d;};
 const write=async(d,n,data)=>{const w=await(await d.getFileHandle(n,{create:true})).createWritable();await w.write(data);await w.close();};
 const hex=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(action==='setup'){const [name,svg,xml,erg,ungueltig]=args;for await(const [n] of archiv.entries())await archiv.removeEntry(n,{recursive:true});
  const proj=await dir([name]);for(const sub of ['Pläne','Laborergebnisse','Laboraufträge','Fotos'])await proj.getDirectoryHandle(sub,{create:true});
  await write(proj,'_Projekt.json',JSON.stringify({format:'mosaik-projekt',version:1,objekt:'EFH, Musterweg 9'}));
  await write(await dir([name,'Pläne']),'Grundriss EG.svg',svg);await write(await dir([name,'Laborergebnisse']),'AR-999.xml',xml);await write(await dir([name,'Laborergebnisse']),'_Ergebnisse.json',erg);
  const jpeg=async(label,color)=>{const c=new OffscreenCanvas(1200,800),g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,1200,800);g.fillStyle='#fff';g.font='120px sans-serif';g.fillText(label,80,450);return new Uint8Array(await (await c.convertToBlob({type:'image/jpeg',quality:.8})).arrayBuffer());};
  const bilder={};
  const add=async(key,path,label,probe,color)=>{const b=await jpeg(label,color);if(path)await write(await dir(path.slice(0,-1)),path.at(-1),b);bilder[key]={beschreibung:`Foto ${label}`,probe,original:{name:key.split('/').pop(),aufnahme:'2026-10-14 10:42'},sha256:{wert:await hex(b),bytes:b.length}};};
  await add('26.0143_001.jpg',[name,'Fotos','26.0143_001.jpg'],'direkt','P1','#3a6ea5');
  await add('Bilder A/IMG_0001.jpg',[name,'Fotos','Bilder A','IMG_0001.jpg'],'Ordner A','P1','#a53a6e');
  await add('Bilder B/IMG_0001.jpg',[name,'Fotos','Bilder B','IMG_0001.jpg'],'Ordner B','P2','#6ea53a');   // gleicher Dateiname, anderer Ordner
  await add('Bilder A/IMG_0002.jpg',null,'fehlt','P2','#888');                                               // Ordner da, Datei nicht
  const ziel={'_aussortiert/IMG_0003.jpg':['Fotos','_aussortiert','IMG_0003.jpg'],'.versteckt/IMG_0004.jpg':['Fotos','.versteckt','IMG_0004.jpg'],'../IMG_0005.jpg':['IMG_0005.jpg'],
   'Bilder A/Tiefer/IMG_0006.jpg':['Fotos','Bilder A','Tiefer','IMG_0006.jpg'],'/IMG_0007.jpg':['Fotos','IMG_0007.jpg'],'Bilder A/':null};
  for(const k of ungueltig)await add(k,ziel[k]&&[name,...ziel[k]],'ungültig','P3','#555');
  await write(await dir([name,'Fotos']),'_Bildumbenenner.json',JSON.stringify({app:'Bildumbenenner',format:1,version:'2.7.0',reihenfolge:Object.keys(bilder),bilder}));
  await new Promise((res,rej)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const tx=r.result.transaction('kv','readwrite');tx.objectStore('kv').put(archiv,'archiv');tx.oncomplete=()=>{r.result.close();res();};tx.onerror=()=>rej(tx.error);};r.onerror=()=>rej(r.error);});return true;}
 if(action==='list'){const d=await dir(args[0]);const out=[];for await(const h of d.values())out.push(h.name);return out.sort();}
 if(action==='bytes'){const d=await dir(args[0]);const b=new Uint8Array(await(await(await d.getFileHandle(args[1])).getFile()).arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);}
 if(action==='sha'){const d=await dir(args[0]);return hex(await(await(await d.getFileHandle(args[1])).getFile()).arrayBuffer());}
},[action,args]);

const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await fs(page,'setup',NAME,svg,labXML(rows),labErgebnisse(rows),UNGUELTIG);
 await page.goto(`${base}/?projekt=${encodeURIComponent(NAME)}`);await page.locator('#project-badge:not([hidden])').waitFor({state:'attached'});
 await page.locator('#folder-plans button',{hasText:'Grundriss EG.svg'}).click();await page.locator('#welcome').waitFor({state:'hidden'});
 await page.keyboard.press('p');await tap(page,.2,.3);await tap(page,.25,.7);await tap(page,.7,.5);await page.keyboard.press('v');
 await pk.proben(page);await page.locator('#lab-folder-dialog [data-ergebnis]',{hasText:'AR-999.xml'}).click();await page.locator('#lab-review').waitFor();await page.locator('#lab-update-all:visible').click();
 await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
 await page.locator('#saved',{hasText:/gespeichert/}).waitFor();

 let docName='';
 await check('Anlage wird mit Unterordner-Fotos erstellt (kein Abbruch)',async()=>{
  await openExport(page);await page.locator('#format').selectOption('anlage');await page.locator('#annex-title').fill('Anlage 3');
  await pk.ausgeben(page);
  await page.waitForFunction(()=>!document.querySelector('#export')?.disabled&&document.querySelector('#toast')?.textContent,null,{timeout:90000});
  const meldung=await page.locator('#toast').textContent();assert.match(meldung,/Anlage gespeichert/,`Meldung: ${meldung}`);
  docName=(await fs(page,'list',[NAME,'Mitteilungen'])).find(n=>n.endsWith('.docx'));assert.ok(docName,'Anlage in „Mitteilungen“');
 });
 await check('Foto im Unterordner über „Ordner/Datei“ gelesen, gleicher Dateiname in zwei Ordnern getrennt; ungültige Wege „fehlt“',async()=>{
  const files=unzip(Buffer.from(await fs(page,'bytes',[NAME,'Mitteilungen'],docName),'base64')),xml=files['word/document.xml'].toString('utf8'),t=text(xml);
  assert.match(t,/Foto direkt\n26\.0143_001\.jpg · 2026-10-14 10:42\nSHA-256 [0-9a-f]{16}… · unverändert seit FotoKit/);
  assert.match(t,/Foto Ordner A\nBilder A\/IMG_0001\.jpg · 2026-10-14 10:42\nSHA-256 [0-9a-f]{16}… · unverändert seit FotoKit/);
  assert.match(t,/Foto Ordner B\nBilder B\/IMG_0001\.jpg · 2026-10-14 10:42\nSHA-256 [0-9a-f]{16}… · unverändert seit FotoKit/);
  const shaA=await fs(page,'sha',[NAME,'Fotos','Bilder A'],'IMG_0001.jpg'),shaB=await fs(page,'sha',[NAME,'Fotos','Bilder B'],'IMG_0001.jpg');
  assert.notEqual(shaA,shaB);assert.ok(t.includes(shaA)&&t.includes(shaB),'volle Prüfsumme beider Fotos aus den Unterordnern');
  assert.match(t,/Keine Fotos verändert seit FotoKit \(Prüfsumme erneut berechnet und verglichen: 3\)/);
  const m=t.match(/!\nFotos in FotoKit erfasst, aber nicht im Ordner „Fotos“\n([^\n]*)/);assert.ok(m,'Hinweis „fehlt“ im Prüfprotokoll');
  const fehlt=m[1].split(', ');assert.deepEqual([...fehlt].sort(),['Bilder A/IMG_0002.jpg',...UNGUELTIG].sort());
  for(const k of ['Bilder A/IMG_0001.jpg','Bilder B/IMG_0001.jpg','26.0143_001.jpg'])assert.ok(!fehlt.includes(k));
  // Bilder: 1 Planseite + 3 Lageausschnitte + 3 Fotos (direkt, Ordner A, Ordner B) – keins der ungültigen
  assert.equal(Object.keys(files).filter(n=>n.startsWith('word/media/')).length,1+3+3);
  assert.doesNotMatch(t,/Foto ungültig\n/,'kein Foto über einen ungültigen Weg abgebildet');
 });
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
