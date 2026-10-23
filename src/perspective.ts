/* Entzerren (ab 1.20): schräg fotografierte Pläne (Fluchtplan im Treppenhaus) über vier Ecken gerade rechnen.
   Vier Ecken im angezeigten Plan → Rechteck. Das Ergebnis ist ein neues Rasterbild; die Originaldatei bleibt unverändert
   (im Projektordner als „(vorher …)“-Kopie bzw. als geladene Fotodatei, in der Sitzung über Rückgängig).
   Markierungen und Flächen werden mit derselben Abbildung umgerechnet. Der Maßstab ändert sich dabei uneinheitlich und
   wird deshalb entfernt (neu messen); die Nordrichtung ebenso. */
import type {Plan,Point,Project} from './model';
import {loadImage} from './import';
import {planMatrix,preparation} from './preparation';

export type Quad=[Point,Point,Point,Point];   // oben links, oben rechts, unten rechts, unten links
export type Aspect='photo'|'din-landscape'|'din-portrait';
export const ASPECT_NAMES:Record<Aspect,string>={photo:'wie im Foto (geschätzt)','din-landscape':'DIN quer (A4/A3)','din-portrait':'DIN hoch (A4/A3)'};
/** Ausgabe höchstens so groß wie gerenderte PDF-Seiten. */
export const MAX_LONG=4600,MAX_PIXELS=16_000_000;

/** 3×3-Homographie (Zeilenweise, h[8]=1), die die vier Punkte from[i] auf to[i] abbildet. */
export function homography(from:Quad,to:Quad):number[]{
  const A:number[][]=[],b:number[]=[];
  for(let i=0;i<4;i++){const {x,y}=from[i],{x:u,y:v}=to[i];
    A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);}
  const h=solve(A,b);if(!h)throw Error('Die vier Ecken ergeben kein gültiges Viereck. Bitte die Ecken prüfen.');
  return [...h,1];
}
function solve(A:number[][],b:number[]):number[]|null{
  const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
    if(Math.abs(M[p][c])<1e-12)return null;[M[c],M[p]]=[M[p],M[c]];
    for(let r=0;r<n;r++){if(r===c)continue;const f=M[r][c]/M[c][c];if(f)for(let k=c;k<=n;k++)M[r][k]-=f*M[c][k];}}
  return M.map((r,i)=>r[n]/M[i][i]);
}
export function applyH(h:number[],p:Point):Point{const w=h[6]*p.x+h[7]*p.y+h[8];return {x:(h[0]*p.x+h[1]*p.y+h[2])/w,y:(h[3]*p.x+h[4]*p.y+h[5])/w};}
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(o:Point,a:Point,b:Point)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
/** Fehlertext, wenn das Viereck nicht taugt (überkreuzt, nicht konvex, zu klein); sonst ''. */
export function quadProblem(q:Quad,plan:{width:number;height:number}):string{
  if(!q.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return 'Ungültige Ecken.';
  const s=[0,1,2,3].map(i=>Math.sign(cross(q[i],q[(i+1)%4],q[(i+2)%4])));
  if(s.some(v=>v===0)||!s.every(v=>v===s[0]))return 'Die Ecken überkreuzen sich oder liegen auf einer Linie. Bitte der Reihe nach: oben links, oben rechts, unten rechts, unten links.';
  const area=Math.abs(cross(q[0],q[1],q[2])+cross(q[0],q[2],q[3]))/2;
  if(area<plan.width*plan.height*.02)return 'Das Viereck ist sehr klein. Bitte die vier Ecken des Plans im Foto antippen.';
  return '';
}
/** Zielgröße in Pixeln: Seitenverhältnis aus dem Foto geschätzt oder DIN; Auflösung etwa wie im Foto, begrenzt. */
export function targetSize(q:Quad,aspect:Aspect){
  const w=(dist(q[0],q[1])+dist(q[3],q[2]))/2,h=(dist(q[0],q[3])+dist(q[1],q[2]))/2;
  let ratio=w/h;if(aspect==='din-landscape')ratio=Math.SQRT2;else if(aspect==='din-portrait')ratio=1/Math.SQRT2;
  let long=Math.min(MAX_LONG,Math.max(w,h)*1.1);
  let W=ratio>=1?long:long*ratio,H=ratio>=1?long/ratio:long;
  if(W*H>MAX_PIXELS){const f=Math.sqrt(MAX_PIXELS/(W*H));W*=f;H*=f;}
  return {width:Math.max(50,Math.round(W)),height:Math.max(50,Math.round(H))};
}
const rect=(w:number,h:number):Quad=>[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
/** Vorschlag für die Ecken: Plan um 6 % eingerückt. */
export function initialQuad(plan:{width:number;height:number}):Quad{const dx=plan.width*.06,dy=plan.height*.06;return [{x:dx,y:dy},{x:plan.width-dx,y:dy},{x:plan.width-dx,y:plan.height-dy},{x:dx,y:plan.height-dy}];}

/** Prüft, ob alle Markierungen und Flächenecken im Viereck liegen (sonst landen sie außerhalb des neuen Plans). */
export function outsideCount(p:Project,q:Quad){
  const inside=(pt:Point)=>{const s=[0,1,2,3].map(i=>Math.sign(cross(q[i],q[(i+1)%4],pt)));return s.every(v=>v>=0)||s.every(v=>v<=0);};
  return p.markers.filter(m=>!inside({x:m.x,y:m.y})).length+(p.areas||[]).filter(a=>a.points.some(pt=>!inside(pt))).length;
}

/** Zeichnet den angezeigten Plan (mit Drehung/Zuschnitt/Ausrichtung) und rechnet ihn auf das Rechteck um. */
export async function warpImage(plan:Plan,q:Quad,size:{width:number;height:number},progress?:(t:string)=>void):Promise<{data:string;width:number;height:number}>{
  const long=Math.max(plan.width,plan.height),k=plan.vector?Math.min(4,Math.max(1,MAX_LONG/long)):1;   // Vektorpläne scharf rastern
  const sw=Math.round(plan.width*k),sh=Math.round(plan.height*k);
  const src=document.createElement('canvas');src.width=sw;src.height=sh;const out=document.createElement('canvas');out.width=size.width;out.height=size.height;
  try{
    const sctx=src.getContext('2d',{willReadFrequently:true}),octx=out.getContext('2d');if(!sctx||!octx)throw Error('Kein Bildspeicher verfügbar.');
    sctx.fillStyle='#fff';sctx.fillRect(0,0,sw,sh);sctx.scale(k,k);sctx.beginPath();sctx.rect(0,0,plan.width,plan.height);sctx.clip();sctx.transform(...planMatrix(plan));
    const source=preparation(plan),img=await loadImage(plan.data,'Der Grundriss');sctx.drawImage(img,0,0,source.sourceWidth,source.sourceHeight);
    const s=sctx.getImageData(0,0,sw,sh).data,o=octx.createImageData(size.width,size.height),d=o.data;
    const inv=homography(rect(size.width,size.height),q.map(p=>({x:p.x*k,y:p.y*k})) as Quad);
    for(let y=0;y<size.height;y++){
      if(progress&&y%400===0)progress(`Entzerren … ${Math.round(y/size.height*100)} %`);
      for(let x=0;x<size.width;x++){
        const w=inv[6]*(x+.5)+inv[7]*(y+.5)+inv[8],u=(inv[0]*(x+.5)+inv[1]*(y+.5)+inv[2])/w-.5,v=(inv[3]*(x+.5)+inv[4]*(y+.5)+inv[5])/w-.5;
        const i=(y*size.width+x)*4;
        if(u<0||v<0||u>sw-1||v>sh-1){d[i]=d[i+1]=d[i+2]=255;d[i+3]=255;continue;}
        const x0=Math.floor(u),y0=Math.floor(v),x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),fx=u-x0,fy=v-y0;
        const a=(y0*sw+x0)*4,b=(y0*sw+x1)*4,c=(y1*sw+x0)*4,e=(y1*sw+x1)*4;
        for(let ch=0;ch<3;ch++)d[i+ch]=(s[a+ch]*(1-fx)+s[b+ch]*fx)*(1-fy)+(s[c+ch]*(1-fx)+s[e+ch]*fx)*fy;
        d[i+3]=255;
      }
      if(y%200===199)await new Promise(r=>setTimeout(r,0));   // Oberfläche bleibt bedienbar
    }
    octx.putImageData(o,0,0);
    const photo=/^data:image\/jpe?g/i.test(plan.data);
    const data=out.toDataURL(photo?'image/jpeg':'image/png',.92);if(data.length<100)throw Error('Der Browser konnte das entzerrte Bild nicht erzeugen.');
    return {data,width:size.width,height:size.height};
  }finally{src.width=src.height=1;out.width=out.height=1;}
}

/** Projekt auf den entzerrten Plan umstellen: Plan ersetzen, Markierungen/Flächen umrechnen, Maßstab und Norden entfernen. */
export function perspectiveProject(project:Project,q:Quad,image:{data:string;width:number;height:number}){
  const h=homography(q,rect(image.width,image.height)),clamp=(v:number,max:number)=>Math.min(max,Math.max(0,v));
  const old=project.plan,plan:Plan={name:old.name,width:image.width,height:image.height,data:image.data,vector:false,...(old.markerScale!==undefined?{markerScale:old.markerScale}:{}),...(old.autoLabels!==undefined?{autoLabels:old.autoLabels}:{}),...(old.valueLabels!==undefined?{valueLabels:old.valueLabels}:{})};
  const lost={calibration:!!old.calibration,north:old.north!==undefined};
  project.plan=plan;
  for(const m of project.markers){const p=applyH(h,{x:m.x,y:m.y}),l=applyH(h,{x:m.lx,y:m.ly}),moved=Math.hypot(m.x-m.lx,m.y-m.ly)>.01;
    m.x=clamp(p.x,image.width);m.y=clamp(p.y,image.height);if(moved){m.lx=l.x;m.ly=l.y;}else{m.lx=m.x;m.ly=m.y;}}
  for(const a of project.areas||[])a.points=a.points.map(pt=>{const p=applyH(h,pt);return {x:clamp(p.x,image.width),y:clamp(p.y,image.height)};});
  return lost;
}
