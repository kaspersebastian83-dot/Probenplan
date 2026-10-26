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
const {vorlaeufigText,vorlaeufigeBerichteAufPlan,vorlaeufigeBerichte,berichtQuellen}=await import('../src/lab-provenance.ts');
let n=0;const check=(name,fn)=>{fn();n++;console.log(`OK Vorläufig: ${name}`);};
const text=bl=>bl.filter(b=>b.t==='p').map(b=>b.text).join('\n');
const img={data:new Uint8Array([1]),ext:'png',widthPx:10,heightPx:10};
const input=(o={})=>({title:'Anlage 5',nr:'26.0142',ort:'Teststadt',projectData:{},parameter:'Summe 16 EPA-PAK',scaleNotes:[],plans:[{floor:'EG',image:img,widthMm:100,heightMm:100,ratio:null,results:true}],
 samples:[],photos:[],sources:[],checks:[],created:'2026-10-24T12:00:00Z',app:'PlanKit',maxPhotos:2,photosIncluded:false,...o});
const H=vorlaeufigText([{id:'r1',bericht:'AR-999-2099-000001-01',labor:'Testlabor',auftragsreferenz:'',sources:{},vorlaeufig:true}]);
check('gemeinsamer Hinweistext nennt den Bericht',()=>{assert.match(H,/^Werte aus vorläufigem Prüfbericht AR-999-2099-000001-01 – sie können sich mit dem endgültigen Bericht ändern/);assert.equal(vorlaeufigText([]),'');});
const plan=(o={})=>({floor:'EG',image:img,widthMm:100,heightMm:100,ratio:null,results:true,...o});
check('Word-Anlage: Hinweis unter dem Lageplan (Ergebniskarte) und im Probenverzeichnis',()=>{
 const t=text(annexBlocks(input({vorlaeufig:H,plans:[plan({vorlaeufig:H}),plan({floor:'OG'})]})));assert.equal(t.split(H).length-1,2,'zweimal: Lageplan und Probenverzeichnis');});
check('ohne vorläufigen Bericht kein Hinweis; neutraler Probenplan ohne Hinweis unter dem Plan',()=>{
 assert.doesNotMatch(text(annexBlocks(input())),/vorläufig/);
 const t=text(annexBlocks(input({vorlaeufig:H,plans:[plan({results:false})]})));assert.equal(t.split(H).length-1,1,'nur im Probenverzeichnis');});
check('Planseite: nur Werte dieser Seite und des dargestellten Parameters (Review)',()=>{
 const R=(id,v)=>({id,bericht:id.toUpperCase(),labor:'L',auftragsreferenz:'',sources:{},...(v?{vorlaeufig:true}:{})});
 const M=(id,rid,par)=>({id,kind:'sample',label:id,note:'',x:0,y:0,lx:0,ly:0,lab:{ref:id,desc:'',reportId:rid,werte:[{p:par,r:'1',u:'mg/kg'}]}});
 const p={labReports:[R('vorl',true),R('fin'),R('vorl-og',true),R('vorl-bap',true)],results:{parameter:'PAK'},markers:[M('P1','fin','PAK'),M('P2','vorl-bap','BaP')],
  sheets:[{name:'EG'},{name:'OG',markers:[M('P3','vorl-og','PAK')]}],active:0,pending:[{reportId:'vorl'}]};
 assert.deepEqual(vorlaeufigeBerichteAufPlan(p,'PAK').map(r=>r.id),[],'nur endgültige Werte für PAK auf dieser Seite → kein Hinweis');
 assert.deepEqual(vorlaeufigeBerichteAufPlan(p,'BaP').map(r=>r.id),['vorl-bap']);
 assert.deepEqual(vorlaeufigeBerichteAufPlan({...p,markers:[M('P3','vorl-og','PAK')]},'PAK').map(r=>r.id),['vorl-og'],'OG-Seite');
 assert.ok(vorlaeufigeBerichte(p).some(r=>r.id==='vorl'),'projektweit (Dialoge, Prüfprotokoll) zählt auch Offenes');
});
check('Quellenverzeichnis der Anlage: nur verwendete Berichte, je Datei einmal (Review 1.38.0)',()=>{
 const R=(id,xml,o={})=>({id,bericht:'AR-1',labor:'L',auftragsreferenz:'',sources:{xml,pdf:'AR-1.pdf'},...o});
 const M=(id,rid)=>({id,kind:'sample',label:id,note:'',x:0,y:0,lx:0,ly:0,lab:{ref:id,desc:'',reportId:rid}});
 // vorläufiger Bericht durch den endgültigen ersetzt (Datei nicht mehr im Ordner), endgültiger zweimal importiert
 const p={labReports:[R('vorl','AR-1-vorlaeufig.xml',{vorlaeufig:true}),R('fin','AR-1.xml'),R('fin2','AR-1.xml'),R('lk',undefined)],markers:[M('P1','fin')],sheets:[{name:'EG'},{name:'OG',markers:[M('P2','fin2')]}],active:0,pending:[{reportId:'fin'}]};
 p.labReports[3].sources={};
 assert.deepEqual(berichtQuellen(p).map(q=>[q.name,q.origin.id]),[['AR-1.xml','fin'],['AR-1.pdf','fin']]);
 assert.deepEqual(berichtQuellen({...p,markers:[],sheets:undefined,pending:[{reportId:'vorl'}]}).map(q=>q.name),['AR-1-vorlaeufig.xml','AR-1.pdf']);
});
check('Schadendatum „nicht bekannt“ aus der Projektzentrale (schadendatum: \'unbekannt\')',()=>{
 const zeile=pd=>annexBlocks(input({projectData:pd})).filter(b=>b.t==='table').flatMap(b=>b.rows).map(r=>r.cells.map(c=>c.text)).find(c=>c[0]==='Schadendatum');
 assert.deepEqual(zeile({schadendatum:'unbekannt'}),['Schadendatum','nicht bekannt']);assert.deepEqual(zeile({schadendatum:'2026-10-02'}),['Schadendatum','02.10.2026']);
});
console.log(`${n} Prüfungen „vorläufig“ bestanden`);
