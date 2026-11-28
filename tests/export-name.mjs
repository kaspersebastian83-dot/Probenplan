// Exporte in „Pläne“ (Prüfbericht 29.10., F09): eine vorhandene Datei – auch in anderer Groß-/Kleinschreibung oder
// Unicode-Schreibweise – wird nie überschrieben; die neue Fassung kommt daneben als „… (2)“. Ordner im Speicher, synthetisch.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';
const code=stripTypeScriptTypes(fs.readFileSync(new URL('../src/folder.ts',import.meta.url),'utf8'),{mode:'transform'}).replace(/^export /gm,'');
const ctx={console,Blob,Set};vm.createContext(ctx);vm.runInContext(code+'\nthis.writeExportFile=writeExportFile;this.existingExports=existingExports;',ctx);
function ordner(dateien){
 const d={async *values(){for(const n of Object.keys(dateien))yield{name:n,kind:'file'};},
  async getFileHandle(n,o){if(!(n in dateien)){if(!o?.create)throw Object.assign(Error('fehlt'),{name:'NotFoundError'});dateien[n]='';}
   return{getFile:async()=>({size:dateien[n].length}),createWritable:async()=>{let t='';return{write:async v=>{t=typeof v==='string'?v:await v.text();},close:async()=>{dateien[n]=t;},abort:async()=>{}};}};}};
 return d;
}
const alt='Probenplan 99.9001 Übersicht.PDF'.normalize('NFD'),d={[alt]:'VON HAND ERGÄNZT'},dir=ordner(d);
assert.equal(await ctx.writeExportFile(dir,'Probenplan 99.9001 Übersicht.pdf',new Blob(['NEU 1'])),'Probenplan 99.9001 Übersicht (2).pdf');
assert.equal(await ctx.writeExportFile(dir,'Probenplan 99.9001 Übersicht.pdf','NEU 2'),'Probenplan 99.9001 Übersicht (3).pdf');
assert.equal(d[alt],'VON HAND ERGÄNZT','vorhandene Datei unverändert');
assert.equal(await ctx.writeExportFile(dir,'Neu.png','BILD'),'Neu.png','freier Name bleibt');
assert.deepEqual([...await ctx.existingExports(dir,['Probenplan 99.9001 Übersicht.pdf','Fehlt.pdf'])],[alt],'vorhandene Datei gefunden');
assert.equal(await ctx.writeExportFile(dir,'Probenplan 99.9001 Übersicht.pdf','ERSETZT',true),alt,'nach Rückfrage ersetzt – vorhandene Schreibweise');
assert.equal(d[alt],'ERSETZT');
console.log('OK Exportname: vorhandene PDFs und Bilder bleiben, neue Fassung als „(2)“, „(3)“ oder nach Rückfrage ersetzt');

// ---- 2.7.0 – Ortstermine: gemeinsame Namensregel (BerichtKit 1.27.0 und Projektzentrale 1.56.0 lesen sie) ----
// Pläne/Probenplan <Ordner>[ - <Plan/Geschoss>][ - Termin TT.MM.JJJJ | - alle Termine][ - Ergebniskarte][ (k)].pdf
// Ein Termin: genau wie bis 2.6.3. Anlagenname: Termin im Titelteil, „_Probenahme_<Datum>“ wird nie abgeschnitten. Plannamen-Schutz.
{
 const {extname}=await import('node:path'),{existsSync}=await import('node:fs'),{fileURLToPath}=await import('node:url'),{registerHooks}=await import('node:module');
 registerHooks({resolve(s,c,next){if(s.startsWith('.')&&c.parentURL){const u=new URL(s,c.parentURL);if(!extname(u.pathname)&&existsSync(fileURLToPath(u)+'.ts'))return next(u.href+'.ts',c);}return next(s,c);},
  load(url,c,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(fs.readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,c);}});
 const T=await import('../src/termine.ts'),{annexFileName}=await import('../src/anlage-name.ts');
 // exportName bis 2.6.3 (main.ts, wörtlich) – ein Termin muss genau so heißen
 const alt=(basis,floor,results,ext)=>`${`${basis}${floor?` - ${floor}`:''}${results?' - Ergebniskarte':''}`.replace(/[<>:"/\\|?*]/g,'_')}.${ext}`;
 const B='Probenplan 26.0999 Teststadt Ka';
 for(const floor of ['','EG','1. OG','Keller: Nord?'])for(const results of [false,true])for(const ext of ['pdf','png','jpg'])assert.equal(T.planDateiName(B,floor,'',results,ext),alt(B,floor,results,ext),'ein Termin wie bis 2.6.3');
 assert.equal(T.planDateiName(B,'','2026-08-20',false,'pdf'),`${B} - Termin 20.08.2026.pdf`);
 assert.equal(T.planDateiName(B,'','2026-08-12',false,'pdf'),`${B} - Termin 12.08.2026.pdf`,'auch für den Tag von Termin 1 (T6)');
 assert.equal(T.planDateiName(B,'EG','2026-08-20',false,'pdf'),`${B} - EG - Termin 20.08.2026.pdf`);
 assert.equal(T.planDateiName(B,'1. OG','2026-08-20',true,'pdf'),`${B} - 1. OG - Termin 20.08.2026 - Ergebniskarte.pdf`,'Termin vor „ - Ergebniskarte“');
 assert.equal(T.planDateiName(B,'','alle',false,'pdf'),`${B} - alle Termine.pdf`);
 assert.equal(T.planDateiName(B,'EG','alle',true,'png'),`${B} - EG - alle Termine - Ergebniskarte.png`);
 assert.equal(T.planDateiName(B,'','2026-08-05',false,'jpg'),`${B} - Termin 05.08.2026.jpg`,'Tag und Monat immer zweistellig');
 // Anlage Probenahme
 assert.equal(annexFileName('26.0999','Anlage 3','2026-08-22',[]),'26-0999_Anlage-3_Probenahme_2026-08-22.docx','ein Termin wie bis 2.6.3');
 assert.equal(annexFileName('26.0999','Anlage 3','2026-08-22',['26-0999_Anlage-3_Probenahme_2026-08-22.docx']),'26-0999_Anlage-3_Probenahme_2026-08-22_2.docx');
 assert.equal(annexFileName('26.0999','Anlage 3','2026-08-22',[],'Termin-20-08-2026'),'26-0999_Anlage-3_Termin-20-08-2026_Probenahme_2026-08-22.docx');
 assert.equal(annexFileName('26.0999','Anlage 3','2026-08-22',[],'alle-Termine'),'26-0999_Anlage-3_alle-Termine_Probenahme_2026-08-22.docx');
 const lang40='Anlage 3 – Probenahme und Laborergebnisse'.slice(0,40),ANLAGE=/_Probenahme_\d{4}-\d{2}-\d{2}(?:_\d+)?\.docx$/i;   // Muster aus BerichtKit/Projektzentrale (mitteilungen.js WORD_ANLAGE)
 assert.equal(lang40.length,40);
 for(const termin of ['','Termin-20-08-2026','alle-Termine']){const n=annexFileName('26.0999',lang40,'2026-08-22',[],termin);assert.match(n,ANLAGE,`${n}: „_Probenahme_<Datum>“ ganz`);if(termin)assert.ok(n.includes(`_${termin}_Probenahme_`),n);}
 // annexFileName bis 2.6.3 (wörtlich, ohne Zählung)
 const altAnlage=(nr,title,date)=>{const s=v=>v.normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');return [s(nr)||'Projekt',s(title)||'Anlage','Probenahme'].join('_').slice(0,64)+'_'+date+'.docx';};
 for(const [nr,title] of [['26.0999',lang40],['26.0999',''],['','Anlage'],['26.0999 Musterstraße','Anlage 3 (Ä)']])assert.equal(annexFileName(nr,title,'2026-08-22',[]),altAnlage(nr,title,'2026-08-22'),`ein Termin wie bis 2.6.3: ${title}`);
 // Plannamen-Schutz (gleiche Regeln wie anlagen.js „verdächtig“)
 for(const n of ['Termin 20.08.2026','Termin 2.8.2026','alle Termine','EG Ergebniskarte','Ergebniskarten'])assert.ok(T.planNameProblem(n),n);
 for(const n of ['Termine','2. Termin','Terminal','EG','Ergebniskartei'])assert.equal(T.planNameProblem(n),'',n);
 console.log('OK Exportname 2.7.0: ein Termin wie bis 2.6.3, Termin-Zusatz vor „ - Ergebniskarte“, „alle Termine“, Anlage mit Termin und langem Titel, Plannamen-Schutz');
}
