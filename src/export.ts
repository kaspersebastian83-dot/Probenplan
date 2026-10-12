import {bounds, markerSize, markerSVG, type Project} from './model';
import {loadImage} from './import';
import {planMatrix,preparation} from './preparation';
import {areaAnchor,areaCategories,areaSVG,palette} from './areas';
function wrap(ctx:CanvasRenderingContext2D,text:string,width:number){
  const lines:string[]=[];let line='';
  for(const word of text.split(/\s+/)){if(line&&ctx.measureText(`${line} ${word}`).width<=width){line+=` ${word}`;continue;}if(line){lines.push(line);line='';}for(const char of word){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}}
  if(line)lines.push(line);return lines;
}
function legendLayout(p:Project,width:number,fs:number){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('Kein Bildspeicher verfügbar.');
  ctx.font=`bold ${fs}px Arial`;
  let y=fs*2.7;
  const entries=areaCategories(p.areas||[]).map(c=>{const lines=wrap(ctx,c.name,width),top=y;y+=lines.length*fs*1.35+fs*.35;
    const variants=c.variants.map(v=>{ctx.font=`${fs*.85}px Arial`;const ids=wrap(ctx,`${v.labels.join(', ')} · ${Math.round(v.opacity*100)} %`,width-fs*3.2),top=y;y+=Math.max(fs*1.2,ids.length*fs*1.15)+fs*.4;ctx.font=`bold ${fs}px Arial`;return{...v,ids,top};});y+=fs*.8;return{...c,lines,top,variants};});
  return {entries,height:y,fs};
}
export function exportLayout(p:Project,longSide:number){
  const b=bounds(p),unit=Math.max(b.width,b.height),pad=unit*.028;
  // Include area code plates close to the plan boundary in the exported bounds.
  for(const a of p.areas||[]){const c=areaAnchor(a.points),size=Math.max(p.plan.width,p.plan.height)/60,rx=size*Math.max(1,a.label.length*.32),right=b.x+b.width,bottom=b.y+b.height;b.x=Math.min(b.x,c.x-rx);b.y=Math.min(b.y,c.y-size*.72);b.width=Math.max(right,c.x+rx)-b.x;b.height=Math.max(bottom,c.y+size*.72)-b.y;}
  const footer=unit*(p.areas?.length ? .14 : .12);
  let width=Math.max(b.width+2*pad,unit*.6),height=b.height+2*pad+footer;
  const right=b.height>b.width,legendWidth=right?unit*.48:width-2*pad,legend=(p.areas?.length?legendLayout(p,legendWidth,unit*.019):null);
  const legendX=right?width+pad:pad,legendY=right?pad:height+pad;
  if(legend){if(right){width+=legendWidth+2*pad;height=Math.max(height,legend.height+2*pad);}else height+=legend.height+2*pad;}
  const scale=longSide/Math.max(width,height);
  return {b,pad,width,height,scale,pixelWidth:Math.round(width*scale),pixelHeight:Math.round(height*scale),footer,legend,legendX,legendY,legendWidth,planWidth:right&&legend?legendX-pad:width};
}
export async function exportImage(p:Project,longSide:number,format:'png'|'jpeg'):Promise<Blob>{
  const l=exportLayout(p,longSide);const canvas=document.createElement('canvas');canvas.width=l.pixelWidth;canvas.height=l.pixelHeight;
  try {
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Kein Bildspeicher verfügbar.');
    if(l.legend&&l.legend.fs*.85*Math.max(Math.min(595/l.width,842/l.height),Math.min(842/l.width,595/l.height))<8)throw Error('Die Flächenlegende wäre auf DIN A4 zu klein. Bitte Bezeichnungen kürzen oder Kategorien zusammenfassen.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(l.scale,l.scale);
    ctx.save();ctx.translate(l.pad-l.b.x,l.pad-l.b.y);
    // The original, sanitized SVG is decoded here at output scale by the canvas renderer.
    ctx.beginPath();ctx.rect(0,0,p.plan.width,p.plan.height);ctx.clip();ctx.transform(...planMatrix(p.plan));
    const source=preparation(p.plan),base=await loadImage(p.plan.data);ctx.drawImage(base,0,0,source.sourceWidth,source.sourceHeight);
    ctx.restore();
    const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="${l.pixelWidth}" height="${l.pixelHeight}" viewBox="0 0 ${l.width} ${l.height}"><g transform="translate(${l.pad-l.b.x} ${l.pad-l.b.y})">${areaSVG(p.areas||[],p.plan)}${p.markers.map(m=>markerSVG(p,m)).join('')}</g></svg>`;
    const url=URL.createObjectURL(new Blob([overlay],{type:'image/svg+xml'}));
    try{ctx.drawImage(await loadImage(url),0,0,l.width,l.height);}finally{URL.revokeObjectURL(url);}
    const fs=Math.max(l.b.width,l.b.height)*(l.legend ? .019 : .0145);const y=l.pad+l.b.height+l.pad;
    ctx.strokeStyle='#a8b1ac';ctx.lineWidth=fs*.05;ctx.beginPath();ctx.moveTo(l.pad,y);ctx.lineTo(l.planWidth-l.pad,y);ctx.stroke();
    ctx.fillStyle='#263b35';ctx.font=`bold ${fs*1.2}px Arial`;ctx.fillText('PROBENPLAN',l.pad,y+fs*1.9);
    ctx.font=`${fs}px Arial`;
    const meta=[p.report?`Gutachten ${p.report}`:'',p.date?`Datum ${p.date.split('-').reverse().join('.')}`:''].filter(Boolean).join('  ·  ');
    ctx.fillText(meta,l.pad,y+fs*3.5,l.planWidth-2*l.pad);
    const ly=y+fs*5.6,r=fs*.6;ctx.strokeStyle='#17665e';ctx.lineWidth=fs*.13;ctx.beginPath();ctx.arc(l.pad+r,ly,r,0,2*Math.PI);ctx.stroke();
    ctx.fillText('P · Probenahmestelle',l.pad+fs*2,ly+fs*.35);
    const bx=l.pad+fs*18;ctx.strokeStyle='#ae4328';ctx.beginPath();ctx.moveTo(bx,ly-r);ctx.lineTo(bx+r,ly);ctx.lineTo(bx,ly+r);ctx.lineTo(bx-r,ly);ctx.closePath();ctx.stroke();ctx.fillText('B · Brandherd',bx+fs*1.6,ly+fs*.35);
    if(l.legend){const {fs,entries}=l.legend,x=l.legendX,y=l.legendY;
      ctx.fillStyle='#263b35';ctx.font=`bold ${fs*1.15}px Arial`;ctx.fillText('Flächenkennzeichnung',x,y+fs*1.2);
      for(const c of entries){ctx.fillStyle='#263b35';ctx.font=`bold ${fs}px Arial`;c.lines.forEach((line,i)=>ctx.fillText(line,x,y+c.top+i*fs*1.35));
        for(const v of c.variants){const top=y+v.top-fs*.8,w=fs*2.2,h=fs*.9,pal=palette(v.color);ctx.fillStyle=v.color;ctx.globalAlpha=v.opacity;ctx.fillRect(x,top,w,h);ctx.globalAlpha=1;ctx.strokeStyle=pal.outline;ctx.lineWidth=fs*.08;ctx.setLineDash(pal.dash.map(n=>n*fs*.08));ctx.strokeRect(x,top,w,h);ctx.setLineDash([]);ctx.fillStyle='#263b35';ctx.font=`${fs*.85}px Arial`;v.ids.forEach((line,i)=>ctx.fillText(line,x+fs*3.2,y+v.top+i*fs*1.15));}
      }
    }
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Der Browser konnte das Bild nicht speichern.')),`image/${format}`,0.96));
    if(blob.size<100)throw Error('Der Bildexport ist leer.');return blob;
  }catch(error){throw Error(`${error instanceof Error?error.message:'Bildexport fehlgeschlagen.'} Bitte die kleinere Exportstufe (3.500 px) wählen oder andere Apps schließen.`);}
  finally{canvas.width=1;canvas.height=1;}
}
