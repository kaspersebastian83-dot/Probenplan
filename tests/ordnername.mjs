// Ordnername „JJ.Nummer Ort Kürzel“ von hinten lesen (SPEKTRON-ORDNERNAME v1, wie Projektzentrale) – ohne Browser.
// src/folder.ts wird mit dem installierten TypeScript übersetzt; nur erfundene Kürzel und Namen.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const src=await readFile(new URL('../src/folder.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {leseProjektordner,parseProjName,setPersonen}=await import('data:text/javascript,'+encodeURIComponent(js));

const personen=[{ordnerKuerzel:'Abc',name:'Anna Beispiel'},{ordnerKuerzel:'Dr. Te',name:'Dr. Tea Test'},{ordnerKuerzel:'Xy',name:'Xaver Ypsilon',aktiv:false}];
const faelle=[
 ['26.0123 Musterstraße Musterstadt Dr. Te','26.0123','Musterstraße Musterstadt','Dr. Te',false],
 ['26.0124 Musterstraße 12 Köln-Porz Abc','26.0124','Musterstraße 12 Köln-Porz','Abc',false],
 ['26.0127 Aachen Dr.Te','26.0127','Aachen','Dr. Te',false],
 ['26.0128 Aachen dr te','26.0128','Aachen','Dr. Te',false],
 ['26.0129 Aachen ABC','26.0129','Aachen','Abc',false],
 ['26.0130_Aachen_Abc','26.0130','Aachen','Abc',false],
 ['26.0131 Aachen Xy','26.0131','Aachen','Xy',false],
 ['26.0125 Aachen','26.0125','Aachen','',true],
 ['26.0126 Aachen Qrs','26.0126','Aachen Qrs','',true],
 ['26.0132 Abc','26.0132','','Abc',true],
 ['26.0133','26.0133','','',true],
 ['26.0134 Abcdorf','26.0134','Abcdorf','',true],
];
for(const [name,nr,ort,kuerzel,hinweis] of faelle){
 const r=leseProjektordner(name,personen);
 assert.equal(r.nr,nr,name);assert.equal(r.ort,ort,name);assert.equal(r.kuerzel,kuerzel,name);assert.equal(!!r.hinweis,hinweis,name+': '+r.hinweis);
}
for(const liste of [null,[]]){const r=leseProjektordner('26.0123 Musterstadt Abc',liste);assert.equal(r.ort,'Musterstadt Abc');assert.equal(r.kuerzel,'');}
assert.equal(leseProjektordner('Mosaik Archivordner',personen),null);
// parseProjName nutzt die geladene Liste (setPersonen), ohne Liste wie bisher
setPersonen(null);assert.deepEqual(parseProjName('26.0123 Köln Abc'),{nr:'26.0123',ort:'Köln Abc'});
setPersonen(personen);assert.deepEqual(parseProjName('26.0123 Köln Abc'),{nr:'26.0123',ort:'Köln'});
setPersonen(null);
console.log(`OK Ordnername: ${faelle.length} Fälle, ohne Liste, parseProjName mit/ohne Mitarbeiterliste`);
