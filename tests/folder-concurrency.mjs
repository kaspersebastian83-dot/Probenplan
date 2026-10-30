// F2: independent lock domains, a deterministic race AFTER both final revision checks,
// real temporary files, then conscious recovery through the real application UI (OPFS).
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,readdir,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {syntheticProject} from './fixtures.mjs';
import {chromium} from './runtime.mjs';
const source=process.env.F2_BASELINE_SOURCE?await readFile(process.env.F2_BASELINE_SOURCE,'utf8'):await readFile('src/folder.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function session(options={}){
 const exports={},calls=[];
 const context=vm.createContext({exports,File,TextEncoder,Date:options.Date||Date,crypto:options.crypto||crypto,navigator:{locks:{request:async(name,fn)=>{calls.push(name);return fn();}}}});
 vm.runInContext(code,context);return{m:exports,calls};
}
class Dir{
 constructor(path,gate){this.path=path;this.name=basename(path);this.gate=gate;}
 async queryPermission(){return 'granted';}
 async getDirectoryHandle(name,{create=false}={}){const p=join(this.path,name);if(create)await mkdir(p,{recursive:true});await stat(p);return new Dir(p);}
 async getFileHandle(name,{create=false}={}){
  if(create&&this.gate)await this.gate(name);
  const p=join(this.path,name);try{await stat(p);}catch(e){if(e.code!=='ENOENT')throw e;if(!create)throw Object.assign(Error('Missing'),{name:'NotFoundError'});await writeFile(p,'');}
  return{name,kind:'file',getFile:async()=>new File([await readFile(p)],name,{lastModified:(await stat(p)).mtimeMs}),createWritable:async()=>{let bytes;return{write:async x=>{bytes=x instanceof Blob?Buffer.from(await x.arrayBuffer()):x;},close:async()=>writeFile(p,bytes),abort:async()=>{}};}};
 }
 async *values(){for(const e of await readdir(this.path,{withFileTypes:true}))if(e.isFile())yield await this.getFileHandle(e.name);}
 async removeEntry(name){await rm(join(this.path,name));}
}
const name='26.0101 F2 Muster',main=`Probenplan ${name}.probenplan`,tmp=await mkdtemp(join(tmpdir(),'plankit-f2-'));
let files,candidateA;
try{
 const dir=new Dir(join(tmp,name));await mkdir(dir.path);const plaene=await dir.getDirectoryHandle('Pläne',{create:true});
 const folder={dir,name,nr:'26.0101',ort:'F2 Muster',plaene};
 const alt=syntheticProject();alt.report='ALT';
 const a=structuredClone(alt);a.report='NEU A';a.markers[0].note='Vollständige Fassung A';
 const b=structuredClone(alt);b.report='NEU B';b.markers[1].note='Vollständige Fassung B';
 const textA=JSON.stringify(a),textB=JSON.stringify(b),initial=session();
 const revision=(await initial.m.saveFolderProject(folder,JSON.stringify(alt),null)).revision;
 const both=deferred(),releaseB=deferred();let reached=0;
 const gate=which=>async filename=>{if(filename!==main)return;reached++;if(reached===2)both.resolve();if(which==='A')await both.promise;else await releaseB.promise;};
 const A=session(),B=session();
 const saveA=A.m.saveFolderProject({...folder,plaene:new Dir(plaene.path,gate('A'))},textA,revision);
 const saveB=B.m.saveFolderProject({...folder,plaene:new Dir(plaene.path,gate('B'))},textB,revision);
 const resultA=await saveA;assert.equal(reached,2,'both sessions passed their final revision check before A writes');
 assert.equal(await readFile(join(plaene.path,main),'utf8'),textA,'A confirms its own complete main file');
 releaseB.resolve();const resultB=await saveB;
 assert.equal(A.calls.length,1);assert.equal(B.calls.length,1);assert.equal(await readFile(join(plaene.path,main),'utf8'),textB);
 assert.notEqual(resultA.revision,resultB.revision);
 files=Object.fromEntries(await Promise.all((await readdir(plaene.path)).map(async n=>[n,await readFile(join(plaene.path,n),'utf8')])));
 const candidates=Object.entries(files).filter(([n])=>n.includes('(Speicherkandidat '));
 assert.ok(candidates.some(([,t])=>t===textA),'the confirmed A version survives the later successful B write');
 assert.ok(candidates.some(([,t])=>t===textB),'the confirmed B version has its own durable candidate');
 candidateA=candidates.find(([,t])=>t===textA)[0];
 // Öffnen bei gültiger Projektdatei: nur A wird angeboten (nie Projektdatei geworden, älter als B) – keine „(vorher …)“-Kopie, nicht B (= Projektdatei).
 {const rev=t=>A.m.fileRevision(new File([t],'x')),time=async n=>(await stat(join(plaene.path,n))).mtimeMs;
  const list=await Promise.all(Object.entries(files).filter(([n])=>n!==main).map(async([n,t])=>({name:n,kind:A.m.copyInfo(name,n).kind,revision:await rev(t),lastModified:await time(n)})));
  assert.ok(list.some(c=>c.kind==='vorher')&&list.some(c=>c.kind==='Speicherkandidat'));
  assert.deepEqual([...A.m.copiesToOffer(list,{revision:await rev(files[main]),lastModified:await time(main)}).map(c=>c.name)],[candidateA]);}
 assert.deepEqual({...A.m.copyInfo(name,`Probenplan ${name} (Kopie vor dem Ersetzen 2026-10-30 19-23-05-123 x).probenplan`)},{kind:'Kopie vor dem Ersetzen',time:new Date(2026,9,30,19,23,5,123).getTime()});
 assert.deepEqual({...A.m.copyInfo(name,'Probenplan anderes Projekt (vorher x).probenplan')},{kind:null,time:null});
 {const c=(name,kind,revision,lastModified)=>({name,kind,revision,lastModified});
  assert.deepEqual([...A.m.copiesToOffer([c('W alt','Wiederherstellung','w1',5),c('W neu','Wiederherstellung','w2',15),c('W wie Datei','Wiederherstellung','m',15),c('vorher neu','vorher','v',20),c('Kopie','Kopie','k',20),
   c('K in vorher','Speicherkandidat','v',5),c('K in Kopie','Speicherkandidat','k',5),c('K verloren','Speicherkandidat','q',5),c('K neu','Speicherkandidat','v',12),c('fremd',null,'f',30)],{revision:'m',lastModified:10}).map(x=>x.name)],['W neu','K verloren','K neu']);}
 // Explicit saving of identical content reuses the protected copy, without deleting it.
 const count=candidates.length;await B.m.saveFolderProject(folder,textB,resultB.revision);
 assert.equal((await readdir(plaene.path)).filter(n=>n.includes('(Speicherkandidat ')).length,count);
 // Old backups beyond the newest 5 are pruned, also legacy UTC names.
 const legacy=`Probenplan ${name} (vorher 2000-01-01T00-00-00-000Z-legacy).probenplan`;
 await writeFile(join(plaene.path,legacy),JSON.stringify({...alt,report:'LEGACY EINZIGARTIG'}));
 const vorErsetzen=`Probenplan ${name} (Kopie vor dem Ersetzen 1999-01-01 00-00-00-000 alt).probenplan`;await writeFile(join(plaene.path,vorErsetzen),JSON.stringify({...alt,report:'VOR DEM ERSETZEN'}));
 for(let i=0;i<45;i++)await writeFile(join(plaene.path,`Probenplan ${name} (vorher 2026-10-20 12-00-${String(i).padStart(2,'0')}-000 test).probenplan`),textB);
 await A.m.pruneBackups(folder);assert.equal(await readFile(join(plaene.path,candidateA),'utf8'),textA);
 const left=(await readdir(plaene.path)).filter(n=>n.includes('(vorher '));assert.equal(left.length,5,'only the 5 newest backups stay');
 assert.ok((await readdir(plaene.path)).includes(vorErsetzen),'a copy taken before replacing the plan is never pruned, however old');assert.ok(!left.includes(legacy),'old backups are pruned');
 // UTF-8 replacement characters are not proof of identical bytes in damaged files.
 const badBackup=`Probenplan ${name} (vorher 1999-01-01T00-00-00-000Z-invalid).probenplan`;
 const decodedCopy=await A.m.writeProjectCopy(folder,'Speicherkandidat','\ufffd');
 await writeFile(join(plaene.path,badBackup),Buffer.from([0xff]));await A.m.pruneBackups(folder);
 assert.ok(!(await readdir(plaene.path)).includes(badBackup),'an old damaged backup is pruned too');
 const rawCopy=await A.m.writeProjectCopy(folder,'Kopie',new File([new Uint8Array([0xff])],'raw'));assert.deepEqual(await readFile(join(plaene.path,rawCopy)),Buffer.from([0xff]));
 // Name collisions must never overwrite a verified copy.
 const FixedDate=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-21T12:00:00Z']));}};
 const collision=session({Date:FixedDate,crypto:{subtle:crypto.subtle,randomUUID:()=> '00000000-0000-4000-8000-000000000000'}}).m;
 const copy=await collision.writeProjectCopy(folder,'Kopie','first');await assert.rejects(collision.writeProjectCopy(folder,'Kopie','second'),/bereits belegt/);assert.equal(await readFile(join(plaene.path,copy),'utf8'),'first');
 console.log('OK F2 Node: independent A/B final checks, A success then B success; both complete versions survive cleanup, identical retry, pruning to the newest 5 and UUID collision');
 // Carry exactly the verified race results into fresh UI sessions; no synthesized replacement for A/B.
 files=Object.fromEntries(await Promise.all((await readdir(plaene.path)).map(async n=>[n,await readFile(join(plaene.path,n),'utf8')])));
 delete files[copy]; // the intentionally non-project collision fixture is covered above
 delete files[decodedCopy];delete files[badBackup];delete files[rawCopy];
}finally{await rm(tmp,{recursive:true,force:true});}
if(!process.env.F2_NODE_ONLY){
 const browser=await chromium.launch();
 try{
  async function open(damaged=false,changed=false){
   const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const base=process.env.TEST_URL||'http://localhost:4173';await page.goto(base);
   await page.evaluate(async({name,main,files,damaged})=>{
    const root=await navigator.storage.getDirectory(),archive=await root.getDirectoryHandle('F2 Archiv',{create:true}),project=await archive.getDirectoryHandle(name,{create:true}),dir=await project.getDirectoryHandle('Pläne',{create:true});
    const put=async(n,t)=>{const w=await(await dir.getFileHandle(n,{create:true})).createWritable();await w.write(t);await w.close();};
    for(const [n,t] of Object.entries(files))await put(n,t);
    // More than 30 valid distinct newer versions must not hide the older A candidate.
    for(let i=0;i<35;i++)await put(`Probenplan ${name} (Wiederherstellung weitere-${i}).probenplan`,JSON.stringify({...JSON.parse(files[main]),report:`WEITERE ${i}`}));
    await put(`Probenplan ${name} (Wiederherstellung defekt).probenplan`,'{interrupted');if(damaged)await put(main,'{damaged-main');
    await new Promise((resolve,reject)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const tx=r.result.transaction('kv','readwrite');tx.objectStore('kv').put(archive,'archiv');tx.oncomplete=()=>{r.result.close();resolve();};tx.onerror=()=>reject(tx.error);};r.onerror=()=>reject(r.error);});
   },{name,main,files,damaged});
   await page.goto(`${base}/#projekt=${encodeURIComponent(name)}`);await page.reload();
   await page.locator('#ask-title',{hasText:damaged?'Projektdatei fehlt oder ist beschädigt':'Gespeicherte Fassungen prüfen'}).waitFor();
   assert.match(await page.locator('#ask-text').textContent(),/unlesbare\/beschädigte/);
   // „Datei verwenden“ ist der grüne Hauptknopf; Fassungen heißen nach Art und Zeit, nicht nach Dateiname; keine „(vorher …)“-Kopie bei gültiger Datei.
   const knoepfe=await page.locator('#ask-actions button').allTextContents();assert.ok(!knoepfe.some(t=>t.endsWith('.probenplan')),knoepfe.join(' | '));
   if(!damaged){assert.equal(await page.locator('#ask-actions button.primary').textContent(),'Datei verwenden');assert.ok(!knoepfe.some(t=>t.startsWith('Vorheriger Stand')),knoepfe.join(' | '));}
   for(let i=0;!await page.locator(`#ask-actions button[title="${candidateA}"]`).isVisible();i++){assert.ok(i<5);await page.getByRole('button',{name:'Weitere Fassungen',exact:true}).click();}
   if(changed)await page.evaluate(async({name,candidateA})=>{const dir=await(await(await(await navigator.storage.getDirectory()).getDirectoryHandle('F2 Archiv')).getDirectoryHandle(name)).getDirectoryHandle('Pläne'),w=await(await dir.getFileHandle(candidateA)).createWritable();await w.write('{replaced-during-choice');await w.close();},{name,candidateA});
   await page.locator(`#ask-actions button[title="${candidateA}"]`).click();
   if(changed){await page.locator('#toast.error',{hasText:'während der Auswahl verändert'}).waitFor();assert.equal(await page.locator('#welcome').isVisible(),true);assert.deepEqual(errors,[]);await context.close();return;}
   await page.locator('#saved',{hasText:'Wiederhergestellt'}).waitFor({state:'attached'});
   assert.equal(await page.locator('#report').inputValue(),'NEU A');
   const disk=await page.evaluate(async({name,main,candidateA})=>{const dir=await(await(await(await navigator.storage.getDirectory()).getDirectoryHandle('F2 Archiv')).getDirectoryHandle(name)).getDirectoryHandle('Pläne');const text=async n=>(await(await dir.getFileHandle(n)).getFile()).text();return{main:await text(main),candidate:await text(candidateA),invalid:await text(`Probenplan ${name} (Wiederherstellung defekt).probenplan`)};},{name,main,candidateA});
   assert.equal(disk.main,damaged?'{damaged-main':files[main]);assert.equal(disk.candidate,files[candidateA]);assert.equal(disk.invalid,'{interrupted');assert.deepEqual(errors,[]);
   await context.close();
  }
  await open();await open(true);await open(false,true);
  console.log('OK F2 Browser: confirmed A found beyond 30 versions, explicit selection without overwriting B, damaged files preserved, valid legacy backups accessible');
 }finally{await browser.close();}
}
