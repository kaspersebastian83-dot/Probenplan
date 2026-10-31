// Stornierte Proben aus LabelKit (ab 4.49.0, Feld `storniert`) – Rechnung ohne Browser, nur synthetische Daten.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const {labelkitReport,stornierteProben}=await import('../src/labelkit.ts');
const {applyLabImport}=await import('../src/lab-provenance.ts');
const {stornoTreffer,stornoText,stornoDetail,stornoKey,stornoPunktEntfernen}=await import('../src/storno.ts');
const PROJEKT='26.0101 Muster',QUELLE='26.0101_Daten.json';
const STORNO={am:'2026-10-30T14:05:00.000Z',kuerzel:'Dr. Ka',grund:'doppelt genommen'};
const fest={am:'2026-10-29T09:00:00.000Z',anlass:'Etiketten'};
// P1–P4 PAK, P5 Chlorid, P6 Asbest; P2 und P5 storniert (P5 nur mit `true` wie im Auftragstext), P7 Sonstige storniert
const datei=(extra={})=>({nrSchutz:1,projekt:{nr:'26.0101'},
 proben:[{_nr:1,z2:'EG Flur',z3:'Decke',matrix:'Wischprobe',nrFest:fest},{_nr:2,z2:'EG Flur',z3:'Wand',matrix:'Wischprobe',nrFest:fest,storniert:STORNO},{_nr:3,z2:'EG Küche',matrix:'Wischprobe',nrFest:fest},{_nr:4,z2:'EG Küche',matrix:'Wischprobe'}],
 chloridProben:[{_nr:5,z2:'OG Bad',matrix:'Wischprobe',nrFest:fest,storniert:true}],asbestProben:[{_nr:6,z2:'Dach',matrix:'Materialprobe',nrFest:fest}],
 sonstigeProben:[{_nr:7,matrix:'Feststoff',nrFest:fest,storniert:{am:'2026-10-30T15:00:00.000Z',kuerzel:'Ric',grund:''}}],...extra});
const report=d=>labelkitReport(JSON.stringify(d),QUELLE,PROJEKT);
const leer=()=>({format:'probenplan',version:4,plan:{width:100,height:100},markers:[],nextSample:1,nextFire:1,report:'',date:'',pending:[]});
const punkt=(label,extra={})=>({id:`m-${label}`,kind:'sample',label,note:'',x:10,y:10,lx:10,ly:10,lab:{ref:`Probe ${label.slice(1)}`,desc:''},...extra});
let checks=0;
function check(name,fn){fn();checks++;console.log(`OK Storno: ${name}`);}

check('stornierte Proben werden nicht angeboten und nicht gezählt, die übrigen Nummern bleiben',()=>{
 const r=report(datei());
 assert.deepEqual(r.rows.map(x=>x.label),['P1','P3','P4','P6']);
 assert.equal(r.expected,4,'„N Proben“ zählt nur nicht stornierte');
 assert.deepEqual(r.storniert.map(s=>s.label),['P2','P5','P7']);
 assert.deepEqual(r.storniert[0],{label:'P2',am:STORNO.am,kuerzel:'Dr. Ka',grund:'doppelt genommen'});
 assert.deepEqual(r.storniert[1],{label:'P5',am:'',kuerzel:'',grund:''},'`storniert: true` zählt auch');
 assert.equal(r.warnings.filter(w=>/storniert/.test(w)).length,1);
 assert.match(r.warnings.join(' '),/P2, P5, P7 sind in LabelKit storniert und werden nicht übernommen – die Nummern bleiben vergeben\./);
 assert.ok(!r.warnings.some(w=>/doppelt vergeben/.test(w)),'Stornierte Nummern sind keine Doppelvergabe');
});
check('ohne Storno wie bisher; eine stornierte Probe im Singular',()=>{
 const ohne=report({...datei(),proben:[{_nr:1,z2:'EG'}],chloridProben:[],asbestProben:[],sonstigeProben:[]});
 assert.deepEqual(ohne.storniert,[]);assert.ok(!ohne.warnings.some(w=>/storniert/.test(w)));
 const eine=report({...datei(),proben:[{_nr:1,z2:'EG'},{_nr:2,storniert:STORNO}],chloridProben:[],asbestProben:[],sonstigeProben:[]});
 assert.match(eine.warnings.join(' '),/P2 ist in LabelKit storniert und wird nicht übernommen – die Nummer bleibt vergeben\./);
 // falsy Werte sind kein Storno (z. B. aufgehoben: Feld fehlt oder null)
 for(const v of [null,false,0,''])assert.deepEqual(report({...datei(),proben:[{_nr:1,storniert:v}],chloridProben:[],asbestProben:[],sonstigeProben:[]}).rows.map(x=>x.label),['P1']);
});
check('stornierteProben: je Nummer einmal, sortiert, ungültige Einträge ignoriert',()=>{
 assert.deepEqual(stornierteProben(null),[]);assert.deepEqual(stornierteProben({}),[]);
 assert.deepEqual(stornierteProben({proben:[{_nr:9,storniert:1},{_nr:3,storniert:{am:'x'}},{storniert:true},null,{_nr:9,storniert:true}]}).map(s=>s.label),['P3','P9']);
});
check('erste Übernahme: nur nicht stornierte offen, Nummern dahinter reserviert',()=>{
 const r=report(datei()),next=applyLabImport(leer(),r,new Map());
 assert.deepEqual(next.pending.map(x=>x.label),['P1','P3','P4','P6'],'„Noch zu platzieren“ ohne P2, P5, P7');
 assert.equal(next.nextSample,8,'höchste stornierte Nummer P7 wird nicht neu vergeben');
});
check('„Nächste freie P-Nummer“ überspringt stornierte Nummern',()=>{
 const p={...leer(),pending:[{label:'P1',ref:'Probe 1',desc:''}],nextSample:2};
 const r={...report(datei()),rows:[{label:'P1',ref:'Probe 1',desc:'neu'}],storniert:[{label:'P2',am:'',kuerzel:'',grund:''},{label:'P3',am:'',kuerzel:'',grund:''}]};
 const next=applyLabImport(p,r,new Map([[r.rows[0],'next']]));
 assert.deepEqual(next.pending.map(x=>x.label),['P1','P4']);
});
check('erneute Übernahme nach Storno: offene stornierte Probe fällt weg, platzierte bleibt',()=>{
 const p={...leer(),markers:[punkt('P1')],pending:[{label:'P3',ref:'Probe 3',desc:''},{label:'P4',ref:'Probe 4',desc:''}],nextSample:5};
 const d=datei();d.proben[0].storniert=STORNO;d.proben[2].storniert=STORNO;   // P1 (platziert) und P3 (offen) jetzt storniert
 const r=report(d);assert.deepEqual(r.rows.map(x=>x.label),['P4','P6']);
 const next=applyLabImport(p,r,new Map(r.rows.filter(x=>x.label==='P4').map(x=>[x,'update'])));
 assert.deepEqual(next.pending.map(x=>x.label),['P4','P6']);
 assert.deepEqual(next.markers.map(m=>m.label),['P1'],'gesetzter Punkt wird nie still entfernt');
 assert.equal(next.nextSample,8);
 // nur Wegnehmen ist auch eine Änderung (alles andere übersprungen)
 const nur=applyLabImport(p,r,new Map(r.rows.map(x=>[x,'skip'])));assert.notEqual(nur,p);assert.deepEqual(nur.pending.map(x=>x.label),['P4']);assert.equal(nur.labReports,undefined,'ohne übernommene Zeile keine neue Herkunft');
 assert.equal(applyLabImport(p,{...r,storniert:[]},new Map(r.rows.map(x=>[x,'skip']))),p,'nichts zu tun: unverändert');
});
check('Storno aufgehoben: Probe wird wieder angeboten, mit derselben Nummer',()=>{
 const d=datei();delete d.proben[1].storniert;d.proben[1].nrFest={am:'2026-10-31T08:00:00.000Z',anlass:'Storno aufgehoben'};
 const r=report(d);assert.ok(r.rows.some(x=>x.label==='P2'));assert.ok(!r.storniert.some(s=>s.label==='P2'));
 const p={...leer(),nextSample:8};const next=applyLabImport(p,r,new Map());assert.ok(next.pending.some(x=>x.label==='P2'));
});
check('Hinweis: gesetzter Punkt (auch auf anderem Plan) und offene Probe, „Behalten“ gilt je Stornierung',()=>{
 const liste=report(datei()).storniert;
 const p={...leer(),markers:[punkt('P2'),punkt('P3')],pending:[{label:'P5',ref:'Probe 5',desc:''}],active:0,
  sheets:[{id:'a',name:'EG'},{id:'b',name:'OG',markers:[punkt('P7',{id:'og-7'}),{...punkt('P9'),lab:undefined}]}]};
 const t=stornoTreffer(p,liste);
 assert.deepEqual(t.map(x=>[x.art,x.storno.label,x.id,x.sheet]),[['punkt','P2','m-P2',0],['offen','P5',undefined,undefined],['punkt','P7','og-7',1]]);
 assert.deepEqual(t.map(stornoText),['P2 ist storniert – Punkt entfernen?','P5 ist storniert – aus „Noch zu platzieren“ nehmen?','P7 ist storniert – Punkt entfernen?']);
 assert.equal(stornoDetail(liste[0]),'In LabelKit storniert am 30.10.2026 (Dr. Ka) – Grund: doppelt genommen. Die Nummer bleibt vergeben.');
 assert.equal(stornoDetail(liste[1]),'In LabelKit storniert. Die Nummer bleibt vergeben.');
 const behalten=new Set([stornoKey(liste[0])]);assert.deepEqual(stornoTreffer(p,liste,behalten).map(x=>x.storno.label),['P5','P7']);
 // neu storniert (anderer Zeitpunkt) → Hinweis kommt wieder
 assert.deepEqual(stornoTreffer(p,[{...liste[0],am:'2026-11-02T10:00:00.000Z'}],behalten).map(x=>x.storno.label),['P2']);
 // Brandherd oder Punkt ohne Laborbezug mit gleicher Kennung: kein Hinweis
 assert.deepEqual(stornoTreffer({...leer(),markers:[{...punkt('P2'),kind:'fire'},{...punkt('P5'),lab:undefined}]},liste),[]);
 assert.deepEqual(stornoTreffer(p,[]),[],'Storno aufgehoben: kein Hinweis mehr');
});
check('Punkt entfernen: aktiver und anderer Plan, kommt nicht zurück in die offene Liste',()=>{
 const p={...leer(),markers:[punkt('P2')],active:0,sheets:[{id:'a',name:'EG'},{id:'b',name:'OG',markers:[punkt('P7',{id:'og-7'})]}]};
 assert.equal(stornoPunktEntfernen(p,'og-7'),true);assert.deepEqual(p.sheets[1].markers,[]);
 assert.equal(stornoPunktEntfernen(p,'m-P2'),true);assert.deepEqual(p.markers,[]);assert.deepEqual(p.pending,[]);
 assert.equal(stornoPunktEntfernen(p,'gibt-es-nicht'),false);
});
check('nur stornierte Proben, alle schon platziert: Nummern trotzdem belegt, Meldung passt (Codex-Review #83)',()=>{
 const d={nrSchutz:1,projekt:{nr:'26.0101'},proben:[{_nr:3,z2:'EG',nrFest:fest,storniert:STORNO}],chloridProben:[],asbestProben:[],sonstigeProben:[{_nr:9,nrFest:fest,storniert:STORNO}]};
 const r=report(d);assert.deepEqual(r.rows,[]);assert.deepEqual(r.storniert.map(s=>s.label),['P3','P9']);
 assert.ok(r.warnings.includes('Alle Proben der LabelKit-Datei sind storniert.'));
 assert.ok(!r.warnings.some(w=>/noch keine PAK/.test(w)),'nicht „noch keine Proben“, wenn alle storniert sind');
 const p={...leer(),markers:[punkt('P3'),punkt('P9')],nextSample:4};
 const next=applyLabImport(p,r,new Map());
 assert.notEqual(next,p,'Zähler muss nachgezogen werden');assert.equal(next.nextSample,10,'P9 bleibt vergeben');
 assert.equal(next.markers.length,2,'Punkte bleiben – darüber entscheidet der Hinweis');assert.deepEqual(next.pending,[]);
 assert.equal(applyLabImport({...p,nextSample:10},r,new Map()).nextSample,10);
 const schon={...p,nextSample:12};assert.equal(applyLabImport(schon,r,new Map()),schon,'Zähler schon weiter: unverändert');
});
console.log(`OK Storno: ${checks} Prüfungen`);
