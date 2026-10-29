// Exporte in „Pläne“ (Prüfbericht 29.10., F09): eine vorhandene Datei – auch in anderer Groß-/Kleinschreibung oder
// Unicode-Schreibweise – wird nie überschrieben; die neue Fassung kommt daneben als „… (2)“. Ordner im Speicher, synthetisch.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';
const code=stripTypeScriptTypes(fs.readFileSync(new URL('../src/folder.ts',import.meta.url),'utf8'),{mode:'transform'}).replace(/^export /gm,'');
const ctx={console,Blob,Set};vm.createContext(ctx);vm.runInContext(code+'\nthis.writeExportFile=writeExportFile;',ctx);
function ordner(dateien){
 const d={async *values(){for(const n of Object.keys(dateien))yield{name:n,kind:'file'};},
  async getFileHandle(n,o){if(!(n in dateien)){if(!o?.create)throw Object.assign(Error('fehlt'),{name:'NotFoundError'});dateien[n]='';}
   return{getFile:async()=>({size:dateien[n].length}),createWritable:async()=>{let t='';return{write:async v=>{t=typeof v==='string'?v:await v.text();},close:async()=>{dateien[n]=t;},abort:async()=>{}};}};}};
 return d;
}
const alt='Probenplan 99.9001 Übersicht.PDF'.normalize('NFD'),d={[alt]:'VON HAND ERGÄNZT'},dir=ordner(d);
assert.equal(await ctx.writeExportFile(dir,'Probenplan 99.9001 Übersicht.pdf',new Blob(['NEU 1'])),'Probenplan 99.9001 Übersicht (2).pdf');
assert.equal(await ctx.writeExportFile(dir,'Probenplan 99.9001 Übersicht.pdf','NEU 2'),'Probenplan 99.9001 Übersicht (3).pdf');
assert.equal(d[alt],'VON HAND ERGÄNZT','vorhandene Datei unverändert');
assert.equal(await ctx.writeExportFile(dir,'Neu.png','BILD'),'Neu.png','freier Name bleibt');
console.log('OK Exportname: vorhandene PDFs und Bilder bleiben, neue Fassung als „(2)“, „(3)“');
