// Raumbuch: Räume aus Proben, Geschoss aus Plan oder Namen, Bewertung, ähnliche Namen, Eingaben, Export. Node, synthetische Daten.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const R=await import('../src/raumbuch.ts');
const {labelkitReport}=await import('../src/labelkit.ts');
const {applyLabImport}=await import('../src/lab-provenance.ts');
const {validRaumbuch}=await import('../src/import.ts');
const {build}=await import('../src/docx.ts');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK Raumbuch: '+name);};

const SUM='Summe 16 EPA-PAK exkl. BG',U='µg/m²';
const m=(label,raum,wert,extra={})=>({id:label,kind:'sample',label,note:'',x:1,y:1,lx:1,ly:1,...(raum?{raum}:{}),...(wert!==undefined?{lab:{ref:'Probe '+label.slice(1),desc:'',werte:[{p:SUM,r:wert,u:U}]}}:{}),...extra});
const projekt=()=>({format:'probenplan',version:4,plan:{name:'eg',width:100,height:100,data:'',vector:true},nextSample:20,nextFire:2,report:'26.0999',date:'',
  results:{parameter:SUM,usage:'residential',scales:{}},
  markers:[m('P1','EG Küche','480',{surface:'ceiling'}),m('P2','EG Kueche','210',{surface:'wall'}),m('P3','EG Flur','38',{surface:'wall'}),m('P4','EG Wohnen','14',{surface:'floor'}),
    m('P5','EG Bad','6',{surface:'wall'}),m('P6','EG Kü.','12'),m('P7','', '3'),{id:'B1',kind:'fire',label:'B1',note:'',x:2,y:2,lx:2,ly:2,raum:'EG Küche'}],
  pending:[{label:'P8',ref:'Probe 8',desc:'',raum:'EG Flur'}]});

ok('Geschoss aus Plan oder Raumnamen, Präfix entfällt', ()=>{
  assert.deepEqual(R.splitRoom('EG','EG Küche'),{floor:'EG',name:'Küche'});
  assert.deepEqual(R.splitRoom('','EG Küche'),{floor:'EG',name:'Küche'});
  assert.deepEqual(R.splitRoom('','1.OG Bad'),{floor:'1. OG',name:'Bad'});
  assert.deepEqual(R.splitRoom('1. OG','1. OG Bad'),{floor:'1. OG',name:'Bad'});
  assert.deepEqual(R.splitRoom('EG','Küche'),{floor:'EG',name:'Küche'});
  assert.deepEqual(R.splitRoom('','EG'),{floor:'',name:'EG'});
  assert.deepEqual(R.splitRoom('','Egon-Zimmer'),{floor:'',name:'Egon-Zimmer'},'„Eg…“ ist kein Geschoss');
  assert.equal(R.norm('Küche '),R.norm('Kueche'));assert.equal(R.norm('EG-Flur'),R.norm('eg flur'));
});
ok('Wischprobenbezeichnung „Gebäude Geschoss Raum Zusatz Bauteil“ (AidKit): Raum ohne Zusatz und Bauteil', ()=>{
  assert.deepEqual(R.splitRoom('','EG Küche Brandraum Decke'),{floor:'EG',name:'Küche'});
  assert.deepEqual(R.splitRoom('EG','EG Küche Wand B'),{floor:'EG',name:'Küche'});
  assert.deepEqual(R.splitRoom('','Haus A 1OG Bad Decke'),{floor:'1. OG',name:'Haus A Bad'},'Gebäude bleibt Teil des Raums');
  assert.deepEqual(R.splitRoom('1. OG','1OG Kinderzimmer 2 Referenz unbelastet Wand A'),{floor:'1. OG',name:'Kinderzimmer 2'});
  assert.deepEqual(R.splitRoom('','1. OG Gäste WC Fenster/Fensterbank'),{floor:'1. OG',name:'Gäste WC'});
  assert.deepEqual(R.splitRoom('','EG Flur Verdacht Kleber/Teer Boden'),{floor:'EG',name:'Flur'});
  assert.deepEqual(R.splitRoom('','EG Wohnzimmer mit Ruß Ansicht'),{floor:'EG',name:'Wohnzimmer'},'Beaufschlagung und Oberflächenart gehören nicht zum Raum');
  assert.deepEqual(R.splitRoom('','EG Zimmer mit Balkon'),{floor:'EG',name:'Zimmer mit Balkon'},'„mit“ nur vor Belag, Ruß, Kondensat, Staub');
  assert.deepEqual(R.splitRoom('EG','1OG Bad Decke'),{floor:'EG',name:'1. OG Bad'},'anderes Geschoss als der Plan bleibt sichtbar');
  assert.deepEqual(R.splitRoom('','EG · Küche · Brandraum · Decke'),{floor:'EG',name:'Küche'},'„ · “ wird auch verstanden');
  assert.deepEqual(R.splitRoom('','Küche Decke'),{floor:'',name:'Küche Decke'},'ohne Geschoss wie bisher');
  assert.deepEqual(R.splitRoom('','EG Brandraum'),{floor:'EG',name:'Brandraum'},'nur ein Wort nach dem Geschoss: ist der Raum');
  assert.deepEqual(R.splitRoom('','EG Wohnzimmer Schrank oben'),{floor:'EG',name:'Wohnzimmer Schrank oben'},'freies Bauteil: wie bisher, im Raumbuch zusammenführbar');
  assert.deepEqual(R.splitRoom('','1UG Keller'),{floor:'',name:'1UG Keller'},'unbekannte Schreibweise wie bisher');
  const p=projekt();p.markers=[m('P1','EG Küche Brandraum Decke','480'),m('P2','EG Küche Brandraum Wand B','210'),m('P3','EG Küche','90'),m('P4','EG Flur Wand A','38')];p.pending=[];
  const s=R.raumbuchStand(p);
  assert.deepEqual(s.rows.map(r=>[r.name,r.probes.map(x=>x.label).join(',')]),[['Küche','P1,P2,P3'],['Flur','P4']],'alle Küchenproben in einem Raum');
});
ok('Räume, Befund, Bewertung nach VdS-Referenz, Reihenfolge', ()=>{
  const s=R.raumbuchStand(projekt());
  assert.deepEqual(s.rows.map(r=>r.name),['Küche','Flur','Wohnen','Bad','Kü.']);
  const [kueche,flur,wohnen,bad]=s.rows;
  assert.deepEqual(kueche.probes.map(x=>x.label),['P1','P2'],'gleiche Schreibweise nach Umlaut-Regel = gleicher Raum');
  assert.equal(kueche.brandherd,true);assert.equal(kueche.auffaellig,true);assert.match(kueche.bewertung,/Referenzwert erreicht/);
  assert.equal(kueche.probes[0].flaeche,'Untersicht');assert.equal(kueche.floor,'EG');
  assert.equal(flur.offen,true);assert.match(flur.bewertung,/teils ausstehend/);assert.equal(flur.probes.at(-1).placed,false);
  assert.equal(wohnen.auffaellig,true);assert.equal(bad.auffaellig,false);assert.match(bad.bewertung,/unter Referenzwert/);
  assert.deepEqual(s.ohneRaum,['P7']);
  assert.equal(s.doppelt.length,1);assert.deepEqual(s.doppelt[0].map(r=>r.name).sort(),['Kü.','Küche']);
});
ok('offene Proben mit Laborwerten werden bewertet', ()=>{
  const p=projekt();p.pending.push({label:'P9',ref:'Probe 9',desc:'',raum:'EG Abstellraum',werte:[{p:SUM,r:'520',u:U}]});
  const s=R.raumbuchStand(p),row=s.rows.find(r=>r.name==='Abstellraum');
  assert.equal(row.probes[0].placed,false);assert.equal(row.auffaellig,true);assert.match(row.bewertung,/Referenzwert erreicht/);
  assert.ok(R.pruefhinweise(s).some(h=>/5 auffällige Räume ohne Maßnahme/.test(h.text)));
});
ok('ein einzelner Plan: Geschoss aus dem Plannamen', ()=>{
  const p=projekt();p.plan.name='1. OG Grundriss.pdf';p.markers=[m('P1','Küche','10'),m('P2','1. OG Bad','10')];p.pending=[];
  assert.deepEqual(R.raumbuchStand(p).rows.map(r=>[r.floor,r.name]),[['1. OG','Küche'],['1. OG','Bad']]);
  p.plan.name='EG_Bestand.svg';assert.equal(R.raumbuchStand(p).rows[0].floor,'EG');
  p.plan.name='Grundriss.pdf';assert.deepEqual(R.raumbuchStand(p).rows.map(r=>r.floor),['1. OG',''],'ohne Geschoss im Plannamen wie bisher');
});
ok('ähnliche Namen: Nummern unterscheiden Räume, andere Geschosse nie', ()=>{
  const row=(floor,name)=>({floor,name});
  assert.equal(R.aehnlich([row('EG','Zimmer 1'),row('EG','Zimmer 2')]).length,0);
  assert.equal(R.aehnlich([row('EG','Flur'),row('OG','Flur')]).length,0);
  assert.equal(R.aehnlich([row('EG','Wohnzimer'),row('EG','Wohnzimmer')]).length,1);
});
ok('Eingaben, Raum ohne Probe, Zusammenführen', ()=>{
  const p=projekt();let s=R.raumbuchStand(p);
  R.setEintrag(p,s.rows[0],{massnahme:'Textbaustein A'});
  R.setEintrag(p,s.rows[4],{bemerkung:'Abkürzung vor Ort'});
  R.addRaum(p,'EG','HWR');assert.throws(()=>R.addRaum(p,'EG','Küche'),/bereits/);
  s=R.raumbuchStand(p);const hwr=s.rows.find(r=>r.name==='HWR');
  assert.equal(hwr.sampled,false);assert.equal(hwr.status,'unauffaellig');assert.equal(hwr.bewertung,'Sichtprüfung unauffällig');assert.equal(s.rows.at(-1).name,'HWR','Räume ohne Probe am Ende des Geschosses');
  R.setEintrag(p,hwr,{status:'nicht_begangen'});assert.equal(R.raumbuchStand(p).rows.find(r=>r.name==='HWR').bewertung,'nicht begangen / nicht zugänglich');
  const [kueche,,,,ku]=R.raumbuchStand(p).rows;R.mergeRaum(p,ku,kueche);
  s=R.raumbuchStand(p);
  assert.deepEqual(s.rows.find(r=>r.name==='Küche').probes.map(x=>x.label),['P1','P2','P6']);
  assert.equal(s.rows.find(r=>r.name==='Küche').massnahme,'Textbaustein A');
  assert.equal(s.rows.find(r=>r.name==='Küche').bemerkung,'Abkürzung vor Ort','Bemerkung der zusammengeführten Schreibweise füllt leeres Feld');
  assert.equal(s.rows.some(r=>r.name==='Kü.'),false);assert.equal(s.doppelt.length,0);
  R.setEintrag(p,s.rows[0],{massnahme:'',bemerkung:''});
  R.removeRaum(p,'EG','HWR');
  assert.deepEqual(validRaumbuch(p.raumbuch),p.raumbuch,'gespeicherte Form ist gültig');
  assert.throws(()=>validRaumbuch({rooms:[{floor:'EG',name:'X',status:'kaputt'}]}),/Ungültiges Raumbuch/);
  assert.throws(()=>validRaumbuch({rooms:[{floor:'EG',name:''}]}),/Ungültiges Raumbuch/);
  assert.throws(()=>validRaumbuch({rooms:[],alias:{a:'a'}}),/Ungültiges Raumbuch/);
});
ok('Prüfhinweise vor dem Export', ()=>{
  const h=R.pruefhinweise(R.raumbuchStand(projekt())).map(x=>x.text);
  assert.ok(h.some(x=>/4 auffällige Räume ohne Maßnahme/.test(x)),h.join(' | '));
  assert.ok(h.some(x=>/1 Probe ohne Raum/.test(x)));assert.ok(h.some(x=>/fehlen noch Laborwerte/.test(x)));assert.ok(h.some(x=>/1 Paar ähnlicher Raumnamen/.test(x)));
});
ok('Word-Anlage und CSV: ohne Flächen, mit Hinweis zur Mengenermittlung', ()=>{
  const s=R.raumbuchStand(projekt());
  const blocks=R.raumbuchBlocks(s,{title:'Anlage 5',nr:'26.0999',ort:'Teststadt',projectData:{objekt:'EFH',nutzung:'Wohnen'},created:'2026-10-24T09:00:00Z',app:'PlanKit test',source:'Pläne/Probenplan.probenplan'});
  const text=JSON.stringify(blocks);
  assert.match(text,/obliegen dem ausführenden Unternehmen/);assert.doesNotMatch(text,/m²\b(?!.*µg)/,'keine Flächenangaben');
  const table=blocks.find(b=>b.t==='table');assert.equal(table.rows.length,1+s.rows.length);assert.equal(table.widths.reduce((a,b)=>a+b,0),9070);
  const bytes=build({title:'Raumbuch',blocks});assert.equal(String.fromCharCode(bytes[0],bytes[1]),'PK');
  const csv=R.raumbuchCSV(s);assert.ok(csv.startsWith('﻿Geschoss;Raum;Status'));assert.match(csv,/EG;Küche;beprobt;P1, P2;/);assert.match(csv,/ausführenden Unternehmen/);
  const evil=R.raumbuchStand({...projekt(),raumbuch:{rooms:[{floor:'EG',name:'Küche',bemerkung:'=HYPERLINK("x")'},{floor:'EG',name:'Flur',massnahme:'- Reinigung'}]}});
  const ev=R.raumbuchCSV(evil);assert.match(ev,/;"'=HYPERLINK\(""x""\)"/);assert.match(ev,/;- Reinigung;/,'Gedankenstrich mit Leerzeichen bleibt');
  assert.equal(R.raumbuchName('26.0999','docx','2026-10-24',['26-0999_Raumbuch_2026-10-24.docx']),'26-0999_Raumbuch_2026-10-24_2.docx','wie die übrigen Anlagen: Punkt wird Bindestrich, nie überschreiben');
});
ok('Raum kommt aus LabelKit und bleibt beim Laborbericht erhalten', ()=>{
  const lk={projekt:{nr:'26.0101'},proben:[{id:1,_nr:1,z2:'EG Küche',z4:'Untersicht'},{id:2,_nr:2,z2:''}]};
  const report=labelkitReport(JSON.stringify(lk),'x_Daten.json','26.0101 Muster');
  assert.equal(report.rows[0].raum,'EG Küche');assert.equal('raum' in report.rows[1],false);
  const p={format:'probenplan',version:4,plan:{width:10,height:10},markers:[{id:'a',kind:'sample',label:'P1',note:'',x:1,y:1,lx:1,ly:1,raum:'Von Hand'}],nextSample:2,nextFire:1,report:'',date:'',pending:[]};
  const next=applyLabImport(p,report,new Map(report.rows.map(r=>[r,r.label==='P1'?'update':'skip'])));
  assert.equal(next.markers[0].raum,'Von Hand','Eingabe in PlanKit bleibt');assert.equal('raum' in next.markers[0].lab,false,'Raum gehört an den Marker');
  const leer={...p,markers:[{...p.markers[0],raum:undefined}]};delete leer.markers[0].raum;
  assert.equal(applyLabImport(leer,report,new Map(report.rows.map(r=>[r,r.label==='P1'?'update':'skip']))).markers[0].raum,'EG Küche','leerer Raum wird gefüllt');
});
console.log(`OK Raumbuch: ${n} Prüfungen`);
