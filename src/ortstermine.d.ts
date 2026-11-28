// Typen zu ortstermine.js – byte-gleich aus der Projektzentrale (Vergleich in tests/kopien.mjs #17), setzt globalThis.Ortstermine.
// PlanKit liest damit nur: Liste der weiteren Ortstermine, gültiges Datum. Es vergibt nie eine Kennung und schreibt _Projekt.json nie.
export {};
declare global {
  interface OrtsterminEintrag {id?:unknown;datum?:unknown;bezeichnung?:unknown;wer?:unknown;[feld:string]:unknown}
  // eslint-disable-next-line no-var
  var Ortstermine:{
    liste(pj:unknown):OrtsterminEintrag[];
    mehrere(pj:unknown):boolean;
    gueltig(s:unknown):boolean;
    nummer(id:unknown):number;
    zusammenfassung(pj:unknown):string;
  };
}
