// Feinausrichtung („Ausrichten“): Rechnung ohne Browser und Bedienung im Browser.
//  • Ohne Feinwinkel sind alle Transformationen exakt wie bisher (0°/90°/180°/270°, Zuschnitt).
//  • Markierungen, Beschriftungen, Flächen und Nordrichtung bleiben auf derselben Stelle des Originals; hin und zurück ergibt den Ausgangszustand.
//  • Ausschnitt: umschließendes Rechteck des gedrehten Ausschnitts, Ecken weiß; Format 6, ältere Formate mit Winkel werden abgelehnt.
//  • Browser: Raster, An-Kante-Ausrichten an einer schiefen Wand, Ziehen, Tasten, Regler/Zahl, Abbrechen, Rückgängig, Export ohne schwarze Ecken, Speichern/Öffnen.
import {chromium,webkit,savedProject,downloadedProject,openExport,closeExport} from './runtime.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import ts from 'typescript';
const out=resolve('.test-output/align'),base=process.env.TEST_URL||'http://localhost:4173';await mkdir(out,{recursive:true});
async function check(name,fn){await fn();console.log(`OK ${name}`);}
for(const name of ['model','areas','preparation']){const source=await readFile(`src/${name}.ts`,'utf8');let code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;code=code.replace(/from '\.\/(\w+)'/g,"from './$1.mjs'");await writeFile(resolve(out,`${name}.mjs`),code);}
const {createProject,clone,addMarker,addSheet}=await import(`file:///${resolve(out,'model.mjs').replaceAll('\\','/')}`);
const {addArea,PALETTE,polygonError}=await import(`file:///${resolve(out,'areas.mjs').replaceAll('\\','/')}`);
const {alignProject,rotateProject,cropProject,planMatrix,invert,applyMatrix,wholeSize,MAX_ANGLE}=await import(`file:///${resolve(out,'preparation.mjs').replaceAll('\\','/')}`);

const near=(a,b,eps=1e-6,msg='')=>assert.ok(Math.abs(a-b)<=eps,`${msg} ${a} ≠ ${b}`);
const nearPt=(a,b,eps=1e-6,msg='')=>{near(a.x,b.x,eps,msg+' x');near(a.y,b.y,eps,msg+' y');};
/** Stelle im Original, auf der ein Planpunkt liegt. */
const toSource=(plan,pt)=>applyMatrix(invert(planMatrix(plan)),pt);
const plan=()=>({name:'foto.png',width:1200,height:900,data:'',vector:false});
function sample(){
  const p=createProject(plan());const m=addMarker(p,'sample',300,250);m.lx=340;m.ly=210;addMarker(p,'fire',900,700);
  addArea(p,[{x:500,y:300},{x:800,y:300},{x:800,y:600},{x:500,y:600}],PALETTE[0].color,.3,'Brandbereich');p.plan.north=10;p.plan.calibration={units:880,meters:8.8};return p;
}
const anchors=p=>[...p.markers.flatMap(m=>[{x:m.x,y:m.y},{x:m.lx,y:m.ly}]),...p.areas.flatMap(a=>a.points)];

await check('Rechnung: ohne Feinwinkel exakt die bisherigen Matrizen (alle 90°-Lagen, mit Zuschnitt)',()=>{
  const old=(prep)=>{const m={0:[1,0,0,1,0,0],90:[0,1,-1,0,prep.sourceHeight,0],180:[-1,0,0,-1,prep.sourceWidth,prep.sourceHeight],270:[0,-1,1,0,0,prep.sourceWidth]}[prep.rotation].slice();m[4]-=prep.crop.x;m[5]-=prep.crop.y;return m;};
  const p=sample();for(let i=0;i<4;i++){rotateProject(p,1);assert.deepEqual(planMatrix(p.plan),old(p.plan.preparation),`Drehung ${p.plan.preparation.rotation}`);}
  cropProject(p,{x:100,y:50,width:900,height:800});assert.deepEqual(planMatrix(p.plan),old(p.plan.preparation));rotateProject(p,-1);assert.deepEqual(planMatrix(p.plan),old(p.plan.preparation));
  assert.equal(p.plan.preparation.angle,undefined);assert.ok(p.version<6);
});
await check('Rechnung: Markierungen, Beschriftungen und Flächen bleiben auf derselben Stelle des Originals',()=>{
  for(const [turns,crop] of [[0,null],[1,null],[2,{x:60,y:40,width:1000,height:780}],[3,{x:5,y:5,width:880,height:1180}]]){
    const p=sample();for(let i=0;i<turns;i++)rotateProject(p,1);if(crop)cropProject(p,crop);
    const before=anchors(p).map(pt=>toSource(p.plan,pt));
    for(const d of [4.3,-12.75,.1,45-(p.plan.preparation?.angle||0)-4.3]){alignProject(p,d);const after=anchors(p).map(pt=>toSource(p.plan,pt));after.forEach((pt,i)=>nearPt(pt,before[i],1e-6,`Drehung ${turns*90}°, ${d}°`));}
    for(const a of p.areas)assert.equal(polygonError(a.points,p.plan),null);
    for(const m of p.markers)assert.ok(m.x>=0&&m.y>=0&&m.x<=p.plan.width&&m.y<=p.plan.height,'Markierung im Plan');
  }
});
await check('Rechnung: hin und zurück ergibt den Ausgangszustand; Ausschnitt = umschließendes Rechteck, Ecken im Bild',()=>{
  const p=sample(),start=clone(p);alignProject(p,7.5);
  const r=7.5*Math.PI/180;near(p.plan.width,1200*Math.cos(r)+900*Math.sin(r),1e-6,'Breite');near(p.plan.height,1200*Math.sin(r)+900*Math.cos(r),1e-6,'Höhe');
  assert.deepEqual(wholeSize(p.plan.preparation),{width:p.plan.width,height:p.plan.height});assert.equal(p.plan.preparation.angle,7.5);assert.equal(p.version,6);
  near(p.plan.north,17.5,1e-9,'Nord dreht mit');assert.deepEqual(p.plan.calibration,start.plan.calibration);
  // Die vier Ecken des Originals liegen auf dem Rand des neuen Plans
  const m=planMatrix(p.plan),corners=[[0,0],[1200,0],[0,900],[1200,900]].map(([x,y])=>applyMatrix(m,{x,y}));
  near(Math.min(...corners.map(c=>c.x)),0,1e-6);near(Math.min(...corners.map(c=>c.y)),0,1e-6);near(Math.max(...corners.map(c=>c.x)),p.plan.width,1e-6);near(Math.max(...corners.map(c=>c.y)),p.plan.height,1e-6);
  alignProject(p,-7.5);assert.equal(p.plan.preparation.angle,undefined);near(p.plan.width,1200,1e-6);near(p.plan.height,900,1e-6);near(p.plan.north,10,1e-9);
  anchors(p).forEach((pt,i)=>nearPt(pt,anchors(start)[i],1e-6,'zurück'));
});
await check('Rechnung: vorhandener Zuschnitt bleibt als gedrehter Ausschnitt erhalten; Grenzen und Format 6',()=>{
  const p=sample();cropProject(p,{x:200,y:150,width:800,height:600});alignProject(p,3);
  const r=3*Math.PI/180;near(p.plan.width,800*Math.cos(r)+600*Math.sin(r),1e-6,'Breite');near(p.plan.height,800*Math.sin(r)+600*Math.cos(r),1e-6,'Höhe');
  assert.throws(()=>alignProject(p,45),/höchstens ±45°/);assert.throws(()=>alignProject(p,NaN),/Ungültiger Drehwinkel/);assert.equal(MAX_ANGLE,45);
  const q=sample();alignProject(q,45);assert.equal(q.plan.preparation.angle,45);assert.throws(()=>alignProject(q,.01));
  // Winkel auf 0,01° gerundet; ohne Änderung bleibt alles wie es ist
  const s=sample(),copy=clone(s);alignProject(s,.004);assert.deepEqual(s,copy);alignProject(s,1.23456);assert.equal(s.plan.preparation.angle,1.23);
  // Weiterer Plan (Geschoss) hält Format 6
  addSheet(s,plan(),'OG');assert.equal(s.version,6);
});

const tilt=4.3,rot=(x,y)=>{const r=tilt*Math.PI/180;return {x:600+x*Math.cos(r)-y*Math.sin(r),y:450+x*Math.sin(r)+y*Math.cos(r)};};
async function photo(page){
  // „Foto“ eines Grundrisses: Plan um 4,3° verdreht auf grauem Grund
  const data=await page.evaluate(t=>{const c=document.createElement('canvas');c.width=1200;c.height=900;const g=c.getContext('2d');g.fillStyle='#d8d4cc';g.fillRect(0,0,1200,900);g.translate(600,450);g.rotate(t*Math.PI/180);g.fillStyle='#fbfaf6';g.fillRect(-480,-340,960,680);g.strokeStyle='#222';g.lineWidth=9;g.strokeRect(-440,-300,880,600);g.beginPath();g.moveTo(-60,-300);g.lineTo(-60,300);g.moveTo(-440,20);g.lineTo(-60,20);g.stroke();return c.toDataURL('image/png').split(',')[1];},tilt);
  await page.locator('#file').setInputFiles({name:'foto-grundriss.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await page.locator('#welcome').waitFor({state:'hidden'});
}
const screen=(page,x,y)=>page.locator('#drawing').evaluate((el,{x,y})=>{const p=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};},{x,y});
const angleField=page=>page.locator('#align-angle').inputValue().then(Number);
async function importJSON(page,p){await page.locator('#project-file').setInputFiles({name:'test.probenplan',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});}

for(const engine of ['chromium','webkit']){
  const browser=await ({chromium,webkit}[engine]).launch();
  try{
    const context=await browser.newContext({viewport:{width:1480,height:1020},acceptDownloads:true}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.goto(`${base}/`);await photo(page);
    await page.locator('[data-mode="sample"]').click();const k=await screen(page,rot(-300,-150).x,rot(-300,-150).y);await page.mouse.click(k.x,k.y);
    const p0=await savedProject(page),m0=p0.markers[0];assert.equal(p0.markers.length,1);

    await check(`${engine}: Ausrichten öffnet Raster und Bedienkarte, Werkzeuge sind gesperrt`,async()=>{
      await page.locator('#align-start').click();
      assert.ok(await page.locator('#align-grid').isVisible());assert.ok(await page.locator('#align-actions').isVisible());assert.equal(await angleField(page),0);
      for(const id of ['undo','export-open','crop-start','rotate-right'])assert.equal(await page.locator(`#${id}`).isDisabled(),true,id);
      assert.equal(await page.locator('[data-mode="sample"]').isDisabled(),true);
    });
    await check(`${engine}: An Kante ausrichten legt eine schiefe Wand waagerecht`,async()=>{
      await page.locator('#align-edge').click();
      const a=rot(-440+880*.15,-300),b=rot(-440+880*.85,-300);
      const sa=await screen(page,a.x,a.y);await page.mouse.click(sa.x,sa.y);const sb=await screen(page,b.x,b.y);await page.mouse.click(sb.x,sb.y);
      await page.waitForFunction(()=>Number(document.getElementById('align-angle').value)!==0);
      near(await angleField(page),-tilt,.2,'Winkel aus der Kante');
      assert.match(await page.locator('#align-confirm').textContent(),/übernehmen \(−?-?4,[2-4]\d?°\)/);
    });
    await check(`${engine}: Übernehmen – Markierung bleibt auf derselben Stelle des Fotos, Wand liegt waagerecht, Format 6`,async()=>{
      await page.locator('#align-confirm').click();await page.locator('#align-actions').waitFor({state:'hidden'});
      const p=await savedProject(page);assert.equal(p.version,6);near(p.plan.preparation.angle,-tilt,.2);
      nearPt(toSource(p.plan,p.markers[0]),{x:m0.x,y:m0.y},1e-6,'Markierung');
      const m=planMatrix(p.plan),l=applyMatrix(m,rot(-440,-300)),r=applyMatrix(m,rot(440,-300));assert.ok(Math.abs(r.y-l.y)<4,`Wand schief: ${r.y-l.y}`);
      assert.equal(await page.locator('#plan-back').evaluate(e=>getComputedStyle(e).display!=='none'&&e.getAttribute('fill')==='#fff'),true,'weißer Grund');
      assert.equal(await page.locator('#align-grid').isVisible(),false);
    });
    await check(`${engine}: Rückgängig/Wiederherstellen in einem Schritt`,async()=>{
      await page.locator('#undo').click();let p=await savedProject(page);assert.equal(p.plan.preparation?.angle,undefined);nearPt(p.markers[0],m0,1e-6);
      await page.locator('#redo').click();p=await savedProject(page);near(p.plan.preparation.angle,-tilt,.2);
    });
    await check(`${engine}: Tasten, Regler, Zahl, Ziehen und Abbrechen ändern nichts am Projekt`,async()=>{
      const before=await savedProject(page),start=before.plan.preparation.angle;
      await page.locator('#align-start').click();await page.locator('#drawing').hover();
      await page.keyboard.press('ArrowRight');near(await angleField(page),start+.1,1e-9);await page.keyboard.press('Shift+ArrowLeft');near(await angleField(page),start-.9,1e-9);
      await page.locator('#align-angle').fill('2.5');await page.locator('#align-angle').press('Tab');near(await angleField(page),2.5,1e-9);
      await page.locator('#align-reset').click();assert.equal(await angleField(page),0);
      await page.locator('#align-plus').click();await page.locator('#align-plus').click();near(await angleField(page),.2,1e-9);
      // Ziehen rechts vom Drehpunkt nach oben: gegen den Uhrzeigersinn
      const box=await page.locator('#drawing').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
      await page.mouse.move(cx+250,cy+40);await page.mouse.down();await page.mouse.move(cx+250,cy-60,{steps:8});await page.mouse.up();assert.ok(await angleField(page)<-10,'gegen den Uhrzeigersinn');
      // Umschalt: zehnmal feiner
      const was=await angleField(page);await page.keyboard.down('Shift');await page.mouse.move(cx+250,cy+40);await page.mouse.down();await page.mouse.move(cx+250,cy-60,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');
      const fine=was-await angleField(page);assert.ok(fine>0&&fine<5,`fein: ${fine}`);
      await page.keyboard.press('Escape');await page.locator('#align-actions').waitFor({state:'hidden'});
      assert.deepEqual(await savedProject(page),before);assert.equal(await page.locator('#base-plan').evaluate(e=>e.parentElement.getAttribute('transform')),null,'Vorschau zurückgesetzt');
    });
    await check(`${engine}: Export ohne schwarze Ecken`,async()=>{
      await openExport(page);await page.locator('#format').selectOption('jpeg');
      const d=page.waitForEvent('download');await page.locator('#export').click();const path=resolve(out,`${engine}.jpg`);await (await d).saveAs(path);await closeExport(page);
      // Schwarze (statt weiße) Ecken außerhalb des Fotos wären rund 13 % der Planfläche; Wände allein sind unter 3 %.
      const share=await page.evaluate(async bytes=>{const bmp=await createImageBitmap(new Blob([Uint8Array.from(atob(bytes),c=>c.charCodeAt(0))],{type:'image/jpeg'}));const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const g=c.getContext('2d');g.drawImage(bmp,0,0);
        const d=g.getImageData(0,0,bmp.width,bmp.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]<150)n++;return n/(bmp.width*bmp.height);},(await readFile(path)).toString('base64'));
      assert.ok(share>.002&&share<.05,`Anteil dunkler Pixel ${share}`);
    });
    await check(`${engine}: Speichern und wieder öffnen behält die Ausrichtung`,async()=>{
      const saved=await downloadedProject(page);assert.equal(saved.version,6);
      await importJSON(page,saved);await page.locator('#replace-yes').click();await page.locator('#import-status').waitFor({state:'hidden'});
      const p=await savedProject(page);assert.equal(p.plan.preparation.angle,saved.plan.preparation.angle);near(p.plan.width,saved.plan.width,1e-9);nearPt(p.markers[0],saved.markers[0],1e-9);
    });
    await check(`${engine}: Projektdateien mit Winkel in altem Format, zu großem Winkel oder neuerem Format werden abgelehnt`,async()=>{
      const saved=await downloadedProject(page);
      for(const [change,text] of [[p=>{p.version=4;},/Projektformat 6/],[p=>{p.plan.preparation.angle=50;},/Ungültige Feinausrichtung/],[p=>{p.version=7;},/neueren PlanKit-Version/]]){
        const bad=structuredClone(saved);change(bad);await importJSON(page,bad);
        await page.waitForFunction(()=>document.getElementById('toast').classList.contains('error')&&!document.getElementById('toast').hidden);
        assert.match(await page.locator('#toast').textContent(),text);await page.evaluate(()=>{const t=document.getElementById('toast');t.hidden=true;t.className='';});
      }
      near((await savedProject(page)).plan.preparation.angle,saved.plan.preparation.angle,1e-9);
    });
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
}
