// Wandansichten der Bohrkerne: Gruppierung je Wand, Lage, Einordnung ohne erfundene Skala, Zeichnung, Word-Blöcke, CSV. Node, synthetische Daten.
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
const W=await import('../src/wandansicht.ts');
const {scaleFor}=await import('../src/results.ts');
let n=0;const check=(name,fn)=>{fn();n++;console.log(`OK Wandansicht: ${name}`);};
const C40='Kohlenwasserstoffe C10-C40',C22='Kohlenwasserstoffe C10-C22',U='mg/kg TS';
const seg=(nr,id,st='A',extra={})=>({id:100+nr,_nr:nr,matrix:'Bohrkern',z2:'EG Wohnzimmer',bkBez:id.replace(/-T\d$/,''),bkId:id,bkVon:0,bkBis:2,bkMaterial:'Putz',bkStatus:st,notiz:st==='R'?'Rückstellprobe – nicht analysieren':'MKW',...extra});
const daten={sonstigeProben:[
 seg(1,'EG-WZ-B-7-T1','A',{bkEcke:0.6,bkOkff:0.3,bkWandL:4.2,bkWandH:2.5}),seg(2,'EG-WZ-B-7-T2','A',{bkVon:2,bkBis:6}),seg(3,'EG-WZ-B-7-T3','R'),
 seg(4,'1OG-KZ2-A-12a-T1'),seg(5,'EG-WZ-BO-1-T1'),seg(6,'REF-1-T1'),seg(7,'F-EG-WZ-B-7-T1'),seg(8,'Boden alt',undefined,{bkId:''}),
 {_nr:9,matrix:'Feststoff',bkId:'EG-WZ-B-1-T1'},null]};
const projekt=(scale)=>({format:'probenplan',version:6,plan:{name:'EG',width:100,height:100,data:'',vector:false},markers:[{id:'m1',kind:'sample',label:'P1',note:'',x:1,y:1,lx:1,ly:1,lab:{ref:'Probe 1',desc:'',werte:[{p:C40,r:'8400',u:U},{p:C22,r:'2100',u:U}]}}],nextSample:1,nextFire:1,report:'',date:'2026-10-24',
 pending:[{label:'P2',ref:'Probe 2',desc:'',werte:[{p:C40,r:'< 50',u:U}]},{label:'P3',ref:'Probe 3',desc:'',werte:[{p:C40,r:'999',u:U}]},{label:'P5',ref:'Probe 5',desc:'',werte:[{p:C40,r:'640',u:U}]}],
 results:scale?{parameter:C40,scales:{[`${C40}|${U}`]:{name:'Testskala',cats:[{name:'gering',from:0,color:'#4caf50'},{name:'stark',from:5000,color:'#e0453a'}]}}}:undefined});

check('Gruppierung: Wände, Boden, Freimessung getrennt, Referenz, ohne ID gemeldet, Fremdes ignoriert',()=>{
 const st=W.wandStand(daten,projekt(true));
 assert.deepEqual(st.waende.map(w=>w.key),['EG-WZ-B','EG-WZ-BO','1OG-KZ2-A','F-EG-WZ-B']);
 assert.deepEqual(st.waende[0].kerne[0].segmente.map(s=>[s.label,s.tiefe,s.status]),[['P1',1,'A'],['P2',2,'A'],['P3',3,'R']]);
 assert.equal(st.waende[0].laenge,4.2);assert.equal(st.waende[0].raum,'Wohnzimmer');assert.equal(st.waende[3].frei,true);
 assert.equal(st.waende[2].kerne[0].punkt,'12a');assert.deepEqual(st.referenz.map(k=>k.kern),['REF-1']);assert.deepEqual(st.ohneId,['P8 (Boden alt)']);
 assert.deepEqual(st.waende[0].kerne[0].segmente[2].werte,[],'Rückstellprobe ohne Werte, auch wenn der Plan welche hätte');
 assert.deepEqual(st.parameter,[C40,C22]);
});
check('Lage: gemessen, Raster, außerhalb, Boden',()=>{
 const st=W.wandStand(daten,projekt(true)),[b,bo,kz]=st.waende;
 assert.equal(W.lageText(b,b.kerne[0]),'0,60 m von links, 0,30 m über OKFF');
 assert.equal(W.lageText(bo,bo.kerne[0]),'Ecke A/D');assert.equal(W.lageText(kz,kz.kerne[0]),'außerhalb des Rasters');
 assert.equal(W.lageText({...b},{...b.kerne[0],ecke:null}),'bodennah links');
});
check('Einordnung: Skala des Projekts, unter BG, ohne Skala keine Kategorie, R, fehlend',()=>{
 const p=projekt(true),st=W.wandStand(daten,p),k=st.waende[0].kerne[0];
 assert.equal(W.einordnung(p,k.segmente[0],C40).kategorie,'stark');assert.equal(W.einordnung(p,k.segmente[1],C40).art,'below');assert.equal(W.einordnung(p,k.segmente[2],C40).art,'R');
 assert.equal(W.einordnung(p,k.segmente[0],'Unbekannt').art,'fehlt');
 const ohne=projekt(false),k2=W.wandStand(daten,ohne).waende[0].kerne[0];assert.equal(W.einordnung(ohne,k2.segmente[0],C40).art,'ohne','keine Skala → keine Kategorie, kein Grenzwert erfunden');
});
check('Vorschlag: C10–C40 zuerst, C10–C22 als zweiter Wert',()=>{
 assert.deepEqual(W.vorschlag([C22,'Summe 16 EPA-PAK',C40]),[C40,C22]);assert.deepEqual(W.vorschlag(['Summe 16 EPA-PAK exkl. BG'],'Summe 16 EPA-PAK exkl. BG'),['Summe 16 EPA-PAK exkl. BG','']);assert.deepEqual(W.vorschlag([]),['','']);
});
check('Zeichnung: Titel, Punktlabel, Tiefenzellen, Legende mit Skala, Rückstellprobe gemustert, Text escaped',()=>{
 const p=projekt(true),st=W.wandStand({sonstigeProben:[...daten.sonstigeProben.slice(0,3)].map(x=>({...x,z2:'EG <Wohn>'}))},p),b=W.wandSvg(p,st.waende[0],C40);
 assert.match(b.svg,/^<svg [^>]*viewBox="0 0 1000 \d+"/);assert.match(b.svg,/Erdgeschoss · &lt;Wohn&gt; · Wand B/);assert.match(b.svg,/>B-7</);
 assert.match(b.svg,/>8400</);assert.match(b.svg,/>&lt; 50</);assert.match(b.svg,/url\(#r\)/);assert.match(b.svg,/stark \(≥ 5\.000 mg\/kg TS\)/);
 assert.deepEqual(b.skalen,['Testskala']);
 const ohne=projekt(false),b2=W.wandSvg(ohne,W.wandStand(daten,ohne).waende[0],C40);assert.match(b2.svg,/keine Skala für diesen Parameter/);assert.deepEqual(b2.skalen,[]);
});
check('Word-Blöcke und CSV',()=>{
 const p=projekt(true),st=W.wandStand(daten,p),img={data:new Uint8Array([1]),ext:'png',widthPx:2000,heightPx:1400};
 const blocks=W.wandBlocks(p,st,new Map(st.waende.map(w=>[w.key,img])),C40,C22,{title:'Anlage 6',nr:'26.0142',ort:'Teststadt',projectData:{objekt:'EFH'},created:'2026-10-24T10:00:00Z',app:'PlanKit test',source:'Pläne/x.probenplan',labelkit:'Laboraufträge/x_Daten.json'});
 const txt=JSON.stringify(blocks);assert.equal(blocks.filter(b=>b.t==='image').length,4);assert.match(txt,/Anlage 6: Bohrkerne – Wandansichten/);assert.match(txt,/Referenzproben/);assert.match(txt,/P8 \(Boden alt\)/);
 const tables=blocks.filter(b=>b.t==='table');assert.ok(tables.every(t=>t.widths.reduce((a,b)=>a+b,0)===9070));assert.ok(tables.every(t=>t.rows.every(r=>r.cells.length===t.widths.length)));
 const csv=W.wandCSV(p,st,C40,C22).split('\r\n');assert.equal(csv[0].charCodeAt(0),0xfeff);assert.equal(csv.filter(Boolean).length,1+7);
 assert.match(csv[1],/^Erdgeschoss;Wohnzimmer;Wand B;EG-WZ-B-7;EG-WZ-B-7-T1;P1;0,60 m von links, 0,30 m über OKFF;0;2;Putz;;analysiert;8400 mg\/kg TS;2100 mg\/kg TS;25;stark$/);
 assert.match(W.wandName('26.0142','docx','2026-10-24',['26-0142_Wandansichten_2026-10-24.docx']),/_2\.docx$/);
 assert.deepEqual(W.wandHinweise(st,C40).map(h=>h.replace(/:.*/,'')),['3 analysierte Segmente noch ohne Laborwert für Kohlenwasserstoffe C10-C40','2 Wände ohne Wandmaße – Lage nach Raster','Ohne gültige Bohrkern-ID, nicht dargestellt']);
});
check('Anteil C10–C22 an C10–C40: gerechnet, Obergrenze bei < BG, sonst leer – keine Ölart',()=>{
 const s=(r40,r22,extra={})=>({label:'P1',id:'x',tiefe:1,von:0,bis:2,material:'',status:'A',werte:[{p:C40,r:r40,u:U},{p:C22,r:r22,u:extra.u||U}],...extra});
 const paar=W.kwPaar(C40,C22);assert.deepEqual(paar,[C40,C22]);assert.deepEqual(W.kwPaar(C22,C40),[C40,C22]);assert.equal(W.kwPaar(C40,''),null);assert.equal(W.kwPaar('Summe 16 EPA-PAK',C22),null);
 assert.equal(W.kwAnteil(s('8400','2100'),paar),'25 %');assert.equal(W.kwAnteil(s('1200','1150'),paar),'96 %');
 assert.equal(W.kwAnteil(s('800','< 50'),paar),'< 6 %');assert.equal(W.kwAnteil(s('800','unter BG'),paar),'');
 assert.equal(W.kwAnteil(s('< 50','< 50'),paar),'');assert.equal(W.kwAnteil(s('800','n.n.'),paar),'');
 assert.equal(W.kwAnteil(s('800','100',{u:'mg/kg'}),paar),'','verschiedene Einheiten');assert.equal(W.kwAnteil(s('800','100',{status:'R'}),paar),'');
 const p=projekt(true),st=W.wandStand(daten,p),svg=W.wandSvg(p,st.waende[0],C40,{anteil:paar}).svg;assert.match(svg,/>25 %</);assert.match(svg,/Anteil C10–C22 an C10–C40/);
 assert.doesNotMatch(W.wandSvg(p,st.waende[0],C40).svg,/>25 %</,'ohne Paar kein Anteil');
 const txt=JSON.stringify(W.wandBlocks(p,st,new Map(),C40,C22,{title:'A',nr:'1',ort:'',projectData:{},created:'2026-10-24T10:00:00Z',app:'t',source:'s',labelkit:'l'}));assert.match(txt,/Anteil C10–C22/);assert.match(txt,/Keine Zuordnung zu einer Ölart/);
});
check('Skalenregel (wie Ergebniskarte): VdS, wenn vorhanden – angepasst möglich; sonst eigene Skala',()=>{const SUM='Summe 16 EPA-PAK exkl. BG',u='µg/m²',own={name:'eigen',cats:[{name:'a',from:0,color:'#4caf50'}]},anp={name:'VdS angepasst',cats:[{name:'b',from:0,color:'#4caf50'}]};
 assert.match(scaleFor({parameter:SUM,scales:{[`${SUM}|${u}`]:own},usage:'residential'},SUM,u).scale.name,/^VdS 2357/,'VdS vor eigener Skala');
 assert.equal(scaleFor({parameter:SUM,scales:{[`${SUM}|${u}`]:own},usage:'residential',vds:{[`${SUM}|${u}`]:anp}},SUM,u).scale,anp);
 assert.equal(scaleFor({parameter:SUM,scales:{[`${SUM}|${u}`]:own}},SUM,u).scale,own,'ohne Nutzung eigene Skala');
 assert.equal(scaleFor({parameter:C40,scales:{[`${C40}|${U}`]:own},usage:'residential'},C40,U).scale,own,'MKW: keine VdS-Referenz → eigene Skala');
 assert.equal(scaleFor({parameter:C40,scales:{},usage:'residential'},C40,U).scale,undefined,'keine erfunden');});
console.log(`OK Wandansicht: ${n} Fälle`);
