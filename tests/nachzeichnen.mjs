// Nachzeichnung (ab 2.3.0, Format 7): Daten, Prüfung, Drehen/Zuschnitt, Sperren, Räume. Node, erfundene Daten.
//  • Die Nachzeichnung wandert bei 90°-Drehung und Zuschnitt exakt mit (wie die Probenpunkte), „geprüft“ bleibt.
//  • Ausrichten (Feinwinkel) ist gesperrt, solange es eine Nachzeichnung gibt.
//  • Ungültige Daten weisen die Datei ab; verbundene Rechtecke (joins) nur ausdrücklich, nie über den Namen.
//  • Die Nachzeichnung schreibt nie einen Maßstab.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const T=await import('../src/trace.ts');
const {createProject,addMarker,clone,addSheet,switchSheet}=await import('../src/model.ts');
const {rotateProject,cropProject,alignProject}=await import('../src/preparation.ts');
function check(name,fn){fn();console.log(`OK ${name}`);}
const plan=()=>({name:'eg.png',width:1200,height:900,data:'',vector:false});
const room=(id,name,x,y,w,h,extra={})=>({id,name,x,y,w,h,...extra});
const trace=()=>({rooms:[room('r1','Küche',100,100,300,200,{fire:true}),room('r2','Flur',400,100,200,500),room('r3','Flur',400,600,400,150,{joins:'r2'})],
  walls:[{id:'w1',x1:100,y1:400,x2:400,y2:520}],openings:[{id:'o1',kind:'door',x:400,y:200,a:90,w:60,side:1}]});
const sample=()=>{const p=createProject(plan());p.plan.trace=trace();p.version=7;return p;};
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<=.011,`${msg}: ${a} ≠ ${b}`);
const same=(a,b,msg)=>{for(const k of ['rooms','walls','openings'])a[k].forEach((e,i)=>{for(const [f,v] of Object.entries(e))typeof v==='number'?near(v,b[k][i][f],`${msg} ${k}[${i}].${f}`):assert.equal(v,b[k][i][f],`${msg} ${k}[${i}].${f}`);});};

check('Prüfung: gültige Nachzeichnung bleibt erhalten, nur bekannte Felder',()=>{
  const t=T.validateTrace({...trace(),checked:{date:'2026-11-12',by:'Ben'}},plan());
  assert.deepEqual(t,{...trace(),checked:{date:'2026-11-12',by:'Ben'}});
  assert.deepEqual(T.validateTrace(T.emptyTrace(),plan()),{rooms:[],walls:[],openings:[]});
});
check('Prüfung: Ungültiges weist ab',()=>{
  const bad=(change,why)=>{const t=trace();change(t);assert.throws(()=>T.validateTrace(t,plan()),/Ungültige Nachzeichnung/,why);};
  bad(t=>{t.rooms[0].x=-5;},'Raum außerhalb');
  bad(t=>{t.rooms[0].w=1200;},'Raum ragt hinaus');
  bad(t=>{t.rooms[0].w=0;},'Raum ohne Breite');
  bad(t=>{t.rooms[0].name='  ';},'leerer Name');
  bad(t=>{t.rooms[0].name='x'.repeat(61);},'Name zu lang');
  bad(t=>{t.rooms[1].id='r1';},'doppelte Kennung');
  bad(t=>{t.walls[0].id='r1';},'Kennung über Arten hinweg doppelt');
  bad(t=>{t.walls[0].x2=5000;},'Wand außerhalb');
  bad(t=>{t.walls[0].x2=100;t.walls[0].y2=400;},'Wand ohne Länge');
  bad(t=>{t.openings[0].kind='gate';},'unbekannte Öffnung');
  bad(t=>{t.openings[0].side=0;},'Aufschlagseite');
  bad(t=>{t.texts=[];},'unbekanntes Feld');
  bad(t=>{t.checked={date:'12.11.2026',by:'Ben'};},'Datum falsch');
  bad(t=>{t.checked={date:'2026-11-12',by:''};},'Kürzel fehlt');
  bad(t=>{t.checked={date:'2026-11-12',by:'Ben',extra:1};},'unbekanntes Feld in checked');
  bad(t=>{t.rooms[2].joins='nix';},'joins auf Unbekanntes');
  bad(t=>{t.rooms[2].joins='r3';},'joins auf sich selbst');
  bad(t=>{t.rooms[1].joins='r1';t.rooms[1].name='Küche';t.rooms[1].fire=true;},'Kette: Teil zeigt auf Teil');
  bad(t=>{t.rooms[2].name='Diele';},'Teil mit anderem Namen als das Hauptrechteck');
  bad(t=>{t.rooms[2].fire=true;},'Teil mit anderem Brandraum-Kennzeichen');
  assert.throws(()=>T.validateTrace({rooms:[],walls:[],openings:[],checked:{date:'2026-11-12',by:'Ben'}},plan()),/Ungültige Nachzeichnung/,'leer und geprüft');
  assert.throws(()=>T.validateTrace({rooms:Array.from({length:201},(_,i)=>room('a'+i,'R',1,1,5,5)),walls:[],openings:[]},plan()),/Ungültige Nachzeichnung/,'zu viele Räume');
  assert.throws(()=>T.validateTrace(null,plan()),/Ungültige Nachzeichnung/);
});
check('Obergrenze: 1 000 Wände sind erlaubt, 1 001 nicht',()=>{
  const walls=n=>Array.from({length:n},(_,i)=>({id:'w'+i,x1:1,y1:1,x2:50,y2:1+i%800}));
  assert.equal(T.validateTrace({rooms:[],walls:walls(1000),openings:[]},plan()).walls.length,1000);
  assert.throws(()=>T.validateTrace({rooms:[],walls:walls(1001),openings:[]},plan()),/Ungültige Nachzeichnung/);
});
check('Drehen: viermal rechts ergibt die Ausgangslage, Plangröße wechselt, „geprüft“ bleibt',()=>{
  const p=sample();p.plan.trace.checked={date:'2026-11-12',by:'Ben'};const before=clone(p).plan.trace;
  rotateProject(p,1);assert.equal(p.plan.width,900);assert.equal(p.plan.height,1200);
  T.validateTrace(p.plan.trace,p.plan);   // liegt weiter im Plan
  assert.notDeepEqual(p.plan.trace.rooms[0],before.rooms[0]);
  for(let i=0;i<3;i++)rotateProject(p,1);
  same(p.plan.trace,before,'4×90°');assert.deepEqual(p.plan.trace.checked,{date:'2026-11-12',by:'Ben'});
  rotateProject(p,1);rotateProject(p,-1);same(p.plan.trace,before,'rechts+links');
  assert.equal(p.version,7,'Format bleibt 7');
});
check('Drehen: eine Probe auf einer Raumecke bleibt auf der Ecke; Tür bleibt auf ihrer Wand',()=>{
  for(const dir of [1,-1]){
    const p=sample(),m=addMarker(p,'sample',400,300);   // rechte untere Ecke der Küche (100…400 × 100…300)
    rotateProject(p,dir);const r=p.plan.trace.rooms[0],ecken=[[r.x,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]];
    assert.ok(ecken.some(([x,y])=>Math.abs(x-m.x)<.011&&Math.abs(y-m.y)<.011),`Probe auf Ecke nach Drehung ${dir}`);
    // Tür lag auf der rechten Kante der Küche (x=400, senkrecht): nach der Drehung liegt sie auf einer waagerechten Kante desselben Raums
    const o=p.plan.trace.openings[0];assert.ok(Math.abs(o.y-r.y)<.011||Math.abs(o.y-(r.y+r.h))<.011,'Tür auf der Raumkante');
    near(Math.abs(Math.sin(o.a*Math.PI/180)),0,'Tür waagerecht');
  }
});
check('Zuschnitt: Nachzeichnung verschiebt sich mit den Proben; außerhalb wird abgelehnt',()=>{
  const p=sample(),m=addMarker(p,'sample',400,300);p.plan.trace.checked={date:'2026-11-12',by:'Ben'};
  cropProject(p,{x:50,y:60,width:1000,height:800});
  assert.deepEqual([p.plan.trace.rooms[0].x,p.plan.trace.rooms[0].y,p.plan.trace.rooms[0].w,p.plan.trace.rooms[0].h],[50,40,300,200]);
  assert.deepEqual([m.x,m.y],[350,240]);assert.deepEqual(p.plan.trace.walls[0],{id:'w1',x1:50,y1:340,x2:350,y2:460});
  assert.deepEqual(p.plan.trace.checked,{date:'2026-11-12',by:'Ben'});T.validateTrace(p.plan.trace,p.plan);
  const q=sample(),vorher=JSON.stringify(q);
  assert.throws(()=>cropProject(q,{x:150,y:0,width:900,height:900}),/Zuschnitt muss die Nachzeichnung enthalten/);
  assert.equal(JSON.stringify(q),vorher,'abgelehnter Zuschnitt ändert nichts');
});
check('Ausrichten ist gesperrt, solange es eine Nachzeichnung gibt; ohne sie wie bisher',()=>{
  const p=sample(),vorher=JSON.stringify(p);
  assert.throws(()=>alignProject(p,2),/Erst ausrichten, dann nachzeichnen/);assert.equal(JSON.stringify(p),vorher);
  delete p.plan.trace;alignProject(p,2);assert.equal(p.plan.preparation.angle,2);assert.equal(p.version,7,'Format wird nicht herabgesetzt');
  const alt=createProject(plan());alignProject(alt,2);assert.equal(alt.version,6,'ohne Nachzeichnung bleibt Format 6');
});
check('Format: Ausrichten eines anderen Plans setzt Format 7 nicht herab',()=>{
  const p=sample();addSheet(p,plan(),'1. OG');alignProject(p,3);assert.equal(p.version,7);
  switchSheet(p,0);assert.ok(p.plan.trace,'Nachzeichnung des EG noch da');
});
check('Rückgängig-Kopien teilen sich die Nachzeichnung nicht',()=>{
  const p=sample(),kopie=clone(p);p.plan.trace.rooms[0].x=7;assert.equal(kopie.plan.trace.rooms[0].x,100);
});
check('Räume: Zeichnen rastet an Kanten ein, kein Raster, Mindestgröße, im Plan',()=>{
  const t={rooms:[room('a','Küche',100,100,300,200)],walls:[],openings:[]};
  const r=T.traceRoomFrom(t,plan(),{x:404,y:97},{x:633.3,y:310.7},8);
  assert.deepEqual([r.x,r.y,r.w,r.h],[400,100,233.3,210.7]);assert.equal(r.name,'Raum 2');
  assert.equal(T.traceRoomFrom(t,plan(),{x:10,y:10},{x:15,y:300},8),null,'zu schmal');
  const rand=T.traceRoomFrom(t,plan(),{x:-50,y:700},{x:300,y:1000},8);assert.deepEqual([rand.x,rand.y,rand.w,rand.h],[0,700,300,200]);
});
check('Räume: Verschieben/Größe rasten ein und bleiben im Plan; Geometrie nimmt „geprüft“ weg, Umbenennen/Brandraum nicht',()=>{
  const t={rooms:[room('a','Küche',100,100,300,200),room('b','Bad',500,100,200,200)],walls:[],openings:[],checked:{date:'2026-11-12',by:'Ben'}};
  T.renameTraceRoom(t,'b','WC');T.setTraceFire(t,'b',true);assert.ok(t.checked,'Name/Brandraum lassen „geprüft“ stehen');assert.equal(t.rooms[1].name,'WC');assert.equal(t.rooms[1].fire,true);
  T.moveTraceRoom(t,plan(),'b',-95,3,{...t.rooms[1]},8);assert.deepEqual([t.rooms[1].x,t.rooms[1].y],[400,100]);assert.equal(t.checked,undefined);
  T.setChecked(t,'2026-11-12','Ben');T.resizeTraceRoom(t,plan(),'b',5000,203,8);assert.deepEqual([t.rooms[1].w,t.rooms[1].h],[800,200]);assert.equal(t.checked,undefined);
  T.setChecked(t,'2026-11-12',' Dr. Ka ');assert.deepEqual(t.checked,{date:'2026-11-12',by:'Dr. Ka'});
  assert.throws(()=>T.setChecked(t,'2026-11-12','  '),/Kürzel/);assert.throws(()=>T.setChecked(T.emptyTrace(),'2026-11-12','Ben'),/leer/);
});
check('Verbinden nur ausdrücklich: gleiche Namen bleiben zwei Räume; „gehört zu Raum“ und Lösen',()=>{
  const t={rooms:[room('a','Büro',100,100,200,200),room('b','Büro',300,100,200,200),room('c','Büro',700,100,100,100)],walls:[],openings:[]};
  assert.equal(T.traceRoomAt(t,{x:350,y:150}).id,'b','gleicher Name, nicht verbunden: eigener Raum');
  assert.throws(()=>T.joinTraceRoom(t,'c','a'),/berühren/);
  T.joinTraceRoom(t,'b','a');assert.equal(t.rooms[1].joins,'a');assert.equal(T.traceRoomAt(t,{x:350,y:150}).id,'a','Probe im Teil bekommt das Hauptrechteck');
  assert.throws(()=>T.joinTraceRoom(t,'b','a'),/schon/);T.validateTrace(t,plan());
  T.renameTraceRoom(t,'b','Großraumbüro');assert.deepEqual(t.rooms.map(r=>r.name),['Großraumbüro','Großraumbüro','Büro']);
  T.setTraceFire(t,'a',true);assert.equal(t.rooms[1].fire,true);T.validateTrace(t,plan());
  assert.deepEqual(T.removeTraceRoom(t,'a'),{heir:'b'});assert.equal(t.rooms[0].joins,undefined);assert.equal(t.rooms[0].name,'Großraumbüro');T.validateTrace(t,plan());
  const u={rooms:[room('a','Flur',100,100,200,200),room('b','Flur',300,100,200,200,{joins:'a'})],walls:[],openings:[]};
  T.unjoinTraceRoom(u,'b');assert.equal(u.rooms[1].joins,undefined);assert.equal(T.traceRoomAt(u,{x:350,y:150}).id,'b');
});
check('Kein Maßstab: Nachzeichnen, Drehen und Zuschneiden setzen nie eine Kalibrierung',()=>{
  const p=sample();rotateProject(p,1);cropProject(p,{x:0,y:0,width:p.plan.width,height:p.plan.height});
  assert.equal(p.plan.calibration,undefined);
  for(const k of Object.keys(T))assert.ok(!/meter|area|flaeche|m2/i.test(k),`trace.ts exportiert keine Maß-Funktion (${k})`);
});
