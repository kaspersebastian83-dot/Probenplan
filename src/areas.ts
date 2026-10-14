import {escape,validLabel,type Area,type Plan,type Point,type Project} from './model';
export const PALETTE=[
  {color:'#d34c42',outline:'#a42c25',title:'Rot',suggestion:'Brandbereich',dash:[]},
  {color:'#df8224',outline:'#a45a11',title:'Orange',suggestion:'Starker Schadensbereich',dash:[5,2]},
  {color:'#e2bd35',outline:'#8c7012',title:'Gelb',suggestion:'Verdachts- oder Untersuchungsbereich',dash:[1,2]},
  {color:'#3780b8',outline:'#205a87',title:'Blau',suggestion:'Löschwasser- oder Feuchtebereich',dash:[6,2,1,2]},
  {color:'#39875a',outline:'#235e3c',title:'Grün',suggestion:'Gereinigter oder freigegebener Bereich',dash:[4,2,4,4]},
  {color:'#78818a',outline:'#4c5660',title:'Grau',suggestion:'Sonstiger Bereich',dash:[1,2,1,2,4,2]},
] as const;
export const MAX_AREAS=100,MAX_POINTS=200;
export const palette=(color:string)=>PALETTE.find(c=>c.color===color)!;
export const cleanName=(s:string)=>s.trim().replace(/\s+/g,' ');
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function polygonError(points:Point[],plan:Plan):string|null{
  if(points.length<3)return 'Eine Fläche benötigt mindestens drei Eckpunkte.';
  if(points.length>MAX_POINTS)return `Eine Fläche darf höchstens ${MAX_POINTS} Eckpunkte enthalten. Für größere Bereiche mehrere Flächen verwenden.`;
  if(points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<-.01||p.y<-.01||p.x>plan.width+.01||p.y>plan.height+.01))return 'Alle Eckpunkte müssen innerhalb des Grundrisses liegen und gültige Koordinaten haben.';
  const eps=Math.max(plan.width,plan.height)*1e-7;
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)<eps)return 'Eckpunkte dürfen nicht doppelt oder unmittelbar übereinander liegen.';
  const on=(a:Point,b:Point,p:Point)=>Math.abs(cross(a,b,p))<eps*eps&&p.x>=Math.min(a.x,b.x)-eps&&p.x<=Math.max(a.x,b.x)+eps&&p.y>=Math.min(a.y,b.y)-eps&&p.y<=Math.max(a.y,b.y)+eps;
  const intersects=(a:Point,b:Point,c:Point,d:Point)=>((cross(a,b,c)>0)!==(cross(a,b,d)>0)&&(cross(c,d,a)>0)!==(cross(c,d,b)>0))||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    if(j===i+1||(i===0&&j===points.length-1))continue;
    if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return 'Die Außenkontur darf sich nicht selbst kreuzen oder berühren. Bitte den letzten Eckpunkt entfernen oder anders setzen.';
  }
  const area=Math.abs(points.reduce((sum,p,i)=>{const next=points[(i+1)%points.length];return sum+p.x*next.y-next.x*p.y;},0))/2;
  if(area<Math.max(1e-10,plan.width*plan.height*1e-9))return 'Die Eckpunkte müssen eine erkennbare Fläche bilden und dürfen nicht nur auf einer Linie liegen.';
  return null;
}
export function addArea(p:Project,points:Point[],color:string,opacity:number,name:string):Area{
  const error=polygonError(points,p.plan);if(error)throw Error(error);
  if((p.areas?.length||0)>=MAX_AREAS)throw Error(`Ein Projekt darf höchstens ${MAX_AREAS} Flächen enthalten.`);
  if(!palette(color)||!Number.isFinite(opacity)||opacity<.05||opacity>.7||!cleanName(name)||cleanName(name).length>160)throw Error('Bitte eine gültige Farbe, Deckkraft und Bezeichnung (1–160 Zeichen) wählen.');
  let n=p.nextArea||1;while(!validLabel(p,`Z${n}`,''))n++;
  if(!Number.isSafeInteger(n)||n<1||n>=999999999)throw Error('Der Flächenzähler ist ausgeschöpft. Bitte ein neues Projekt verwenden.');
  const area={id:crypto.randomUUID(),label:`Z${n}`,name:cleanName(name),color,opacity,points:points.map(pt=>({...pt}))};
  (p.areas||= []).push(area);p.nextArea=n+1;p.version=p.version===4?4:3;return area;
}
export function contains(points:Point[],p:Point){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(((a.y>p.y)!==(b.y>p.y))&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
export function areaAnchor(points:Point[]):Point{
  const ys=points.map(p=>p.y),min=Math.min(...ys),max=Math.max(...ys);let best={x:points[0].x,y:points[0].y},length=-1;
  // A scanline midpoint stays inside concave polygons, unlike a bounding-box center.
  for(let row=1;row<20;row++){const y=min+(max-min)*row/20,xs:number[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a.y>y)!==(b.y>y))xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const score=(xs[i+1]-xs[i])*(1-Math.abs(row-10)/25);if(score>length){length=score;best={x:(xs[i]+xs[i+1])/2,y};}}}
  return best;
}
export function areaSVG(areas:Area[],plan:Plan,options:{selected?:string|null;minSize?:number;interactive?:boolean;handles?:boolean}={}){
  const unit=Math.max(plan.width,plan.height),stroke=unit/600,size=Math.max(unit/60,options.minSize||0),attrs=(a:Area)=>options.interactive?`data-area="${a.id}"`:'';
  const fills=areas.map(a=>`<polygon ${attrs(a)} points="${a.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${a.color}" fill-opacity="${a.opacity}"/>`).join('');
  const borders=areas.map(a=>{const c=palette(a.color);return `<polygon ${attrs(a)} points="${a.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${c.outline}" stroke-width="${stroke}" ${c.dash.length?`stroke-dasharray="${c.dash.map(d=>d*stroke).join(' ')}"`:''}/>`;}).join('');
  const labels=areas.map(a=>{const p=areaAnchor(a.points),rx=size*Math.max(1,a.label.length*.32);return `<g ${attrs(a)}><rect x="${p.x-rx}" y="${p.y-size*.72}" width="${2*rx}" height="${size*1.44}" rx="${size*.2}" fill="white" fill-opacity=".94" stroke="${palette(a.color).outline}" stroke-width="${stroke*.6}"/><text x="${p.x}" y="${p.y+size*.29}" text-anchor="middle" fill="#24342e" font-family="Arial, sans-serif" font-size="${size*.86}" font-weight="700">${escape(a.label)}</text></g>`;}).join('');
  const a=areas.find(a=>a.id===options.selected),handles=a&&options.handles?a.points.map((p,i)=>`<g data-area="${a.id}" data-vertex="${i}"><circle cx="${p.x}" cy="${p.y}" r="${size*1.8}" fill="transparent"/><circle cx="${p.x}" cy="${p.y}" r="${size*.55}" fill="white" stroke="#193d32" stroke-width="${size*.18}"/></g>`).join(''):'';
  return `<g class="area-fills">${fills}</g><g class="area-contours">${borders}</g><g class="area-codes">${labels}</g><g class="area-handles">${handles}</g>`;
}
export interface AreaCategory {name:string;variants:{color:string;opacity:number;labels:string[]}[]}
export function areaCategories(areas:Area[]):AreaCategory[]{
  const groups=new Map<string,AreaCategory>();
  for(const a of areas){const key=cleanName(a.name).normalize('NFC').toLocaleLowerCase('de');let group=groups.get(key);if(!group){group={name:cleanName(a.name),variants:[]};groups.set(key,group);}let v=group.variants.find(v=>v.color===a.color&&v.opacity===a.opacity);if(!v){v={color:a.color,opacity:a.opacity,labels:[]};group.variants.push(v);}v.labels.push(a.label);}
  return [...groups.values()];
}
