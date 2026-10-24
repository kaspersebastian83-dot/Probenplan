// Vorläufiger Prüfbericht: Hinweis in der Word-Anlage (Lageplan als Ergebniskarte, Probenverzeichnis). Node, synthetische Daten.
// Die Ergebniskarte (PDF/Bild) zeigt „VORLÄUFIG“ im Schriftfeld – gezeichnet, daher hier nur der gemeinsame Hinweistext.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
globalThis.localStorage={getItem:()=>null,setItem(){}};
const {annexBlocks}=await import('../src/annex.ts');
const {vorlaeufigText}=await import('../src/lab-provenance.ts');
let n=0;const check=(name,fn)=>{fn();n++;console.log(`OK Vorläufig: ${name}`);};
const text=bl=>bl.filter(b=>b.t==='p').map(b=>b.text).join('\n');
const img={data:new Uint8Array([1]),ext:'png',widthPx:10,heightPx:10};
const input=(o={})=>({title:'Anlage 5',nr:'26.0142',ort:'Teststadt',projectData:{},parameter:'Summe 16 EPA-PAK',scaleNotes:[],plans:[{floor:'EG',image:img,widthMm:100,heightMm:100,ratio:null,results:true}],
 samples:[],photos:[],sources:[],checks:[],created:'2026-10-24T12:00:00Z',app:'PlanKit',maxPhotos:2,photosIncluded:false,...o});
const H=vorlaeufigText([{id:'r1',bericht:'AR-999-2099-000001-01',labor:'Testlabor',auftragsreferenz:'',sources:{},vorlaeufig:true}]);
check('gemeinsamer Hinweistext nennt den Bericht',()=>{assert.match(H,/^Werte aus vorläufigem Prüfbericht AR-999-2099-000001-01 – sie können sich mit dem endgültigen Bericht ändern/);assert.equal(vorlaeufigText([]),'');});
check('Word-Anlage: Hinweis unter dem Lageplan (Ergebniskarte) und im Probenverzeichnis',()=>{
 const t=text(annexBlocks(input({vorlaeufig:H})));assert.equal(t.split(H).length-1,2,'zweimal: Lageplan und Probenverzeichnis');});
check('ohne vorläufigen Bericht kein Hinweis; neutraler Probenplan ohne Hinweis unter dem Plan',()=>{
 assert.doesNotMatch(text(annexBlocks(input())),/vorläufig/);
 const t=text(annexBlocks(input({vorlaeufig:H,plans:[{floor:'EG',image:img,widthMm:100,heightMm:100,ratio:null,results:false}]})));assert.equal(t.split(H).length-1,1,'nur im Probenverzeichnis');});
console.log(`${n} Prüfungen „vorläufig“ bestanden`);
