// Minimaler PDF-Schreiber: je Seite ein verlustfrei (Flate) komprimiertes RGB-Rasterbild in exakter Blattgröße.
// Keine Fremdbibliothek; das Bild wird in Originalmaßen platziert, damit der Maßstab auf dem Ausdruck stimmt.
import {zlibSync} from 'fflate';
export interface PdfPage {widthMm:number;heightMm:number;pixelWidth:number;pixelHeight:number;rgb:Uint8Array}
const PT=72/25.4;
const enc=new TextEncoder();
/** Text als UTF-16BE mit BOM (für Umlaute in den Dokumenteigenschaften). */
function pdfText(s:string){let hex='FEFF';for(const ch of s){const c=ch.codePointAt(0)!;const units=c>0xffff?[0xd800+((c-0x10000)>>10),0xdc00+((c-0x10000)&0x3ff)]:[c];for(const u of units)hex+=u.toString(16).padStart(4,'0').toUpperCase();}return `<${hex}>`;}
function pdfDate(d:Date){const z=(n:number)=>String(n).padStart(2,'0');return `(D:${d.getUTCFullYear()}${z(d.getUTCMonth()+1)}${z(d.getUTCDate())}${z(d.getUTCHours())}${z(d.getUTCMinutes())}${z(d.getUTCSeconds())}Z)`;}
const num=(n:number)=>(Math.round(n*1000)/1000).toString();
/** Canvas-Inhalt (RGBA) als RGB-Bytes – Hintergrund ist weiß, Transparenz entfällt. */
export function canvasRGB(canvas:HTMLCanvasElement){
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Kein Bildspeicher verfügbar.');
  const rgb=new Uint8Array(canvas.width*canvas.height*3),rows=Math.max(1,Math.floor(4_000_000/canvas.width));
  // Zeilenweise lesen hält den Spitzenbedarf an Arbeitsspeicher klein.
  for(let y=0;y<canvas.height;y+=rows){const h=Math.min(rows,canvas.height-y),data=ctx.getImageData(0,y,canvas.width,h).data;let o=y*canvas.width*3;for(let i=0;i<data.length;i+=4){rgb[o++]=data[i];rgb[o++]=data[i+1];rgb[o++]=data[i+2];}}
  return rgb;
}
export function buildPdf(pages:PdfPage[],info:{title:string;subject?:string;author?:string}):Blob{
  const parts:Uint8Array[]=[],offsets:number[]=[];let length=0;
  const push=(chunk:Uint8Array|string)=>{const b=typeof chunk==='string'?enc.encode(chunk):chunk;parts.push(b);length+=b.length;};
  const object=(id:number,body:string,stream?:Uint8Array)=>{offsets[id]=length;push(`${id} 0 obj\n${body}\n`);if(stream){push('stream\n');push(stream);push('\nendstream\n');}push('endobj\n');};
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'.replace(/[\u0080-ÿ]/g,c=>c));
  // Objekte: 1 Katalog, 2 Seitenbaum, 3 Info, danach je Seite: Seite, Inhalt, Bild.
  const pageIds=pages.map((_,i)=>4+i*3);
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  object(3,`<< /Title ${pdfText(info.title)}${info.subject?` /Subject ${pdfText(info.subject)}`:''}${info.author?` /Author ${pdfText(info.author)}`:''} /Creator (PlanKit) /Producer (PlanKit) /CreationDate ${pdfDate(new Date())} >>`);
  pages.forEach((page,i)=>{
    const id=pageIds[i],w=page.widthMm*PT,h=page.heightMm*PT;
    const content=enc.encode(`q ${num(w)} 0 0 ${num(h)} 0 0 cm /Im0 Do Q`);
    object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(w)} ${num(h)}] /Resources << /XObject << /Im0 ${id+2} 0 R >> >> /Contents ${id+1} 0 R >>`);
    object(id+1,`<< /Length ${content.length} >>`,content);
    const data=zlibSync(page.rgb,{level:6});
    object(id+2,`<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Interpolate false /Filter /FlateDecode /Length ${data.length} >>`,data);
  });
  const count=4+pages.length*3,xref=length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for(let id=1;id<count;id++)push(`${String(offsets[id]).padStart(10,'0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[],{type:'application/pdf'});
}
