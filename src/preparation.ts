import {clone,type Plan,type Preparation,type Project,type Rect} from './model';
export function preparation(plan:Plan):Preparation{return clone(plan.preparation||{sourceWidth:plan.width,sourceHeight:plan.height,rotation:0,crop:{x:0,y:0,width:plan.width,height:plan.height}});}
export function planMatrix(plan:Plan):[number,number,number,number,number,number]{
  const p=preparation(plan);const matrices:Record<number,[number,number,number,number,number,number]>={0:[1,0,0,1,0,0],90:[0,1,-1,0,p.sourceHeight,0],180:[-1,0,0,-1,p.sourceWidth,p.sourceHeight],270:[0,-1,1,0,0,p.sourceWidth]};
  const m=matrices[p.rotation];m[4]-=p.crop.x;m[5]-=p.crop.y;return m;
}
export function rotateProject(project:Project,direction:1|-1){
  const plan=project.plan,p=preparation(plan),w=plan.width,h=plan.height;
  const wholeW=p.rotation%180?p.sourceHeight:p.sourceWidth,wholeH=p.rotation%180?p.sourceWidth:p.sourceHeight;
  const c=p.crop;p.crop=direction===1?{x:wholeH-c.y-c.height,y:c.x,width:c.height,height:c.width}:{x:c.y,y:wholeW-c.x-c.width,width:c.height,height:c.width};
  p.rotation=((p.rotation+direction*90+360)%360) as Preparation['rotation'];
  const turn=(x:number,y:number)=>direction===1?{x:h-y,y:x}:{x:y,y:w-x};
  for(const m of project.markers){const pt=turn(m.x,m.y),label=turn(m.lx,m.ly);m.x=pt.x;m.y=pt.y;m.lx=label.x;m.ly=label.y;}
  for(const area of project.areas||[])area.points=area.points.map(pt=>turn(pt.x,pt.y));
  plan.preparation=p;plan.width=h;plan.height=w;project.version=project.version===4?4:project.areas?3:2;
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
  plan.preparation=p;plan.width=rect.width;plan.height=rect.height;project.version=project.version===4?4:project.areas?3:2;
}
