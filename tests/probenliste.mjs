// Probenliste, Rechnung (ab 1.48): Zeilen aus offenen und platzierten Proben (auch mehrere Pläne), Gruppen nach Geschoss und Raum,
// Filter und Suche, fertige Räume ans Ende, „zurück zu offen“. Node, synthetische Daten.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const L=await import('../src/probenliste.ts');
const {validLab}=await import('../src/import.ts');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK Probenliste: '+name);};
const labels=list=>list.map(r=>r.label);
const offen=(label,raum,desc,extra={})=>({label,ref:'Probe '+label.slice(1),desc:desc??'',art:'PAK · Wischprobe',...(raum!==undefined?{raum}:{}),...extra});
const punkt=(label,raum,desc,extra={})=>({id:'m'+label,kind:'sample',label,note:desc??'',x:10,y:10,lx:10,ly:10,...(raum!==undefined?{raum}:{}),lab:{ref:'Probe '+label.slice(1),desc:desc??'',art:'PAK · Wischprobe'},...extra});
const projekt=(extra={})=>({format:'probenplan',version:4,plan:{name:'eg',width:100,height:100,data:'',vector:true},nextSample:50,nextFire:2,report:'26.0999',date:'',markers:[],pending:[],...extra});

ok('Titel ohne den Raum: „Decke · Untersicht“, Fallback auf die Referenz',()=>{
  assert.equal(L.titelVon('EG Flur, Decke, Untersicht','EG Flur'),'Decke · Untersicht');
  assert.equal(L.titelVon('EG Flur, Decke, Untersicht, 600 cm²','eg  flur'),'Decke · Untersicht · 600 cm²');
  assert.equal(L.titelVon('','EG Flur','Probe 7'),'Probe 7');
  assert.equal(L.titelVon('EG Flur','EG Flur','Probe 7'),'Probe 7');
  assert.equal(L.titelVon('Decke','','Probe 7'),'Decke');
});
ok('Zeilen: offene, platzierte und weitere Markierungen; Form, Probenart, Titel, Wert',()=>{
  const p=projekt({
    pending:[offen('P3','EG Flur','EG Flur, Decke, Untersicht',{typ:'Chlorid'}),offen('P4','','Wand')],
    markers:[punkt('P1','EG Flur','EG Flur, Wand, Ansicht',{typ:'PAK'}),{id:'b1',kind:'fire',label:'B1',note:'',x:1,y:1,lx:1,ly:1,raum:'EG Küche'},{id:'s9',kind:'sample',label:'P9',note:'Fensterbank',x:1,y:1,lx:1,ly:1}]});
  const rows=L.zeilen(p,m=>m.label==='P1'?'Σ16 PAK: 480 µg/m²':'');
  assert.deepEqual(rows.map(r=>[r.art,r.label]),[['offen','P3'],['offen','P4'],['platziert','P1'],['weitere','B1'],['weitere','P9']]);
  const [p3,p4,p1,b1,p9]=rows;
  assert.equal(p3.titel,'Decke · Untersicht');assert.equal(p3.probenart,'Chlorid');assert.equal(p3.shape,'square','Chlorid = Quadrat');assert.equal(p3.raum.floor,'EG');assert.equal(p3.raum.name,'Flur');assert.equal(p3.id,'');assert.equal(p3.sheet,-1);
  assert.equal(p4.raum.ohne,true);assert.equal(p4.shape,'circle');
  assert.equal(p1.art,'platziert');assert.equal(p1.id,'mP1');assert.equal(p1.sheet,0);assert.equal(p1.titel,'Wand · Ansicht');assert.equal(p1.wert,'Σ16 PAK: 480 µg/m²');assert.equal(p1.raum.key,p3.raum.key,'gleicher Raum wie die offene Probe');
  assert.equal(b1.fire,true);assert.equal(b1.titel,'Brandherd');assert.equal(p9.titel,'Fensterbank');assert.equal(p9.art,'weitere');
});
ok('Mehrere Pläne: Geschoss kommt vom Plan, platzierte Proben anderer Pläne stehen mit Planindex in der Liste',()=>{
  const eg=punkt('P1','Küche','Küche, Decke'),og=punkt('P2','Bad','Bad, Wand');
  const p=projekt({markers:[eg],sheets:[{id:'a',name:'EG'},{id:'b',name:'1. OG',plan:{name:'og',width:100,height:100,data:'',vector:true},markers:[og]}],active:0,pending:[offen('P3','EG Küche','EG Küche, Wand')]});
  const rows=L.zeilen(p);
  assert.deepEqual(rows.map(r=>[r.label,r.sheet]),[['P3',-1],['P1',0],['P2',1]]);
  assert.equal(rows[0].raum.key,rows[1].raum.key,'„EG Küche“ (offen) und „Küche“ auf Plan „EG“ sind derselbe Raum');
  assert.equal(rows[2].raum.floor,'1. OG');assert.equal(rows[2].raum.name,'Bad');
});
ok('Gruppen: Räume mit offenen Proben zuerst (Geschoss, Raum), fertige danach, weitere zuletzt',()=>{
  const p=projekt({
    pending:[offen('P5','EG Küche','EG Küche, Decke'),offen('P6','1. OG Bad','1. OG Bad, Wand'),offen('P7','EG Flur','EG Flur, Decke'),offen('P8','','Boden')],
    markers:[punkt('P1','EG Flur','EG Flur, Wand'),punkt('P2','KG Keller','KG Keller, Decke'),punkt('P3','DG Spitzboden','DG Spitzboden, Wand'),{id:'b1',kind:'fire',label:'B1',note:'',x:1,y:1,lx:1,ly:1,raum:'EG Küche'}]});
  const g=L.gruppen(L.zeilen(p),'alle');
  assert.deepEqual(g.map(x=>x.weitere?'weitere':x.ohne?'ohne':`${x.floor} ${x.name}`),['EG Flur','EG Küche','1. OG Bad','','KG Keller','DG Spitzboden','weitere'].map(s=>s===''?'ohne':s));
  assert.deepEqual(g.map(x=>x.fertig),[false,false,false,false,true,true,false]);
  const flur=g[0];assert.equal(flur.offen,1);assert.equal(flur.gesamt,2);assert.deepEqual(labels(flur.zeilen),['P7','P1'],'offene zuerst, dann platzierte');
});
ok('Innerhalb eines Raums: offene in Listenreihenfolge, platzierte nach P-Nummer',()=>{
  const p=projekt({pending:[offen('P12','EG Flur','EG Flur, A'),offen('P3','EG Flur','EG Flur, B')],markers:[punkt('P20','EG Flur','EG Flur'),punkt('P2','EG Flur','EG Flur'),punkt('P10','EG Flur','EG Flur')]});
  assert.deepEqual(labels(L.gruppen(L.zeilen(p),'alle')[0].zeilen),['P12','P3','P2','P10','P20']);
});
ok('Filter: Offen, Platziert, Alle; Zähler und Räume ohne Treffer fallen weg',()=>{
  const p=projekt({pending:[offen('P3','EG Flur','EG Flur, Decke'),offen('P4','EG Küche','EG Küche, Decke')],markers:[punkt('P1','EG Flur','EG Flur, Wand'),punkt('P2','EG Bad','EG Bad, Wand'),{id:'b1',kind:'fire',label:'B1',note:'',x:1,y:1,lx:1,ly:1}]});
  const rows=L.zeilen(p);assert.deepEqual(L.zaehler(rows),{offen:2,platziert:2,weitere:1,gesamt:4});
  assert.deepEqual(L.gruppen(rows,'offen').map(g=>[g.name,labels(g.zeilen)]),[['Flur',['P3']],['Küche',['P4']]]);
  assert.deepEqual(L.gruppen(rows,'platziert').map(g=>[g.weitere?'weitere':g.name,labels(g.zeilen)]),[['Flur',['P1']],['Bad',['P2']],['weitere',['B1']]]);
  assert.equal(L.gruppen(rows,'alle').length,4);
  assert.equal(L.gruppen(rows,'offen')[0].gesamt,2,'Zähler der Gruppe zählt alle Proben des Raums, nicht nur die angezeigten');
  assert.equal(L.filterStandard(3),'offen');assert.equal(L.filterStandard(0),'alle');
});
ok('Suche nach Raum oder Kennung (Schreibweise egal), wirkt zusätzlich zum Filter',()=>{
  const p=projekt({pending:[offen('P3','EG Küche','EG Küche, Decke'),offen('P10','EG Flur','EG Flur, Decke')],markers:[punkt('P1','EG Kueche','EG Kueche, Wand')]});
  const rows=L.zeilen(p);
  assert.deepEqual(labels(L.gruppen(rows,'alle','küche').flatMap(g=>g.zeilen)),['P3','P1']);
  assert.deepEqual(labels(L.gruppen(rows,'alle','EG  flur').flatMap(g=>g.zeilen)),['P10']);
  assert.deepEqual(labels(L.gruppen(rows,'alle','p10').flatMap(g=>g.zeilen)),['P10']);
  assert.deepEqual(labels(L.gruppen(rows,'offen','küche').flatMap(g=>g.zeilen)),['P3']);
  assert.deepEqual(L.gruppen(rows,'alle','zzz'),[]);
  assert.equal(L.gruppen(rows,'alle','--').length,2,'Satzzeichen allein sind keine Suche');
});
ok('Fertiger Raum: gesamt > 0 und nichts offen; Raum ohne Proben-Zeilen gibt es nicht',()=>{
  const p=projekt({pending:[offen('P3','EG Flur','EG Flur, A')],markers:[punkt('P1','EG Küche','EG Küche, A'),punkt('P2','EG Küche','EG Küche, B')]});
  const g=L.gruppen(L.zeilen(p),'alle');assert.deepEqual(g.map(x=>[x.name,x.fertig]),[['Flur',false],['Küche',true]]);
  assert.deepEqual(g[1].zeilen.length,2);
});
ok('Zurück zu offen: Punkt entfernen, Probe sortiert in die offene Liste, Typ/Form/Oberfläche/Raum bleiben',()=>{
  const m=punkt('P2','EG Flur','EG Flur, Decke',{typ:'Chlorid',shape:'square',surface:'ceiling'});m.lab.labNr='L7';m.lab.reportId='r1';m.lab.werte=[{p:'Chlorid',r:'3',u:'µg/cm²'}];
  const p=projekt({markers:[m],pending:[offen('P4','EG Küche','y'),offen('P1','EG Bad','z')]});
  const probe=L.zurueckZuOffen(p,'mP2');
  assert.equal(probe.label,'P2');assert.deepEqual(labels(p.pending),['P1','P2','P4'],'nach P-Nummer sortiert');assert.deepEqual(p.markers,[]);
  const back=p.pending[1];assert.equal(back.typ,'Chlorid');assert.equal(back.shape,'square');assert.equal(back.surface,'ceiling');assert.equal(back.raum,'EG Flur');assert.equal(back.desc,'EG Flur, Decke');assert.equal(back.labNr,'L7');assert.equal(back.reportId,'r1');assert.deepEqual(back.werte,[{p:'Chlorid',r:'3',u:'µg/cm²'}]);
  assert.equal(validLab({...back}),true,'gültige Laborzeile');
  const wieder=L.zeilen(p).find(r=>r.label==='P2');assert.equal(wieder.art,'offen');assert.equal(wieder.shape,'square');
});
ok('Zurück zu offen auf einem anderen Plan; nicht erlaubt für Brandherde, Proben ohne Labor und Kennungen ohne P-Nummer',()=>{
  const og=punkt('P7','Bad','Bad, Wand');
  const p=projekt({sheets:[{id:'a',name:'EG'},{id:'b',name:'1. OG',plan:{name:'og',width:100,height:100,data:'',vector:true},markers:[og]}],active:0,markers:[{id:'b1',kind:'fire',label:'B1',note:'',x:1,y:1,lx:1,ly:1},{id:'s9',kind:'sample',label:'P9',note:'',x:1,y:1,lx:1,ly:1},punkt('X1','EG Flur','a')]});
  const before=JSON.stringify(p);
  for(const id of ['b1','s9','mX1','gibtsnicht'])assert.equal(L.zurueckZuOffen(p,id),null,id);
  assert.equal(JSON.stringify(p),before,'bei Ablehnung bleibt das Projekt unverändert');
  assert.equal(L.zurueckZuOffen(p,'mP7').label,'P7');assert.deepEqual(p.sheets[1].markers,[]);assert.deepEqual(labels(p.pending),['P7']);
});
console.log(`${n} Prüfungen`);
