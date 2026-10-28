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
// Chlorid nach VdS 2357 (5–10 µg/cm² korrosionschemisch relevante Größenordnung): wie in ResultKit und FotoKit (KORROSION-CHLORID v1).
const {chloridScale,scaleFor,rate,valueOf,wertFuer,units}=await import('../src/results.ts');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK Chlorid: '+name);};
ok('drei Kategorien in µg/cm²: < 5 grün, 5 – < 10 amber, ≥ 10 rot',()=>{
 const s=chloridScale('Chlorid','µg/cm²');assert.deepEqual(s.cats.map(c=>c.from),[0,5,10]);
 assert.deepEqual([4.9,5,9.9,10,26].map(v=>rate(s,v)),[0,1,1,2,2]);
 assert.match(s.cats[1].name,/im Bereich der korrosionschemisch relevanten Größenordnung/);
});
ok('ältere Berichte in mg/m²: Grenzen umgerechnet (1 µg/cm² = 10 mg/m²)',()=>{
 assert.deepEqual(chloridScale('Chlorid','mg/m²').cats.map(c=>c.from),[0,50,100]);
 assert.deepEqual(chloridScale('Chlorid','mg/m2').cats.map(c=>c.from),[0,50,100]);
 assert.equal(chloridScale('Chlorid','mg/kg'),undefined,'Feststoff: keine Oberflächenreferenz');
 assert.equal(chloridScale('Sulfat','µg/cm²'),undefined);
});
ok('gilt ohne Nutzung; in PlanKit anpassbar wie die PAK-Referenz',()=>{
 const r=scaleFor({scales:{}},'Chlorid','µg/cm²');assert.ok(r.vds);assert.equal(r.angepasst,false);assert.equal(r.scale.cats.length,3);
 const eigen={name:'Eigene',cats:[{name:'ok',from:0},{name:'hoch',from:20}]};
 const a=scaleFor({scales:{},vds:{'Chlorid|µg/cm²':eigen}},'Chlorid','µg/cm²');assert.equal(a.angepasst,true);assert.equal(a.scale,eigen);
 assert.equal(scaleFor({scales:{}},'Summe 16 EPA-PAK exkl. BG','µg/m²').vds,undefined,'PAK-Referenz weiter nur mit Nutzung');
});
ok('Eurofins liefert Chlorid je Probe und je Fläche (Reihenfolge wechselt): bewertet und gezeigt wird der Flächenwert',()=>{
 const P='Chlorid (Cl)';
 const a=[{p:'Größe der Probenfläche',r:'140',u:'cm²'},{p:P,r:'2800',u:'µg/Probe'},{p:P,r:'199',u:'mg/m²'}],b=[{p:P,r:'32',u:'mg/m²'},{p:P,r:'450',u:'µg/Probe'}];
 assert.equal(wertFuer(a,P).u,'mg/m²');assert.equal(wertFuer(b,P).u,'mg/m²');assert.equal(wertFuer([{p:P,r:'1',u:'µg/Probe'}],P).u,'µg/Probe','nur je Probe: wie im Bericht');
 const project={markers:[{kind:'sample',label:'P6',lab:{werte:a}},{kind:'sample',label:'P5',lab:{werte:b}}],pending:[],sheets:undefined};
 assert.equal(valueOf(project.markers[0],P).r,'199');assert.deepEqual(units(project,P),['mg/m²'],'keine leere Skala für µg/Probe');
 assert.equal(rate(scaleFor({scales:{}},P,'mg/m²').scale,199),2,'199 mg/m² = 19,9 µg/cm² → oberhalb');
});
// Automatisch – je Probenart: PAK, Chlorid und Asbest auf einer Karte.
{const {rateMarkers,prepare,AUTO_PARAM,hauptwert,paramUnits}=await import('../src/results.ts');
 const SUM='Summe 16 EPA-PAK exkl. BG',mk=(label,werte,typ)=>({id:label,kind:'sample',label,note:'',x:1,y:1,lx:1,ly:1,...(typ?{typ}:{}),lab:{ref:label,desc:'',werte}});
 const plan=()=>({format:'probenplan',version:4,plan:{name:'x',width:100,height:100,data:''},nextSample:9,nextFire:1,report:'',date:'',markers:[
  mk('P1',[{p:SUM,r:'45',u:'µg/m²'},{p:'Benzo[a]pyren',r:'3',u:'µg/m²'}],'PAK'),mk('P2',[{p:SUM,r:'4',u:'µg/m²'}]),
  mk('P3',[{p:'Chlorid (Cl)',r:'120',u:'µg/Probe'},{p:'Chlorid (Cl)',r:'7,5',u:'µg/cm²'}],'Chlorid'),mk('P4',[{p:'Chlorid (Cl)',r:'2',u:'µg/cm²'}]),
  mk('P5',[{p:'Asbestart',r:'Chrysotil',u:''},{p:'Asbestgehalt',r:'5 - 20',u:'%'}],'Asbest'),mk('P6',[{p:'Asbest',r:'Kein Asbest nachgewiesen',u:''}],'Asbest'),
  mk('P7',[{p:'MKW C10-C40',r:'80',u:'mg/kg'}])]});
 ok('Automatisch: neue Ergebniskarte bewertet jede Probe nach ihrer Art (PAK nach Nutzung, Chlorid 5–10, Asbest nachgewiesen hellrot)',()=>{
  const p=plan();prepare(p);assert.equal(p.results.parameter,AUTO_PARAM);p.results.usage='residential';
  const r=rateMarkers(p),f=Object.fromEntries(r.fill);
  assert.deepEqual(f,{P1:'#e0453a',P2:'#4caf50',P3:'#f0a030',P4:'#4caf50',P5:'#ef9a9a',P6:'#4caf50',P7:'#c3ccd5'});
  assert.deepEqual(r.groups.map(g=>g.parameter),[SUM,'Chlorid (Cl)','Asbest']);assert.deepEqual(r.unrated,['P7']);
  assert.deepEqual(paramUnits(p,AUTO_PARAM).map(x=>x.key),[`${SUM}|µg/m²`,'Chlorid (Cl)|µg/cm²','Asbest|']);
  assert.equal(hauptwert(p.markers[4].lab.werte).r,'Chrysotil · 5 - 20 %');
 });
 ok('Einzelparameter bleibt wählbar: nur PAK bewertet, Chlorid grau',()=>{
  const p=plan();prepare(p);p.results.parameter=SUM;p.results.usage='residential';const f=Object.fromEntries(rateMarkers(p).fill);
  assert.equal(f.P1,'#e0453a');assert.equal(f.P3,'#c3ccd5');prepare(p);assert.equal(p.results.parameter,SUM,'gewählter Parameter bleibt');
 });
}
console.log(`${n} Prüfungen Chlorid bestanden`);
