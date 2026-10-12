import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {unzipSync} from 'fflate';
import assert from 'node:assert/strict';
const out=resolve('.test-output');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});const page=await context.newPage();await page.goto(process.env.TEST_URL||'http://localhost:4173');
 const original=JSON.parse(await readFile(resolve(out,'chrome-roundtrip.probenplan'),'utf8'));
 async function open(p){const hadPlan=!!await page.locator('#base-plan').getAttribute('href');await page.locator('#project-file').setInputFiles({name:'test.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});if(hadPlan)await page.locator('#replace-yes').click();await page.locator('#file-type').filter({hasText:'SVG'}).waitFor();}
 await open(original);await page.locator('.marker-row').first().waitFor();
 const bad=structuredClone(original);bad.markers[1].label=bad.markers[0].label;await page.locator('#project-file').setInputFiles({name:'invalid.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.locator('#toast').filter({hasText:'doppelte'}).waitFor();assert.equal(await page.locator('.marker-row').count(),5);results.push('Projektdatei mit doppelten Kennungen abgewiesen; vorhandenes Projekt erhalten');
 const outside=structuredClone(original);outside.markers[0].lx=-190;outside.markers[0].ly=-130;outside.markers[4].label='BRANDHERD-123456';outside.markers[4].lx=1100;outside.markers[4].ly=1200;
 await open(outside);await page.locator('#quality').selectOption('3500');const d=page.waitForEvent('download');await page.locator('#export').click();await(await d).saveAs(resolve(out,'outside-labels.png'));assert.match(await page.locator('#dimensions').innerText(),/3\.500/);results.push('Außerhalb des Plans liegende Beschriftungen und lange Brandherdkennung exportiert');
 await page.locator('#quality').selectOption('4600');await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,...args){HTMLCanvasElement.prototype.toBlob=original;callback(null);};});await page.locator('#export').click();await page.locator('#smaller').waitFor();assert.match(await page.locator('#toast').innerText(),/kleinere Exportstufe/);const fallback=page.waitForEvent('download');await page.locator('#smaller').click();await(await fallback).saveAs(resolve(out,'fallback-3500.png'));assert.equal(await page.locator('#quality').inputValue(),'3500');results.push('Simulierter Canvas-Speicherfehler: verständlicher Hinweis und erfolgreicher 3500-px-Ersatzexport');
 let zip=(await readdir('.')).find(f=>f.endsWith('.zip'));if(!zip)zip='beispiele/'+(await readdir('beispiele')).find(f=>f.endsWith('.zip'));const unpacked=unzipSync(new Uint8Array(await readFile(zip)));const png=Object.entries(unpacked).find(([name])=>/\.png$/i.test(name));
 for(const [name,mimeType,buffer] of [[png[0],'image/png',Buffer.from(png[1])],['raster-test.jpg','image/jpeg',await readFile(resolve(out,'chrome-plan-4600.jpg'))]]){
   await page.locator('#file').setInputFiles({name,mimeType,buffer});await page.locator('#replace-yes').click();await page.locator('#file-type').filter({hasText:'RASTERBILD'}).waitFor();assert.equal(await page.locator('.marker-row').count(),0);results.push(`${mimeType}: direkter Import erfolgreich`);
 }
 await context.close();
}finally{await browser.close();}
await writeFile(resolve(out,'edge-results.json'),JSON.stringify(results,null,2));results.forEach(r=>console.log(`OK ${r}`));
