// Wandansichten der Bohrkerne: Projektordner mit LabelKit-Datei (Wandblatt-Bohrkerne) und Prüfbericht (MKW), Dialog,
// Vorschau, Word-Anlage und CSV in „Mitteilungen“. Synthetische Daten. Nur Chromium (Ordnerzugriff).
import {chromium} from './runtime.mjs';
import {labXML} from './lab-fixtures.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
const NAME='26.0142 Teststadt',C40='Kohlenwasserstoffe C10-C40',C22='Kohlenwasserstoffe C10-C22',U='mg/kg TS';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="white"/><path d="M30 30H1570V970H30Z" fill="none" stroke="black" stroke-width="10"/></svg>';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
function unzip(buf){const out={};let p=0;while(buf.readUInt32LE(p)===0x04034b50){const size=buf.readUInt32LE(p+18),n=buf.readUInt16LE(p+26),e=buf.readUInt16LE(p+28),name=buf.subarray(p+30,p+30+n).toString('utf8');out[name]=buf.subarray(p+30+n+e,p+30+n+e+size);p+=30+n+e+size;}return out;}
const text=xml=>xml.replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');

// LabelKit-Datei wie nach „Proben anlegen“ aus dem Wandblatt (4.38): Wand B mit Maßen, Boden ohne
const seg=(nr,id,t,von,bis,st,extra={})=>({id:100+nr,_nr:nr,matrix:'Bohrkern',z2:'EG Wohnzimmer',bkBez:id.replace(/-T\d$/,''),bkId:id,bkVon:von,bkBis:bis,bkSegment:t,bkMaterial:t===1?'Putz':'Ziegel',bkStatus:st,
 notiz:st==='R'?'Rückstellprobe – nicht analysieren':'MKW (KW-Index C10–C40 und C10–C22)',bkQuelle:'26.0142-BK-01',...extra});
const B={bkWandL:4.2,bkWandH:2.5};
const daten={version:'4.38.0',projekt:{nr:'26.0142'},proben:[],sonstigeProben:[
 seg(1,'EG-WZ-B-7-T1',1,0,2,'A',{...B,bkEcke:0.6,bkOkff:0.3,bkGeruch:'++'}),seg(2,'EG-WZ-B-7-T2',2,2,6,'A',{...B,bkEcke:0.6,bkOkff:0.3}),seg(3,'EG-WZ-B-7-T3',3,6,12,'R',{...B,bkEcke:0.6,bkOkff:0.3}),
 seg(4,'EG-WZ-B-3-T1',1,0,2,'A',{...B,bkEcke:3.6,bkOkff:2.1}),seg(5,'EG-WZ-B-3-T2',2,2,6,'A',{...B,bkEcke:3.6,bkOkff:2.1}),
 seg(6,'EG-WZ-BO-5-T1',1,0,3,'A')]};
const werte={1:['8400','2100'],2:['640','< 50'],4:['< 50','< 50'],5:['n.n.','n.n.'],6:['1900','300']};
const rows=Object.entries(werte).map(([n,[a,b]])=>({ref:`Probe ${n}`,desc:`Bohrkern ${n}`,art:'Feststoff',labNr:`999-2099-${String(n).padStart(8,'0')}`,lines:[{p:C40,r:a,u:U},{p:C22,r:b,u:U}]}));

const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Projektordner im Origin Private File System; „Ordner öffnen“ bekommt ihn über den Dateidialog
 await context.addInitScript(name=>{window.showDirectoryPicker=async()=>(await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(name);},NAME);
 await page.goto(base);
 await page.evaluate(async([name,svg,daten,xml])=>{
  const root=await navigator.storage.getDirectory();for await(const [n] of root.entries())await root.removeEntry(n,{recursive:true});
  const archiv=await root.getDirectoryHandle('Mosaik Archivordner',{create:true}),proj=await archiv.getDirectoryHandle(name,{create:true});
  const put=async(sub,n,data)=>{const d=await proj.getDirectoryHandle(sub,{create:true});const w=await(await d.getFileHandle(n,{create:true})).createWritable();await w.write(data);await w.close();};
  await put('Pläne','Grundriss EG.svg',svg);await put('Laboraufträge','26.0142_24.10.2026_Daten.json',JSON.stringify(daten));await put('Laborergebnisse','AR-999.xml',xml);
 },[NAME,svg,daten,labXML(rows,{vorlaeufig:true})]);
 // Skala für MKW (synthetisch) wie aus FotoKit
 await page.evaluate(([k])=>localStorage.setItem('bu-scales',JSON.stringify({[k]:{name:'Testskala MKW (synthetisch)',cats:[{name:'gering',from:0},{name:'erhöht',from:1000},{name:'stark',from:5000}]}})),[`${C40}|${U}`]);
 await page.locator('#open-folder').click();
 await page.locator('#folder-plans button',{hasText:'Grundriss EG.svg'}).click();await page.locator('#welcome').waitFor({state:'hidden'});
 await page.locator('#lab-import').click();await page.locator('#lab-folder-dialog [data-lab-file]',{hasText:'AR-999.xml'}).click();await page.locator('#lab-review').waitFor();
 assert.match(await page.locator('#lab-review').textContent(),/Vorläufiger Prüfbericht AR-999-2099-000001-01/,'Hinweis beim Import');
 await page.locator('#lab-confirm:enabled').click();await page.locator('#lab-review').waitFor({state:'hidden'});
 await page.locator('#results-toggle').click();await page.locator('#result-vorlaeufig:not([hidden])').waitFor();assert.match(await page.locator('#result-vorlaeufig').textContent(),/vorläufigem Prüfbericht AR-999/);await page.locator('#results-toggle').click();

 await check('Dialog: Kerne aus LabelKit, MKW C10–C40 vorgeschlagen, Vorschau je Fläche, Hinweise',async()=>{
  await page.locator('#wand-open').click();await page.locator('#wand-dialog[open]').waitFor();
  assert.match(await page.locator('#wand-quelle').textContent(),/2 Flächen mit 3 Bohrkernen aus Laboraufträge\/26\.0142_24\.10\.2026_Daten\.json/);
  assert.equal(await page.locator('#wand-p1').inputValue(),C40);assert.equal(await page.locator('#wand-p2').inputValue(),C22);
  assert.equal(await page.locator('#wand-vorschau img').count(),2);
  await page.waitForFunction(()=>[...document.querySelectorAll('#wand-vorschau img')].every(i=>i.complete&&i.naturalWidth>0));
  assert.deepEqual(await page.locator('#wand-hinweise p').allTextContents(),['Werte aus vorläufigem Prüfbericht AR-999-2099-000001-01 – sie können sich mit dem endgültigen Bericht ändern.'],'nur der Hinweis „vorläufig“: alle Segmente haben Werte, Wand B hat Maße');
  if(process.env.WAND_DUMP)await page.locator('#wand-dialog').screenshot({path:`${process.env.WAND_DUMP}/dialog.png`});
 });
 await check('Word-Anlage: je Fläche Bild und Tabelle, Rückstellprobe, Einordnung, in „Mitteilungen“',async()=>{
  await page.locator('#wand-anlage').fill('Anlage 6');await page.locator('#wand-word').click();
  await page.locator('#toast',{hasText:'Wandansichten gespeichert'}).waitFor({timeout:60000});
  const r=await page.evaluate(async name=>{const d=await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(name)).getDirectoryHandle('Mitteilungen');
   const names=[];for await(const h of d.values())names.push(h.name);const doc=names.find(n=>n.endsWith('.docx'));const b=new Uint8Array(await (await (await d.getFileHandle(doc)).getFile()).arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return {names,doc,b64:btoa(s)};},NAME);
  assert.match(r.doc,/^26-0142_Wandansichten_\d{4}-\d{2}-\d{2}\.docx$/);assert.ok(r.names.includes('_Anlagen-Protokoll.txt'));
  if(process.env.WAND_DUMP)(await import('node:fs')).writeFileSync(`${process.env.WAND_DUMP}/${r.doc}`,Buffer.from(r.b64,'base64'));
  const files=unzip(Buffer.from(r.b64,'base64')),t=text(files['word/document.xml'].toString('utf8'));
  assert.equal(Object.keys(files).filter(n=>/^word\/media\/.*\.png$/.test(n)).length,2,'ein Bild je Fläche');
  assert.match(t,/Anlage 6: Bohrkerne – Wandansichten/);assert.match(t,/Erdgeschoss · Wohnzimmer · Wand B/);assert.match(t,/Erdgeschoss · Wohnzimmer · Boden/);
  assert.match(t,/EG-WZ-B-7/);assert.match(t,/0,60 m von links, 0,30 m über OKFF/);assert.match(t,/Raummitte/);
  assert.match(t,/KW C10-C40\[mg\/kg TS\]/,'gemeinsame Einheit im Spaltenkopf');assert.match(t,/8400/);assert.match(t,/stark/);assert.match(t,/Rückstellprobe/);assert.match(t,/Testskala MKW \(synthetisch\)/);assert.match(t,/Werte aus vorläufigem Prüfbericht AR-999-2099-000001-01/);
 });
 await check('CSV: eine Zeile je Segment',async()=>{
  await page.locator('#wand-csv').click();await page.locator('#toast',{hasText:/Wandansichten gespeichert: .*\.csv/}).waitFor({timeout:30000});
  const csv=await page.evaluate(async name=>{const d=await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mosaik Archivordner')).getDirectoryHandle(name)).getDirectoryHandle('Mitteilungen');
   for await(const h of d.values())if(h.name.endsWith('.csv'))return await (await h.getFile()).text();return '';},NAME);
  const lines=csv.trim().split(/\r\n/);assert.equal(lines.length,7,'Kopf + 6 Segmente');assert.match(lines[0],/^\ufeff?Geschoss;Raum;Fläche;Kern;Segment;Probe/);
  assert.match(csv,/EG-WZ-B-7-T3;P3;.*;Rückstellprobe;;;/);
 });
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
