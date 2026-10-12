import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy,type PDFDocumentLoadingTask} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerURL from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import type {Plan} from './model';
GlobalWorkerOptions.workerSrc=workerURL;
const assets=new URL(`${import.meta.env.BASE_URL}pdfjs/`,document.baseURI).href;
const mobile=()=>/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)||((navigator as Navigator & {deviceMemory?:number}).deviceMemory||8)<=4;
async function deadline<T>(promise:Promise<T>,cancel:()=>void,label:string):Promise<T>{
  let timer=0;try{return await Promise.race([promise,new Promise<T>((_r,reject)=>{timer=window.setTimeout(()=>{cancel();reject(Error(`${label} dauert zu lange. Bitte eine einfachere PDF oder ein Planbild verwenden.`));},45_000);})]);}finally{clearTimeout(timer);}
}
function pdfError(error:unknown):Error{
  const e=error as {name?:string;message?:string};
  if(e.name==='PasswordException')return Error('Diese PDF ist passwortgeschützt. Bitte eine ungeschützte Kopie des Grundrisses verwenden.');
  if(e.name==='InvalidPDFException'||e.name==='MissingPDFException')return Error('Die PDF ist beschädigt oder enthält keine lesbaren Seiten. Bitte die Datei erneut als PDF oder JPG/PNG speichern.');
  if(e.message?.includes('dauert zu lange'))return Error(e.message);
  return Error('Die PDF-Seite konnte nicht verarbeitet werden. Möglicherweise ist sie zu komplex oder der Gerätespeicher reicht nicht aus. Bitte andere Apps schließen oder eine kleinere PDF/JPG/PNG verwenden.');
}
export class LocalPDF {
  constructor(private document:PDFDocumentProxy,private task:PDFDocumentLoadingTask,readonly name:string){}
  get pages(){return this.document.numPages;}
  async preview(page:number):Promise<string>{return (await this.render(page,650,500_000)).data;}
  private async render(number:number,maxSide:number,maxPixels:number){
    if(!Number.isInteger(number)||number<1||number>this.pages)throw Error('Bitte eine gültige PDF-Seite auswählen.');
    const page=await this.document.getPage(number),base=page.getViewport({scale:1});
    const scale=Math.min(maxSide/Math.max(base.width,base.height),Math.sqrt(maxPixels/(base.width*base.height)));
    if(!Number.isFinite(scale)||scale<=0)throw Error('Die PDF-Seite hat ungültige Abmessungen.');
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(base.width*scale));canvas.height=Math.max(1,Math.floor(base.height*scale));
    // Keep the entire page inside integer canvas dimensions, including the last
    // fractional pixel at the right/bottom edge, without changing aspect ratio.
    const viewport=page.getViewport({scale:Math.min(canvas.width/base.width,canvas.height/base.height)});
    try{
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('Kein Bildspeicher verfügbar.');
      const task=page.render({canvas,canvasContext:ctx,viewport,background:'rgb(255,255,255)'});
      await deadline(task.promise,()=>task.cancel(),'Das Rendern der PDF');
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Kein Bildspeicher verfügbar.')),'image/png'));
      const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('PDF-Bild konnte nicht gelesen werden.'));r.readAsDataURL(blob);});
      return {data,width:canvas.width,height:canvas.height};
    }finally{canvas.width=1;canvas.height=1;page.cleanup();}
  }
  async plan(page:number):Promise<Plan>{
    try{
      let rendered;
      try{rendered=await this.render(page,4600,mobile()?9_000_000:16_000_000);}
      catch{rendered=await this.render(page,3000,6_000_000);}
      return {...rendered,name:`${this.name} · Seite ${page} von ${this.pages}`,vector:false,pdf:{page,totalPages:this.pages,renderLongSide:Math.max(rendered.width,rendered.height)}};
    }catch(e){throw pdfError(e);}
  }
  async close(){await this.task.destroy();}
}
export async function openPDF(name:string,bytes:Uint8Array):Promise<LocalPDF>{
  if(bytes.length>60*1024*1024)throw Error('Die PDF ist zu groß (maximal 60 MB). Bitte nur die benötigten Seiten als eigene PDF speichern.');
  const task=getDocument({data:bytes,cMapUrl:`${assets}cmaps/`,cMapPacked:true,standardFontDataUrl:`${assets}standard_fonts/`,wasmUrl:`${assets}wasm/`,iccUrl:`${assets}iccs/`,useSystemFonts:false,useWorkerFetch:true,enableXfa:false,stopAtErrors:true,canvasMaxAreaInBytes:mobile()?36_000_000:64_000_000});
  try{
    const doc=await deadline(task.promise,()=>{void task.destroy();},'Das Öffnen der PDF');
    if(doc.numPages>500){await task.destroy();throw Error('Die PDF enthält mehr als 500 Seiten. Bitte den benötigten Grundriss als eigene PDF speichern.');}
    return new LocalPDF(doc,task,name);
  }catch(error){await task.destroy().catch(()=>{});if(error instanceof Error&&error.message.includes('500 Seiten'))throw error;throw pdfError(error);}
}
