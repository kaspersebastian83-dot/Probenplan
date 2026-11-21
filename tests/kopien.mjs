// Kopien in PlanKit gegen ihre Originale (Audit 2026-11 Lauf 5, E4 #7/#8/#9/#11/#13/#15/#16). Vorher prüfte das niemand –
// eine Änderung am Original fiel in PlanKit nicht auf.
//   #7/#8  Bewertungskern (labNumber, labQualifier, vdsScale, KORROSION-CHLORID v2)  src/results.ts  ↔ ResultKit src/bewertung.ts (wörtlich)
//   #9     SPEKTRON-SKALEN                                                          src/skalen-archiv.js ↔ ResultKit src/skalen-archiv.js (Byte für Byte)
//   #11    Beschreibungsvergleich (BESCHREIBUNG)                                    src/lab-provenance.ts ↔ ResultKit src/ergebnisse.ts (gleiche Ergebnisse)
//   #13    Raumkürzel und Kern-ID (RAEUME, RAEUME_ALT, MUSTER)                       src/wandansicht.ts ↔ AidKit konventionen.js
//   #15    Word-Schreiber DOCX                                                      src/docx.ts ↔ Projektzentrale index.html DOCX-START…DOCX-ENDE (gleiche Bytes)
//   #16    F7-READER (_Projekt.json lesen)                                           src/project-data.js ↔ LabelKit index.html (wörtlich)
// Die Originale liegen daneben (../resultkit, ../aidkit, ../projektzentrale, ../labelkit). In der CI Pflicht (KOPIEN_PFLICHT=1), sonst SKIP je Original.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname,join} from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const hier=p=>fileURLToPath(new URL('../'+p,import.meta.url)),neben=(repo,p)=>fileURLToPath(new URL(`../../${repo}/${p}`,import.meta.url));
const lies=p=>readFileSync(p,'utf8');
const block=(t,a,b,was)=>{const i=t.indexOf(a),j=t.indexOf(b,i);assert.ok(i>=0&&j>i,`${was}: Markierung fehlt`);return t.slice(i,j+b.length);};
let n=0,skip=0;
async function ok(name,original,fn){
 if(!existsSync(original)){assert.ok(process.env.KOPIEN_PFLICHT!=='1',`${original} fehlt (KOPIEN_PFLICHT=1)`);skip++;console.log(`SKIP Kopie: ${name} (${original} fehlt)`);return;}
 await fn();n++;console.log('OK Kopie: '+name);
}
const json=x=>JSON.parse(JSON.stringify(x??null));

await ok('#7/#8 Bewertungskern wörtlich wie ResultKit (bewertung.ts)',neben('resultkit','src/bewertung.ts'),()=>{
 const a='export const UNRATED',b='/* ===== Ende KORROSION-CHLORID v2 ===== */';
 const pk=block(lies(hier('src/results.ts')),a,b,'PlanKit results.ts'),rk=block(lies(neben('resultkit','src/bewertung.ts')),a,b,'ResultKit bewertung.ts');
 if(pk!==rk){const x=pk.split('\n'),y=rk.split('\n'),i=x.findIndex((z,k)=>z!==y[k]);assert.fail(`results.ts weicht ab Zeile ${(i<0?x.length:i)+1} des Blocks ab:\n  PlanKit:   ${x[i]??'(Ende)'}\n  ResultKit: ${y[i]??'(Ende)'}`);}
});
await ok('#9 SPEKTRON-SKALEN Byte für Byte wie ResultKit',neben('resultkit','src/skalen-archiv.js'),()=>{
 assert.ok(readFileSync(hier('src/skalen-archiv.js')).equals(readFileSync(neben('resultkit','src/skalen-archiv.js'))),'src/skalen-archiv.js ≠ ResultKit');
});
await ok('#11 Beschreibungsvergleich gleich wie ResultKit (ergebnisse.ts)',neben('resultkit','src/ergebnisse.ts'),async()=>{
 const PK=await import('../src/lab-provenance.ts'),RK=await import(new URL('../../resultkit/src/ergebnisse.ts',import.meta.url).href);
 const texte=['EG Küche, verrußt, Wand','EG Küche , verrußt , Wand','eg küche, verrußt, wand','EG  Küche,,verrußt','„EG“ Küche – Wand','"EG" Küche - Wand','EG Küche, verrußt, Wand, Tiefe: 0-2 cm',
  'OG Bad, verrußt, Wand','EG Küche, verrußt, Wand','',' ',null,undefined,'Bohrkern EG-WZ-B-7','EG Küche\tWand','EG Küche ‐ Wand','EG Küche −Wand','‚Bad‘ «Tür»'];
 const arten=['','PAK','Bohrkern','bohrkern Segment'];let f=0;
 for(const a of texte){assert.equal(PK.beschreibungKey(a),RK.beschreibungKey(a),`beschreibungKey(${JSON.stringify(a)})`);
  for(const b of texte)for(const art of arten){
   assert.equal(PK.beschreibungVergleichbar(a,b,art),RK.beschreibungVergleichbar(a,b,art),`beschreibungVergleichbar(${JSON.stringify(a)}, ${JSON.stringify(b)}, ${art})`);
   assert.equal(PK.beschreibungWeichtAb(a,b,art),RK.beschreibungWeichtAb(a,b,art),`beschreibungWeichtAb(${JSON.stringify(a)}, ${JSON.stringify(b)}, ${art})`);f++;}}
 console.log(`   ${f} Fälle`);
});
await ok('#13 Raumkürzel und Kern-ID wie AidKit (konventionen.js)',neben('aidkit','konventionen.js'),()=>{
 const AK=createRequire(import.meta.url)(neben('aidkit','konventionen.js')),t=lies(hier('src/wandansicht.ts'));
 const wert=name=>{const m=new RegExp(`const ${name}(?::[^=]+)?=([\\s\\S]*?);\\n`).exec(t);assert.ok(m,`${name} in wandansicht.ts`);return vm.runInNewContext('('+m[1]+')');};
 assert.deepEqual(json(wert('RAEUME')),json(AK.RAEUME),'RAEUME');assert.deepEqual(json(wert('RAEUME_ALT')),json(AK.RAEUME_ALT),'RAEUME_ALT');
 const muster=/const MUSTER=(\/.*\/[a-z]*);\n/.exec(t);assert.ok(muster,'MUSTER in wandansicht.ts');
 const ak=/const MUSTER = (\/.*\/[a-z]*);\n/.exec(lies(neben('aidkit','konventionen.js')));assert.ok(ak,'MUSTER in konventionen.js');
 assert.equal(muster[1],ak[1],'MUSTER');
});
await ok('#15 Word-Schreiber: gleiche Bytes wie die Projektzentrale (DOCX)',neben('projektzentrale','index.html'),async()=>{
 const html=lies(neben('projektzentrale','index.html')),code=block(html,'/* DOCX-START */','/* DOCX-ENDE */','Projektzentrale DOCX');
 const ctx={TextEncoder,TextDecoder};vm.runInNewContext(code+'\nthis.DOCX = DOCX;',ctx);
 const PK=await import('../src/docx.ts');
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
 const docs=[
  {title:'Test <&>',author:'PlanKit',application:'PlanKit',created:'2026-10-16T16:00:00.000Z',blocks:[
   {t:'p',text:'Überschrift & „Anführung“ <b>',size:12,u:true},{t:'p',runs:[{text:'fett',b:true},{text:' kursiv\nneue Zeile\tTab',i:true,font:'Arial',color:'1F3864'}],align:'both',keepNext:true},
   {t:'p',text:'Steuerzeichen\u0001\u0008 weg, Emoji 🔥 bleibt, einzelnes Surrogat \uD800 weg',caps:true,track:20},
   {t:'table',widths:[3000,3000,3070],rows:[{header:true,cells:[{text:'A',b:true,shade:'F2F2F2'},{text:'B'},{text:'C',align:'right'}]},{cells:[{text:'über zwei',span:2,vAlign:'center'},{text:''}]}]},
   {t:'pagebreak'},{t:'image',data:png,ext:'png',widthMm:50,heightMm:50,alt:'Foto "1"'},
   {t:'table',widths:[4535,4535],borders:false,rows:[{cells:[{image:{data:png,ext:'png',widthMm:20,heightMm:20},paras:[{text:'Bildunterschrift'}]},{text:''}]}]}]},
  {created:'2026-01-01T00:00:00.000Z',blocks:[{t:'p',text:''}]},
  {title:'Anlage Probenahme',created:'2026-11-21T09:30:00.000Z',blocks:[{t:'table',widths:[1200,7870],size:9,align:'center',rows:[{header:true,minHeight:400,cells:[{text:'Nr.'},{text:'Probenahmestelle'}]},...Array.from({length:30},(_,i)=>({cells:[{text:'P'+(i+1)},{text:'EG Küche, verrußt, Wand '+i}]}))]}]},
 ];
 for(const [i,d] of docs.entries()){
  const a=Buffer.from(PK.build(d)),b=Buffer.from(ctx.DOCX.build(d));
  assert.ok(a.equals(b),`Dokument ${i+1}: PlanKit ${a.length} Bytes, Projektzentrale ${b.length} Bytes – nicht gleich`);
 }
 assert.equal(PK.crc32(png),ctx.DOCX.crc32(png));
});
await ok('#16 F7-READER wörtlich wie LabelKit',neben('labelkit','index.html'),()=>{
 const a='/* F7-READER-START',b='/* F7-READER-ENDE */';
 assert.equal(block(lies(hier('src/project-data.js')),a,b,'PlanKit project-data.js'),block(lies(neben('labelkit','index.html')),a,b,'LabelKit index.html'),'F7-READER weicht von LabelKit ab');
});
console.log(`${n} Kopien gleich${skip?`, ${skip} übersprungen`:''}`);
