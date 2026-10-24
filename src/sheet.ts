import {labeled} from './labels';
// Druckblatt A4/A3: Plan in genormtem Maßstab, Legende, Nordpfeil, Maßstabsleiste und Schriftfeld.
// Alle Maße in Millimetern; gerendert wird mit fester Auflösung, sodass 1 mm auf dem Blatt exakt stimmt.
import {floorName,metersPerUnit,northAngle,starPath,FIRE_RED,type Project} from './model';
import {contentBounds,drawLegend,drawPlanContent,legendLayout,wrap} from './export';
import {loadImage} from './import';
import type {Rated} from './results';
import {vorlaeufigeBerichte,vorlaeufigText} from './lab-provenance';
// Als data:-URL eingebettet: das Blatt lädt beim Export nichts nach (offline sicher, unabhängig vom Service Worker).
import logoUrl from './assets/firmenlogo.png?inline';

export const COMPANY={name:'Dr. Schiffers & Partner',address:'Gouleystr. 59 · 52146 Würselen'};
export type Paper='a4'|'a3'|'anlage'|'bild';
/** „anlage“: Planseite für die Word-Anlage – passt hochkant in den Textbereich des Berichts (A4, 25 mm Ränder,
 *  Briefkopf oben), ohne eigenen Heftrand. Das Bild wird in Word in genau dieser Größe eingesetzt, der Maßstab bleibt. */
export const PAPERS:Record<Paper,{long:number;short:number;label:string}>={a4:{long:297,short:210,label:'A4'},a3:{long:420,short:297,label:'A3'},anlage:{long:192,short:159,label:'Anlage'},bild:{long:297,short:210,label:'Bild'}};
/** „bild“: PNG/JPG fürs Gutachten im Seitenverhältnis A4, ohne Heftrand – mit Schriftfeld, Firmenlogo, Legende und Maßstabsleiste wie das PDF. */
/** Genormte Maßstäbe 1:N, aufsteigend. */
export const SCALES=[10,20,25,50,100,200,250,500,1000,2000,2500,5000];
const MARGIN={left:20,top:10,right:10,bottom:10},NO_MARGIN={left:.3,top:.3,right:.3,bottom:.3},PAD=3,TITLE_H=46,NS_H=24;
const title=(paper:Paper)=>({width:paper==='a3'?100:82});
const font=(paper:Paper)=>paper==='a3'?2.8:2.5;
interface Box {x:number;y:number;w:number;h:number}
export interface SheetLayout {
  paper:Paper;landscape:boolean;width:number;height:number;style:'side'|'band';
  frame:Box;plan:Box;legend:Box;ns:Box;title:Box;
  /** Maßstabszahl N (1:N) oder null ohne Kalibrierung. */
  ratio:number|null;
  /** Millimeter auf dem Blatt je Planeinheit. */
  mmPerUnit:number;
  bounds:{x:number;y:number;width:number;height:number};
}
/** Höhe der Legende in mm für eine Spaltenbreite in mm (Messung bei 10 px/mm). */
function legendHeight(p:Project,rated:Rated|null|undefined,width:number,fs:number){
  const l=legendLayout(p,width*10,fs*10,rated);
  return 2*fs*1.7+fs*1.8+(l.entries.length?l.height/10:0)+2;
}
/** Ergebniskarte mit Werten aus einem vorläufigen Prüfbericht: Hinweistext für Legende und Schriftfeld, sonst ''. */
export const vorlaeufigHinweis=(p:Project,rated:Rated|null|undefined)=>rated?vorlaeufigText(vorlaeufigeBerichte(p)):'';
const VORLAEUFIG_ROT='#B3261E';
function hasLegendEntries(p:Project,rated?:Rated|null){return legendLayout(p,1000,10,rated).entries.length>0;}
/** Wählt Ausrichtung und Anordnung mit dem größten genormten Maßstab (bzw. der größten Darstellung ohne Kalibrierung). */
export function sheetLayout(p:Project,paper:Paper,rated?:Rated|null):SheetLayout{
  p=labeled(p,rated);
  const b=contentBounds(p),mpu=metersPerUnit(p.plan),fs=font(paper),tw=title(paper).width;
  const candidates:SheetLayout[]=[];
  // Reihenfolge = Vorrang bei gleichem Maßstab: quer mit Seitenleiste, hoch mit Fußleiste.
  const M=paper==='anlage'||paper==='bild'?NO_MARGIN:MARGIN;
  for(const landscape of (paper==='anlage'?[false]:[true,false]))for(const style of (landscape?['side','band']:['band','side']) as ('side'|'band')[]){
    const width=landscape?PAPERS[paper].long:PAPERS[paper].short,height=landscape?PAPERS[paper].short:PAPERS[paper].long;
    const frame={x:M.left,y:M.top,w:width-M.left-M.right,h:height-M.top-M.bottom};
    let plan:Box,legend:Box,ns:Box,titleBox:Box;
    if(style==='side'){
      const x=frame.x+frame.w-tw;titleBox={x,y:frame.y+frame.h-TITLE_H,w:tw,h:TITLE_H};ns={x,y:titleBox.y-NS_H,w:tw,h:NS_H};legend={x,y:frame.y,w:tw,h:ns.y-frame.y};
      if(legendHeight(p,rated,tw-2*PAD,fs)*1.04>legend.h)continue;
      plan={x:frame.x,y:frame.y,w:frame.w-tw,h:frame.h};
    }else{
      const left=frame.w-tw,need=legendHeight(p,rated,left-2*PAD,fs)*1.04,band=Math.max(TITLE_H,need+NS_H);
      if(band>frame.h*.45||left<70)continue;
      const y=frame.y+frame.h-band;titleBox={x:frame.x+left,y:frame.y+frame.h-TITLE_H,w:tw,h:TITLE_H};legend={x:frame.x,y,w:left,h:band-NS_H};ns={x:frame.x,y:frame.y+frame.h-NS_H,w:left,h:NS_H};
      plan={x:frame.x,y:frame.y,w:frame.w,h:frame.h-band};
    }
    const iw=plan.w-2*PAD*2,ih=plan.h-2*PAD*2;if(iw<=0||ih<=0)continue;
    let ratio:number|null=null,mm:number;
    if(mpu){const found=SCALES.find(n=>b.width*mpu*1000/n<=iw&&b.height*mpu*1000/n<=ih);if(found){ratio=found;mm=mpu*1000/found;}else mm=Math.min(iw/b.width,ih/b.height);}
    else mm=Math.min(iw/b.width,ih/b.height);
    candidates.push({paper,landscape,width,height,style,frame,plan,legend,ns,title:titleBox,ratio,mmPerUnit:mm,bounds:b});
  }
  if(!candidates.length)throw Error(paper==='bild'?'Die Legende passt nicht neben das Schriftfeld. Bitte Bezeichnungen kürzen, Kategorien zusammenfassen oder „Mit Schriftfeld“ abwählen.':paper==='anlage'?'Die Legende passt nicht auf die Planseite der Anlage. Bitte Bezeichnungen kürzen bzw. Kategorien zusammenfassen.':`Die Legende passt nicht auf ${PAPERS[paper].label}. Bitte ${paper==='a4'?'A3 wählen oder ':''}Bezeichnungen kürzen bzw. Kategorien zusammenfassen.`);
  // Größter Maßstab (kleinstes N) gewinnt; bei Gleichstand die größere Darstellung, sonst die Reihenfolge oben.
  return candidates.reduce((best,c)=>{const nb=best.ratio??Infinity,nc=c.ratio??Infinity;if(nc!==nb)return nc<nb?c:best;return c.mmPerUnit>best.mmPerUnit*1.0001?c:best;});
}
/** Schöne Gesamtlänge der Maßstabsleiste in Metern und Zahl der Felder. */
export function scaleBar(ratio:number,maxMm:number){
  const options=[.1,.2,.25,.5,1,2,2.5,5,10,20,25,50,100,200,250,500,1000,2000,2500,5000];
  let meters=options[0];for(const m of options)if(m*1000/ratio<=maxMm)meters=m;
  const lead=Number(String(meters).replace(/[0.]/g,'')[0]);
  return {meters,segments:lead===2&&!String(meters).includes('25')?4:5,mm:meters*1000/ratio};
}
const de=(n:number)=>n.toLocaleString('de-DE',{maximumFractionDigits:2});
export interface SheetInfo {objekt:string;page:number;pages:number}
/** Rendert ein Blatt als Canvas in dpi; gibt das Canvas zurück (Aufrufer gibt Speicher frei). */
export async function renderSheet(p:Project,layout:SheetLayout,rated:Rated|null|undefined,info:SheetInfo,dpi:number){
  p=labeled(p,rated);
  const k=dpi/25.4,canvas=document.createElement('canvas');canvas.width=Math.round(layout.width*k);canvas.height=Math.round(layout.height*k);
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Kein Bildspeicher verfügbar.');
  const L=layout,fs=font(L.paper),ink='#1d2a33',muted='#5d6b66',line=(w:number)=>{ctx.lineWidth=w*k;ctx.strokeStyle=ink;};
  const text=(s:string,x:number,y:number,size:number,opts:{bold?:boolean;color?:string;max?:number;align?:CanvasTextAlign}={})=>{ctx.font=`${opts.bold?'bold ':''}${size*k}px Arial`;ctx.fillStyle=opts.color||ink;ctx.textAlign=opts.align||'left';ctx.fillText(s,x*k,y*k,opts.max?opts.max*k:undefined);ctx.textAlign='left';};
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  // Plan in exaktem Maßstab, zentriert im Planfeld.
  const b=L.bounds,w=b.width*L.mmPerUnit,h=b.height*L.mmPerUnit,x0=L.plan.x+(L.plan.w-w)/2,y0=L.plan.y+(L.plan.h-h)/2;
  ctx.save();ctx.beginPath();ctx.rect(L.plan.x*k,L.plan.y*k,L.plan.w*k,L.plan.h*k);ctx.clip();
  await drawPlanContent(ctx,p,b,x0*k,y0*k,L.mmPerUnit*k,rated);ctx.restore();
  // Rahmen und Felder.
  line(.5);ctx.strokeRect(L.frame.x*k,L.frame.y*k,L.frame.w*k,L.frame.h*k);
  line(.35);
  if(L.style==='side'){ctx.beginPath();ctx.moveTo(L.legend.x*k,L.frame.y*k);ctx.lineTo(L.legend.x*k,(L.frame.y+L.frame.h)*k);ctx.stroke();}
  else{ctx.beginPath();ctx.moveTo(L.frame.x*k,L.legend.y*k);ctx.lineTo((L.frame.x+L.frame.w)*k,L.legend.y*k);ctx.moveTo(L.title.x*k,L.legend.y*k);ctx.lineTo(L.title.x*k,(L.frame.y+L.frame.h)*k);ctx.stroke();}
  for(const box of [L.ns,L.title]){ctx.beginPath();ctx.moveTo(box.x*k,box.y*k);ctx.lineTo((box.x+box.w)*k,box.y*k);ctx.stroke();}
  // Legende: Symbole P/B, danach Flächen bzw. Ergebnisklassen.
  {const x=L.legend.x+PAD;let y=L.legend.y+PAD+fs*1.2;text('Legende',x,y,fs*1.15,{bold:true});y+=fs*1.9;
    const r=fs*.55;ctx.lineWidth=fs*.13*k;ctx.strokeStyle='#17665e';ctx.beginPath();ctx.arc((x+r)*k,(y-fs*.35)*k,r*k,0,2*Math.PI);ctx.stroke();text('P · Probenahmestelle',x+fs*2,y,fs*.9);y+=fs*1.7;
    {const cx=x+r,cy=y-fs*.35,f=ctx.fillStyle;ctx.fillStyle=FIRE_RED;ctx.fill(new Path2D(starPath(cx*k,cy*k,r*1.35*k)));ctx.fillStyle=f;}text('Brandherd',x+fs*2,y,fs*.9);y+=fs*.6;
    if(hasLegendEntries(p,rated)){const legend=legendLayout(p,(L.legend.w-2*PAD)*k,fs*k,rated);drawLegend(ctx,legend,x*k,y*k);}
    // Vorläufiger Prüfbericht: „VORLÄUFIG“ steht immer im Schriftfeld; der ausführliche Hinweis unten in der Legende, wenn dort Platz frei ist
    // (die Aufteilung des Blatts – und damit der Maßstab – ändert sich dadurch nicht)
    const v=vorlaeufigHinweis(p,rated);
    const size=fs*.85;ctx.font=`${size*k}px Arial`;const lines=v?wrap(ctx,v,(L.legend.w-2*PAD)*k):[],frei=L.legend.h-legendHeight(p,rated,L.legend.w-2*PAD,fs);
    if(v&&frei>=lines.length*size*1.25+PAD){let yy=L.legend.y+L.legend.h-PAD-(lines.length-1)*size*1.25;
      for(const [i,l] of lines.entries()){text(l,x,yy,size,{color:VORLAEUFIG_ROT});yy+=size*1.25;}}}
  // Nordpfeil und Maßstabsleiste.
  {const north=northAngle(p.plan),cy=L.ns.y+L.ns.h/2;let x=L.ns.x+PAD;
    if(north!==null){const r=7.5,cx=x+r;ctx.save();ctx.translate(cx*k,cy*k);ctx.lineWidth=.25*k;ctx.strokeStyle=ink;ctx.beginPath();ctx.arc(0,0,r*k,0,2*Math.PI);ctx.stroke();ctx.rotate(north*Math.PI/180);
      ctx.beginPath();ctx.moveTo(0,-(r-1.2)*k);ctx.lineTo(2.4*k,(r-2.8)*k);ctx.lineTo(0,(r-4.2)*k);ctx.closePath();ctx.fillStyle='#fff';ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,-(r-1.2)*k);ctx.lineTo(-2.4*k,(r-2.8)*k);ctx.lineTo(0,(r-4.2)*k);ctx.closePath();ctx.fillStyle=ink;ctx.fill();
      ctx.font=`bold ${3*k}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';const t=-(r+2.6);ctx.translate(0,t*k);ctx.rotate(-north*Math.PI/180);ctx.fillText('N',0,0);ctx.restore();ctx.textBaseline='alphabetic';x=cx+r+5;}
    const room=L.ns.x+L.ns.w-PAD-x;
    if(L.ratio){const bar=scaleBar(L.ratio,Math.min(room-6,90)),seg=bar.mm/bar.segments,top=cy-1.6,hgt=2;
      text(`Maßstab 1:${L.ratio.toLocaleString('de-DE')}`,x,top-3.4,fs*1.05,{bold:true});
      for(let i=0;i<bar.segments;i++){ctx.fillStyle=i%2?'#fff':ink;ctx.fillRect((x+i*seg)*k,top*k,seg*k,hgt*k);}
      line(.25);ctx.strokeRect(x*k,top*k,bar.mm*k,hgt*k);
      const labelEvery=seg>=7?1:seg*2>=7?2:bar.segments;
      for(let i=0;i<=bar.segments;i++)if(i%labelEvery===0||i===bar.segments)text(i===bar.segments?`${de(bar.meters)} m`:de(bar.meters/bar.segments*i),x+i*seg,top+hgt+3.2,fs*.85,{align:i===0?'left':'center'});
      text(L.paper==='bild'?'1:N gilt bei Wiedergabe in A4-Größe; die Leiste gilt immer':'Drucken mit „Tatsächliche Größe“ (100 %)',x,top+hgt+7.2,fs*.72,{color:muted,max:room});
    }else{text('Ohne Maßstab',x,cy-1,fs*1.05,{bold:true});text('Plan nicht kalibriert – Strecke messen in der Liste',x,cy+3,fs*.8,{color:muted,max:room});}
  }
  // Schriftfeld.
  {const T=L.title,logo=await loadImage(logoUrl,'Firmenlogo'),lh=11,lw=lh*logo.naturalWidth/logo.naturalHeight;
    ctx.drawImage(logo,(T.x+PAD)*k,(T.y+2)*k,lw*k,lh*k);
    const tx=T.x+PAD+lw+3,tmax=T.x+T.w-PAD-tx;text(COMPANY.name,tx,T.y+7,3.4,{bold:true,max:tmax});text(COMPANY.address,tx,T.y+11.4,2.3,{color:muted,max:tmax});
    line(.25);let y=T.y+15;ctx.beginPath();ctx.moveTo(T.x*k,y*k);ctx.lineTo((T.x+T.w)*k,y*k);ctx.stroke();
    const floor=floorName(p),heading=rated?'ERGEBNISKARTE':'PROBENPLAN',vorl=!!vorlaeufigHinweis(p,rated),vw=vorl?17:0;
    text(floor?`${heading} · ${floor}`:heading,T.x+PAD,y+6.6,4.2,{bold:true,max:T.w-2*PAD-vw});
    if(vorl)text('VORLÄUFIG',T.x+T.w-PAD,y+6.4,2.9,{bold:true,color:VORLAEUFIG_ROT,align:'right'});
    y+=10;ctx.beginPath();ctx.moveTo(T.x*k,y*k);ctx.lineTo((T.x+T.w)*k,y*k);ctx.stroke();
    const field=(label:string,value:string,x:number,top:number,width:number)=>{text(label,x+PAD,top+2.5,1.9,{color:muted});ctx.font=`${2.8*k}px Arial`;const lines=wrap(ctx,value||'–',(width-2*PAD)*k);text(lines.length>1?`${lines[0].replace(/\s*\S*$/,'')} …`:lines[0],x+PAD,top+6,2.8,{max:width-2*PAD});};
    const half=T.w/2,rowH=7;
    field('Objekt',info.objekt,T.x,y,T.w);y+=rowH;ctx.beginPath();ctx.moveTo(T.x*k,y*k);ctx.lineTo((T.x+T.w)*k,y*k);ctx.moveTo((T.x+half)*k,y*k);ctx.lineTo((T.x+half)*k,(T.y+T.h)*k);ctx.stroke();
    field('Gutachten-Nr.',p.report,T.x,y,half);field('Datum',p.date?p.date.split('-').reverse().join('.'):'',T.x+half,y,half);y+=rowH;ctx.beginPath();ctx.moveTo(T.x*k,y*k);ctx.lineTo((T.x+T.w)*k,y*k);ctx.stroke();
    field('Maßstab',L.ratio?`M 1:${L.ratio.toLocaleString('de-DE')}${L.paper==='bild'?' (bei A4)':''}`:'ohne (nicht kalibriert)',T.x,y,half);
    field('Blatt',L.paper==='anlage'?`Anlage${info.pages>1?` · Plan ${info.page}/${info.pages}`:''}`:L.paper==='bild'?`Bild${info.pages>1?` · Plan ${info.page}/${info.pages}`:''}`:`${PAPERS[L.paper].label} ${L.landscape?'quer':'hoch'}${info.pages>1?` · ${info.page}/${info.pages}`:''}`,T.x+half,y,half);
  }
  return canvas;
}
