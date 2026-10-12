import {bounds, markerSize, markerSVG, type Project} from './model';
import {loadImage} from './import';
export function exportLayout(p:Project,longSide:number){
  const b=bounds(p),unit=Math.max(b.width,b.height),pad=unit*.028;
  const width=Math.max(b.width+2*pad,unit*.6),height=b.height+2*pad+unit*.12;
  const scale=longSide/Math.max(width,height);
  return {b,pad,width,height,scale,pixelWidth:Math.round(width*scale),pixelHeight:Math.round(height*scale),footer:unit*.12};
}
export async function exportImage(p:Project,longSide:number,format:'png'|'jpeg'):Promise<Blob>{
  const l=exportLayout(p,longSide);const canvas=document.createElement('canvas');canvas.width=l.pixelWidth;canvas.height=l.pixelHeight;
  try {
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Kein Bildspeicher verfügbar.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(l.scale,l.scale);
    ctx.save();ctx.translate(l.pad-l.b.x,l.pad-l.b.y);
    // The original, sanitized SVG is decoded here at output scale by the canvas renderer.
    const base=await loadImage(p.plan.data);ctx.drawImage(base,0,0,p.plan.width,p.plan.height);
    ctx.restore();
    const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="${l.pixelWidth}" height="${l.pixelHeight}" viewBox="0 0 ${l.width} ${l.height}"><g transform="translate(${l.pad-l.b.x} ${l.pad-l.b.y})">${p.markers.map(m=>markerSVG(p,m)).join('')}</g></svg>`;
    const url=URL.createObjectURL(new Blob([overlay],{type:'image/svg+xml'}));
    try{ctx.drawImage(await loadImage(url),0,0,l.width,l.height);}finally{URL.revokeObjectURL(url);}
    const fs=Math.max(l.b.width,l.b.height)*.0145;const y=l.pad+l.b.height+l.pad;
    ctx.strokeStyle='#a8b1ac';ctx.lineWidth=fs*.05;ctx.beginPath();ctx.moveTo(l.pad,y);ctx.lineTo(l.width-l.pad,y);ctx.stroke();
    ctx.fillStyle='#263b35';ctx.font=`bold ${fs*1.2}px Arial`;ctx.fillText('PROBENPLAN',l.pad,y+fs*1.9);
    ctx.font=`${fs}px Arial`;
    const meta=[p.report?`Gutachten ${p.report}`:'',p.date?`Datum ${p.date.split('-').reverse().join('.')}`:''].filter(Boolean).join('  ·  ');
    ctx.fillText(meta,l.pad,y+fs*3.5,l.width-2*l.pad);
    const ly=y+fs*5.6,r=fs*.6;ctx.strokeStyle='#17665e';ctx.lineWidth=fs*.13;ctx.beginPath();ctx.arc(l.pad+r,ly,r,0,2*Math.PI);ctx.stroke();
    ctx.fillText('P · Probenahmestelle',l.pad+fs*2,ly+fs*.35);
    const bx=l.pad+fs*18;ctx.strokeStyle='#ae4328';ctx.beginPath();ctx.moveTo(bx,ly-r);ctx.lineTo(bx+r,ly);ctx.lineTo(bx,ly+r);ctx.lineTo(bx-r,ly);ctx.closePath();ctx.stroke();ctx.fillText('B · Brandherd',bx+fs*1.6,ly+fs*.35);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Der Browser konnte das Bild nicht speichern.')),`image/${format}`,0.96));
    if(blob.size<100)throw Error('Der Bildexport ist leer.');return blob;
  }catch(error){throw Error(`${error instanceof Error?error.message:'Bildexport fehlgeschlagen.'} Bitte die kleinere Exportstufe (3.500 px) wählen oder andere Apps schließen.`);}
  finally{canvas.width=1;canvas.height=1;}
}
