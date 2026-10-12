import {chromium,webkit} from './runtime.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:4173';
const fixture={format:'probenplan',version:3,plan:{name:'test.svg',width:600,height:800,vector:true,data:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="white"/></svg>').toString('base64')},markers:[{id:'sample',kind:'sample',label:'P1',note:'Probe mit Notiz',x:100,y:100,lx:130,ly:120},{id:'fire',kind:'fire',label:'B1',note:'Brandherd mit Notiz',x:300,y:300,lx:330,ly:320}],areas:[{id:'area',label:'Z1',name:'Brandbereich',color:'#d34c42',opacity:.45,points:[{x:50,y:50},{x:200,y:50},{x:200,y:200},{x:50,y:200}]}],nextSample:2,nextFire:2,nextArea:2,report:'Test',date:'2026-10-12'};
async function state(page){await page.locator('#saved').filter({hasText:'Lokal gesichert'}).waitFor();return page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('probenplan',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,read=db.transaction('projects').objectStore('projects').get('current');read.onsuccess=()=>{db.close();resolve(read.result);};read.onerror=()=>{db.close();reject(read.error);};};}));}
async function blur(page){await page.evaluate(()=>document.activeElement?.blur());}
for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1050},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  await page.locator('#project-file').setInputFiles({name:'test.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.locator('.marker-row').first().waitFor();
  const original=await state(page);
  for(const [id,selector,inspector] of [['sample','[data-select="sample"]','#inspector'],['fire','[data-select="fire"]','#inspector'],['area','[data-area-select="area"]','#area-inspector']]){
   for(const key of ['Delete','Backspace']){
    await page.locator(selector).click();await page.keyboard.press(key);
    const deleted=await state(page);assert.equal((id==='area'?deleted.areas:deleted.markers).some(o=>o.id===id),false);assert.equal(await page.locator(inspector).isVisible(),false);
    await page.locator('#undo').click();assert.deepEqual(await state(page),original,`${engine}: vollständiges Undo ${id}/${key}`);
    await page.locator('#redo').click();assert.deepEqual(await state(page),deleted);
    await page.locator('#undo').click();
   }
   await page.locator(selector).click();await page.keyboard.press('Escape');assert.equal(await page.locator(inspector).isVisible(),false);
   await page.keyboard.press('Delete');await page.keyboard.press('Backspace');assert.deepEqual(await state(page),original);
  }
  for(const selector of ['#label','#note','#report','#date','#area-label','#area-name','#area-color','#area-opacity']){
   await page.locator(selector.startsWith('#area-')?'[data-area-select="area"]':'[data-select="sample"]').click();await page.locator(selector).focus();
   // Dispatch without editing field values; verify shortcut handling and browser default preservation.
   for(const key of ['Delete','Backspace','Escape'])assert.equal(await page.locator(selector).evaluate((el,key)=>el.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})),key),true);
   assert.equal(await page.locator(selector.startsWith('#area-')?'#area-inspector':'#inspector').isVisible(),true);await blur(page);assert.deepEqual(await state(page),original);
  }
  await page.locator('[data-select="sample"]').click();
  await page.locator('#note').focus();await page.keyboard.press('End');await page.keyboard.press('Backspace');assert.equal(await page.locator('#note').inputValue(),'Probe mit Noti');await page.keyboard.press('Escape');assert.equal(await page.locator('#inspector').isVisible(),true);await page.locator('#note').fill('Probe mit Notiz');await blur(page);
  await page.evaluate(()=>{const el=document.createElement('div');el.id='editable-test';el.contentEditable='true';el.innerHTML='<span>Bearbeitbarer Text</span>';document.body.append(el);el.focus();});
  for(const key of ['Delete','Backspace','Escape'])assert.equal(await page.locator('#editable-test span').evaluate((el,key)=>el.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})),key),true);
  assert.equal(await page.locator('#inspector').isVisible(),true);await page.locator('#editable-test').evaluate(el=>el.remove());
  await page.locator('#help').click();for(const key of ['Delete','Backspace'])assert.equal(await page.locator('#help-dialog .close').evaluate((el,key)=>el.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})),key),true);assert.equal(await page.locator('#inspector').isVisible(),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#inspector').isVisible(),true);assert.deepEqual(await state(page),original);
  await page.locator('[data-select="sample"]').click();await page.keyboard.press('Escape');await blur(page);const historyBefore=await page.locator('#undo,#redo').evaluateAll(buttons=>buttons.map(b=>b.disabled));await page.keyboard.press('Delete');await page.keyboard.press('Backspace');assert.deepEqual(await page.locator('#undo,#redo').evaluateAll(buttons=>buttons.map(b=>b.disabled)),historyBefore);assert.deepEqual(await state(page),original);
  assert.deepEqual(errors,[]);console.log(`OK ${engine}: Löschen, vollständiges Undo/Redo, Escape, keine Auswahl, Eingaben, Contenteditable und Dialoge`);
 }finally{await browser.close();}
}
