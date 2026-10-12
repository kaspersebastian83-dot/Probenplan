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
