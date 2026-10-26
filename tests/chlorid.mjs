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
const {chloridScale,scaleFor,rate}=await import('../src/results.ts');
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
console.log(`${n} Prüfungen Chlorid bestanden`);
