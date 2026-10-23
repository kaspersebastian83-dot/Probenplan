import {spawn} from 'node:child_process';
for(const engine of ['chromium','webkit']){
 const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['tests/project-data-browser.cjs',engine],{env:process.env,stdio:'inherit'});p.once('error',reject);p.once('exit',resolve);});
 if(code!==0)throw Error(`F7 ${engine} regression failed (${code})`);
}
