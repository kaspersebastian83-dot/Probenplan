import {labeled,shownSVG,ensureInk} from './labels';
import {bounds, floorName, markerSize, shapeOf, typeOf, starPath, trialOn, FIRE_RED, SHAPES, SHAPE_NAMES, SURFACE_NAMES, TYPE_ORDER, type Project, type Shape, type Surface} from './model';
import {loadImage} from './import';
import {planMatrix,preparation} from './preparation';
import {areaAnchor,areaCategories,areaSVG,palette} from './areas';
import {rangeText,shortParameter,UNRATED,qualifierGroups,type Rated} from './results';
export function wrap(ctx:CanvasRenderingContext2D,text:string,width:number){
  const lines:string[]=[];let line='';
  for(const word of text.split(/\s+/)){if(line&&ctx.measureText(`${line} ${word}`).width<=width){line+=` ${word}`;continue;}if(line){lines.push(line);line='';}for(const char of word){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}}
  if(line)lines.push(line);return lines;
}
interface LegendVariant {color:string;opacity:number;outline:string;dash:readonly number[];round:boolean;text:string;shape?:Shape|'star';surface?:Surface}
/** Legende der Formen: mehrere Formen im Plan → je Form die Probenarten (aus LabelKit). Probe/Brandherd stehen fest in der Fußzeile. */
const DEFAULT_TYPE:Record<Shape,string>={circle:'PAK',square:'Chlorid',diamond:'Asbest'};
export function markerLegend(p:Project):{name:string;variants:LegendVariant[]}|null{
  const samples=p.markers.filter(m=>m.kind==='sample');
  const used=SHAPES.filter(f=>samples.some(m=>shapeOf(m)===f));
  const variants:LegendVariant[]=[];
  if(used.length>1)for(const f of used){
    const types=[...new Set(samples.filter(m=>shapeOf(m)===f).map(typeOf).filter(Boolean))].sort((a,b)=>(TYPE_ORDER.indexOf(a)+1||99)-(TYPE_ORDER.indexOf(b)+1||99)||a.localeCompare(b,'de'));
    variants.push({color:'#ffffff',opacity:1,outline:'#17665e',dash:[],round:false,shape:f,text:(types.length?types.join(', '):DEFAULT_TYPE[f])+` (${SHAPE_NAMES[f]})`});
  }
  return variants.length?{name:'Probenarten',variants}:null;
}
function legendBlocks(p:Project,rated?:Rated|null){
  const blocks:{name:string;variants:LegendVariant[]}[]=[];
  if(rated){
    for(const g of rated.groups)if(g.scale)blocks.push({name:`${shortParameter(g.parameter)}${g.unit?` in ${g.unit}`:''}${g.scale.name?` · ${g.scale.name}`:''}`,variants:g.cats.map((c,i)=>({color:c.color,opacity:1,outline:'#1d2a33',dash:[],round:true,text:`${c.name} (${rangeText(g.scale!,i,g.unit)})${c.labels.length?`: ${c.labels.join(', ')}`:''}`}))});
    for(const g of qualifierGroups(rated))blocks.push({name:g.name,variants:[{color:g.color,opacity:1,outline:'#1d2a33',dash:[],round:true,text:g.labels.join(', ')}]});
    if(rated.unrated.length)blocks.push({name:'Ohne Bewertung',variants:[{color:UNRATED,opacity:1,outline:'#1d2a33',dash:[],round:true,text:`${rated.unrated.join(', ')} – kein Wert für ${shortParameter(rated.parameter)} oder keine anwendbare Skala / Zahl nicht eindeutig`}]});
  }
  const ml=markerLegend(p);if(ml)blocks.push(ml);
  if(p.plan.surfaceBars!==false){const used=(['ceiling','wall','floor'] as Surface[]).map(s=>({s,labels:p.markers.filter(m=>m.kind==='sample'&&m.surface===s).map(m=>m.label)})).filter(x=>x.labels.length);
    if(used.length)blocks.push({name:'Oberflächenart',variants:used.map(x=>({color:'#5b6773',opacity:1,outline:'#5b6773',dash:[],round:true,surface:x.s,text:`${SURFACE_NAMES[x.s]}: ${x.labels.sort((a,b)=>a.localeCompare(b,'de',{numeric:true})).join(', ')}`}))});}
  for(const c of areaCategories(p.areas||[]))blocks.push({name:c.name,variants:c.variants.map(v=>{const pal=palette(v.color);return {color:v.color,opacity:v.opacity,outline:pal.outline,dash:pal.dash,round:false,text:`${v.labels.join(', ')} · ${Math.round(v.opacity*100)} %`};})});
  return blocks;
}
export function legendLayout(p:Project,width:number,fs:number,rated?:Rated|null){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('Kein Bildspeicher verfügbar.');
  ctx.font=`bold ${fs}px Arial`;
  let y=fs*2.7;
  const entries=legendBlocks(p,rated).map(c=>{const lines=wrap(ctx,c.name,width),top=y;y+=lines.length*fs*1.35+fs*.35;
    const variants=c.variants.map(v=>{ctx.font=`${fs*.85}px Arial`;const ids=wrap(ctx,v.text,width-fs*3.2),top=y;y+=Math.max(fs*1.2,ids.length*fs*1.15)+fs*.4;ctx.font=`bold ${fs}px Arial`;return{...v,ids,top};});y+=fs*.8;return{...c,lines,top,variants};});
  const kinds=[!!rated,!!markerLegend(p),!!p.areas?.length].filter(Boolean).length;
  const title=kinds>1?'Legende':rated?'Ergebnisse':p.areas?.length?'Flächenkennzeichnung':'Legende';
  return {entries,height:y,fs,title};
}
/** Plan mit allen Markierungen, Beschriftungen und Flächenschildern. */
export function contentBounds(p:Project){
  const b=bounds(p);
  // Include area code plates close to the plan boundary in the exported bounds.
  for(const a of p.areas||[]){const c=areaAnchor(a.points),size=Math.max(p.plan.width,p.plan.height)/60,rx=size*Math.max(1,a.label.length*.32),right=b.x+b.width,bottom=b.y+b.height;b.x=Math.min(b.x,c.x-rx);b.y=Math.min(b.y,c.y-size*.72);b.width=Math.max(right,c.x+rx)-b.x;b.height=Math.max(bottom,c.y+size*.72)-b.y;}
  return b;
}
/** Grundriss (zugeschnitten/gedreht) und Markierungen auf ctx zeichnen: Planeinheit u erscheint bei (x0+(u-b.x)*k, y0+(v-b.y)*k). */
export async function drawPlanContent(ctx:CanvasRenderingContext2D,p:Project,b:{x:number;y:number;width:number;height:number},x0:number,y0:number,k:number,rated?:Rated|null){
  await ensureInk(p.plan);p=labeled(p,rated);
  ctx.save();ctx.translate(x0,y0);ctx.scale(k,k);ctx.translate(-b.x,-b.y);
  ctx.beginPath();ctx.rect(0,0,p.plan.width,p.plan.height);ctx.clip();ctx.transform(...planMatrix(p.plan));
  const source=preparation(p.plan),base=await loadImage(p.plan.data,'Der Grundriss');ctx.drawImage(base,0,0,source.sourceWidth,source.sourceHeight);
  ctx.restore();
  const w=b.width*k,h=b.height*k;
  const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="${b.x} ${b.y} ${b.width} ${b.height}">${areaSVG(p.areas||[],p.plan)}${p.markers.map(m=>shownSVG(p,m,false,0,rated?.fill.get(m.id))).join('')}</svg>`;
  const url=URL.createObjectURL(new Blob([overlay],{type:'image/svg+xml'}));
  try{ctx.drawImage(await loadImage(url,'Die Markierungsebene'),x0,y0,w,h);}finally{URL.revokeObjectURL(url);}
}
export type LegendLayout=NonNullable<ReturnType<typeof legendLayout>>;
/** Legendenblöcke (Flächen/Ergebnisse) ab (x,y) zeichnen; Maße wie bei legendLayout. */
export function drawLegend(ctx:CanvasRenderingContext2D,legend:LegendLayout,x:number,y:number,title=true){
  const {fs,entries}=legend;
  if(title){ctx.fillStyle='#263b35';ctx.font=`bold ${fs*1.15}px Arial`;ctx.fillText(legend.title,x,y+fs*1.2);}
  for(const c of entries){ctx.fillStyle='#263b35';ctx.font=`bold ${fs}px Arial`;c.lines.forEach((line,i)=>ctx.fillText(line,x,y+c.top+i*fs*1.35));
    for(const v of c.variants){const top=y+v.top-fs*.8,w=fs*2.2,h=fs*.9;ctx.fillStyle=v.color;ctx.globalAlpha=v.opacity;ctx.strokeStyle=v.outline;ctx.lineWidth=fs*.08;
      if(v.surface){const cx=x+w/2,cy=top+h/2,R=h*.5,t=R*.45;ctx.beginPath();ctx.arc(cx,cy,R,0,2*Math.PI);ctx.fill();
        if(v.surface==='ceiling')ctx.fillRect(cx-R,cy-R-t*1.6,2*R,t);else if(v.surface==='floor')ctx.fillRect(cx-R,cy+R+t*.6,2*R,t);else if(v.surface==='wall')ctx.fillRect(cx-R-t*1.6,cy-R,t,2*R);}
      else if(v.shape){const cx=x+w/2,cy=top+h/2,R=h*.62;ctx.lineWidth=fs*.1;ctx.beginPath();
        if(v.shape==='star')ctx.fill(new Path2D(starPath(cx,cy,R*1.25)));
        else{if(v.shape==='circle')ctx.arc(cx,cy,R,0,2*Math.PI);else if(v.shape==='square')ctx.rect(cx-R,cy-R,2*R,2*R);else{ctx.moveTo(cx,cy-R*1.25);ctx.lineTo(cx+R*1.25,cy);ctx.lineTo(cx,cy+R*1.25);ctx.lineTo(cx-R*1.25,cy);ctx.closePath();}ctx.fill();ctx.stroke();}
        ctx.globalAlpha=1;}
      else if(v.round){ctx.beginPath();ctx.arc(x+w/2,top+h/2,h*.62,0,2*Math.PI);ctx.fill();ctx.globalAlpha=1;ctx.stroke();}
      else{ctx.fillRect(x,top,w,h);ctx.globalAlpha=1;ctx.setLineDash(v.dash.map(n=>n*fs*.08));ctx.strokeRect(x,top,w,h);ctx.setLineDash([]);}ctx.fillStyle='#263b35';ctx.font=`${fs*.85}px Arial`;v.ids.forEach((line,i)=>ctx.fillText(line,x+fs*3.2,y+v.top+i*fs*1.15));}
  }
}
export function exportLayout(p:Project,longSide:number,rated?:Rated|null){
  p=labeled(p,rated);
  const hasLegend=!!(p.areas?.length||markerLegend(p)||(rated&&(rated.groups.some(g=>g.scale)||rated.unrated.length||qualifierGroups(rated).length)));
  const b=contentBounds(p),unit=Math.max(b.width,b.height),pad=unit*.028;
  const footer=unit*(hasLegend ? .14 : .12);
  let width=Math.max(b.width+2*pad,unit*.6),height=b.height+2*pad+footer;
  const right=b.height>b.width,legendWidth=right?unit*.48:width-2*pad,legend=(hasLegend?legendLayout(p,legendWidth,unit*.019,rated):null);
  const legendX=right?width+pad:pad,legendY=right?pad:height+pad;
  if(legend){if(right){width+=legendWidth+2*pad;height=Math.max(height,legend.height+2*pad);}else height+=legend.height+2*pad;}
  const scale=longSide/Math.max(width,height);
  return {b,pad,width,height,scale,pixelWidth:Math.round(width*scale),pixelHeight:Math.round(height*scale),footer,legend,legendX,legendY,legendWidth,planWidth:right&&legend?legendX-pad:width};
}
export async function exportImage(p:Project,longSide:number,format:'png'|'jpeg',rated?:Rated|null,extra=''):Promise<Blob>{
  await ensureInk(p.plan);p=labeled(p,rated);
  const l=exportLayout(p,longSide,rated);const canvas=document.createElement('canvas');canvas.width=l.pixelWidth;canvas.height=l.pixelHeight;
  try {
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Kein Bildspeicher verfügbar.');
    if(l.legend&&l.legend.fs*.85*Math.max(Math.min(595/l.width,842/l.height),Math.min(842/l.width,595/l.height))<8)throw Error('Die Flächenlegende wäre auf DIN A4 zu klein. Bitte Bezeichnungen kürzen oder Kategorien zusammenfassen.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(l.scale,l.scale);
    ctx.save();ctx.translate(l.pad-l.b.x,l.pad-l.b.y);
    // The original, sanitized SVG is decoded here at output scale by the canvas renderer.
    ctx.beginPath();ctx.rect(0,0,p.plan.width,p.plan.height);ctx.clip();ctx.transform(...planMatrix(p.plan));
    const source=preparation(p.plan),base=await loadImage(p.plan.data);ctx.drawImage(base,0,0,source.sourceWidth,source.sourceHeight);
    ctx.restore();
    const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="${l.pixelWidth}" height="${l.pixelHeight}" viewBox="0 0 ${l.width} ${l.height}"><g transform="translate(${l.pad-l.b.x} ${l.pad-l.b.y})">${areaSVG(p.areas||[],p.plan)}${p.markers.map(m=>shownSVG(p,m,false,0,rated?.fill.get(m.id))).join('')}</g></svg>`;
    const url=URL.createObjectURL(new Blob([overlay],{type:'image/svg+xml'}));
    try{ctx.drawImage(await loadImage(url),0,0,l.width,l.height);}finally{URL.revokeObjectURL(url);}
    const fs=Math.max(l.b.width,l.b.height)*(l.legend ? .019 : .0145);const y=l.pad+l.b.height+l.pad;
    ctx.strokeStyle='#a8b1ac';ctx.lineWidth=fs*.05;ctx.beginPath();ctx.moveTo(l.pad,y);ctx.lineTo(l.planWidth-l.pad,y);ctx.stroke();
    ctx.fillStyle='#263b35';ctx.font=`bold ${fs*1.2}px Arial`;const floor=floorName(p),heading=rated?'ERGEBNISKARTE':'PROBENPLAN';ctx.fillText(floor?`${heading} · ${floor}`:heading,l.pad,y+fs*1.9,l.planWidth-2*l.pad);
    ctx.font=`${fs}px Arial`;
    const meta=[p.report?`Gutachten ${p.report}`:'',p.date?`Datum ${p.date.split('-').reverse().join('.')}`:'',extra].filter(Boolean).join('  ·  ');
    ctx.fillText(meta,l.pad,y+fs*3.5,l.planWidth-2*l.pad);
    const ly=y+fs*5.6,r=fs*.6;ctx.strokeStyle='#17665e';ctx.lineWidth=fs*.13;ctx.beginPath();ctx.arc(l.pad+r,ly,r,0,2*Math.PI);ctx.stroke();
    ctx.fillText('P · Probenahmestelle',l.pad+fs*2,ly+fs*.35);
    const bx=l.pad+fs*18;ctx.fillStyle=FIRE_RED;ctx.fill(new Path2D(starPath(bx,ly,r*1.35)));ctx.fillStyle='#263b35';ctx.fillText('Brandherd',bx+fs*1.6,ly+fs*.35);
    if(l.legend)drawLegend(ctx,l.legend,l.legendX,l.legendY);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Der Browser konnte das Bild nicht speichern.')),`image/${format}`,0.96));
    if(blob.size<100)throw Error('Der Bildexport ist leer.');return blob;
  }catch(error){throw Error(`${error instanceof Error?error.message:'Bildexport fehlgeschlagen.'} Bitte die kleinere Exportstufe (3.500 px) wählen oder andere Apps schließen.`);}
  finally{canvas.width=1;canvas.height=1;}
}
