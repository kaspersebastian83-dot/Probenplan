// Only synthetic geometry. Fixtures are generated into ignored .test-output/.
export function syntheticPDF(pages=[{width:600,height:800}]){
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids=[];
  pages.forEach(({width:w,height:h},i)=>{
    const index=objects.length+1;kids.push(`${index} 0 R`);
    const content=`1 1 1 rg 0 0 ${w} ${h} re f\n0 0 0 RG 4 w 30 30 ${w-60} ${h-60} re S\n0.9 0.1 0.05 rg 50 ${h-100} 50 50 re f\n0.05 0.6 0.2 rg ${w-100} 50 50 50 re f\n0 0 0 RG 3 w 150 150 ${w-300} ${h-300} re S\n150 ${h/2} m ${w-150} ${h/2} l S\n${w/2} 150 m ${w/2} ${h-150} l S\n0 0 0 rg BT /F1 20 Tf 120 ${h-80} Td (SYNTHETISCHER TESTPLAN ${i+1}) Tj ET\nBT /F1 14 Tf 180 ${h/2+35} Td (Raum A - Seite ${i+1}) Tj ET\n`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${index+1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`);
  });
  objects[1]=`<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>`;
  let text='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=Buffer.byteLength(text);text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(text);
}
export function orientJPEG(jpeg,orientation=6){
  // Little-endian EXIF orientation entry; decoder must rotate pixels before display/export.
  const exif=Buffer.from([0x45,0x78,0x69,0x66,0,0,0x49,0x49,42,0,8,0,0,0,1,0,0x12,1,3,0,1,0,0,0,orientation,0,0,0,0,0,0,0]);
  const header=Buffer.alloc(4);header[0]=255;header[1]=225;header.writeUInt16BE(exif.length+2,2);return Buffer.concat([jpeg.subarray(0,2),header,exif,jpeg.subarray(2)]);
}

// Entirely invented plan and font; never read examples or user exports.
// The WOFF uses self-authored geometric glyphs, not a third-party font.
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {zipSync,strToU8} from 'fflate';
export const syntheticFont=readFileSync(new URL('./resources/synthetic-plan.woff',import.meta.url));
export const syntheticFontStyle=`<style>@font-face{font-family:'Synthetic Plan';src:url(data:font/woff;base64,${syntheticFont.toString('base64')}) format('woff');}text{font-family:'Synthetic Plan';}</style>`;
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,bytes){const data=Buffer.concat([Buffer.from(type),bytes]),result=Buffer.alloc(bytes.length+12);result.writeUInt32BE(bytes.length);data.copy(result,4);result.writeUInt32BE(crc32(data),result.length-4);return result;}
export function syntheticPNG(width=914,height=1200){
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 const rows=Buffer.alloc(height*(1+width*3),255);
 for(let y=0;y<height;y++){const start=y*(1+width*3);rows[start]=0;for(let x=0;x<width;x++){const wall=x<12||y<12||x>=width-12||y>=height-12||Math.abs(x-width/2)<4||Math.abs(y-height/2)<4;const i=start+1+x*3;if(wall)rows[i]=rows[i+1]=rows[i+2]=35;else if(x>width*.7&&y<height*.2){rows[i]=215;rows[i+1]=61;rows[i+2]=39;}}}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
export function syntheticPolycam(){
 const png=syntheticPNG(),root='Polycam Export - Synthetic Building/Floor Plans/';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="914" height="1200" viewBox="0 0 914 1200"><defs>${syntheticFontStyle}</defs><rect width="914" height="1200" fill="white"/><path d="M20 20H894V1180H20Z M20 600H894 M457 20V1180" stroke="#222" stroke-width="8" fill="none"/><path d="M350 600v-70a70 70 0 0 1 70 70" stroke="#555" stroke-width="3" fill="none"/><text x="80" y="120" font-size="30">Badezimmer ÄÖÜ</text><text x="520" y="120" font-size="30">Raum A</text><text x="80" y="1080" font-size="24">SYNTHETISCHER TESTPLAN</text><image x="750" y="80" width="80" height="80" href="data:image/png;base64,${syntheticPNG(32,32).toString('base64')}"/></svg>`;
 const files={
  [`${root}Ground Floor.svg`]:strToU8(svg),[`${root}Ground Floor.png`]:png,
  [`${root}Ground Floor.pdf`]:syntheticPDF(),
  ['Polycam Export - Synthetic Building/Resources/synthetic-plan.woff']:syntheticFont,
  ['Polycam Export - Synthetic Building/metadata.json']:strToU8(JSON.stringify({synthetic:true,units:'meters',floor:'Ground Floor'})),
  ['__MACOSX/._Ground Floor.svg']:strToU8('Ignored synthetic metadata'),
 };
 return {name:'synthetic-polycam.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync(files)),svg,png,files,width:914,height:1200};
}
export function syntheticProject(){const {svg,width,height}=syntheticPolycam();return {format:'probenplan',version:1,plan:{name:'synthetic.svg',data:`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,width,height,vector:true},markers:['P1','P3','P4','P20','B1'].map((label,i)=>({id:`synthetic-${i}`,kind:i===4?'fire':'sample',label,note:i===0?'Synthetische Notiz':'',x:200+i*100,y:300+i*100,lx:200+i*100,ly:300+i*100})),nextSample:21,nextFire:2,report:'TEST-2026',date:'2026-10-12'};}
