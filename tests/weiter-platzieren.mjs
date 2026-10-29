// Weiter-Platzieren, Rechnung (ab 1.47): Räume und Reihenfolge der offenen Proben, „nächste Probe“, Hinweistext. Node, synthetische Daten.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const W=await import('../src/weiter.ts');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK Weiter-Platzieren: '+name);};
const p=(label,raum,desc='')=>({label,ref:'Probe '+label.slice(1),desc,...(raum!==undefined?{raum}:{})});
const labels=list=>list.map(r=>r.label);

ok('Raum der offenen Probe: Geschoss aus dem Präfix, gleiche Schreibweisen sind ein Raum, ohne Raum eigene Gruppe',()=>{
  const a=W.raumVon(p('P1','EG Küche')),b=W.raumVon(p('P2','EG Kueche')),c=W.raumVon(p('P3','  eg  küche '));
  assert.equal(a.floor,'EG');assert.equal(a.name,'Küche');assert.equal(a.key,b.key);assert.equal(a.key,c.key);
  assert.equal(W.raumVon(p('P4','1.OG Bad')).floor,'1. OG');
  assert.equal(W.raumVon(p('P5','Bad')).floor,'');
  for(const r of [p('P6'),p('P7',''),p('P8','   ')]){const x=W.raumVon(r);assert.equal(x.ohne,true);assert.equal(x.key,'');}
  assert.equal(W.raumVon(p('P9','EG Küche Brandraum Decke')).name,'Küche','Zusatz und Bauteil gehören nicht zum Raum');
});
ok('Sortierung: Geschoss (KG, EG, OG, DG), dann Raum natürlich, „Ohne Raum“ zuletzt, innerhalb des Raums Listenreihenfolge',()=>{
  const list=[p('P1','1. OG Bad'),p('P2'),p('P3','EG Zimmer 10'),p('P4','EG Flur'),p('P5','KG Keller'),p('P6','EG Zimmer 2'),p('P7','DG Spitzboden'),p('P8','EG Flur'),p('P9','Garage')];
  assert.deepEqual(labels(W.sortiere(list)),['P5','P4','P8','P6','P3','P1','P7','P9','P2']);
  assert.deepEqual(labels(list),['P1','P2','P3','P4','P5','P6','P7','P8','P9'],'Eingabe bleibt unverändert');
});
ok('Nummerierte Untergeschosse von unten nach oben: 2. UG, 1. UG, KG, EG',()=>{
  const list=[p('P1','1. UG Technik'),p('P2','EG Flur'),p('P3','2. UG Tiefgarage'),p('P4','KG Keller')];
  assert.deepEqual(labels(W.sortiere(list)),['P3','P1','P4','P2']);
  assert.equal(W.naechste(list,'P3'),'P1','nach dem letzten Raum im 2. UG weiter im 1. UG, nicht im EG');
});
ok('Nächste Probe: erst im selben Raum, dann der nächste Raum, nach dem letzten Raum wieder von vorn',()=>{
  const list=[p('P1','EG Flur'),p('P2','EG Küche'),p('P3','EG Flur'),p('P4','1. OG Bad'),p('P5','EG Küche')];
  // Reihenfolge: Flur P1 P3 · Küche P2 P5 · 1. OG Bad P4
  assert.equal(W.naechste(list,'P1'),'P3');
  assert.equal(W.naechste(list,'P3'),'P1','im Raum wieder von vorn, solange dort etwas offen ist');
  const ohneP1=list.filter(r=>r.label!=='P1');
  assert.equal(W.naechste(ohneP1,'P3'),'P2','Flur ist fertig → nächster Raum');
  assert.equal(W.naechste(list.filter(r=>r.label!=='P3'),'P1'),'P2');
  assert.equal(W.naechste(list,'P5'),'P2');
  assert.equal(W.naechste(list.filter(r=>r.label!=='P2'),'P5'),'P4');
  assert.equal(W.naechste(list.filter(r=>r.label!=='P5'),'P2'),'P4');
  assert.equal(W.naechste(list.filter(r=>r.label!=='P4'),'P4'),'P1','unbekannte Probe → erste in Reihenfolge');
  assert.equal(W.naechste([p('P4','1. OG Bad'),p('P1','EG Flur')],'P4'),'P1','nach dem letzten Raum wieder von vorn');
});
ok('Nach dem Platzieren: nächste kommt aus der Liste vor dem Entfernen; letzte Probe → nichts mehr offen',()=>{
  const list=[p('P1','EG Flur'),p('P2','EG Flur'),p('P3','EG Bad')];
  let open=list,cur='P1',order=[];
  while(cur){order.push(cur);const next=W.naechste(open,cur);open=open.filter(r=>r.label!==cur);cur=next;}
  assert.deepEqual(order,['P1','P2','P3'],'Flur (P1, P2) zuerst, dann Bad – obwohl Bad im Alphabet vorn steht');assert.deepEqual(open,[]);
  assert.equal(W.naechste([p('P9','EG Flur')],'P9'),null);assert.equal(W.naechste([],'P1'),null);
});
ok('Überspringen wechselt im Raum durch und springt weiter, wenn der Raum nur diese Probe hat',()=>{
  const list=[p('P1','EG Flur'),p('P2','EG Flur'),p('P3','EG Flur'),p('P4','EG Bad')];
  assert.equal(W.naechste(list,'P1'),'P2');assert.equal(W.naechste(list,'P2'),'P3');assert.equal(W.naechste(list,'P3'),'P1');
  assert.equal(W.naechste([p('P1','EG Flur'),p('P4','EG Bad')],'P1'),'P4');
});
ok('Proben ohne Raum kommen als eigene Gruppe zuletzt dran',()=>{
  const list=[p('P1'),p('P2','EG Flur'),p('P3')];
  assert.equal(W.naechste(list,'P2'),'P1');assert.equal(W.naechste(list,'P1'),'P3');assert.equal(W.naechste(list,'P3'),'P1');
});
ok('Hinweistext: P-Nummer · Raum · Bauteil · Oberfläche; Raum nur einmal',()=>{
  assert.equal(W.jetztText(p('P11','EG Flur','EG Flur, Decke, Untersicht')),'P11 · EG Flur · Decke · Untersicht');
  assert.equal(W.jetztText(p('P12','EG Flur','Decke, Untersicht')),'P12 · EG Flur · Decke · Untersicht');
  assert.equal(W.jetztText(p('P13',undefined,'')),'P13 · Probe 13');
  assert.equal(W.jetztText(p('P14','Bad','')),'P14 · Bad');
});
ok('Schalter: ohne Speicher an, „0“ aus, „1“ an',()=>{
  const store=new Map();globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>void store.set(k,String(v))};
  assert.equal(W.weiterOn(),true);W.setWeiter(false);assert.equal(store.get('plankit-weiter-platzieren'),'0');assert.equal(W.weiterOn(),false);W.setWeiter(true);assert.equal(W.weiterOn(),true);
  globalThis.localStorage={getItem(){throw Error('gesperrt');},setItem(){throw Error('gesperrt');}};assert.equal(W.weiterOn(),true);W.setWeiter(false);delete globalThis.localStorage;
});
console.log(`${n} Prüfungen`);
