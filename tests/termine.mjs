// PlanKit 2.7.0 – Ortstermin je Probe (plankit-ortstermine-plan.md, T1–T18): die Regel in src/termine.ts, rein rechnend, ohne Browser.
// Ein Termin → „wie heute“; zwei Tage; zwei Termine am selben Tag (ein Eintrag, T13); Termin 1 ohne Datum; Datum ohne Treffer; kein
// Datum; LabelKit ≠ Punkt mit gleichem und mit anderem Termin (T14); Termin entfernt oder Datum geändert → „ohne Termin“, nie ein anderer.
// Dazu: Rolle in der Ausgabe, Vorwahl, Link „mitteilung=“ (T11), Namen (T5/T6), Plannamen-Schutz. Nur erfundene Daten.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const T=await import('../src/termine.ts');
const {GRAU,BLASS,TERMIN}=await import('../src/model.ts');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK '+name);};

const EIN={ortstermin:'2026-08-12'};
const ZWEI={ortstermin:'2026-08-12',ortsterminBezeichnung:'Erstbegehung',weitereOrtstermine:[{id:'t2',datum:'2026-08-20',bezeichnung:'Nachbeprobung'}],ortsterminZaehler:2};
const LK=new Map([['P1','2026-08-12'],['P14','2026-08-20'],['P22','2026-08-21'],['P30','']]);

ok('Ein Termin: ein Tag, nicht „mehrere“ – alles wie heute (kein Zusatz, keine Wahl)',()=>{
 const t=T.tage(EIN);assert.deepEqual(t,[{datum:'2026-08-12',ids:['t1'],bezeichnungen:[],erster:true}]);assert.equal(T.mehrere(t),false);
 assert.equal(T.mehrere(T.tage({})),false);assert.equal(T.mehrere(T.tage(null)),false);
 // ohne Zähler und ohne weitere Termine bleibt es einer, auch mit einer Bezeichnung
 assert.equal(T.mehrere(T.tage({...EIN,ortsterminBezeichnung:'Erstbegehung',ortsterminZaehler:3})),false);
 // ein weiterer Termin ohne gültige Kennung zählt nicht (Ortstermine.liste)
 assert.equal(T.mehrere(T.tage({...EIN,weitereOrtstermine:[{id:'x',datum:'2026-08-20'}]})),false);
});
ok('Zwei Tage: aufsteigend, je Tag die Bezeichnungen, Termin 1 markiert',()=>{
 const t=T.tage(ZWEI);assert.equal(T.mehrere(t),true);
 assert.deepEqual(t.map(x=>[x.datum,x.ids,x.bezeichnungen,x.erster]),[['2026-08-12',['t1'],['Erstbegehung'],true],['2026-08-20',['t2'],['Nachbeprobung'],false]]);
 assert.equal(T.tagName(t[1]),'20.08. (Nachbeprobung)');assert.equal(T.tagName(t[1],true),'20.08.2026 (Nachbeprobung)');
 // Reihenfolge der Liste egal: nach Datum
 assert.deepEqual(T.tage({ortstermin:'2026-09-03',weitereOrtstermine:[{id:'t2',datum:'2026-08-20'}]}).map(x=>x.datum),['2026-08-20','2026-09-03']);
});
ok('T13: zwei Termine am selben Tag = ein Eintrag (Bezeichnungen beider); nur Termin 1 an seinem Tag → ein Termin',()=>{
 const t=T.tage({...ZWEI,weitereOrtstermine:[...ZWEI.weitereOrtstermine,{id:'t3',datum:'2026-08-20',bezeichnung:'Freimessung'}]});
 assert.equal(t.length,2);assert.deepEqual(t[1].ids,['t2','t3']);assert.equal(T.tagName(t[1]),'20.08. (Nachbeprobung · Freimessung)');
 assert.equal(T.zuordnen('P14','2026-08-20',null,t).tag,'2026-08-20','kein „ohne Termin“ an einem Tag mit zwei Terminen');
 const gleich=T.tage({ortstermin:'2026-08-12',weitereOrtstermine:[{id:'t2',datum:'2026-08-12',bezeichnung:'Freimessung'}]});
 assert.equal(gleich.length,1);assert.equal(gleich[0].erster,true);assert.equal(T.mehrere(gleich),false,'derselbe Tag wie Termin 1: wie heute');
});
ok('Termin 1 ohne Datum: ein weiterer Tag gilt als „mehrere“ (ein Tag, der nicht Termin 1 ist)',()=>{
 for(const ot of [undefined,'','12.08.2026','2026-02-30']){const t=T.tage({ortstermin:ot,weitereOrtstermine:[{id:'t2',datum:'2026-08-20'}]});
  assert.deepEqual(t.map(x=>x.datum),['2026-08-20'],String(ot));assert.equal(T.mehrere(t),true);
  assert.equal(T.zuordnen('P1','2026-08-12',null,t).tag,null,'Datum von Termin 1 ohne gültigen Termin 1: ohne Termin');}
 // weiterer Termin ohne (gültiges) Datum zählt nicht als Tag
 assert.equal(T.mehrere(T.tage({...EIN,weitereOrtstermine:[{id:'t2',datum:''},{id:'t3',datum:'2026-13-01'}]})),false);
});
ok('Datum je Probe (T2): LabelKit zuerst, sonst Datum am Punkt; kein Datum oder kein Tag → „ohne Termin“ mit Grund, nie der nächstgelegene',()=>{
 const t=T.tage(ZWEI);
 assert.deepEqual(T.zuordnen('P1','2026-08-12',LK,t),{tag:'2026-08-12',datum:'2026-08-12',quelle:'labelkit',grund:'',abweichung:''});
 assert.deepEqual(T.zuordnen('P5','2026-08-20',LK,t),{tag:'2026-08-20',datum:'2026-08-20',quelle:'punkt',grund:'',abweichung:''},'nicht in LabelKit: Punkt');
 {const z=T.zuordnen('P30','2026-08-20',LK,t);assert.equal(z.tag,null,'LabelKit kennt die Probe ohne Datum: nie das Datum am Punkt');assert.equal(z.grund,'kein Probenahmedatum in LabelKit');}
 const p22=T.zuordnen('P22',undefined,LK,t);assert.equal(p22.tag,null);assert.equal(p22.grund,'Probenahmedatum 21.08.2026 passt zu keinem Ortstermin');
 for(const d of ['2026-08-13','2026-08-19','2026-08-21','2027-08-20'])assert.equal(T.zuordnen('P9',d,null,t).tag,null,`${d}: nie der nächstgelegene`);
 assert.equal(T.zuordnen('P9',undefined,null,t).grund,'kein Probenahmedatum');
 assert.equal(T.zuordnen('P9',undefined,null,t,true).grund,'von Hand gesetzt – kein Probenahmedatum','T16: Probe von Hand bleibt ohne Termin');
 assert.equal(T.zuordnen('P14',undefined,LK,t,true).tag,null,'T16: auch wenn LabelKit eine Probe mit derselben Nummer kennt');
 assert.equal(T.zuordnen('P9','20.08.2026',null,t).tag,null,'am Punkt nur JJJJ-MM-TT');
 assert.equal(T.zuordnen('p14',undefined,LK,t).tag,null,'Kennung genau wie im Plan (P groß)');
});
ok('T14: gelbe Zeile nur, wenn LabelKit und Punkt zu verschiedenen Terminen führen (oder einer zu keinem) – es zählt LabelKit',()=>{
 const t=T.tage({...ZWEI,weitereOrtstermine:[...ZWEI.weitereOrtstermine,{id:'t3',datum:'2026-08-21',bezeichnung:'Freimessung'}]});
 const lk=new Map([['P14','2026-08-20'],['P15','2026-08-20'],['P16','2026-08-20']]);
 const a=T.zuordnen('P14','2026-08-21',lk,t);assert.equal(a.tag,'2026-08-20');assert.equal(a.abweichung,'P14: laut LabelKit 20.08., am Punkt 21.08. – Proben übernehmen');
 const b=T.zuordnen('P15','2026-10-08',lk,t);assert.equal(b.tag,'2026-08-20');assert.match(b.abweichung,/laut LabelKit 20\.08\., am Punkt 08\.10\./,'Punkt ohne Termin');
 assert.equal(T.zuordnen('P16','2026-08-20',lk,t).abweichung,'','gleich: keine Zeile');
 // anderer Tag, aber beide zu keinem Termin (Datum aus dem Prüfbericht weicht ab, LabelKit passt auch nicht): keine Zeile, „ohne Termin“
 const c=T.zuordnen('P17','2026-10-08',new Map([['P17','2026-08-22']]),t);assert.equal(c.abweichung,'');assert.equal(c.tag,null);
});
ok('Termin entfernt oder Datum geändert → „ohne Termin“, nie ein anderer Termin',()=>{
 const vorher=T.tage(ZWEI),z=T.zuordnen('P14','2026-08-20',LK,vorher);assert.equal(z.tag,'2026-08-20');
 const entfernt=T.tage({...ZWEI,weitereOrtstermine:[]});assert.equal(T.zuordnen('P14','2026-08-20',LK,entfernt).tag,null);
 const geaendert=T.tage({...ZWEI,weitereOrtstermine:[{id:'t2',datum:'2026-08-19'}]});const g=T.zuordnen('P14','2026-08-20',LK,geaendert);
 assert.equal(g.tag,null);assert.equal(g.grund,'Probenahmedatum 20.08.2026 passt zu keinem Ortstermin');
 assert.equal(T.zuordnen('P1','2026-08-12',LK,geaendert).tag,'2026-08-12','Termin 1 bleibt');
});
ok('Rolle in der Ausgabe: gewählter Tag normal, frühere grau oder weg, spätere und „ohne Termin“ weg, „alle“ alles normal',()=>{
 const z=d=>({tag:d,datum:d||'',quelle:'',grund:'',abweichung:''});
 const r=(d,tag,fr='grau')=>T.rolle(z(d),{tag,frueher:fr});
 assert.equal(r('2026-08-20','2026-08-20'),'normal');assert.equal(r('2026-08-12','2026-08-20'),'grau');assert.equal(r('2026-08-12','2026-08-20','weg'),'weg');
 assert.equal(r('2026-09-03','2026-08-20'),'weg');assert.equal(r(null,'2026-08-20'),'weg');
 for(const d of ['2026-08-12','2026-09-03',null])assert.equal(r(d,'alle'),'normal');
});
ok('Vorwahl (E6): neuester Tag mit mindestens einer Probe, sonst der neueste; frühere grau; gemerkte Wahl nur mit gültigem Tag',()=>{
 const t=T.tage({...ZWEI,weitereOrtstermine:[...ZWEI.weitereOrtstermine,{id:'t3',datum:'2026-09-03'}]}),z=d=>({tag:d,datum:'',quelle:'',grund:'',abweichung:''});
 assert.deepEqual(T.vorwahl(t,[z('2026-08-12'),z('2026-08-20'),z(null)]),{tag:'2026-08-20',frueher:'grau'},'03.09. noch ohne Probe');
 assert.deepEqual(T.vorwahl(t,[]),{tag:'2026-09-03',frueher:'grau'});
 assert.deepEqual(T.gueltigeWahl({tag:'2026-08-12',frueher:'weg'},t),{tag:'2026-08-12',frueher:'weg'});
 assert.deepEqual(T.gueltigeWahl({tag:'alle',frueher:'grau'},t),{tag:'alle',frueher:'grau'});
 for(const w of [null,'x',{tag:'2026-08-13',frueher:'grau'},{tag:'2026-08-12'},{tag:'2026-08-12',frueher:'blass'}])assert.equal(T.gueltigeWahl(w,t),null,JSON.stringify(w));
});
ok('T11: Link „mitteilung=“ – ein Tag, alle Tage, mehrere aber nicht alle (neuester mit Satz), unbekannt/ohne Tag → null',()=>{
 const pj={...ZWEI,weitereOrtstermine:[...ZWEI.weitereOrtstermine,{id:'t3',datum:'2026-09-03'},{id:'t4',datum:'2026-09-03'}],
  weitereMitteilungen:[{id:'m1',nr:1,termine:['t1']},{id:'m2',nr:2,termine:['t2','t3']},{id:'m3',nr:3,termine:['t1','t2','t4']},{id:'m4',nr:4,termine:[]},{id:'m5',nr:5,termine:['t9']},{id:'m6',nr:6,termine:['t4']}]},t=T.tage(pj);
 assert.deepEqual(T.ausMitteilung(pj,'m1',t),{wahl:{tag:'2026-08-12',frueher:'grau'},satz:''});
 assert.deepEqual(T.ausMitteilung(pj,'m2',t),{wahl:{tag:'2026-09-03',frueher:'grau'},satz:'2. Mitteilung: Termine 20.08. und 03.09.'});
 assert.deepEqual(T.ausMitteilung(pj,'m3',t),{wahl:{tag:'alle',frueher:'grau'},satz:''},'alle Tage des Projekts');
 assert.deepEqual(T.ausMitteilung(pj,'m6',t)?.wahl,{tag:'2026-09-03',frueher:'grau'},'t4 am selben Tag wie t3');
 for(const id of ['m4','m5','m9','',null])assert.equal(T.ausMitteilung(pj,id,t),null,String(id));
 assert.equal(T.ausMitteilung({},'m2',t),null);
});
ok('Kopf für Schriftfeld/Fußzeile und Legendenzeile „grau: Proben vom …“',()=>{
 const t=T.tage(ZWEI);
 assert.deepEqual(T.terminKopf({tag:'2026-08-20',frueher:'grau'},t),{titel:'Ortstermin 20.08.2026 (Nachbeprobung)',feld:'Ortstermin · Nachbeprobung',wert:'20.08.2026'});
 assert.deepEqual(T.terminKopf({tag:'alle',frueher:'grau'},t),{titel:'Ortstermine 12.08. · 20.08.2026',feld:'Ortstermine',wert:'12.08. · 20.08.2026'});
 assert.equal(T.grauText(['2026-08-12','2026-08-12']),'grau: Proben vom 12.08.2026');assert.equal(T.grauText(['2026-08-15','2026-08-12']),'grau: Proben vom 12.08. · 15.08.2026');assert.equal(T.grauText([]),'');
});
ok('Termin-Ansicht: grau/weg je Probe (auch auf anderen Plänen und bei offenen Proben), Brandherde bleiben, Original unverändert, Symbole nie im JSON',()=>{
 const t=T.tage(ZWEI),zu=(l,d,h)=>T.zuordnen(l,d,LK,t,h);
 const m=(id,label,datum,kind='sample')=>({id,kind,label,note:'',x:0,y:0,lx:0,ly:0,...(datum!==null?{lab:{ref:label,desc:'',datum}}:{})});
 const p={format:'probenplan',version:5,plan:{name:'EG',width:10,height:10,data:'',vector:true},markers:[m('a','P1','2026-08-12'),m('b','P14','2026-08-20'),m('c','P22','2026-08-21'),m('f','B1',null,'fire'),m('h','P40',null)],
  nextSample:41,nextFire:2,report:'',date:'',sheets:[{id:'s1',name:'EG'},{id:'s2',name:'1. OG',plan:{name:'OG',width:10,height:10,data:'',vector:true},markers:[m('d','P9','2026-08-12')]}],active:0,
  pending:[{label:'P15',ref:'Probe 15',desc:'',datum:'2026-08-20'},{label:'P2',ref:'Probe 2',desc:'',datum:'2026-08-12'}]};
 const vorher=JSON.stringify(p),kopf=T.terminKopf({tag:'2026-08-20',frueher:'grau'},t);
 const v=T.ansicht(p,zu,{tag:'2026-08-20',frueher:'grau'},kopf);
 assert.deepEqual(v.markers.map(x=>[x.label,x[GRAU]||'']),[['P1','2026-08-12'],['P14',''],['B1','']],'P22 und P40 (ohne Termin) weg, Brandherd bleibt');
 assert.deepEqual(v.sheets[1].markers.map(x=>[x.label,x[GRAU]]),[['P9','2026-08-12']]);assert.deepEqual(v.pending.map(x=>x.label),['P15']);assert.deepEqual(v[TERMIN],kopf);
 assert.equal(JSON.stringify(p),vorher,'Original unverändert');assert.equal(JSON.stringify(v).includes('grau'),false,'Symbol nicht im JSON');
 const weg=T.ansicht(p,zu,{tag:'2026-08-20',frueher:'weg'},kopf);assert.deepEqual(weg.markers.map(x=>x.label),['P14','B1']);
 const alle=T.ansicht(p,zu,{tag:'alle',frueher:'grau'},T.terminKopf({tag:'alle',frueher:'grau'},t));assert.deepEqual(alle.markers.map(x=>x.label),['P1','P14','P22','B1','P40']);assert.equal(alle.pending.length,2);
 const anzeige=T.ansicht(p,zu,{tag:'2026-08-12',frueher:'grau'},kopf,true);assert.deepEqual(anzeige.markers.map(x=>[x.label,!!x[BLASS]]),[['P1',false],['P14',true],['P22',true],['B1',false],['P40',true]],'Karte: was fehlt, bleibt blass greifbar');
});
ok('Namen (T5/T6): ein Termin wie bis 2.6.3, sonst immer mit Zusatz; Anlage-Teil',()=>{
 const alt=(basis,floor,results,ext)=>`${`${basis}${floor?` - ${floor}`:''}${results?' - Ergebniskarte':''}`.replace(/[<>:"/\\|?*]/g,'_')}.${ext}`;   // exportName bis 2.6.3
 for(const [b,f,r,e] of [['Probenplan 26.0999 Teststadt Ka','',false,'pdf'],['Probenplan 26.0999 Teststadt Ka','1. OG',true,'png'],['Probenplan A/B: C?','E*G',false,'jpg'],['26.0999','',true,'pdf']])assert.equal(T.planDateiName(b,f,'',r,e),alt(b,f,r,e));
 assert.equal(T.planDateiName('Probenplan 26.0999 Teststadt Ka','','2026-08-20',false,'pdf'),'Probenplan 26.0999 Teststadt Ka - Termin 20.08.2026.pdf');
 assert.equal(T.planDateiName('Probenplan 26.0999 Teststadt Ka','EG','2026-08-12',true,'pdf'),'Probenplan 26.0999 Teststadt Ka - EG - Termin 12.08.2026 - Ergebniskarte.pdf');
 assert.equal(T.planDateiName('Probenplan 26.0999 Teststadt Ka','1. OG','alle',false,'png'),'Probenplan 26.0999 Teststadt Ka - 1. OG - alle Termine.png');
 assert.equal(T.anlageTerminTeil('2026-08-20'),'Termin-20-08-2026');assert.equal(T.anlageTerminTeil('alle'),'alle-Termine');assert.equal(T.anlageTerminTeil(''),'');
});
ok('Plannamen-Schutz: „Termin TT.MM.JJJJ“ (auch einstellig), „alle Termine“, ganzes Wort „Ergebniskarte(n)“ – „Termine“, „2. Termin“, „Terminal“ erlaubt',()=>{
 for(const n of ['Termin 20.08.2026','Termin 20.8.2026','termin 1.8.26','EG Termin 20.08.2026','alle Termine','Alle Termine OG','Ergebniskarte','Ergebniskarten EG','EG-Ergebniskarte','EG Ergebniskarte'])assert.ok(T.planNameProblem(n),n);
 for(const n of ['EG','1. OG','Termine','2. Termin','Terminal','Keller','Ergebniskartei','Ergebnis','Terminplan','EG (Termin)'])assert.equal(T.planNameProblem(n),'',n);
 assert.match(T.planNameProblem('Termin 20.08.2026'),/Ortstermin/);assert.match(T.planNameProblem('Ergebniskarte'),/Ergebniskarte/);
});
ok('LabelKit-Daten: P-Nummer → Datum (auch TT.MM.JJJJ), erstes Vorkommen, ungültig leer',()=>{
 const d=T.labelkitDaten({proben:[{_nr:1,datum:'2026-08-12'},{_nr:2,datum:'20.8.2026'},{id:3,datum:'2026-02-30'},{_nr:1,datum:'2026-09-01'}],chloridProben:[{chloridNr:9,datum:'2026-08-12'}],asbestProben:[{_nr:18,datum:'2026-08-20'}],sonstigeProben:[{_nr:20}],brandgeruchProben:[{id:99,datum:'2026-08-12'}]});
 assert.deepEqual([...d],[['P1','2026-08-12'],['P2','2026-08-20'],['P3',''],['P9','2026-08-12'],['P18','2026-08-20'],['P20','']]);
 assert.equal(T.labelkitDaten(null).size,0);assert.equal(T.labelkitDaten({proben:'x'}).size,0);
});
console.log(`${n} Fälle Ortstermin je Probe`);
