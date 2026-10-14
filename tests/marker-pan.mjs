import {chromium,webkit,devices,savedProject} from './runtime.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://localhost:4173',results=[];
const fixture={format:'probenplan',version:3,plan:{name:'pan-test.svg',width:600,height:800,vector:true,data:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="white"/><path d="M20 20H580V780H20Z" fill="none" stroke="black"/></svg>').toString('base64')},markers:[{id:'sample',kind:'sample',label:'P1',note:'Unverändert',x:80,y:80,lx:80,ly:80}],areas:[{id:'area',label:'Z1',name:'Bereich',color:'#d34c42',opacity:.3,points:[{x:300,y:300},{x:500,y:300},{x:500,y:600},{x:300,y:600}]}],nextSample:2,nextFire:1,nextArea:2,report:'Pan-Test',date:'2026-10-14'};
async function check(name,fn){await fn();results.push(name);console.log(`OK ${name}`);}
async function position(page,x=420,y=440){await page.locator('#drawing').scrollIntoViewIfNeeded();return page.locator('#drawing').evaluate((el,{x,y})=>{const p=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};},{x,y});}
async function view(page){return page.locator('#drawing').getAttribute('viewBox');}
async function history(page){return {undo:await page.locator('#undo').isDisabled(),redo:await page.locator('#redo').isDisabled()};}
async function observeSaves(page){await page.evaluate(()=>{window.panWrites=0;if(window.panPutInstalled)return;window.panPutInstalled=true;const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){window.panWrites++;return original.apply(this,args);};});}
async function untouched(page,before,buttons,tool){assert.deepEqual(await savedProject(page),before);assert.deepEqual(await history(page),buttons);assert.equal(await page.locator('#stage').getAttribute('data-mode'),tool);assert.equal(await page.evaluate(()=>window.panWrites),0,'Pan/Zoom darf keine Projektsicherung auslösen');}
async function mouseDrag(page,pt,dx,dy,back=false){await page.mouse.move(pt.x,pt.y);await page.mouse.down();await page.mouse.move(pt.x+dx,pt.y+dy,{steps:6});if(back)await page.mouse.move(pt.x,pt.y,{steps:6});await page.mouse.up();}
for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{const context=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#project-file').setInputFiles({name:'pan.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.locator('.area-row').waitFor();await savedProject(page);
 for(const tool of ['sample','fire']){
  await check(`${engine}/${tool}: Klick und kleine Mausbewegung setzen genau einen Punkt`,async()=>{
   await page.locator(`[data-mode="${tool}"]`).click();await page.locator('#fit').click();let before=await savedProject(page),pt=await position(page);await page.mouse.click(pt.x,pt.y);let after=await savedProject(page);assert.equal(after.markers.length,before.markers.length+1);assert.equal(after.markers.at(-1).kind,tool);await page.locator('#undo').click();
   before=await savedProject(page);const camera=await view(page);pt=await position(page);await mouseDrag(page,pt,3,2);after=await savedProject(page);assert.equal(after.markers.length,before.markers.length+1);assert.equal(await view(page),camera);await page.locator('#undo').click();
  });
  await check(`${engine}/${tool}: Ziehen, Rückkehr zum Start, Undo/Redo und keine Speicherung`,async()=>{
   const before=await savedProject(page),buttons=await history(page);assert.equal(buttons.redo,false);await observeSaves(page);let camera=await view(page),pt=await position(page);await mouseDrag(page,pt,55,35);assert.notEqual(await view(page),camera);await untouched(page,before,buttons,tool);
   await page.locator('#fit').click();camera=await view(page);pt=await position(page);await mouseDrag(page,pt,40,30,true);assert.equal(await view(page),camera);await untouched(page,before,buttons,tool);
   // A movement just above the mouse threshold is already a drag.
   pt=await position(page);await mouseDrag(page,pt,9,0);await untouched(page,before,buttons,tool);
   pt=await position(page);await page.mouse.click(pt.x,pt.y);const placed=(await savedProject(page)).markers.at(-1);assert.equal(placed.kind,tool);assert.ok(Math.abs(placed.x-420)<2&&Math.abs(placed.y-440)<2,'Klick nach Pan muss Plan-Koordinaten verwenden');await page.locator('#undo').click();assert.deepEqual(await savedProject(page),before);
   await page.locator('#redo').click();assert.equal((await savedProject(page)).markers.length,before.markers.length+1);await page.locator('#undo').click();assert.deepEqual(await savedProject(page),before);
  });
  await check(`${engine}/${tool}: Mausrad, Freigabe ohne letztes Move-Event und Marker-Auswahl`,async()=>{
   await page.locator('#fit').click();const before=await savedProject(page),buttons=await history(page);await observeSaves(page);let pt=await position(page),camera=await view(page);await page.mouse.move(pt.x,pt.y);await page.mouse.wheel(0,-100);assert.notEqual(await view(page),camera);await untouched(page,before,buttons,tool);
   // Keep a real captured pointer, but simulate a device reporting displacement only on release.
   pt=await position(page);await page.locator('#drawing').evaluate(el=>el.addEventListener('pointerdown',e=>window.panReleasePointer=e.pointerId,{once:true}));await page.mouse.move(pt.x,pt.y);await page.mouse.down();await page.locator('#drawing').evaluate((el,p)=>el.dispatchEvent(new PointerEvent('pointerup',{pointerId:window.panReleasePointer,pointerType:'mouse',clientX:p.x+30,clientY:p.y+20,bubbles:true})),pt);await page.mouse.up();await untouched(page,before,buttons,tool);
   await page.locator('#fit').click();pt=await position(page,80,80);camera=await view(page);await mouseDrag(page,pt,35,25);assert.equal(await view(page),camera);assert.deepEqual(await savedProject(page),before);assert.equal(await page.locator('#label').inputValue(),'P1');assert.equal(await page.locator('#stage').getAttribute('data-mode'),tool);
  });
 }assert.deepEqual(errors,[]);await context.close();}finally{await browser.close();}
}
const browser=await chromium.launch();try{const context=await browser.newContext({...devices['iPhone 13'],acceptDownloads:true}),page=await context.newPage();await page.goto(base);await page.locator('#project-file').setInputFiles({name:'touch-pan.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.locator('.area-row').waitFor();const cdp=await context.newCDPSession(page);
const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
for(const tool of ['sample','fire']){
 await page.locator(`[data-mode="${tool}"]`).click();await page.locator('#fit').click();
 await check(`Touch/${tool}: Tippen, Toleranz bei Fingerbewegung und Einfinger-Pan`,async()=>{
  let before=await savedProject(page),pt=await position(page);await page.touchscreen.tap(pt.x,pt.y);assert.equal((await savedProject(page)).markers.length,before.markers.length+1);await page.locator('#undo').click();
  before=await savedProject(page);pt=await position(page);let camera=await view(page);await touch('touchStart',[{...pt,id:1}]);await touch('touchMove',[{x:pt.x+5,y:pt.y+2,id:1}]);await touch('touchEnd',[]);assert.equal((await savedProject(page)).markers.length,before.markers.length+1);assert.equal(await view(page),camera);await page.locator('#undo').click();
  before=await savedProject(page);const buttons=await history(page);await observeSaves(page);pt=await position(page);camera=await view(page);await touch('touchStart',[{...pt,id:1}]);for(const factor of [.3,.6,1])await touch('touchMove',[{x:pt.x+45*factor,y:pt.y+30*factor,id:1}]);await touch('touchEnd',[]);assert.notEqual(await view(page),camera);await untouched(page,before,buttons,tool);
  await page.locator('#fit').click();pt=await position(page);camera=await view(page);await touch('touchStart',[{...pt,id:1}]);await touch('touchMove',[{x:pt.x+10,y:pt.y,id:1}]);await touch('touchMove',[{...pt,id:1}]);await touch('touchEnd',[]);assert.equal(await view(page),camera);await untouched(page,before,buttons,tool);
  pt=await position(page);await page.touchscreen.tap(pt.x,pt.y);const placed=(await savedProject(page)).markers.at(-1);assert.equal(placed.kind,tool);assert.ok(Math.abs(placed.x-420)<2&&Math.abs(placed.y-440)<2);await page.locator('#undo').click();assert.deepEqual(await savedProject(page),before);
 });
 await check(`Touch/${tool}: Zweifinger-Zoom nach Pan, Restfinger und Abbruch erzeugen keinen Punkt`,async()=>{
  await page.locator('#fit').click();const before=await savedProject(page),buttons=await history(page);await observeSaves(page);let pt=await position(page),camera=await view(page);
  await touch('touchStart',[{x:pt.x-20,y:pt.y,id:1}]);await touch('touchMove',[{x:pt.x-5,y:pt.y+10,id:1}]);await touch('touchStart',[{x:pt.x-5,y:pt.y+10,id:1},{x:pt.x+25,y:pt.y+10,id:2}]);await touch('touchMove',[{x:pt.x-35,y:pt.y+10,id:1},{x:pt.x+55,y:pt.y+10,id:2}]);await touch('touchEnd',[{x:pt.x-35,y:pt.y+10,id:1}]);await touch('touchMove',[{x:pt.x-10,y:pt.y+25,id:1}]);await touch('touchEnd',[]);assert.notEqual(await view(page),camera);await untouched(page,before,buttons,tool);
  pt=await position(page);await touch('touchStart',[{...pt,id:1}]);await touch('touchCancel',[]);await untouched(page,before,buttons,tool);
 });
}await context.close();}finally{await browser.close();}
await mkdir('.test-output/marker-pan',{recursive:true});await writeFile('.test-output/marker-pan/results.json',JSON.stringify({date:new Date().toISOString(),checks:results},null,2));console.log(`${results.length} Prüfgruppen für Marker-Pan erfolgreich.`);
