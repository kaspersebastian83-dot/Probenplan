// Zuschneiden (ab 1.43): Angebot nach dem Laden, Ausschnitt aufziehen, an Anfassern anpassen, innen verschieben,
// außerhalb ziehen bewegt die Ansicht, Mausrad zoomt, Enter übernimmt; Größe und Hinweise (klein, Markierungen außerhalb).
import {chromium,webkit,savedProject} from './runtime.mjs';
import assert from 'node:assert/strict';
import {syntheticPDF} from './fixtures.mjs';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}
const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
async function drag(page,a,b){const p=await toScreen(page,...a),q=await toScreen(page,...b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move((p.x+q.x)/2,(p.y+q.y)/2,{steps:4});await page.mouse.move(q.x,q.y,{steps:4});await page.mouse.up();}
const info=async page=>{const t=await page.locator('#crop-info').textContent();const m=/Ausschnitt ([\d.]+) × ([\d.]+) px/.exec(t);return {t,w:Number(m[1].replace(/\./g,'')),h:Number(m[2].replace(/\./g,''))};};
const near=(a,b,tol,what)=>assert.ok(Math.abs(a-b)<=tol,`${what}: ${a} ≈ ${b}`);
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const tol=async()=>Math.ceil(2/await page.locator('#drawing').evaluate(el=>el.getScreenCTM().a))+2;   // 2 Bildschirmpixel in Planeinheiten

  await check(`${engine}: nach dem Laden wird ein Ausschnitt angeboten; „Ganzen Plan behalten“ blendet es aus`,async()=>{
   await page.locator('#file').setInputFiles({name:'lageplan.pdf',mimeType:'application/pdf',buffer:syntheticPDF()});
   await page.locator('#import-status').waitFor({state:'hidden'});await page.locator('#crop-offer').waitFor();
   assert.match(await page.locator('#crop-offer').textContent(),/Nur einen Teil des Plans/);
   await page.getByRole('button',{name:'Ganzen Plan behalten'}).click();assert.equal(await page.locator('#crop-offer').isVisible(),false);
  });
  await check(`${engine}: „✂ Ausschnitt wählen“ – aufziehen, Größe sehen, Ecke ziehen, innen verschieben`,async()=>{
   await page.evaluate(()=>{document.getElementById('crop-offer').hidden=false;});   // Angebot erneut zeigen wie nach dem Laden
   await page.getByRole('button',{name:'✂ Ausschnitt wählen'}).click();await page.locator('#crop-actions').waitFor();
   assert.equal(await page.locator('#crop-offer').isVisible(),false);assert.equal(await page.locator('#crop-redraw').isVisible(),false);
   const t=await tol();
   await drag(page,[500,500],[2500,3000]);let i=await info(page);near(i.w,2000,t,'Breite');near(i.h,2500,t,'Höhe');
   assert.equal(await page.locator('#crop-overlay rect[fill="#fff"]').count(),8,'acht Anfasser nach dem Aufziehen');
   assert.equal(await page.locator('#crop-redraw').isVisible(),true);assert.equal(await page.locator('#crop-confirm').isEnabled(),true);
   await drag(page,[2500,3000],[3000,3500]);i=await info(page);near(i.w,2500,t*2,'Breite nach Ecke');near(i.h,3000,t*2,'Höhe nach Ecke');
   await drag(page,[1500,2000],[1700,2100]);i=await info(page);near(i.w,2500,t*2,'Verschieben ändert die Größe nicht');
  });
  await check(`${engine}: außerhalb ziehen bewegt die Ansicht, Mausrad zoomt – der Ausschnitt bleibt`,async()=>{
   const before=await info(page),vb=await page.locator('#drawing').getAttribute('viewBox');
   const p=await toScreen(page,3300,4300);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x-120,p.y-80,{steps:5});await page.mouse.up();
   assert.notEqual(await page.locator('#drawing').getAttribute('viewBox'),vb,'Ansicht bewegt');assert.deepEqual(await info(page),before,'Ausschnitt unverändert');
   const z=await page.locator('#zoom-value').textContent();const c=await toScreen(page,1900,2100);await page.mouse.move(c.x,c.y);await page.mouse.wheel(0,-400);
   await page.waitForFunction(z=>document.getElementById('zoom-value').textContent!==z,z);assert.deepEqual(await info(page),before);
  });
  await check(`${engine}: Enter übernimmt den angepassten Ausschnitt`,async()=>{
   const t=await tol();
   await page.keyboard.press('Enter');await page.locator('#crop-actions').waitFor({state:'hidden'});
   const c=(await savedProject(page)).plan.preparation.crop;near(c.x,700,t*3,'x');near(c.y,600,t*3,'y');near(c.width,2500,t*3,'Breite');near(c.height,3000,t*3,'Höhe');
  });
  await check(`${engine}: Hinweise – Markierung außerhalb, kleiner Ausschnitt; „Neu aufziehen“; Esc bricht ab`,async()=>{
   const plan=(await savedProject(page)).plan;await page.keyboard.press('p');await toScreen(page,plan.width/2,plan.height/2).then(q=>page.mouse.click(q.x,q.y));await page.keyboard.press('v');
   assert.equal(await page.locator('#crop-offer').isVisible(),false);
   await page.locator('#crop-start').click();await page.locator('#crop-actions').waitFor();
   await drag(page,[50,50],[350,350]);const i=await info(page);assert.match(i.t,/1 Markierung außerhalb/);assert.match(i.t,/unscharf/);
   assert.equal(await page.locator('#crop-info').evaluate(e=>e.classList.contains('warn')),true);
   await page.locator('#crop-redraw').click();assert.equal(await page.locator('#crop-info').isVisible(),false);assert.equal(await page.locator('#crop-confirm').isDisabled(),true);
   await page.keyboard.press('Escape');await page.locator('#crop-actions').waitFor({state:'hidden'});
   assert.equal((await savedProject(page)).markers.length,1);
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
