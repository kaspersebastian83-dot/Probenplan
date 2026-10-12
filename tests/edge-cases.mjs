import {chromium} from './runtime.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {syntheticPolycam,syntheticProject} from './fixtures.mjs';
import assert from 'node:assert/strict';
const out=resolve('.test-output');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});const page=await context.newPage();await page.goto(process.env.TEST_URL||'http://localhost:4173');
 const original=syntheticProject();
 async function open(p){const hadPlan=!!await page.locator('#base-plan').getAttribute('href');await page.locator('#project-file').setInputFiles({name:'test.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});if(hadPlan)await page.locator('#replace-yes').click();await page.locator('#import-status').waitFor({state:'hidden'});await page.locator('#file-type').filter({hasText:'SVG'}).waitFor();}
 await open(original);await page.locator('.marker-row').first().waitFor();
 const bad=structuredClone(original);bad.markers[1].label=bad.markers[0].label;await page.locator('#project-file').setInputFiles({name:'invalid.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.locator('#toast').filter({hasText:'doppelte'}).waitFor();assert.equal(await page.locator('.marker-row').count(),5);results.push('Projektdatei mit doppelten Kennungen abgewiesen; vorhandenes Projekt erhalten');
 const outside=structuredClone(original);outside.markers[0].lx=-190;outside.markers[0].ly=-130;outside.markers[4].label='BRANDHERD-123456';outside.markers[4].lx=1100;outside.markers[4].ly=1200;
 await open(outside);await page.locator('#quality').selectOption('3500');const d=page.waitForEvent('download');await page.locator('#export').click();await(await d).saveAs(resolve(out,'outside-labels.png'));assert.match(await page.locator('#dimensions').innerText(),/3\.500/);results.push('Außerhalb des Plans liegende Beschriftungen und lange Brandherdkennung exportiert');
 await page.locator('#quality').selectOption('4600');await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,...args){HTMLCanvasElement.prototype.toBlob=original;callback(null);};});await page.locator('#export').click();await page.locator('#smaller').waitFor();assert.match(await page.locator('#toast').innerText(),/kleinere Exportstufe/);const fallback=page.waitForEvent('download');await page.locator('#smaller').click();await(await fallback).saveAs(resolve(out,'fallback-3500.png'));assert.equal(await page.locator('#quality').inputValue(),'3500');results.push('Simulierter Canvas-Speicherfehler: verständlicher Hinweis und erfolgreicher 3500-px-Ersatzexport');
 const png=syntheticPolycam().png;
 const jpeg=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=800;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,600,800);ctx.fillStyle='black';ctx.fillRect(30,30,540,10);return c.toDataURL('image/jpeg').split(',')[1];});
 for(const [name,mimeType,buffer] of [['synthetic.png','image/png',png],['raster-test.jpg','image/jpeg',Buffer.from(jpeg,'base64')]]){
   await page.locator('#file').setInputFiles({name,mimeType,buffer});await page.locator('#replace-yes').click();await page.locator('#file-type').filter({hasText:'RASTERBILD'}).waitFor();assert.equal(await page.locator('.marker-row').count(),0);results.push(`${mimeType}: direkter Import erfolgreich`);
 }
 await context.close();
}finally{await browser.close();}
await writeFile(resolve(out,'edge-results.json'),JSON.stringify(results,null,2));results.forEach(r=>console.log(`OK ${r}`));
