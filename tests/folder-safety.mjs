// Synthetic browser File System Access tests. No office archive or host filesystem is accessed.
import {chromium} from './runtime.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import ts from 'typescript';
const code=ts.transpileModule(await readFile('src/folder.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/folder.mjs'?'text/javascript':'text/html');res.end(req.url==='/folder.mjs'?code:'<!doctype html><title>Synthetic office file safety</title>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
try{
 const context=await browser.newContext(),page=await context.newPage(),url=`http://127.0.0.1:${server.address().port}`;await page.goto(url);
 await page.evaluate(async()=>{
  const m=await import('/folder.mjs'),root=await navigator.storage.getDirectory();
  window.make=async()=>{const dir=await root.getDirectoryHandle(`26.0123 Synthetic-${crypto.randomUUID()}`,{create:true});return {dir,name:dir.name,nr:'26.0123',ort:'Synthetic',plaene:await dir.getDirectoryHandle('Pläne',{create:true})};};
  window.read=async(f,n=m.projectFileName(f))=>{const x=await m.fileInfo(f.plaene,n);return x?await x.text():null;};
  window.names=async f=>{const n=[];for await(const h of f.plaene.values())n.push(h.name);return n;};
  // Wrap native handles for deterministic faults; real OPFS streams still perform writes.
  window.wrap=(f,fail)=>({...f,plaene:new Proxy(f.plaene,{get(target,key){if(key==='getFileHandle')return async(name,options)=>{const h=await target.getFileHandle(name,options);return new Proxy(h,{get(file,key){if(key==='createWritable')return async()=>{const w=await file.createWritable();return new Proxy(w,{get(stream,op){if(['write','close'].includes(op))return async(...args)=>{await fail(name,op);return stream[op](...args);};return typeof stream[op]==='function'?stream[op].bind(stream):stream[op];}});};return typeof file[key]==='function'?file[key].bind(file):file[key];}});};return typeof target[key]==='function'?target[key].bind(target):target[key];}})});
 });
 async function check(name,fn){await fn();console.log(`OK ${name}`);}
 await check('Office safety: verified saves, unique backups and same-content timestamps',async()=>{
  const got=await page.evaluate(async()=>{const m=await import('/folder.mjs'),f=await make(),a='{"synthetic":1}',b='{"synthetic":2}',c='{"synthetic":3}';let rev=(await m.saveFolderProject(f,a,null)).revision;await m.writeProjectCopy(f,'Wiederherstellung',b);rev=(await m.saveFolderProject(f,b,rev)).revision;rev=(await m.saveFolderProject(f,c,rev)).revision;const files=await names(f),copies=await Promise.all(files.filter(n=>n.includes('(vorher ')).map(n=>read(f,n)));return {text:await read(f),files,copies,revision:rev,actual:await m.fileRevision(await m.fileInfo(f.plaene,m.projectFileName(f)))};});
  assert.equal(got.text,'{"synthetic":3}');assert.deepEqual(got.copies.sort(),['{"synthetic":1}','{"synthetic":2}']);assert.equal(got.files.filter(n=>n.includes('Wiederherstellung')).length,1);assert.equal(got.files.filter(n=>n.includes('Speicherkandidat')).length,3);assert.equal(new Set(got.files).size,7);assert.equal(got.revision,got.actual);
 });
 await check('Office safety: changed bytes, replacement, deletion and unexpected creation conflict',async()=>{
  const got=await page.evaluate(async()=>{const m=await import('/folder.mjs'),result=[];
   for(const kind of ['change','delete','create']){const f=await make();let rev=null;if(kind!=='create')rev=(await m.saveFolderProject(f,'AAAA',null)).revision;
    if(kind==='delete')await f.plaene.removeEntry(m.projectFileName(f));else await m.writeFile(f.plaene,m.projectFileName(f),'BBBB');
    try{await m.saveFolderProject(f,'CCCC',rev);result.push(false);}catch(e){result.push(e instanceof m.FolderConflict);}result.push(await read(f)===(kind==='delete'?null:'BBBB'));}
   const d=new File(['AAAA'],'test',{lastModified:123}),e=new File(['BBBB'],'test',{lastModified:123});return {result,sameMetadataDifferentBytes:await m.fileRevision(d)!==await m.fileRevision(e)};
  });assert.ok(got.result.every(Boolean));assert.equal(got.sameMetadataDifferentBytes,true);
 });
 await check('Office safety: backup/write/close failures preserve main and recovery',async()=>{
  const got=await page.evaluate(async()=>{const m=await import('/folder.mjs'),out=[];
   for(const kind of ['backup','recovery','write','close']){const f=await make(),rev=(await m.saveFolderProject(f,'old',null)).revision;
    const wrapped=wrap(f,async(name,op)=>{if((kind==='backup'&&name.includes('(vorher '))||(kind==='recovery'&&name.includes('(Speicherkandidat '))||(name===m.projectFileName(f)&&op===kind))throw Error(`Synthetic ${kind} failure`);});
    let failed=false;try{await m.saveFolderProject(wrapped,'new',rev);}catch{failed=true;}const files=await names(f),recovery=files.filter(n=>n.includes('(Speicherkandidat '));out.push({kind,failed,main:await read(f),recoveries:await Promise.all(recovery.map(n=>read(f,n)))});
   }return out;
  });for(const r of got){assert.equal(r.failed,true,r.kind);assert.equal(r.main,'old',r.kind);if(['write','close'].includes(r.kind))assert.ok(r.recoveries.includes('new'));}
 });
 await check('Office safety: final conflict check preserves a concurrent external edit',async()=>{
  const got=await page.evaluate(async()=>{const m=await import('/folder.mjs'),f=await make(),rev=(await m.saveFolderProject(f,'old',null)).revision;let once=false;
   const wrapped=wrap(f,async(name,op)=>{if(!once&&name.includes('(Speicherkandidat ')&&op==='close'){once=true;await m.writeFile(f.plaene,m.projectFileName(f),'external');}});
   let conflict=false;try{await m.saveFolderProject(wrapped,'mine',rev);}catch(e){conflict=e instanceof m.FolderConflict;}return {conflict,text:await read(f),copies:await Promise.all((await names(f)).filter(n=>n.includes('(vorher ')||n.includes('(Speicherkandidat ')).map(n=>read(f,n)))};
  });assert.equal(got.conflict,true);assert.equal(got.text,'external');assert.deepEqual([...new Set(got.copies)].sort(),['mine','old']);
 });
 await check('Office safety: lost permission stops all filesystem changes',async()=>{
  const got=await page.evaluate(async()=>{const m=await import('/folder.mjs'),f=await make();const rev=(await m.saveFolderProject(f,'old',null)).revision,count=(await names(f)).length;let failed=false;
   try{await m.saveFolderProject({...f,dir:{queryPermission:async()=> 'denied'}},'mine',rev);}catch{failed=true;}
   return {failed,text:await read(f),unchanged:count===(await names(f)).length};
  });assert.deepEqual(got,{failed:true,text:'old',unchanged:true});
 });
 await check('Office safety: simultaneous saves in separate tabs cannot overwrite each other',async()=>{
  const f=await page.evaluate(async()=>{const m=await import('/folder.mjs'),f=await make();return {name:f.name,revision:(await m.saveFolderProject(f,'old',null)).revision};});
  const other=await context.newPage();await other.goto(url);
  const save=async(p,text)=>p.evaluate(async({name,revision,text})=>{const m=await import('/folder.mjs'),dir=await(await navigator.storage.getDirectory()).getDirectoryHandle(name),f={dir,name,nr:'26.0123',ort:'Synthetic',plaene:await dir.getDirectoryHandle('Pläne')};try{await m.saveFolderProject(f,text,revision);return 'saved';}catch(e){return e instanceof m.FolderConflict?'conflict':String(e);}}, {...f,text});
  assert.deepEqual((await Promise.all([save(page,'tab A'),save(other,'tab B')])).sort(),['conflict','saved']);await other.close();
 });
 await check('Office safety: old "vorher" backups are pruned; recovery files and manual copies stay',async()=>{
  const got=await page.evaluate(async()=>{const m=await import('/folder.mjs'),f=await make();let rev=null;
   await m.writeFile(f.plaene,`Probenplan ${f.name} (Kopie manuell).probenplan`,'copy');
   for(let i=0;i<15;i++)rev=(await m.saveFolderProject(f,'v'+i,rev)).revision;
   const files=await names(f),backups=files.filter(n=>n.includes('(vorher '));
   return {count:backups.length,texts:await Promise.all(backups.map(n=>read(f,n))),copy:files.some(n=>n.includes('(Kopie manuell)')),main:await read(f),recovery:files.filter(n=>n.includes('Wiederherstellung')).length};
  });
  assert.equal(got.count,10);assert.equal(got.main,'v14');assert.ok(got.copy);assert.equal(got.recovery,0);
  assert.ok(got.texts.includes('v13'),'newest backup kept');assert.ok(!got.texts.includes('v0'),'oldest backup pruned');
 });
 await check('Office safety: backup names use local time; unique old UTC backups survive cleanup',async()=>{
  const got=await page.evaluate(async()=>{const m=await import('/folder.mjs'),f=await make();let rev=null;
   rev=(await m.saveFolderProject(f,'a',rev)).revision;rev=(await m.saveFolderProject(f,'b',rev)).revision;
   const now=new Date(),z=n=>String(n).padStart(2,'0'),backups=(await names(f)).filter(n=>n.includes('(vorher '));
   // 12 alte Sicherungen im UTC-Format von gestern: dürfen die neuen (Ortszeit) nicht verdrängen
   const y=new Date(Date.now()-86400000);for(let i=0;i<12;i++){const d=new Date(y.getTime()+i*1000);await m.writeFile(f.plaene,`Probenplan ${f.name} (vorher ${d.toISOString().replace(/[:.]/g,'-')}-0000000${i%10}-uuid).probenplan`,'alt'+i);}
   rev=(await m.saveFolderProject(f,'c',rev)).revision;
   const after=(await names(f)).filter(n=>n.includes('(vorher '));
   return {first:backups[0],today:`${now.getFullYear()}-${z(now.getMonth()+1)}-${z(now.getDate())}`,hour:z(now.getHours()),texts:await Promise.all(after.map(n=>read(f,n))),
    utc:m.stampTime('2026-10-16T19-37-16-853Z-x'),local:m.stampTime('2026-10-16 21-37-16-853 abcd1234)')};
  });
  assert.match(got.first,new RegExp(`\\(vorher ${got.today} \\d{2}-\\d{2}-\\d{2}-\\d{3} [0-9a-f-]{36}\\)\\.probenplan$`),got.first);
  assert.ok(got.first.includes(`${got.today} ${got.hour}-`)||got.first.includes(`${got.today} `),'Ortszeit im Namen');
  assert.equal(got.utc,Date.UTC(2026,9,16,19,37,16,853));assert.equal(got.local,new Date(2026,9,16,21,37,16,853).getTime());
  assert.ok(got.texts.includes('a')&&got.texts.includes('b'),'neue Sicherungen bleiben, auch neben 12 älteren im UTC-Format');
  assert.ok(got.texts.includes('alt0'),'einzigartige alte UTC-Sicherung darf nicht gelöscht werden');
 });
 await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
