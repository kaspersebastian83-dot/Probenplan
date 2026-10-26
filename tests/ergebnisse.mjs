// Node 24: echte TypeScript-Parser samt lokalen Abhängigkeiten, ohne DOM oder Nutzerdaten.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
// „_Ergebnisse.json“ aus ResultKit lesen und als Laborbericht in die gewohnte Übernahme geben. Synthetische Daten.
const {liesErgebnisse,berichtAlsReport,standKennung}=await import('../src/ergebnisse.ts');
const {applyLabImport}=await import('../src/lab-provenance.ts');
const {createProject}=await import('../src/model.ts');
const {labErgebnisse,labRows}=await import('./lab-fixtures.mjs');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK ResultKit-Übergabe: '+name);};
ok('gültige Datei: Berichte, Proben, Werte ohne BG; Herkunft bleibt',()=>{
 const e=liesErgebnisse(labErgebnisse(labRows.slice(0,3),{vorlaeufig:true}));
 assert.equal(e.berichte.length,1);const b=e.berichte[0];assert.equal(b.vorlaeufig,true);assert.deepEqual(b.sources,{xml:'AR-999.xml'});
 assert.deepEqual(b.proben[0].werte,[{p:'Synthetischer Parameter',r:'< 0,50',u:'µg/m²'}]);
 const r=berichtAlsReport(b);assert.equal(r.bericht,'AR-999-2099-000001-01');assert.equal(r.vorlaeufig,true);assert.equal(r.rows.length,3);assert.equal(r.quelle,'AR-999.xml');
});
ok('fremde, neuere oder kaputte Dateien werden abgewiesen',()=>{
 assert.throws(()=>liesErgebnisse('{'),/keine gültige JSON/);
 assert.throws(()=>liesErgebnisse('{"format":"x"}'),/nicht aus ResultKit/);
 assert.throws(()=>liesErgebnisse(JSON.stringify({...JSON.parse(labErgebnisse()),version:2})),/PlanKit aktualisieren/);
});
ok('fehlende P-Nummer wird aus der Probenreferenz gebildet; Übernahme legt eigene Herkunft an',()=>{
 const roh=JSON.parse(labErgebnisse(labRows.slice(0,2)));roh.berichte[0].proben[1].label='';
 const r=berichtAlsReport(liesErgebnisse(JSON.stringify(roh)).berichte[0]);assert.deepEqual(r.rows.map(x=>x.label),['P1','P2']);
 const p=applyLabImport(createProject({kind:'image',name:'Plan',width:100,height:100,src:'data:,'}),r,new Map());
 assert.equal(p.labReports.length,1);assert.equal(p.pending.length,2);assert.equal(p.pending[0].reportId,p.labReports[0].id);assert.equal(p.labReports[0].bericht,'AR-999-2099-000001-01');
});
// Review 1.38.0: „Aktualisieren“ ergänzt Labordaten und Messwerte, statt sie zu ersetzen.
{const {labelkitReport}=await import('../src/labelkit.ts');const {valueOf}=await import('../src/results.ts');
 const SUM='Summe 16 EPA-PAK exkl. BG',CL='Chlorid',bericht=(id,nr,werte,o={})=>({id,bericht:nr,labor:'Testlabor',auftragsreferenz:'99.9001',sources:{xml:`${nr}.xml`},...o,proben:[{label:'P1',ref:'Probe 1',desc:'EG Küche Decke',labNr:`${nr}-1`,werte}]});
 const datei=bs=>liesErgebnisse(JSON.stringify({format:'spektron-ergebnisse',version:1,projekt:'99.9001',uebernommen:'2099-01-01T00:00:00Z',vollstaendig:true,stand:'',offen:[],berichte:bs})).berichte;
 const leer=()=>({format:'probenplan',version:4,plan:{name:'x',width:100,height:100,data:''},markers:[],nextSample:1,nextFire:1,report:'99.9001',date:''});
 const marker=lab=>({id:'m1',kind:'sample',label:'P1',note:'',x:1,y:1,lx:1,ly:1,lab});
 const update=(p,r)=>applyLabImport(p,r,new Map(r.rows.map(x=>[x,'update'])));
 const imp=b=>berichtAlsReport(b),first=b=>applyLabImport(leer(),imp(b),new Map());
 const place=p=>{const {label,typ,shape,surface,raum,...lab}=p.pending[0];return {...p,markers:[marker(lab)],pending:[]};};
 ok('A: erneuter LabelKit-Import mit „Aktualisieren“ behält Messwerte, Labornummer und Bericht',()=>{
  const [b]=datei([bericht('b1','AR-1',[{p:SUM,r:'120',u:'µg/m²'}])]);const p=place(first(b)),id=p.markers[0].lab.reportId;
  const lk=labelkitReport(JSON.stringify({projekt:{nr:'99.9001'},proben:[{_nr:1,matrix:'Wischprobe',z2:'EG Küche',z4:'Decke',cm2:100}]}),'99.9001_Daten.json','99.9001 Musterort');
  const q=update(p,lk),lab=q.markers[0].lab;
  assert.deepEqual(valueOf(q.markers[0],SUM),{p:SUM,r:'120',u:'µg/m²'});assert.equal(lab.labNr,'AR-1-1');assert.equal(lab.bericht,'AR-1');assert.equal(lab.reportId,id);
  assert.match(lab.desc,/100 cm²/,'Beschreibung aus LabelKit wird übernommen');assert.equal(q.markers[0].note,lab.desc);
  // dasselbe für eine noch nicht platzierte Probe
  const o=update(first(b),lk);assert.deepEqual(o.pending[0].werte,[{p:SUM,r:'120',u:'µg/m²'}]);assert.equal(o.pending[0].bericht,'AR-1');assert.equal(o.pending[0].reportId,o.labReports[0].id);assert.equal(o.pending[0].typ,'PAK');
 });
 ok('B: eine Probe in zwei Prüfberichten (PAK in AR-1, Chlorid in AR-2) – beide Werte bleiben',()=>{
  const [b1,b2]=datei([bericht('b1','AR-1',[{p:SUM,r:'120',u:'µg/m²'}]),bericht('b2','AR-2',[{p:CL,r:'7,5',u:'µg/cm²'}])]);
  const q=update(place(first(b1)),imp(b2));assert.deepEqual(valueOf(q.markers[0],SUM),{p:SUM,r:'120',u:'µg/m²'});assert.deepEqual(valueOf(q.markers[0],CL),{p:CL,r:'7,5',u:'µg/cm²'});
  assert.equal(q.markers[0].lab.reportId,q.labReports[1].id,'Herkunft des zuletzt importierten Berichts');assert.equal(q.markers[0].lab.bericht,'AR-2');
  const o=update(first(b1),imp(b2));assert.deepEqual(o.pending[0].werte.map(w=>w.p),[SUM,CL]);
 });
 ok('vorläufig → endgültig: der endgültige Bericht ersetzt dieselben Parameter, Herkunft wird endgültig',()=>{
  const [v,e]=datei([bericht('v','AR-3',[{p:SUM,r:'120',u:'µg/m²'},{p:'Benzo[a]pyren',r:'9',u:'µg/m²'}],{vorlaeufig:true}),bericht('e','AR-3',[{p:SUM,r:'95',u:'µg/m²'},{p:'Benzo[a]pyren',r:'8',u:'µg/m²'}])]);
  const q=update(place(first(v)),imp(e));assert.deepEqual(q.markers[0].lab.werte,[{p:SUM,r:'95',u:'µg/m²'},{p:'Benzo[a]pyren',r:'8',u:'µg/m²'}]);
  assert.equal(q.markers[0].lab.reportId,q.labReports[1].id);assert.equal(q.labReports[1].vorlaeufig,undefined);
 });
}
ok('Dateistand wie in ResultKit',()=>{assert.equal(standKennung([{name:'b.xml',size:1,t:2},{name:'a.pdf',size:3,t:4}]),'a.pdf|3|4\nb.xml|1|2');});
console.log(`${n} Prüfungen ResultKit-Übergabe bestanden`);
