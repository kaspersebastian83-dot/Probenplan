// Hilfe-Links ins Handbuch: nur feste Kapiteladressen aus AidKit (hilfe-anker.json), gemeinsames Fenster „aidkit“ – ohne Browser.
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const src=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
const FEST=['start','brandschaden','bohrkern-ablauf','app-projektzentrale','app-labelkit','app-fotokit','app-resultkit','app-plankit','app-belegkit','app-spesenkit','app-datenarchiv','bohrkern','wischprobe','raumkuerzel'];
const neben=new URL('../../aidkit/hilfe-anker.json',import.meta.url);
let anker=FEST,mitListe=false;
try{await access(neben);anker=Object.keys(JSON.parse(await readFile(neben,'utf8')).anker);mitListe=true;assert.deepEqual([...anker].sort(),[...FEST].sort(),'Liste hier = hilfe-anker.json in AidKit');}catch(e){if(e.code!=='ENOENT')throw e;}
// handbuchLink('<anker>', …) und direkte ../aidkit/#…-Links
const genutzt=[...src.matchAll(/handbuchLink\('([a-z0-9-]+)'/g)].map(m=>m[1]).concat([...src.matchAll(/\.\.\/aidkit\/#([a-z0-9-]+)/g)].map(m=>m[1]));
assert.ok(genutzt.length>=3,'Hilfe-Links vorhanden');
for(const id of genutzt)assert.ok(anker.includes(id),`#${id} ist keine feste Handbuch-Adresse`);
assert.match(src,/href="\.\.\/aidkit\/#\$\{anker\}" target="aidkit" rel="noopener"/,'gemeinsames Fenster „aidkit“');
assert.deepEqual([...new Set(genutzt.filter(x=>x!=='$'))].sort(),['app-plankit','bohrkern','bohrkern-ablauf'],'Kurzanleitung: PlanKit; Wandansichten: Bohrkerne');
console.log(`OK Hilfe-Links: ${genutzt.length} Verweise auf feste Handbuch-Adressen${mitListe?' (mit AidKit-Liste geprüft)':''}`);
