// Nachzeichnung, Stufe 2 (ab 2.4.0): Wände (auch schräg, 15°-Hilfe), Türen und Fenster ohne Maß, Einrasten, „gehört zu Raum …“,
// Angebot und Prüfliste für schon gesetzte Proben. Node, erfundene Daten.
//  • Kein neues Dateiformat: alles, was hier entsteht, besteht die Prüfung von 2.3.0 (validateTrace) und bleibt Format 7.
//  • Die gemeinsame Kante VERBUNDENER Rechtecke ist keine Wand; gleichnamige, nicht verbundene Räume behalten sie.
//  • Proben: das Angebot betrifft nur Proben ohne Raum; Abweichungen werden nur gelistet, nie geändert.
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
const {createProject,addMarker}=await import('../src/model.ts');
const {rotateProject,cropProject}=await import('../src/preparation.ts');
function check(name,fn){fn();console.log(`OK ${name}`);}
const plan=()=>({name:'eg.png',width:1200,height:900,data:'',vector:false});
const room=(id,name,x,y,w,h,extra={})=>({id,name,x,y,w,h,...extra});
const leer=()=>({rooms:[],walls:[],openings:[]});
const near=(a,b,msg,tol=.011)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: ${a} ≠ ${b}`);
const grad=w=>Math.atan2(w.y2-w.y1,w.x2-w.x1)*180/Math.PI;
const TOL=12;   // 12 px am Bildschirm, hier 1 px = 1 Planeinheit

check('Wand: frei gezogen bleibt frei – kein Raster, keine Länge',()=>{
  const w=T.traceWallFrom(leer(),plan(),{x:103.37,y:211.42},{x:431.18,y:344.91},TOL);
  assert.deepEqual([w.x1,w.y1,w.x2,w.y2],[103.37,211.42,431.18,344.91]);assert.deepEqual(Object.keys(w).sort(),['id','x1','x2','y1','y2']);
});
check('Wand: 15°-Hilfe – nahe an einem 15°-Schritt wird genau ausgerichtet, sonst nicht',()=>{
  const p=plan(),a={x:200,y:200};
  const fast=T.traceWallFrom(leer(),p,a,{x:500,y:208},TOL);near(grad(fast),0,'fast waagerecht → 0°',.01);near(fast.y2,200,'y bleibt');
  const s30=T.traceWallFrom(leer(),p,a,{x:200+300*Math.cos(32*Math.PI/180),y:200+300*Math.sin(32*Math.PI/180)},TOL);near(grad(s30),30,'32° → 30°',.01);
  near(Math.hypot(s30.x2-s30.x1,s30.y2-s30.y1),300,'Länge bleibt wie gezogen',.02);
  const s45=T.traceWallFrom(leer(),p,a,{x:400,y:395},TOL);near(grad(s45),45,'≈44° → 45°',.01);
  const frei=T.traceWallFrom(leer(),p,a,{x:200+300*Math.cos(22*Math.PI/180),y:200+300*Math.sin(22*Math.PI/180)},TOL);near(grad(frei),22,'22° bleibt 22°',.01);
  const hoch=T.traceWallFrom(leer(),p,a,{x:203,y:600},TOL);assert.equal(hoch.x2,200,'senkrecht: x genau gleich');
});
check('Einrasten (E16): Raumecke vor Raumkante vor frei; Wandende; außerhalb von 12 px frei',()=>{
  const t={rooms:[room('r1','Küche',100,100,300,200)],walls:[{id:'w1',x1:600,y1:100,x2:700,y2:400}],openings:[]};
  assert.deepEqual(T.snapTracePoint(t,{x:407,y:306},TOL),{p:{x:400,y:300},an:'ecke'});
  assert.deepEqual(T.snapTracePoint(t,{x:404,y:200},TOL),{p:{x:400,y:200},an:'kante'});
  assert.deepEqual(T.snapTracePoint(t,{x:695,y:395},TOL),{p:{x:700,y:400},an:'ecke'});
  assert.equal(T.snapTracePoint(t,{x:414,y:200},TOL).an,'frei');assert.deepEqual(T.snapTracePoint(t,{x:414,y:200},TOL).p,{x:414,y:200});
  const mitte=T.snapTracePoint(t,{x:655,y:250},TOL);assert.equal(mitte.an,'kante','auch an einer schrägen Wand');
  // Wand von der Raumecke zur Raumkante: beide Enden sitzen genau
  const w=T.traceWallFrom(t,plan(),{x:395,y:296},{x:596,y:103},TOL);assert.deepEqual([w.x1,w.y1,w.x2,w.y2],[400,300,600,100]);
});
check('Einrasten: ausgerichtete Wand endet genau auf der Kante, die sie trifft',()=>{
  const t={rooms:[room('r1','Küche',100,100,300,200)],walls:[],openings:[]};
  const w=T.traceWallFrom(t,plan(),{x:400,y:200},{x:700,y:206},TOL);near(grad(w),0,'waagerecht',.01);assert.equal(w.x1,400);assert.equal(w.y1,200);
  const t2={rooms:[room('r1','Küche',100,100,300,200),room('r2','Bad',700,100,200,300)],walls:[],openings:[]};
  const v=T.traceWallFrom(t2,plan(),{x:400,y:200},{x:694,y:205},TOL);assert.deepEqual([v.x2,v.y2],[700,200],'bis genau an die Kante des Nachbarraums');
});
check('Nachbarräume teilen sich genau eine Kante (kein Spalt, keine doppelte Linie daneben)',()=>{
  const t={rooms:[room('r1','Küche',100,100,300,200)],walls:[],openings:[]};
  const r=T.traceRoomFrom(t,plan(),{x:407,y:95},{x:650,y:309},TOL);assert.equal(r.x,400);assert.equal(r.y,100);assert.equal(r.y+r.h,300);
  T.addTraceRoom(t,r);const senkrecht=T.traceSegments(t).filter(g=>g.x1===400&&g.x2===400);
  assert.equal(senkrecht.length,2);assert.deepEqual(senkrecht.map(g=>[g.y1,g.y2]),[[100,300],[100,300]],'beide Räume haben dieselbe Kante');
  assert.equal(T.traceSegments(t).some(g=>g.x1>400&&g.x1<412&&g.x1===g.x2),false,'keine zweite Kante knapp daneben');
});
check('Wand: zu kurz → nichts; Obergrenze 1000; jede Wand nimmt „geprüft“ weg',()=>{
  assert.equal(T.traceWallFrom(leer(),plan(),{x:100,y:100},{x:104,y:100},TOL),null);
  const t={rooms:[room('r1','Küche',100,100,300,200)],walls:[],openings:[]};T.setChecked(t,'2026-11-12','Ben');
  T.addTraceWall(t,T.traceWallFrom(t,plan(),{x:500,y:500},{x:800,y:650},TOL));assert.equal(t.checked,undefined);
  const voll={rooms:[],walls:Array.from({length:1000},(_,i)=>({id:`w${i}`,x1:0,y1:i%900,x2:100,y2:i%900})),openings:[]};
  assert.throws(()=>T.addTraceWall(voll,{id:'x',x1:0,y1:0,x2:50,y2:50}),/Höchstens 1000 Wände/);
});
check('Tür/Fenster: von Kante zu Kante gezogen – Mitte, Breite und Richtung aus der Wand, kein Maß',()=>{
  const t={rooms:[room('r1','Küche',100,100,300,200)],walls:[{id:'w1',x1:500,y1:500,x2:800,y2:800}],openings:[]};
  const oben=T.traceSegNear(t,{x:200,y:103},TOL);assert.deepEqual([oben.x1,oben.y1,oben.x2,oben.y2],[100,100,400,100]);
  const tuer=T.traceOpeningOn(plan(),oben,'door',{x:180,y:104},{x:240,y:97});
  assert.deepEqual({kind:tuer.kind,x:tuer.x,y:tuer.y,a:tuer.a,w:tuer.w,side:tuer.side},{kind:'door',x:210,y:100,a:0,w:60,side:1});
  assert.deepEqual(Object.keys(tuer).sort(),['a','id','kind','side','w','x','y'],'dieselben Felder wie in 2.3.0');
  const schraeg=T.traceSegNear(t,{x:652,y:648},TOL),f=T.traceOpeningOn(plan(),schraeg,'window',{x:600,y:600},{x:700,y:700});
  near(f.x,650,'Mitte x');near(f.y,650,'Mitte y');near(f.a,45,'Richtung der schrägen Wand');near(f.w,Math.hypot(100,100),'Breite = gezogene Strecke');
  assert.equal(T.traceOpeningOn(plan(),oben,'door',{x:200,y:100},{x:202,y:100}),null,'zu klein');
});
check('Tür/Fenster: einfacher Tipp setzt eine Standardbreite als Anteil der Planseite – auf kurzen Wänden kleiner',()=>{
  const p=plan(),t={rooms:[room('r1','Küche',100,100,300,200)],walls:[{id:'w1',x1:600,y1:100,x2:620,y2:100}],openings:[]};
  const oben=T.traceSegNear(t,{x:250,y:100},TOL),tuer=T.traceOpeningOn(p,oben,'door',{x:250,y:95},null),fenster=T.traceOpeningOn(p,oben,'window',{x:250,y:105},null);
  near(tuer.w,1200*T.DOOR_SHARE,'Tür');near(fenster.w,1200*T.WINDOW_SHARE,'Fenster');assert.equal(tuer.x,250);assert.equal(tuer.side,-1,'Aufschlag zur getippten Seite');assert.equal(fenster.side,1);
  const rand=T.traceOpeningOn(p,oben,'door',{x:102,y:100},null);near(rand.x-rand.w/2,100,'am Wandende: ganz auf der Wand');
  const kurz=T.traceOpeningOn(p,T.traceSegNear(t,{x:610,y:100},TOL),'door',{x:610,y:100},null);assert.equal(kurz.w,16,'höchstens 80 % der Wand');
  // ein anderer Plan, dieselbe Zeichnung doppelt so groß: Breite wächst mit – es steckt kein Maß darin
  assert.equal(T.traceOpeningOn({width:2400,height:1800},{x1:200,y1:200,x2:800,y2:200,owner:'r',room:true},'door',{x:500,y:200},null).w,Math.round(2400*T.DOOR_SHARE*100)/100);
});
check('Tür/Fenster: Enden ziehen, entlang der Wand schieben; nichts doppelt an derselben Stelle',()=>{
  const p=plan(),t={rooms:[room('r1','Küche',100,100,300,200)],walls:[],openings:[]};
  const oben=T.traceSegNear(t,{x:200,y:100},TOL),o=T.traceOpeningOn(p,oben,'door',{x:180,y:100},{x:240,y:100});T.addTraceOpening(t,o);
  T.moveTraceOpeningEnd(t,p,o.id,1,{x:300,y:140});assert.deepEqual([o.x,o.w],[240,120],'rechtes Ende gezogen, linkes bleibt bei 180');
  T.moveTraceOpeningEnd(t,p,o.id,-1,{x:150,y:60});assert.deepEqual([o.x,o.w],[225,150],'linkes Ende gezogen, rechtes bleibt bei 300');
  T.moveTraceOpeningEnd(t,p,o.id,1,{x:900,y:100});assert.equal(o.x+o.w/2,400,'nicht über das Wandende hinaus');
  T.moveTraceOpeningEnd(t,p,o.id,1,{x:300,y:100});
  const von={...o};T.moveTraceOpening(t,o.id,-500,0,von);assert.equal(o.x-o.w/2,100,'schieben endet am Wandanfang');assert.equal(o.y,100);
  assert.throws(()=>T.addTraceOpening(t,T.traceOpeningOn(p,oben,'window',{x:150,y:100},null)),/Dort ist schon eine Tür oder ein Fenster/);
  T.addTraceOpening(t,T.traceOpeningOn(p,oben,'window',{x:350,y:100},null));assert.equal(t.openings.length,2);
  const o2=t.openings[1],vor={...o2};T.moveTraceOpening(t,o2.id,-200,0,vor);assert.deepEqual([o2.x,o2.y],[vor.x,vor.y],'schiebt sich nicht über die Tür');
});
check('Türen und Fenster wandern mit Raum und Wand; ohne Wand fallen sie weg',()=>{
  const p=plan(),t={rooms:[room('r1','Küche',100,100,300,200)],walls:[{id:'w1',x1:500,y1:500,x2:800,y2:500}],openings:[]};
  const add=(pt,kind,to=null)=>{const o=T.traceOpeningOn(p,T.traceSegNear(t,pt,TOL),kind,pt,to);T.addTraceOpening(t,o);return o;};
  const rechts=add({x:400,y:200},'door'),unten=add({x:250,y:300},'window'),wand=add({x:650,y:500},'window');
  T.moveTraceRoom(t,p,'r1',50,30,{...t.rooms[0]},0);assert.deepEqual([rechts.x,rechts.y],[450,230]);assert.deepEqual([unten.x,unten.y],[300,330]);
  T.resizeTraceRoom(t,p,'r1',400,300,0);assert.deepEqual([rechts.x,rechts.y],[550,230],'rechte Kante nimmt die Tür mit');assert.deepEqual([unten.x,unten.y],[300,430],'untere Kante das Fenster');
  T.moveTraceWall(t,p,'w1',40,100,{...t.walls[0]},0);assert.deepEqual([wand.x,wand.y],[690,600]);
  // Wandende drehen: das Fenster behält seinen Abstand zum festen Ende und dreht mit
  T.moveTraceWallEnd(t,p,'w1',2,{x:540,y:900},0);near(t.walls[0].x2,540,'neues Ende');near(wand.a,90,'Richtung der Wand');near(wand.x,540,'auf der Wand');near(wand.y,750,'Abstand 150 vom festen Ende');
  T.moveTraceWallEnd(t,p,'w1',2,{x:540,y:700},0);assert.equal(t.openings.includes(wand),false,'passt nicht mehr auf die verkürzte Wand → weg');
  T.removeTraceRoom(t,'r1');assert.equal(t.openings.length,0,'Raum gelöscht: seine Türen und Fenster auch');
  assert.doesNotThrow(()=>T.validateTrace(t,p));
});
check('Verbinden (E18): gemeinsame Kante ist keine Wand mehr; gleicher Name allein verbindet nichts',()=>{
  const t={rooms:[room('a','Büro',100,100,300,200),room('b','Büro',400,100,200,200),room('c','Büro',100,300,200,150)],walls:[],openings:[]};
  const kanteAB=g=>g.x1===400&&g.x2===400,kanteAC=g=>g.y1===300&&g.y2===300&&g.owner!=='b';
  assert.equal(T.traceSegments(t).filter(kanteAB).length,2,'gleichnamig, nicht verbunden: Wand bleibt (je Raum eine Kante)');
  assert.equal(T.traceSegments(t).filter(g=>g.room).length,12);
  T.joinTraceRoom(t,'c','a');assert.equal(t.rooms[2].joins,'a');
  const ac=T.traceSegments(t).filter(kanteAC);
  assert.deepEqual(ac.map(g=>[g.owner,g.x1,g.x2]),[['a',300,400]],'L-Form: unter A bleibt nur das Stück neben C');
  assert.equal(T.traceSegments(t).filter(kanteAB).length,2,'B ist nicht verbunden – Wand zu B bleibt');
  T.unjoinTraceRoom(t,'c');assert.equal(t.rooms[2].joins,undefined);assert.equal(t.rooms[2].name,'Büro','eigener Raum mit dem bisherigen Namen');
  assert.equal(T.traceSegments(t).filter(kanteAC).length,2,'nach dem Lösen wieder eine Wand');
});
check('Verbinden: überlappende Rechtecke ergeben einen Umriss; Tür auf der gemeinsamen Kante fällt weg; „geprüft“ weg',()=>{
  const p=plan(),t={rooms:[room('a','Halle',100,100,400,200),room('b','Raum 2',300,200,300,300)],walls:[],openings:[]};
  const o=T.traceOpeningOn(p,T.traceSegNear(t,{x:400,y:300},TOL),'door',{x:400,y:300},null);T.addTraceOpening(t,o);   // auf A unten, liegt innerhalb von B
  const fenster=T.traceOpeningOn(p,T.traceSegNear(t,{x:200,y:100},TOL),'window',{x:200,y:100},null);T.addTraceOpening(t,fenster);
  T.setChecked(t,'2026-11-12','Ben');T.joinTraceRoom(t,'b','a');
  assert.equal(t.checked,undefined);assert.equal(t.rooms[1].name,'Halle');assert.deepEqual(t.openings.map(x=>x.id),[fenster.id],'Tür im Inneren des verbundenen Raums ist weg, Fenster außen bleibt');
  const segs=T.traceSegments(t);
  assert.equal(segs.some(g=>g.y1===300&&g.y2===300&&g.x1<500&&g.x2>300&&g.owner==='a'&&g.x2>300.01&&g.x1>=300),false,'A unten: kein Stück innerhalb von B');
  assert.deepEqual(segs.filter(g=>g.owner==='a'&&g.y1===300&&g.y2===300).map(g=>[g.x1,g.x2]),[[100,300]]);
  assert.deepEqual(segs.filter(g=>g.owner==='b'&&g.y1===200&&g.y2===200).map(g=>[g.x1,g.x2]),[[500,600]],'B oben: nur das Stück außerhalb von A');
  assert.deepEqual(segs.filter(g=>g.owner==='b'&&g.x1===300&&g.x2===300).map(g=>[g.y1,g.y2]),[[300,500]]);
  assert.doesNotThrow(()=>T.validateTrace(t,p));
});
check('Kein neues Dateiformat: Wände, Türen, Fenster und Verbindung bestehen die Prüfung von 2.3.0 und überstehen Drehen und Zuschnitt',()=>{
  const p=createProject(plan()),t=leer();p.plan.trace=t;p.version=7;
  T.addTraceRoom(t,T.traceRoomFrom(t,p.plan,{x:100,y:100},{x:400,y:300},TOL));T.addTraceRoom(t,T.traceRoomFrom(t,p.plan,{x:400,y:100},{x:600,y:300},TOL));
  T.addTraceRoom(t,T.traceRoomFrom(t,p.plan,{x:100,y:300},{x:300,y:450},TOL));T.joinTraceRoom(t,t.rooms[2].id,t.rooms[0].id);
  T.addTraceWall(t,T.traceWallFrom(t,p.plan,{x:600,y:300},{x:820,y:470},TOL));
  for(const [pt,kind] of [[{x:250,y:100},'door'],[{x:500,y:300},'window'],[{x:710,y:385},'window']])T.addTraceOpening(t,T.traceOpeningOn(p.plan,T.traceSegNear(t,pt,TOL),kind,pt,null));
  assert.equal(t.openings.length,3);
  const gelesen=T.validateTrace(JSON.parse(JSON.stringify(t)),p.plan);assert.deepEqual(gelesen,JSON.parse(JSON.stringify(t)));
  assert.deepEqual(Object.keys(t).sort(),['openings','rooms','walls']);
  const start=JSON.parse(JSON.stringify(t));
  for(let i=0;i<4;i++){rotateProject(p,1);assert.equal(T.openingsOn(p.plan.trace,p.plan.trace.walls[0].id).length,1,`Drehung ${i+1}: Fenster liegt weiter auf der schrägen Wand`);assert.equal(p.plan.trace.openings.every(o=>T.hostSeg(p.plan.trace,o)),true);}
  for(const k of ['rooms','walls','openings'])p.plan.trace[k].forEach((e,i)=>{for(const [f,v] of Object.entries(e))if(typeof v==='number'&&f!=='a')near(v,start[k][i][f],`4 × 90° ${k}[${i}].${f}`,.03);});
  cropProject(p,{x:50,y:50,width:900,height:600});assert.equal(p.plan.trace.openings.every(o=>T.hostSeg(p.plan.trace,o)),true,'nach dem Zuschnitt liegen alle Öffnungen auf ihrer Wand');
  assert.doesNotThrow(()=>T.validateTrace(JSON.parse(JSON.stringify(p.plan.trace)),p.plan));assert.equal(p.version,7);
});
check('Auswahl: Tür/Fenster vor Wand vor Raum',()=>{
  const p=plan(),t={rooms:[room('r1','Küche',100,100,300,200)],walls:[{id:'w1',x1:150,y1:150,x2:350,y2:250}],openings:[]};
  const o=T.traceOpeningOn(p,T.traceSegNear(t,{x:250,y:200},TOL),'door',{x:250,y:200},null);T.addTraceOpening(t,o);
  assert.deepEqual(T.traceHit(t,{x:250,y:201},10),{type:'opening',id:o.id});assert.deepEqual(T.traceHit(t,{x:170,y:163},10),{type:'wall',id:'w1'});
  assert.deepEqual(T.traceHit(t,{x:120,y:280},10),{type:'room',id:'r1'});assert.equal(T.traceHit(t,{x:800,y:800},10),null);
});

/* ---------- schon gesetzte Proben (E22) ---------- */
const projekt=()=>{const p=createProject(plan());p.plan.trace={rooms:[room('k','Küche',100,100,300,200),room('f','Flur',400,100,200,500),room('f2','Flur',400,600,400,150,{joins:'f'})],walls:[],openings:[]};p.version=7;return p;};
const probe=(p,x,y,raum,extra={})=>{const m=addMarker(p,'sample',x,y);if(raum)m.raum=raum;Object.assign(m,extra);return m;};
check('Angebot: nur Proben OHNE Raum, die in einem nachgezeichneten Raum liegen – Teil eines Raums zählt zum Hauptrechteck',()=>{
  const p=projekt(),a=probe(p,200,200),b=probe(p,700,700),c=probe(p,1000,100),d=probe(p,250,250,'Küche'),e=addMarker(p,'fire',220,220);
  const {ohne,abweichend}=T.probenAbgleich(p.plan.trace,p.markers);
  assert.deepEqual(ohne,[{id:a.id,label:a.label,raum:'Küche',raumSkizze:'k'},{id:b.id,label:b.label,raum:'Flur',raumSkizze:'f'}]);assert.deepEqual(abweichend,[]);
  assert.equal(ohne.some(v=>v.id===c.id||v.id===d.id||v.id===e.id),false,'außerhalb, mit Raum, Brandherd: nicht im Angebot');
  assert.deepEqual(T.probenAbgleich(undefined,p.markers),{ohne:[],abweichend:[]});
});
check('Übernehmen: setzt nur raum und raumSkizze – Name, Kennung, Laborwerte, Lage bleiben; Proben mit Raum werden nie angefasst',()=>{
  const p=projekt(),lab={nr:'AR-1',lines:[{p:'PAK',r:'38,5',u:'µg/100 cm²'}]},a=probe(p,200,200,'',{lab:structuredClone(lab),note:'Decke'}),b=probe(p,250,250,'Flur'),vorA=structuredClone(a),vorB=structuredClone(b);
  const {ohne}=T.probenAbgleich(p.plan.trace,p.markers);
  b.raum='Flur';a.note='Decke';   // zwischen Angebot und Klick trägt jemand an einer Probe von Hand einen Raum ein:
  const c=probe(p,300,150);const liste=[...ohne,{id:c.id,label:c.label,raum:'Küche',raumSkizze:'k'},{id:b.id,label:b.label,raum:'Küche',raumSkizze:'k'}];c.raum='Lager';
  assert.equal(T.raeumeUebernehmen(p.markers,liste),1);
  assert.deepEqual(a,{...vorA,raum:'Küche',raumSkizze:'k'});assert.deepEqual(b,vorB,'Probe mit Raum unverändert');assert.equal(c.raum,'Lager');assert.equal(c.raumSkizze,undefined);
});
check('Prüfliste: Abweichung wird genannt, nie geändert; LabelKit-Schreibweise mit Geschoss/Zusatz ist keine Abweichung',()=>{
  const p=projekt(),a=probe(p,200,200,'Flur'),b=probe(p,250,250,'EG Küche Brandraum'),c=probe(p,500,300,'  flur '),d=probe(p,700,700,'Küche'),e=probe(p,300,200,'Wohnküche'),vor=JSON.stringify(p.markers);
  const {ohne,abweichend}=T.probenAbgleich(p.plan.trace,p.markers);assert.deepEqual(ohne,[]);
  assert.deepEqual(abweichend,[{id:a.id,label:a.label,steht:'Flur',liegt:'Küche'},{id:d.id,label:d.label,steht:'Küche',liegt:'Flur'},{id:e.id,label:e.label,steht:'Wohnküche',liegt:'Küche'}]);
  assert.equal(abweichend.some(v=>v.id===b.id||v.id===c.id),false);assert.equal(JSON.stringify(p.markers),vor,'der Abgleich ändert nichts');
  assert.equal(T.raumPasst('Haus A 1OG Bad Wand B','Bad'),true);assert.equal(T.raumPasst('Badezimmer','Bad'),false);assert.equal(T.raumPasst('Küche 2','Küche'),true);assert.equal(T.raumPasst('Küche','Küche 2'),false);
});
