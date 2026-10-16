// Synthetic only. Runs on the existing isolated parser module server.
import assert from 'node:assert/strict';
import {labXML,labRows,labPages} from './lab-fixtures.mjs';
export async function laboratoryRegressions(page,check){
 await check('Labor 1.8.1: strict German/international numbers, ambiguity and BG',async()=>{
  const good=[['1300',1300],['0',0],['3,2',3.2],['3.2',3.2],['0.123',.123],['0,123',.123],['1.300,5',1300.5],['1,300.5',1300.5],['1.234.567',1234567],['1,234,567',1234567],['1 300,5',1300.5],['1\u202f300.5',1300.5],['1\u00a0300',1300],['1,2e3',1200],['1.2E-3',.0012],['−2,5',-2.5]];
  const bad=['',' ','1.300','1,300','1.234','1,234','12.345','12,345','12.34,5','12,34.5','1 30','1,2,3','1.2.3','1.234,5.6','1.2 mg/kg','> 5','NaN','Infinity','0x10','1e999','1e','--1'];
  const bg=['< 0,50','<0.5','< 1.300,5','< 1,300.5','unter BG'];
  const got=await page.evaluate(async({good,bad,bg})=>{const m=await import('/results.mjs');return {values:good.map(([s])=>m.labNumber(s)),invalid:bad.map(s=>Number.isNaN(m.labNumber(s))),bg:bg.map(s=>[m.belowLimit(s),Number.isNaN(m.labNumber(s))]),zeroBG:m.belowLimit('0'),otherBG:m.belowLimit('unbekannt')};},{good,bad,bg});
  assert.deepEqual(got.values,good.map(([,n])=>n));assert.ok(got.invalid.every(Boolean));assert.ok(got.bg.every(x=>x.every(Boolean)));assert.equal(got.zeroBG,false);assert.equal(got.otherBG,false);
 });
 await check('Labor 1.8.1: qualifiers remain distinct from BG and measured zero',async()=>{
  const cases=[['< 0,50','below'],['unter BG','below'],[' UNTER bg ','below'],['n.n.','notDetected'],['(N. N.)','notDetected'],['n.b.','notDetermined'],['(n. b.)','notDetermined'],['0','measured'],['0,00','measured'],['<','unrated'],['< kaputt','unrated'],['< 1.2 mg/kg','unrated'],['<< 0.50','unrated'],['< NaN','unrated'],['< Infinity','unrated'],['< -1','unrated'],['< 1.234','unrated'],['< BG','unrated'],['n.n. Zusatz','unrated'],['(n.b.','unrated']];
  const got=await page.evaluate(async cases=>{const m=await import('/results.mjs');return cases.map(([s])=>({kind:m.labQualifier(s),below:m.belowLimit(s),number:Number.isFinite(m.labNumber(s))}));},cases);
  assert.deepEqual(got,cases.map(([,kind])=>({kind,below:kind==='below',number:kind==='measured'})));
 });
 await check('Labor 1.8.1: VdS boundaries, units, BG and raw preservation',async()=>{
  const got=await page.evaluate(async()=>{
   const m=await import('/results.mjs'),sum='Summe 16 EPA-PAK exkl. BG';
   const cases=[['9.99','µg/m²'],['10','µg/m²'],['99.99','µg/m²'],['100','µg/m²'],['0.0999','µg/100 cm²'],['0.1','µg/100 cm²'],['0.0099','mg/m²'],['0.01','mg/m²'],['9999','ng/m²'],['10000','ng/m²'],['< 500','µg/m²'],['0','µg/m²'],['1.234','µg/m²'],['-1','µg/m²'],['10','mg/kg']];
   const p={markers:cases.map(([r,u],i)=>({id:String(i),kind:'sample',label:`P${i+1}`,lab:{werte:[{p:sum,r,u}]}})),results:{parameter:sum,scales:{},usage:'residential'}};
   const before=JSON.stringify(p.markers),a=m.rateMarkers(p);p.results.usage='industrial';const b=m.rateMarkers(p);
   return {a:[...a.fill.values()],b:[...b.fill.values()],below:a.below,unrated:a.unrated,unchanged:before===JSON.stringify(p.markers),unknown:m.vdsScale('Benzo[a]pyren','µg/m²','residential')===undefined,alias:m.vdsScale('Σ16 EPA-PAK','μg / m2','residential')?.cats[1].from,onlyBG:m.parameters({markers:[],pending:[{werte:[{p:sum,r:'unter BG',u:'µg/m²'}]}]})};
  });
  const green='#4caf50',red='#e0453a',blue='#749bb5',gray='#c3ccd5';
  assert.deepEqual(got.a,[green,red,red,red,green,red,green,red,green,red,blue,green,gray,gray,gray]);
  assert.deepEqual(got.b,[green,green,green,red,green,green,green,green,green,green,blue,green,gray,gray,gray]);
  assert.deepEqual(got.below,['P11']);assert.deepEqual(got.unrated,['P13','P14','P15']);assert.equal(got.unchanged,true);assert.equal(got.unknown,true);assert.equal(got.alias,10);assert.deepEqual(got.onlyBG,['Summe 16 EPA-PAK exkl. BG']);
 });
 await check('Labor 1.8.1: qualifier colors, legends and original values without a scale',async()=>{
  const got=await page.evaluate(async()=>{
   const m=await import('/results.mjs'),values=['< 0,50','unter BG','n.n.','n.b.','< kaputt','0'];
   const p={markers:values.map((r,i)=>({id:String(i),kind:'sample',label:`P${i+1}`,lab:{werte:[{p:'Test',r,u:' μg / m² '}]}})),results:{parameter:'Test',scales:{}}},before=JSON.stringify(p),rated=m.rateMarkers(p);
   return {fills:[...rated.fill.values()],below:rated.below,notDetected:rated.notDetected,notDetermined:rated.notDetermined,unrated:rated.unrated,groups:m.qualifierGroups(rated),unchanged:before===JSON.stringify(p)};
  });
  assert.deepEqual(got.fills,['#749bb5','#749bb5','#8b83a8','#9d8975','#c3ccd5','#c3ccd5']);
  assert.deepEqual(got.below,['P1','P2']);assert.deepEqual(got.notDetected,['P3']);assert.deepEqual(got.notDetermined,['P4']);assert.deepEqual(got.unrated,['P5','P6']);assert.equal(got.unchanged,true);
  assert.deepEqual(got.groups.map(g=>[g.name,g.labels]),[['Unter BG (kein gemessener Nullwert)',['P1','P2']],['Nicht nachgewiesen (n.n.)',['P3']],['Nicht bestimmt / Bedeutung prüfen (n.b.)',['P4']]]);
 });
 await check('Labor 1.8.1: XML preserves exact strings, rejects truncation, isolates duplicate references',async()=>{
  const lines=[{p:'Test',r:' 1.300,50 ',u:' μg / m² '}],xml=labXML([{...labRows[0],lines},{...labRows[1],ref:labRows[0].ref,lines:[{p:'Test',r:'0.125',u:'mg/kg'}]}]);
  const got=await page.evaluate(async({xml,oversize})=>{const m=await import('/labreport.mjs');let rejected=false;try{m.parseLabXML(oversize);}catch{rejected=true;}return {rows:m.parseLabXML(xml).rows,rejected};},{xml,oversize:labXML([{...labRows[0],lines:[{p:'Test',r:'1'.repeat(41),u:'µg/m²'}]}])});
  assert.deepEqual(got.rows[0].werte,lines);assert.deepEqual(got.rows[1].werte,[{p:'Test',r:'0.125',u:'mg/kg'}]);assert.equal(got.rejected,true);
 });
 await check('Labor 1.8.1: XML/PDF ID, sampling date and sample type comparison',async()=>{
  const got=await page.evaluate(async({xml,pages})=>{
   const m=await import('/labreport.mjs'),a=m.parseLabXML(xml),b=m.parseLabPDF(pages),clean=m.compareReports(a,b);
   b.rows[0].labNr='999-2099-99999999';b.rows[0].datum='2026-10-09';b.rows[0].art='Materialprobe';const mismatch=m.compareReports(a,b);
   b.rows[0]={...a.rows[0],labNr:a.rows[0].labNr.replaceAll('-',' – '),art:' wischprobe '};const normalized=m.compareReports(a,b);
   b.rows[0].labNr='';b.rows[0].datum='';b.rows[0].art='';const missing=m.compareReports(a,b);
   b.rows.push({...b.rows[0]});const duplicate=m.compareReports(a,b);
   return {clean,mismatch,normalized,missing,duplicate};
  },{xml:labXML(),pages:labPages()});
  assert.deepEqual(got.clean,[]);assert.deepEqual(got.normalized,[]);
  for(const field of ['Labor-Nr.','Probenahmedatum','Probenart']){assert.ok(got.mismatch.some(w=>w.includes(`${field} weicht`)));assert.ok(got.missing.some(w=>w.includes(`${field} fehlt in PDF`)));}
  assert.match(got.duplicate.join(' '),/nicht eindeutig/);
 });
 await check('Labor 1.8.1: PDF sampling column differs from receipt date',async()=>{
  const pages=labPages();for(const p of pages)for(const i of p.items){if(i.text==='Eingangsdatum')i.text='Probenahmedatum';if(i.x===491)i.text='09.10.2026';}
  const rows=await page.evaluate(async pages=>(await import('/labreport.mjs')).parseLabPDF(pages).rows,pages);assert.equal(rows.length,9);assert.ok(rows.every(r=>r.datum==='2026-10-09'));
  const receipt=labPages();for(const p of receipt)for(const i of p.items)if(i.x===491)i.text='12.10.2026';
  const dates=await page.evaluate(async pages=>(await import('/labreport.mjs')).parseLabPDF(pages).rows.map(r=>r.datum),receipt);assert.ok(dates.every(d=>d==='2026-10-08'));
 });
}
