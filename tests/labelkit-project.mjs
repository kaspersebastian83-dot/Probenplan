// Node 24: echte TypeScript-Parser samt lokalen Abhängigkeiten, ohne DOM oder Nutzerdaten.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const {labelkitReport}=await import('../src/labelkit.ts');
const {applyLabImport}=await import('../src/lab-provenance.ts');
const {setNutzung,usageFromNutzung,prepare,vdsScale}=await import('../src/results.ts');
const project='26.0101 Muster',quelle='26.0999_Daten.json';
const data=nr=>({version:'4.30.10',projekt:{nr},proben:[{id:1,_nr:1,z2:'FREMDES PROJEKT',datum:'2026-10-21',matrix:'Wischprobe',cm2:'100'}]});
let checks=0;
function check(name,fn){fn();checks++;console.log(`OK F1: ${name}`);}
check('verbindlicher Fremdprojektfall blockiert auch bei pauschalem OK',()=>{
 let prompts=0;const foreign=data('26.0999'),before=JSON.stringify(foreign);
 assert.throws(()=>labelkitReport(before,quelle,project,()=>{prompts++;return true;}),/blockiert.*26\.0999.*26\.0101/);
 assert.equal(prompts,0);assert.equal(JSON.stringify(foreign),before);
});
check('korrekte Nummer wird aus der Datei als Referenz erhalten',()=>{
 const report=labelkitReport(JSON.stringify(data('26.0101')),quelle,project,()=>{throw Error('Keine Bestätigung bei passender Nummer');});
 assert.equal(report.auftragsreferenz,'26.0101');assert.equal(report.rows[0].desc,'FREMDES PROJEKT, 100 cm²');assert.equal(report.rows[0].label,'P1');assert.equal(report.rows[0].datum,'2026-10-21');
});
check('Leerzeichen ändern die Projektnummer nicht',()=>assert.equal(labelkitReport(JSON.stringify(data(' 26.0101 ')),quelle,project).auftragsreferenz,'26.0101'));
for(const legacy of [data(''),data('  '),data(null),{proben:data('').proben}]){
 check('alte Datei ohne Bestätigung bleibt gesperrt',()=>assert.throws(()=>labelkitReport(JSON.stringify(legacy),quelle,project),/nicht ausdrücklich/));
 check('Abbrechen verwirft alte Datei',()=>assert.throws(()=>labelkitReport(JSON.stringify(legacy),quelle,project,()=>false),/abgebrochen/));
 check('ausdrücklich geprüfte alte Datei bleibt lesbar',()=>{
  let prompts=0;const report=labelkitReport(JSON.stringify(legacy),quelle,project,message=>{prompts++;assert.match(message,/26\.0101/);assert.match(message,/keine Projektnummer/);return true;});
  assert.equal(prompts,1);assert.equal(report.auftragsreferenz,'26.0101');assert.equal(report.rows.length,1);
 });
}
check('unterschiedliche führende Nullen und ungültige Nummern werden nicht gleichgesetzt',()=>{
 for(const nr of ['26.101','26.01010','26.0101 Fremd','unbekannt',{},123])assert.throws(()=>labelkitReport(JSON.stringify(data(nr)),quelle,project,()=>true),/blockiert/);
});
check('ohne erkennbare Zielprojektnummer keine Zuordnung',()=>assert.throws(()=>labelkitReport(JSON.stringify(data('26.0101')),quelle,'',()=>true),/aktiven Projekts/));
check('bestehende Listen, Nummern, Beschreibungen und Datumsformate bleiben erhalten',()=>{
 const input={...data('26.0101'),chloridProben:[{id:7,_nr:2,matrix:'Wischprobe',z2:'Flur',cm2:'400',datum:'21.10.2026'}],asbestProben:[{id:3,_nr:3,matrix:'Materialprobe',z2:'Dach'}],sonstigeProben:[{id:4,_nr:4,matrix:'Bohrkern',bkBez:'Boden',bkVon:1,bkBis:3}],extension:{unbekannt:true}};
 const text=JSON.stringify(input),report=labelkitReport(text,quelle,project);
 assert.deepEqual(report.rows.map(r=>[r.label,r.typ]),[['P1','PAK'],['P2','Chlorid'],['P3','Asbest'],['P4','Sonstige']]);assert.equal(report.rows[1].datum,'2026-10-21');assert.equal(report.expected,4);assert.equal(JSON.stringify(input),text);
});
check('Bohrkern: Segment-ID und Material in der Beschreibung, Rückstellproben nicht als offene Probe',()=>{
 const seg=(nr,t,von,bis,extra)=>({id:nr,_nr:nr,matrix:'Bohrkern',bkBez:'EG-WZ-B-7',bkId:`EG-WZ-B-7-T${t}`,bkMaterial:'Putz',bkVon:von,bkBis:bis,z2:'EG Wohnzimmer',bkStatus:'A',notiz:'MKW',...extra});
 const input={...data('26.0101'),proben:[],sonstigeProben:[seg(1,1,0,2),seg(2,2,2,6),seg(3,3,6,12,{bkStatus:'R',notiz:'Rückstellprobe – nicht analysieren'})]};
 const report=labelkitReport(JSON.stringify(input),quelle,project);
 assert.deepEqual(report.rows.map(r=>[r.label,r.desc,r.raum]),[['P1','EG-WZ-B-7-T1 · Putz · 0–2 cm','EG Wohnzimmer'],['P2','EG-WZ-B-7-T2 · Putz · 2–6 cm','EG Wohnzimmer']]);
 assert.match(report.warnings.join(' '),/1 Bohrkern-Rückstellprobe .*nicht übernommen/);
});
check('beschädigte und fachfremde JSON bleiben abgewiesen',()=>{
 for(const text of ['{','null','{}','[]'])assert.throws(()=>labelkitReport(text,quelle,project,()=>true));
});
check('freier Plan erhält nur die Quellreferenz und keine erfundene Zielnummer',()=>{
 const r=labelkitReport(JSON.stringify(data('26.0999')),quelle,null);
 assert.equal(r.auftragsreferenz,'26.0999');assert.equal(r.rows.length,1);
});
check('nummernlose freie Datei braucht ausdrückliches OK, Referenz bleibt leer',()=>{
 for(const confirm of [undefined,()=>false])assert.throws(()=>labelkitReport(JSON.stringify(data('')),quelle,null,confirm),/abgebrochen/);
 const r=labelkitReport(JSON.stringify(data('')),quelle,null,m=>{assert.match(m,/freien Plan/);return true;});
 assert.equal(r.auftragsreferenz,'');assert.equal(r.rows.length,1);
});
check('unlesbare vorhandene Zielkennung ist kein freier Plan',()=>{
 for(const target of ['', 'unbekannt', '2026-0142'])assert.throws(()=>labelkitReport(JSON.stringify(data('26.0999')),quelle,target,()=>true),/aktiven Projekts/);
});
// Echter manueller Importhandler mit verzögertem Dateilesen; kein DOM nötig.
const labui=readFileSync(new URL('../src/labui.ts',import.meta.url),'utf8');
const importStart=labui.indexOf(' async import(files:File[])'),importEnd=labui.indexOf('\n private collision',importStart);
const manualMethod=stripTypeScriptTypes('class TestUI {'+labui.slice(importStart,importEnd)+'}',{mode:'transform'});
async function manual(target,nr,approval,change){
 const errors=[],prompts=[];let active={},currentTarget=target,shown=0;
 const context=vm.createContext({labelkitReport,window:{confirm:m=>{prompts.push(m);return approval;}}});
 const UI=vm.runInContext(manualMethod+'; TestUI',context),ui=new UI();
 Object.assign(ui,{hooks:{project:()=>active,labelkitProject:()=>currentTarget,blocked:()=>false,busy(){},error:e=>errors.push(e.message)},review:{open:false,showModal(){shown++;}},open:{},choices:new Map(),meta:new Map(),renderTable(){},render(){}});
 await ui.import([{name:quelle,text:async()=>{if(change==='project')active={};if(change==='target')currentTarget='26.0888';return JSON.stringify(data(nr));}}]);
 return{errors,prompts,shown,report:ui.report,loading:ui.loading};
}
for(const [target,nr,approval,accepted,promptCount] of [[null,'26.0999',false,true,0],[null,'',false,false,1],[null,'',true,true,1],[project,'26.0999',true,false,0],[project,'26.0101',false,true,0],[project,'',false,false,1],[project,'',true,true,1]]){
 const r=await manual(target,nr,approval);assert.equal(r.shown,accepted?1:0);assert.equal(r.errors.length,accepted?0:1);assert.equal(r.prompts.length,promptCount);assert.equal(r.loading,false);checks++;
}
for(const change of ['project','target']){
 const r=await manual(null,'26.0999',true,change);assert.equal(r.shown,0);assert.match(r.errors[0],/gewechselt/);assert.equal(r.prompts.length,0);checks++;
}
console.log('OK F1 manueller Handler: freier Plan, Zielnummer, Altdateien und Projektwechsel');
// Der tatsächliche asynchrone Klickhandler darf die Prüftabelle erst nach erfolgreicher Zuordnung öffnen.
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const start=main.indexOf("$('lab-folder-list').onclick=async e=>"),end=main.indexOf("\n  $('lab-folder-other')",start);
assert.ok(start>=0&&end>start);
const handler=stripTypeScriptTypes(main.slice(start,end),{mode:'transform'});
async function ui(nr,approval,changeProject=false){
 const shown=[],errors=[],prompts=[],list={},folder={name:project},active={report:project};let context;
 const handle={getFile:async()=>{if(changeProject)context.folder={name:'26.0888 Anderes Projekt'};return{text:async()=>JSON.stringify(data(nr))};}};
 context=vm.createContext({$:()=>list,folder,project:active,erfassungen:[{name:quelle,handle}],d:{close(){}},labelkitReport,labUI:{show:r=>shown.push(r)},window:{confirm:m=>{prompts.push(m);return approval;}},fail:e=>errors.push(e.message)});
 vm.runInContext(handler,context);await list.onclick({target:{closest:()=>({dataset:{labelkit:'0'}})}});
 return{shown,errors,prompts};
}
for(const [nr,approval,accepted,prompts] of [['26.0999',true,false,0],['26.0101',false,true,0],['',false,false,1],['',true,true,1]]){
 const result=await ui(nr,approval);assert.equal(result.shown.length,accepted?1:0);assert.equal(result.errors.length,accepted?0:1);assert.equal(result.prompts.length,prompts);
 if(nr==='26.0999')assert.match(result.errors[0],/26\.0999.*26\.0101/);
 checks++;console.log(`OK F1 Klickhandler: ${nr||'ohne Nummer'}, OK=${approval}, Prüftabelle=${accepted}`);
}
check('Oberflächenart aus LabelKit wird zur Fläche am Probenpunkt',()=>{
 const input={...data('26.0101'),proben:[{id:1,_nr:1,z2:'EG',z4:'Aufsicht'},{id:2,_nr:2,z2:'EG',z4:'Ansicht'},{id:3,_nr:3,z2:'EG',z4:'Untersicht'},{id:4,_nr:4,z2:'EG',z4:''},{id:5,_nr:5,z2:'EG',z4:'irgendwas'}]};
 const rows=labelkitReport(JSON.stringify(input),quelle,project).rows;
 assert.deepEqual(rows.map(r=>r.surface),['floor','wall','ceiling',undefined,undefined]);
});
check('erneuter LabelKit-Import füllt nur leere Oberflächenart; Eingabe in PlanKit bleibt',()=>{
 const report=labelkitReport(JSON.stringify({...data('26.0101'),proben:[{id:1,_nr:1,z2:'EG',z4:'Aufsicht'},{id:2,_nr:2,z2:'EG',z4:'Aufsicht'}]}),quelle,project);
 const marker=(label,extra={})=>({id:label,kind:'sample',label,note:'',x:1,y:1,lx:1,ly:1,...extra});
 const p={format:'probenplan',version:4,plan:{width:10,height:10},markers:[marker('P1',{surface:'wall'}),marker('P2')],nextSample:3,nextFire:1,report:'',date:'',pending:[]};
 const next=applyLabImport(p,report,new Map(report.rows.map(r=>[r,'update'])));
 assert.deepEqual(next.markers.map(m=>m.surface),['wall','floor']);
 assert.ok(next.markers.every(m=>!('surface' in (m.lab||{}))),'Oberflächenart gehört an den Marker, nicht zu den Labordaten');
});
check('Nutzung aus den Projektdaten wählt die VdS-Referenz nur beim ersten Anlegen vor',()=>{
 for(const [n,u] of [['Wohnen','residential'],['Büro','residential'],['Öffentlich','residential'],['Gesundheit & Labor','residential'],['Gewerbe/Industrie','industrial'],['Landwirtschaft','industrial'],['',undefined],['Raumstation',undefined]])assert.equal(usageFromNutzung(n),u,n);
 const SUM='Summe 16 EPA-PAK exkl. BG',withValue=()=>({format:'probenplan',version:4,plan:{width:10,height:10},markers:[{id:'a',kind:'sample',label:'P1',note:'',x:1,y:1,lx:1,ly:1,lab:{ref:'Probe 1',desc:'',werte:[{p:SUM,r:'12',u:'µg/m²'}]}}],nextSample:2,nextFire:1,report:'',date:''});
 setNutzung('Gewerbe/Industrie');const a=withValue();prepare(a);assert.equal(a.results.usage,'industrial');
 setNutzung('Wohnen');prepare(a);assert.equal(a.results.usage,'industrial','eine bestehende Wahl bleibt');
 const b=withValue();b.results={parameter:SUM,scales:{}};prepare(b);assert.equal(b.results.usage,undefined,'„Eigene Skala“ bleibt eigene Skala');
 setNutzung('Gesundheit & Labor');assert.match(vdsScale(SUM,'µg/m²','residential').name,/Gesundheit & Labor, Referenz < 10 µg\/m²/);assert.equal(vdsScale(SUM,'µg/m²','residential').cats[1].from,10);
 setNutzung('');assert.match(vdsScale(SUM,'µg/m²','residential').name,/Wohn-\/Büroräume/);
});
const switched=await ui('26.0101',true,true);assert.equal(switched.shown.length,0);assert.match(switched.errors[0],/gewechselt/);checks++;
console.log(`OK F1: ${checks} Parser- und Klickhandler-Prüfungen`);
