// Audit Lauf 2 (20.11.2026): B3 Projektnummer im Hinweis „Auftragsreferenz passt möglicherweise nicht“, B4 Beschreibungsvergleich.
// Node 24, echte TypeScript-Quellen; Vergleich mit ResultKit, wenn ../resultkit daneben liegt (in der CI Pflicht: RESULTKIT_PFLICHT).
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const {blankReport,reportWarnings,projektnummerIn}=await import('../src/labreport.ts');
const {applyLabImport,beschreibungWeichtAb}=await import('../src/lab-provenance.ts');
const {createProject,addMarker}=await import('../src/model.ts');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK Audit Lauf 2: '+name);};
const RK=new URL('../../resultkit/src/',import.meta.url),rkDa=existsSync(fileURLToPath(new URL('labreport.ts',RK)));
if(!rkDa)assert.ok(!process.env.RESULTKIT_PFLICHT,'../resultkit fehlt (RESULTKIT_PFLICHT) – in der CI muss der Vergleich laufen');

const warnt=(ref,report)=>reportWarnings({...blankReport(),auftragsreferenz:ref},{report}).some(w=>/passt möglicherweise nicht zur Gutachtennummer/.test(w));
ok('B3: Datum ist keine Projektnummer, bei mehreren gilt die des Projekts',()=>{
 assert.equal(warnt('Ortstermin 18.11.2026 / 26.0604','26.0604'),false,'Datum vor der Nummer (bisher Warnung wegen „11.2026“)');
 assert.equal(warnt('26.0604 vom 18.11.2026','26.0604'),false);
 assert.equal(warnt('25.0100 / 26.0604','26.0604'),false,'mehrere Nummern: die des Projekts zählt');
 assert.equal(warnt('25.0100','26.0604'),true,'fremde Nummer');
 assert.equal(warnt('Ortstermin 18.11.2026 / 25.0100','26.0604'),true);
 assert.equal(warnt('26.0604','26.0604'),false);
 assert.equal(warnt('Ortstermin 18.11.2026','26.0604'),true,'ohne Nummer wie bisher ein Hinweis');
 assert.equal(warnt('18.11.2026',''),false,'ohne Gutachtennummer kein Hinweis');
 assert.equal(projektnummerIn('Ortstermin 18.11.2026 / 26.0604'),'26.0604');assert.equal(projektnummerIn('18.11.26'),'');assert.equal(projektnummerIn('1.2026'),'');
});
ok('B3: Block PROJEKTNUMMER v1 zeichengleich mit ResultKit',()=>{
 if(!rkDa){console.log('   (ohne ../resultkit übersprungen)');return;}
 const block=t=>{const a=t.indexOf('/* ===== PROJEKTNUMMER v1'),b=t.indexOf('/* ===== Ende PROJEKTNUMMER v1 ===== */');assert.ok(a>=0&&b>a,'Block gefunden');return t.slice(a,b);};
 assert.equal(block(readFileSync(new URL('../src/labreport.ts',import.meta.url),'utf8')),block(readFileSync(new URL('labreport.ts',RK),'utf8')));
});
const paare=[['EG Küche Heizkörper','OG Bad, verrußt, Wand',''],['EG Küche , Wand, 400 cm²','EG Küche, Wand, 400 cm²',''],['EG – Flur','eg - flur',''],['„Keller“','"Keller"',''],
 ['Sonstige, Bohrmehl, Tiefe: 0-2 cm','Sonstige, Bohrmehl',''],['Kern A','Kern B','Bohrkern'],['','OG Bad',''],['EG Bad',' ',''],['EG Küche','EG Küche, verrußt','']];
ok('B4: Beschreibung vergleichen wie ResultKit (beschreibungWeichtAb)',()=>{
 assert.deepEqual(paare.map(([a,b,art])=>beschreibungWeichtAb(a,b,art)),[true,false,false,false,false,false,false,false,true]);
});
if(rkDa){const rk=await import(fileURLToPath(new URL('ergebnisse.ts',RK)));ok('B4: gleich wie ResultKit src/ergebnisse.ts',()=>{assert.deepEqual(paare.map(([a,b,art])=>beschreibungWeichtAb(a,b,art)),paare.map(([a,b,art])=>rk.beschreibungWeichtAb(a,b,art)));});}
ok('B4: applyLabImport unverändert – „ersetzen“ überträgt Beschreibung und Wert (darum die Warnung vorher im Dialog)',()=>{
 const p=createProject({name:'plan.svg',width:600,height:800,dataUrl:'data:image/svg+xml,'});const m=addMarker(p,'sample',120,300);m.label='P4';m.note='EG Küche Heizkörper';m.lab={ref:'Probe 4',desc:'EG Küche Heizkörper'};
 const row={label:'P4',ref:'Probe 4',desc:'OG Bad, verrußt, Wand',art:'Wischprobe',werte:[{parameter:'Chlorid',wert:'14',einheit:'µg/cm²'}]};
 const report={...blankReport(),bericht:'AR-1',labor:'Eurofins',rows:[row]},next=applyLabImport(p,report,new Map([[row,'update']]));
 const q=next.markers.find(x=>x.label==='P4');assert.deepEqual([q.x,q.y,q.note,q.lab.desc],[120,300,'OG Bad, verrußt, Wand','OG Bad, verrußt, Wand']);
 assert.equal(beschreibungWeichtAb(m.lab.desc,row.desc,row.art),true,'die Prüftabelle erkennt den Fall');
});
console.log(`${n} Prüfungen bestanden.`);
