import {preview} from 'vite';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,rm,access} from 'node:fs/promises';
const suites=['browser','edge-cases','import-preparation','scoped-pdf','areas','keyboard','marker-pan','labreport','lab-provenance','layout'];
// Start a private production preview on a free port; never attach to a user's app.
await rm('.test-output',{recursive:true,force:true});await mkdir('.test-output',{recursive:true});
for(const file of ['dist/index.html','dist/sw.js'])await access(file).catch(()=>{throw new Error('Produktionsbuild fehlt. Vor pnpm test bitte pnpm build ausführen.');});
const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});
const port=server.httpServer.address().port,base=`http://127.0.0.1:${port}`;
const results=[];let child,interrupted=false;
function stop(signal){interrupted=true;child?.kill(signal);process.exitCode=1;}
process.once('SIGINT',()=>stop('SIGINT'));process.once('SIGTERM',()=>stop('SIGTERM'));
try{
 for(const suite of suites){if(interrupted)break;console.log(`\n=== ${suite} ===`);const start=Date.now();let output='';
  const code=await new Promise((resolve,reject)=>{child=spawn(process.execPath,['tests/execute.mjs',suite],{env:{...process.env,TEST_URL:base,TEST_SUITE:suite,AREA_ENGINE:'',TEST_FILTER:''},stdio:['ignore','pipe','pipe'],timeout:10*60*1000,killSignal:'SIGTERM'});for(const [stream,dest] of [[child.stdout,process.stdout],[child.stderr,process.stderr]])stream.on('data',data=>{output+=data;dest.write(data);});child.once('error',reject);child.once('exit',code=>resolve(code));});
  await writeFile(`.test-output/${suite}.log`,output);results.push({suite,code,durationMs:Date.now()-start});if(code!==0){process.exitCode=1;
   // In GitHub Actions erscheint der Fehler zusätzlich als Annotation direkt am Pull Request.
   if(process.env.GITHUB_ACTIONS){const tail=output.replace(/\u001b\[[0-9;]*m/g,'').split('\n').filter(l=>!/^OK /.test(l)).join('\n').trim().slice(-1500);console.log(`::error title=Testsuite ${suite}::${tail.replace(/%/g,'%25').replace(/\r/g,'').replace(/\n/g,'%0A')}`);}}
 }
}finally{await writeFile('.test-output/summary.json',JSON.stringify(results,null,2));await new Promise(resolve=>server.httpServer.close(resolve));}
