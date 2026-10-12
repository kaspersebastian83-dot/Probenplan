import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const suite=process.argv[2];
try{await import(new URL(`./${suite}.mjs`,import.meta.url));}catch(error){await mkdir('.test-output/diagnostics',{recursive:true});await writeFile(resolve('.test-output/diagnostics',`${suite}-failure.txt`),error.stack||String(error));console.error(error);process.exitCode=1;}
