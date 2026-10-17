import {clone,type Plan,type Preparation,type Project,type Rect,type Point} from './model';
/** Affine Abbildung wie bei Canvas/SVG: [a,b,c,d,e,f] bildet (x,y) auf (a·x+c·y+e, b·x+d·y+f) ab. */
export type Matrix=[number,number,number,number,number,number];
/** Feinausrichtung höchstens ±45°; größere Drehungen über die 90°-Knöpfe. */
export const MAX_ANGLE=45;
export function preparation(plan:Plan):Preparation{return clone(plan.preparation||{sourceWidth:plan.width,sourceHeight:plan.height,rotation:0,crop:{x:0,y:0,width:plan.width,height:plan.height}});}
const IDENTITY:Matrix=[1,0,0,1,0,0];
/** a∘b: erst b, dann a. */
export function multiply(a:Matrix,b:Matrix):Matrix{return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export function invert(m:Matrix):Matrix{const det=m[0]*m[3]-m[1]*m[2];if(!det)throw Error('Die Planausrichtung ist nicht umkehrbar.');return [m[3]/det,-m[1]/det,-m[2]/det,m[0]/det,(m[2]*m[5]-m[3]*m[4])/det,(m[1]*m[4]-m[0]*m[5])/det];}
export function applyMatrix(m:Matrix,pt:Point):Point{return {x:m[0]*pt.x+m[2]*pt.y+m[4],y:m[1]*pt.x+m[3]*pt.y+m[5]};}
/** Feinwinkel in Grad, im Uhrzeigersinn wie am Bildschirm; 0 ohne Feinausrichtung. */
export function fineAngle(p:Preparation){return p.angle||0;}
/** Größe des fein gedrehten Originals: umschließendes Rechteck, Ecken außerhalb des Bildes werden weiß. */
export function alignedSize(p:Preparation){
  const a=fineAngle(p);if(!a)return {width:p.sourceWidth,height:p.sourceHeight};
  const r=a*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r));
  return {width:p.sourceWidth*c+p.sourceHeight*s,height:p.sourceWidth*s+p.sourceHeight*c};
}
/** Ganzes Bild nach Feinausrichtung und 90°-Drehung, vor dem Zuschnitt. */
export function wholeSize(p:Preparation){const s=alignedSize(p);return p.rotation%180?{width:s.height,height:s.width}:s;}
function fineMatrix(p:Preparation):Matrix{
  const a=fineAngle(p);if(!a)return IDENTITY;
  const r=a*Math.PI/180,cos=Math.cos(r),sin=Math.sin(r),s=alignedSize(p);
  return multiply([1,0,0,1,s.width/2,s.height/2],multiply([cos,sin,-sin,cos,0,0],[1,0,0,1,-p.sourceWidth/2,-p.sourceHeight/2]));
}
/** Original → ganzes vorbereitetes Bild (Feinausrichtung, dann 90°-Drehung), ohne Zuschnitt. */
export function wholeMatrix(p:Preparation):Matrix{
  const s=alignedSize(p),w=s.width,h=s.height;
  const turns:Record<number,Matrix>={0:[1,0,0,1,0,0],90:[0,1,-1,0,h,0],180:[-1,0,0,-1,w,h],270:[0,-1,1,0,0,w]};
  return multiply(turns[p.rotation],fineMatrix(p));
}
/** Original → Planeinheiten (Feinausrichtung, 90°-Drehung, Zuschnitt). Ohne Feinausrichtung exakt wie bisher. */
export function planMatrix(plan:Plan):Matrix{
  const p=preparation(plan),m=wholeMatrix(p);m[4]-=p.crop.x;m[5]-=p.crop.y;return m;
}
export function rotateProject(project:Project,direction:1|-1){
  const plan=project.plan,p=preparation(plan),w=plan.width,h=plan.height;
  const aligned=alignedSize(p),wholeW=p.rotation%180?aligned.height:aligned.width,wholeH=p.rotation%180?aligned.width:aligned.height;
  const c=p.crop;p.crop=direction===1?{x:wholeH-c.y-c.height,y:c.x,width:c.height,height:c.width}:{x:c.y,y:wholeW-c.x-c.width,width:c.height,height:c.width};
  p.rotation=((p.rotation+direction*90+360)%360) as Preparation['rotation'];
  const turn=(x:number,y:number)=>direction===1?{x:h-y,y:x}:{x:y,y:w-x};
  for(const m of project.markers){const pt=turn(m.x,m.y),label=turn(m.lx,m.ly);m.x=pt.x;m.y=pt.y;m.lx=label.x;m.ly=label.y;}
  for(const area of project.areas||[])area.points=area.points.map(pt=>turn(pt.x,pt.y));
  if(typeof plan.north==='number')plan.north=((plan.north+direction*90)%360+360)%360;
  plan.preparation=p;plan.width=h;plan.height=w;project.version=Math.max(project.version,project.areas?3:2) as Project['version'];
}
export function cropProject(project:Project,rect:Rect){
  const plan=project.plan;
  if(!Object.values(rect).every(Number.isFinite)||rect.width<=0||rect.height<=0||rect.x<0||rect.y<0||rect.x+rect.width>plan.width+.01||rect.y+rect.height>plan.height+.01)throw Error('Bitte einen gültigen Zuschneidebereich innerhalb des Plans wählen.');
  const outside=project.markers.filter(m=>m.x<rect.x||m.y<rect.y||m.x>rect.x+rect.width||m.y>rect.y+rect.height);
  if(outside.length)throw Error(`${outside.length} Markierung(en) liegen außerhalb des Zuschnitts. Wählen Sie einen Bereich, der alle Probenpunkte und Brandherde enthält.`);
  if((project.areas||[]).some(a=>a.points.some(p=>p.x<rect.x-.01||p.y<rect.y-.01||p.x>rect.x+rect.width+.01||p.y>rect.y+rect.height+.01)))throw Error('Der Zuschnitt muss alle Eckpunkte der eingezeichneten Flächen enthalten. Bitte einen größeren Ausschnitt wählen oder die betreffende Fläche vorher bearbeiten/löschen.');
  const p=preparation(plan);p.crop={x:p.crop.x+rect.x,y:p.crop.y+rect.y,width:rect.width,height:rect.height};
  for(const m of project.markers){m.x-=rect.x;m.y-=rect.y;m.lx-=rect.x;m.ly-=rect.y;}
  for(const area of project.areas||[])area.points=area.points.map(pt=>({x:Math.max(0,Math.min(rect.width,pt.x-rect.x)),y:Math.max(0,Math.min(rect.height,pt.y-rect.y))}));
  plan.preparation=p;plan.width=rect.width;plan.height=rect.height;project.version=Math.max(project.version,project.areas?3:2) as Project['version'];
}
/**
 * Plan um delta Grad fein drehen (im Uhrzeigersinn). Das Original bleibt unverändert; gespeichert wird nur der Winkel.
 * Markierungen, Beschriftungen, Flächen und Nordrichtung drehen mit, damit sie auf derselben Stelle des Bildes bleiben.
 * Der Ausschnitt wird zum umschließenden Rechteck des gedrehten bisherigen Ausschnitts (innerhalb des ganzen Bildes);
 * liegen Markierungen oder Flächen außerhalb, wird das ganze Bild verwendet. Maßstab und Punktgröße ändern sich nicht.
 */
export function alignProject(project:Project,delta:number){
  if(!Number.isFinite(delta))throw Error('Ungültiger Drehwinkel.');
  const plan=project.plan,old=preparation(plan),before=fineAngle(old),angle=Math.round((before+delta)*100)/100;
  if(Math.abs(angle)>MAX_ANGLE)throw Error(`Feinausrichtung höchstens ±${MAX_ANGLE}°. Für größere Drehungen zuerst um 90° drehen.`);
  if(angle===before)return;
  const next:Preparation={sourceWidth:old.sourceWidth,sourceHeight:old.sourceHeight,rotation:old.rotation,crop:{...old.crop},...(angle?{angle}:{})};
  const move=multiply(wholeMatrix(next),invert(wholeMatrix(old))),c=old.crop,whole=wholeSize(next);
  const toWhole=(pt:Point)=>applyMatrix(move,{x:pt.x+c.x,y:pt.y+c.y});
  const corners=[{x:0,y:0},{x:c.width,y:0},{x:0,y:c.height},{x:c.width,y:c.height}].map(toWhole);
  const x0=Math.max(0,Math.min(...corners.map(p=>p.x))),y0=Math.max(0,Math.min(...corners.map(p=>p.y)));
  const x1=Math.min(whole.width,Math.max(...corners.map(p=>p.x))),y1=Math.min(whole.height,Math.max(...corners.map(p=>p.y)));
  const markers=project.markers.map(m=>({m,pt:toWhole(m),label:toWhole({x:m.lx,y:m.ly})}));
  const areas=(project.areas||[]).map(a=>({a,points:a.points.map(toWhole)}));
  const fits=(r:Rect)=>[...markers.map(e=>e.pt),...areas.flatMap(e=>e.points)].every(p=>p.x>=r.x-.01&&p.y>=r.y-.01&&p.x<=r.x+r.width+.01&&p.y<=r.y+r.height+.01);
  let crop:Rect={x:x0,y:y0,width:x1-x0,height:y1-y0};
  if(!(crop.width>0&&crop.height>0)||!fits(crop))crop={x:0,y:0,width:whole.width,height:whole.height};
  if(!fits(crop))throw Error('Eine Markierung oder Fläche läge nach dem Drehen außerhalb des Planbildes. Bitte die Lage prüfen.');
  next.crop=crop;
  for(const {m,pt,label} of markers){m.x=pt.x-crop.x;m.y=pt.y-crop.y;m.lx=label.x-crop.x;m.ly=label.y-crop.y;}
  for(const {a,points} of areas)a.points=points.map(p=>({x:Math.max(0,Math.min(crop.width,p.x-crop.x)),y:Math.max(0,Math.min(crop.height,p.y-crop.y))}));
  if(typeof plan.north==='number')plan.north=Math.round(((plan.north+angle-before)%360+360)%360*100)/100%360;
  plan.preparation=next;plan.width=crop.width;plan.height=crop.height;project.version=6;
}
