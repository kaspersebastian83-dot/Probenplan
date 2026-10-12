import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from '@playwright/test';
import {syntheticPDF} from './fixtures.mjs';
import assert from 'node:assert/strict';
const root=resolve('dist'),prefix='/Probenplan/';
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith(prefix)){res.writeHead(404).end();return;}
  const relative=decodeURIComponent(path.slice(prefix.length))||'index.html',file=resolve(root,relative);if(!file.startsWith(root+sep)){res.writeHead(404).end();return;}
  const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}${prefix}`;
const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),bad=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))bad.push(r.url());});await page.goto(base);await page.locator('#offline.ready').waitFor();await context.setOffline(true);await page.reload();await page.locator('#offline.ready').waitFor();
 await page.locator('#file').setInputFiles({name:'offline-scoped.pdf',mimeType:'application/pdf',buffer:syntheticPDF()});await page.locator('#import-status').waitFor({state:'hidden'});assert.match(await page.locator('#file-type').textContent(),/PDF/);
 const download=page.waitForEvent('download');await page.locator('#export').click();await mkdir('.test-output/v1.1',{recursive:true});await(await download).saveAs(resolve('.test-output/v1.1/scoped-offline.png'));assert.deepEqual(bad,[]);await context.close();console.log('OK Unterverzeichnis /Probenplan/: Offline-Erstimport PDF und Export mit lokalem Worker/Fonts');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
