// Name der Word-Anlage Probenahme in „Mitteilungen“ (ohne Importe, damit tests/export-name.mjs ihn ohne Browser prüft).
/** termin (2.7.0): „Termin-20-08-2026“ bzw. „alle-Termine“ im Titelteil. Gekürzt wird nur Nummer und Titel – „_<Termin>_Probenahme_<Datum>“
 *  bleibt immer ganz (BerichtKit und die Projektzentrale finden die Anlage am Ende des Namens). Ohne termin wie bis 2.6.3 – nur ein
 *  Kopf über 53 Zeichen verlor dort „Probenahme“ (die Eingabe erlaubt 40 Zeichen Titel, das kam praktisch nicht vor). */
export function annexFileName(nr:string,title:string,date:string,taken:string[],termin=''){
  const s=(v:string)=>v.normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  const kopf=[s(nr)||'Projekt',s(title)||'Anlage'].join('_'),ende=termin?`_${termin}_Probenahme`:'_Probenahme';
  const base=kopf.slice(0,64-ende.length)+ende+'_'+date,used=new Set(taken.map(n=>n.toLowerCase()));   // bis 53 Zeichen vorn genau wie bis 2.6.3
  for(let i=1;i<1000;i++){const n=`${base}${i>1?`_${i}`:''}.docx`;if(!used.has(n.toLowerCase()))return n;}
  throw Error('Zu viele Anlagen mit gleichem Namen.');
}

