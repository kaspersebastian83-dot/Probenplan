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
ok('Dateistand wie in ResultKit',()=>{assert.equal(standKennung([{name:'b.xml',size:1,t:2},{name:'a.pdf',size:3,t:4}]),'a.pdf|3|4\nb.xml|1|2');});
console.log(`${n} Prüfungen ResultKit-Übergabe bestanden`);
