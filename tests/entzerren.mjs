// Entzerren (ab 1.20): schräg fotografierter Plan über vier Ecken gerade rechnen.
// Synthetisches „Foto“: ein Plan mit vier farbigen Ecken, perspektivisch verzerrt auf grauem Grund. Nach dem Entzerren
// liegen die Farben wieder in den Ecken, eine vorher gesetzte Probe in der Planmitte bleibt in der Mitte; Rückgängig stellt
// das Foto wieder her; ein überkreuztes Viereck wird abgewiesen.
import {chromium,webkit,savedProject} from './runtime.mjs';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
const base=process.env.TEST_URL||'http://localhost:4173';
async function check(name,fn){await fn();console.log(`OK ${name}`);}

// --- synthetisches Foto ---
function solve(A,b){const n=b.length,M=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;[M[c],M[p]]=[M[p],M[c]];for(let r=0;r<n;r++){if(r===c)continue;const f=M[r][c]/M[c][c];for(let k=c;k<=n;k++)M[r][k]-=f*M[c][k];}}return M.map((r,i)=>r[n]/M[i][i]);}
function homography(from,to){const A=[],b=[];for(let i=0;i<4;i++){const [x,y]=from[i],[u,v]=to[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);}return [...solve(A,b),1];}
const PW=600,PH=400,FW=1000,FH=750;
const CORNERS=[[170,120],[860,190],[800,640],[110,560]];   // Ecken des Plans im Foto: oben links, oben rechts, unten rechts, unten links
function photoPNG(){
 const inv=homography(CORNERS,[[0,0],[PW,0],[PW,PH],[0,PH]]),row=FW*3+1,raw=Buffer.alloc(row*FH);
 const colors=[[220,30,30],[30,170,60],[40,70,220],[240,200,20]];
 for(let y=0;y<FH;y++){raw[y*row]=0;for(let x=0;x<FW;x++){const w=inv[6]*x+inv[7]*y+inv[8],u=(inv[0]*x+inv[1]*y+inv[2])/w,v=(inv[3]*x+inv[4]*y+inv[5])/w;
  let c=[150,145,138];
  if(u>=0&&v>=0&&u<=PW&&v<=PH){c=[255,255,255];const q=80;
   if(u<q&&v<q)c=colors[0];else if(u>PW-q&&v<q)c=colors[1];else if(u>PW-q&&v>PH-q)c=colors[2];else if(u<q&&v>PH-q)c=colors[3];
   else if(u<8||v<8||u>PW-8||v>PH-8||Math.abs(u-PW/2)<3)c=[30,30,30];}
  raw.set(c,y*row+1+x*3);}}
 const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const chunk=(t,d)=>{const len=Buffer.alloc(4);len.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(FW,0);ihdr.writeUInt32BE(FH,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const photo=photoPNG();
// Planmitte im Foto (für die Probe vor dem Entzerren)
const fwd=homography([[0,0],[PW,0],[PW,PH],[0,PH]],CORNERS),mid=(()=>{const x=PW/2,y=PH/2,w=fwd[6]*x+fwd[7]*y+fwd[8];return [(fwd[0]*x+fwd[1]*y+fwd[2])/w,(fwd[3]*x+fwd[4]*y+fwd[5])/w];})();

const toScreen=(page,x,y)=>page.locator('#drawing').evaluate((el,[x,y])=>{const q=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},[x,y]);
const engines=(process.env.ENGINES||'chromium,webkit').split(',');
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('#file').setInputFiles({name:'fluchtplan.png',mimeType:'image/png',buffer:photo});await page.locator('#welcome').waitFor({state:'hidden'});
  // Probe in der Planmitte (im Foto)
  await page.keyboard.press('p');const pm=await toScreen(page,mid[0],mid[1]);await page.mouse.click(pm.x,pm.y);await page.keyboard.press('v');

  await check(`${engine}: Werkzeug „Entzerren“ mit vier Ecken, Lupe beim Ziehen, überkreuztes Viereck abgewiesen`,async()=>{
   await page.keyboard.press('w');await page.locator('#warp-actions').waitFor();assert.equal(await page.locator('#warp-overlay [data-corner]').count(),4);
   // Ecke 1 auf Ecke 3 ziehen: überkreuzt
   const c0=await page.locator('#warp-overlay [data-corner="0"] circle').nth(1).boundingBox(),far=await toScreen(page,FW*.9,FH*.9);
   await page.mouse.move(c0.x+c0.width/2,c0.y+c0.height/2);await page.mouse.down();await page.mouse.move(far.x,far.y,{steps:5});
   assert.equal(await page.locator('#warp-loupe').isVisible(),true,'Lupe beim Ziehen');await page.mouse.up();
   assert.equal(await page.locator('#warp-loupe').isVisible(),false);
   assert.match(await page.locator('#warp-info').textContent(),/überkreuzen/);assert.equal(await page.locator('#warp-confirm').isDisabled(),true);
  });
  await check(`${engine}: Ecken antippen setzt jeweils die nächste Ecke; Entzerren ergibt einen geraden Plan`,async()=>{
   // Antippen nahe einer Ecke versetzt die nächstgelegene Ecke dorthin – in einer Reihenfolge, die keine Verwechslung erlaubt
   for(const i of [0,1,2,3]){const c=await page.locator(`#warp-overlay [data-corner="${i}"] circle`).nth(1).boundingBox(),t=await toScreen(page,...CORNERS[i]);
    await page.mouse.move(c.x+c.width/2,c.y+c.height/2);await page.mouse.down();await page.mouse.move(t.x,t.y,{steps:4});if(i===2&&process.env.SHOT)await page.screenshot({path:process.env.SHOT+'-1.png'});await page.mouse.up();}
   assert.match(await page.locator('#warp-info').textContent(),/Ergebnis/);
   await page.locator('#warp-confirm').click();await page.locator('#toast',{hasText:'Plan entzerrt'}).waitFor({timeout:30000});
   assert.equal(await page.locator('#warp-actions').isVisible(),false);
   if(process.env.SHOT){await page.waitForTimeout(400);await page.screenshot({path:process.env.SHOT+'-2.png'});}
   const s=await savedProject(page);const ratio=s.plan.width/s.plan.height;assert.ok(ratio>1.25&&ratio<1.8,`Seitenverhältnis ${ratio}`);assert.equal(s.plan.preparation,undefined);
   // Farben wieder in den Ecken, Mitte weiß
   const px=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
    const at=(fx,fy)=>[...x.getImageData(Math.round(fx*img.width),Math.round(fy*img.height),1,1).data.slice(0,3)];return {tl:at(.05,.06),tr:at(.95,.06),br:at(.95,.94),bl:at(.05,.94),mid:at(.3,.5)};},s.plan.data);
   const near=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<60);
   assert.ok(near(px.tl,[220,30,30]),`oben links ${px.tl}`);assert.ok(near(px.tr,[30,170,60]),`oben rechts ${px.tr}`);assert.ok(near(px.br,[40,70,220]),`unten rechts ${px.br}`);assert.ok(near(px.bl,[240,200,20]),`unten links ${px.bl}`);assert.ok(near(px.mid,[255,255,255]),`Mitte ${px.mid}`);
   // Probe aus der Planmitte bleibt in der Mitte
   const m=s.markers[0];assert.ok(Math.abs(m.x/s.plan.width-.5)<.02&&Math.abs(m.y/s.plan.height-.5)<.02,`Probe ${m.x/s.plan.width} ${m.y/s.plan.height}`);assert.equal(m.lx,m.x);
  });
  await check(`${engine}: Rückgängig stellt das Foto wieder her`,async()=>{
   await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Control+z');
   const s=await savedProject(page);assert.equal(s.plan.width,FW);assert.equal(s.plan.height,FH);assert.ok(Math.abs(s.markers[0].x-mid[0])<1);
  });
  await check(`${engine}: DIN quer ergibt √2, Abbrechen ändert nichts`,async()=>{
   await page.keyboard.press('w');await page.locator('#warp-aspect').selectOption('din-landscape');
   const [w,h]=(await page.locator('#warp-info').textContent()).match(/[\d.]+/g).map(v=>Number(v.replace(/\./g,'')));assert.ok(Math.abs(w/h-Math.SQRT2)<.01,`${w}×${h}`);
   await page.locator('#warp-cancel').click();assert.equal(await page.locator('#warp-actions').isVisible(),false);assert.equal((await savedProject(page)).plan.width,FW);
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
