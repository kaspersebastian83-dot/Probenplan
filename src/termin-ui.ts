// PlanKit 2.7.0 – Termin-Wahl (nur bei mehreren Ortsterminen; plankit-ortstermine-plan.md 4.5, T1–T18). Eine Wahl für ② und ③:
// „12.08. · 20.08. (Nachbeprobung) · Alle Termine“, dazu „frühere Termine: grau · ausblenden“. Gemerkt nur im Browser, je Projektordner
// (wie der Anlagen-Titel) – nie in einer Datei. Vorwahl: der neueste Tag mit mindestens einer Probe, frühere grau (E6); ein Link
// „mitteilung=m2“ aus der Projektzentrale wählt den Tag dieser Mitteilung vor (T11, nur lesen). Ein Termin: nichts davon ist sichtbar.
import {sheetCount,sheetProject,type Project,type TerminKopf} from './model';
import {ansicht,ausMitteilung,gueltigeWahl,kurz,lang,mehrere,rolle,tagName,tage,terminKopf,vorwahl,zuordnen,type LkDaten,type Tag,type Wahl,type Zuordnung} from './termine';

export interface TerminHooks {project():Project|null;projectData():Record<string,unknown>;folder():string|null;lk():LkDaten|null;changed():void}
export interface Fehlt {label:string;grund:string}
const KEY=(f:string)=>`plankit-termin:${f}`;
const h=<K extends keyof HTMLElementTagNameMap>(tag:K,attrs:Record<string,string>={},text=''):HTMLElementTagNameMap[K]=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e;};
const liste=(xs:string[],max=8)=>xs.length>max?`${xs.slice(0,max).join(', ')} … (+${xs.length-max})`:xs.join(', ');
const nr=(l:string)=>Number(l.replace(/\D+/g,''))||0;

export class TerminUI{
 private ordner:string|null=null;private eigen:Wahl|null=null;private link='';private linkAktiv=false;
 private felder:{tag:HTMLSelectElement;frueher:HTMLSelectElement;frueherFeld:HTMLElement;box:HTMLElement}[]=[];
 private satz3!:HTMLElement;private fehlt3!:HTMLElement;private hinweise2!:HTMLElement;
 constructor(private hooks:TerminHooks){}

 /** Tage des Projekts (nur mit Projektordner – ohne ihn gibt es keine Projektdaten). */
 private memo:{pd:unknown;folder:string|null;t:Tag[]}|null=null;
 tage():Tag[]{const pd=this.hooks.projectData(),f=this.hooks.folder();if(this.memo?.pd!==pd||this.memo.folder!==f)this.memo={pd,folder:f,t:f?tage(pd):[]};return this.memo.t;}
 /** Mehrere Ortstermine? Sonst gilt überall „wie heute“. */
 aktiv(){return mehrere(this.tage());}
 /** Zuordnung einer Probe (Punkt oder offene Probe). */
 zu=(label:string,datum:string|undefined,vonHand:boolean):Zuordnung=>zuordnen(label,datum,this.hooks.lk(),this.tage(),vonHand);
 /** Alle Proben des Projekts mit Zuordnung: gesetzte (je Plan) und offene. */
 proben(p:Project){
  const out:{label:string;sheet:number;offen:boolean;z:Zuordnung}[]=[];
  for(let i=0;i<sheetCount(p);i++)for(const m of sheetProject(p,i).markers)if(m.kind==='sample')out.push({label:m.label,sheet:i,offen:false,z:this.zu(m.label,m.lab?.datum,!m.lab)});
  for(const r of p.pending||[])out.push({label:r.label,sheet:-1,offen:true,z:this.zu(r.label,r.datum,false)});
  return out.sort((a,b)=>nr(a.label)-nr(b.label));
 }
 /** Projektordner gewechselt oder geöffnet: gemerkte Wahl laden; link = Kennung aus „mitteilung=…“ (oder leer). */
 ordnerGeoeffnet(name:string|null,link=''){
  if(name===this.ordner&&!link)return;   // derselbe Ordner noch einmal (z. B. Neuladen der Projektdaten): Wahl bleibt
  this.ordner=name;this.eigen=null;this.link=link;this.linkAktiv=!!link;
  if(name)try{const raw=localStorage.getItem(KEY(name));if(raw)this.eigen=JSON.parse(raw);}catch{/* ohne Speicher: nur Vorwahl */}
 }
 /** Gültige Wahl oder null (ein Termin). */
 /** Während einer Ausgabe gilt die Wahl vom Start – ein Wechsel der Auswahl oder neu gelesene Daten ändern Inhalt und Namen nicht mittendrin. */
 private fest:{wahl:Wahl|null}|null=null;
 festhalten(){this.fest={wahl:this.wahl()};for(const f of this.felder){f.tag.disabled=true;f.frueher.disabled=true;}}
 loslassen(){const war=!!this.fest;this.fest=null;for(const f of this.felder){f.tag.disabled=false;f.frueher.disabled=false;}return war;}
 wahl():Wahl|null{
  if(this.fest)return this.fest.wahl;
  const p=this.hooks.project(),t=this.tage();if(!p||!mehrere(t))return null;
  if(this.linkAktiv){const a=ausMitteilung(this.hooks.projectData(),this.link,t);if(a)return a.wahl;}
  return gueltigeWahl(this.eigen,t)||vorwahl(t,this.proben(p).map(x=>x.z));
 }
 private linkSatz(){if(!this.linkAktiv)return '';return ausMitteilung(this.hooks.projectData(),this.link,this.tage())?.satz||'';}
 kopf():TerminKopf{const w=this.wahl();return w?terminKopf(w,this.tage()):{titel:'',feld:'',wert:''};}
 /** Zusatz für Dateinamen: '' (ein Termin) · 'JJJJ-MM-TT' · 'alle'. */
 zusatz(){return this.wahl()?.tag||'';}
 /** Termin-Ansicht fürs Ausgeben (oder mit anzeige für die Karte). Ein Termin: genau das Projekt selbst. */
 ansicht(p:Project,anzeige=false):Project{const w=this.wahl();return w?ansicht(p,this.zu,w,terminKopf(w,this.tage()),anzeige):p;}
 /** Pläne, die in „Alle Pläne“ hineinkommen (T7): bei einem Tag nur die mit mindestens einer Probe dieses Tags. */
 blaetter(p:Project):{drin:number[];weg:number[]}{
  const n=sheetCount(p),alle=Array.from({length:n},(_,i)=>i),w=this.wahl();if(!w||w.tag==='alle')return {drin:alle,weg:[]};
  const mit=new Set(this.proben(p).filter(x=>!x.offen&&rolle(x.z,w)==='normal').map(x=>x.sheet));
  return {drin:alle.filter(i=>mit.has(i)),weg:alle.filter(i=>!mit.has(i))};
 }
 /** Proben „ohne Termin“, die in einer Termin-Ausgabe fehlen würden (T15). blaetter: welche Pläne; offen: offene Proben mitzählen (Anlage). */
 fehlend(p:Project,blaetter:number[],offen:boolean):Fehlt[]{
  const w=this.wahl();if(!w||w.tag==='alle')return [];
  return this.proben(p).filter(x=>!x.z.tag&&(x.offen?offen:blaetter.includes(x.sheet))).map(x=>({label:x.label,grund:x.z.grund}));
 }
 /** Rückfrage vor der Ausgabe (T15): nennt Proben und Grund, sperrt nichts. true = ausgeben. */
 rueckfrage(f:Fehlt[],was:string):boolean{
  if(!f.length)return true;const w=this.wahl()!,tag=lang(w.tag);
  const zeilen=f.slice(0,12).map(x=>`• ${x.label}: ${x.grund}`).concat(f.length>12?[`• … und ${f.length-12} weitere`]:[]);
  return window.confirm(`${f.length===1?'Diese Probe hat':'Diese Proben haben'} keinen Ortstermin und ${f.length===1?'fehlt':'fehlen'} in ${was} für den ${tag}:\n${zeilen.join('\n')}\n\nWeg: das Probenahmedatum in LabelKit berichtigen – oder oben „Alle Termine“ wählen.\n\nOK = trotzdem ausgeben\nAbbrechen = nicht ausgeben`);
 }
 /** Satz in ③: „Ausgabe für den Ortstermin am 20.08.2026 – 9 Proben, 13 frühere grau“. blaetter: Pläne der Ausgabe; offen: offene Proben mitzählen. */
 satz(p:Project,blaetter:number[],offen:boolean){
  const w=this.wahl();if(!w)return '';
  const xs=this.proben(p).filter(x=>x.offen?offen:blaetter.includes(x.sheet)),n=(f:(x:typeof xs[number])=>boolean)=>xs.filter(f).length;
  if(w.tag==='alle')return `Ausgabe für alle Ortstermine – ${xs.length} Probe${xs.length===1?'':'n'}`;
  const normal=n(x=>rolle(x.z,w)==='normal'),frueher=n(x=>!!x.z.tag&&x.z.tag<w.tag),spaeter=n(x=>!!x.z.tag&&x.z.tag>w.tag);
  const teile=[`${normal} Probe${normal===1?'':'n'}`];
  if(frueher)teile.push(`${frueher} frühere ${w.frueher==='grau'?'grau':'ausgeblendet'}`);
  if(spaeter)teile.push(`${spaeter} spätere nicht drin`);
  return `Ausgabe für den Ortstermin am ${lang(w.tag)} – ${teile.join(', ')}`;
 }
 /** Fingerabdruck für „erledigt“ in ③: Wahl und gerechnete Zuordnung (ändert sich ein Datum in LabelKit, ist die Ausgabe nicht mehr erledigt). */
 stand(){const p=this.hooks.project(),w=this.wahl();if(!p||!w)return '';return JSON.stringify([w,this.proben(p).map(x=>`${x.label}:${x.z.tag||'-'}`)]);}

 // ---------- Oberfläche ----------
 /** ③: Zeile „Ortstermin“ über „Darstellung“ in der Exportkarte; ②: dieselbe Wahl über der Probenliste mit den gelben Zeilen (T14). */
 aufbauen(exportFeldVor:HTMLElement,probenVor:HTMLElement){
  const feld=(id:string,cls:string)=>{
   const box=h('div',{id,class:`pk-termin ${cls}`,hidden:''}),tagL=h('label',{},'Ortstermin'),tag=h('select',{id:`${id}-tag`,'aria-label':'Ortstermin'});tagL.append(tag);
   const frL=h('label',{class:'pk-termin-frueher'},'Frühere Termine'),fr=h('select',{id:`${id}-frueher`,'aria-label':'Frühere Termine'});
   fr.append(new Option('grau','grau'),new Option('ausblenden','weg'));frL.append(fr);box.append(tagL,frL);
   const wechsel=()=>this.waehlen({tag:tag.value,frueher:fr.value==='weg'?'weg':'grau'});tag.onchange=wechsel;fr.onchange=wechsel;
   this.felder.push({tag,frueher:fr,frueherFeld:frL,box});return box;
  };
  const b3=feld('termin','pk-termin-3');this.satz3=h('p',{id:'termin-satz',class:'tiny'});this.fehlt3=h('p',{id:'termin-fehlt',class:'pk-warnung',hidden:''});b3.append(this.satz3,this.fehlt3);exportFeldVor.before(b3);
  const b2=feld('termin2','pk-termin-2');this.hinweise2=h('div',{id:'termin-hinweise',class:'pk-warnung',hidden:''});b2.append(this.hinweise2);probenVor.before(b2);
 }
 private waehlen(w:Wahl){this.eigen=w;this.linkAktiv=false;if(this.ordner)try{localStorage.setItem(KEY(this.ordner),JSON.stringify(w));}catch{/* nur für diese Sitzung */}
  this.hooks.changed();}
 /** Nach jedem Zeichnen. ausgabe: Pläne und offene Proben der aktuellen Ausgabe in ③ (für Satz und gelbe Zeile). */
 render(ausgabe:{blaetter:number[];fehlendIn:number[];offen:boolean;was:string;zusatz?:string}|null){
  const p=this.hooks.project(),t=this.tage(),w=this.wahl(),an=!!p&&!!w;
  for(const f of this.felder){f.box.hidden=!an;if(!an)continue;
   const opts=[...t.map(x=>[x.datum,tagName(x)]),['alle','Alle Termine']],sig=JSON.stringify(opts);
   if(f.tag.dataset.sig!==sig){f.tag.replaceChildren(...opts.map(([v,n])=>new Option(n,v)));f.tag.dataset.sig=sig;}
   if(f.tag.value!==w!.tag)f.tag.value=w!.tag;if(f.frueher.value!==w!.frueher)f.frueher.value=w!.frueher;
   f.frueherFeld.hidden=w!.tag==='alle'||t[0]?.datum===w!.tag;}
  if(!this.hinweise2)return;   // vor dem Aufbau
  if(!an||!p){this.hinweise2.hidden=true;return;}
  // ③ Satz und gelbe Zeile, wenn Proben „ohne Termin“ fehlen würden (nennt sie, sperrt nichts – vor dem Ausgeben fragt PlanKit, T15)
  if(ausgabe&&this.satz3){
   const satz=[this.linkSatz(),this.satz(p,ausgabe.blaetter,ausgabe.offen),ausgabe.zusatz||''].filter(Boolean).join(' · ');if(this.satz3.textContent!==satz)this.satz3.textContent=satz;
   const f=this.fehlend(p,ausgabe.fehlendIn,ausgabe.offen),text=f.length?`Ohne Ortstermin – nicht in ${ausgabe.was}: ${liste(f.map(x=>`${x.label} (${x.grund})`),4)}`:'';
   this.fehlt3.hidden=!text;if(this.fehlt3.textContent!==text)this.fehlt3.textContent=text;}
  // ② gelbe Zeilen: Datum in LabelKit und am Punkt führen zu verschiedenen Terminen (T14) – es zählt LabelKit
  const abw=this.proben(p).filter(x=>x.z.abweichung).map(x=>x.z.abweichung),text=abw.length>6?[...abw.slice(0,6),`… und ${abw.length-6} weitere`]:abw;
  this.hinweise2.hidden=!text.length;const sig=text.join('\n');if(this.hinweise2.dataset.sig!==sig){this.hinweise2.dataset.sig=sig;this.hinweise2.replaceChildren(...text.map(t=>h('div',{},`⚠ ${t}`)));}
 }
 /** Kleiner Tag je Zeile der Probenliste in ② – „ohne Termin“ mit Grund. null bei einem Termin (Liste wie bisher). */
 zeile(label:string,datum:string|undefined,vonHand:boolean):{text:string;ohne:boolean;title:string}|null{
  if(!this.aktiv())return null;const z=this.zu(label,datum,vonHand);
  return z.tag?{text:kurz(z.tag),ohne:false,title:`Ortstermin ${lang(z.tag)}${z.quelle==='punkt'?' (Datum am Punkt)':''}`}:{text:'ohne Termin',ohne:true,title:z.grund};
 }
}
