// Probenliste (ab 1.48): eine Liste für offene und platzierte Laborproben, gruppiert nach Geschoss → Raum.
// Der erste Teil ist reine Rechnung (Zeilen, Gruppen, „zurück zu offen“), der zweite die Darstellung im Reiter „Proben“.
import {floorName,otherSheets,pendingShape,shapeOf,sheetCount,sheetProject,typeFromArt,type LabSample,type Marker,type Project,type Shape} from './model';
import {copyLab} from './import';
import {norm} from './raumbuch';
import {raumVergleich,raumVon,type RaumRef} from './weiter';

export type Filter='offen'|'platziert'|'alle';
export type ZeilenArt='offen'|'platziert'|'weitere';
export interface Zeile{art:ZeilenArt;label:string;/** Marker-ID, bei offenen Proben leer */id:string;/** Plan (Index), bei offenen Proben −1 */sheet:number;raum:RaumRef;titel:string;probenart:string;shape:Shape;fire:boolean;wert:string;suche:string}
export interface Gruppe{key:string;floor:string;name:string;ohne:boolean;weitere:boolean;alle:Zeile[];zeilen:Zeile[];offen:number;gesamt:number;fertig:boolean}
export const WEITERE_KEY='~weitere',OHNE_KEY='~ohne';

/** Beschreibung aus LabelKit („EG Flur, Decke, Untersicht, 600 cm²“) ohne den Raum: „Decke · Untersicht · 600 cm²“. */
export function titelVon(desc:string,raum:string,ref=''):string{
  const teile=(desc||'').split(/,\s*/).map(s=>s.trim()).filter(Boolean).filter(t=>!raum||norm(t)!==norm(raum));
  return teile.join(' · ')||ref;
}
const nummer=(label:string)=>Number(label.replace(/\D+/g,''))||0;
const labelVergleich=(a:{label:string},b:{label:string})=>nummer(a.label)-nummer(b.label)||a.label.localeCompare(b.label,'de',{numeric:true});

/** Alle Zeilen der Liste: offene Proben, platzierte Laborproben (aller Pläne) und weitere Markierungen (Brandherde, eigene Proben). */
export function zeilen(p:Project,wert:(m:Marker)=>string=()=>''):Zeile[]{
  const out:Zeile[]=[];
  const suche=(...teile:(string|undefined)[])=>teile.filter(Boolean).join(' ');
  for(const r of p.pending||[]){
    const raum=raumVon(r),shape=pendingShape(r),probenart=r.typ||typeFromArt(r.art)?.typ||(r.art||'').split(/\s*·\s*/)[0];
    const titel=titelVon(r.desc,r.raum||'',r.ref)||'Probe';
    out.push({art:'offen',label:r.label,id:'',sheet:-1,raum,titel,probenart,shape,fire:false,wert:'',suche:suche(r.label,r.raum,titel,probenart,r.ref)});
  }
  for(let i=0;i<sheetCount(p);i++){
    const floor=floorName(p,i);
    for(const m of sheetProject(p,i).markers){
      const raum=raumVon(m,floor);
      if(m.kind==='sample'&&m.lab){
        const titel=titelVon(m.lab.desc,m.raum||'',m.lab.ref)||'Probenahmestelle',probenart=m.typ||typeFromArt(m.lab.art)?.typ||(m.lab.art||'').split(/\s*·\s*/)[0];
        out.push({art:'platziert',label:m.label,id:m.id,sheet:i,raum,titel,probenart,shape:shapeOf(m),fire:false,wert:wert(m),suche:suche(m.label,m.raum,titel,probenart,m.lab.ref,m.note)});
      }else{
        const fire=m.kind==='fire',titel=fire?'Brandherd':(m.note||'Probenahmestelle');
        out.push({art:'weitere',label:m.label,id:m.id,sheet:i,raum,titel,probenart:'',shape:shapeOf(m),fire,wert:'',suche:suche(m.label,m.raum,titel,m.note)});
      }
    }
  }
  return out;
}
export function zaehler(rows:readonly Zeile[]){
  let offen=0,platziert=0,weitere=0;for(const z of rows){if(z.art==='offen')offen++;else if(z.art==='platziert')platziert++;else weitere++;}
  return {offen,platziert,weitere,gesamt:offen+platziert};
}
/** Gruppen für die Anzeige: Räume mit offenen Proben zuerst (Geschoss, dann Raum), fertige Räume danach, „weitere Markierungen“ zuletzt.
 *  Innerhalb einer Gruppe stehen die offenen Proben (in der Reihenfolge der Liste) vor den platzierten (nach P-Nummer).
 *  `offen`/`gesamt`/`fertig` zählen alle Proben des Raums, unabhängig von Filter und Suche. */
export function gruppen(rows:readonly Zeile[],filter:Filter,query=''):Gruppe[]{
  const q=norm(query),map=new Map<string,Gruppe>();
  for(const z of rows){
    const key=z.art==='weitere'?WEITERE_KEY:z.raum.ohne?OHNE_KEY:z.raum.key;
    let g=map.get(key);
    if(!g){g={key,floor:key===WEITERE_KEY?'':z.raum.floor,name:z.raum.name,ohne:key===OHNE_KEY,weitere:key===WEITERE_KEY,alle:[],zeilen:[],offen:0,gesamt:0,fertig:false};map.set(key,g);}
    g.alle.push(z);if(z.art==='offen')g.offen++;if(z.art!=='weitere')g.gesamt++;
  }
  const shown=(z:Zeile)=>(filter==='alle'||(filter==='offen'?z.art==='offen':z.art!=='offen'))&&(!q||norm(z.suche).includes(q));
  const out:Gruppe[]=[];
  for(const g of map.values()){
    g.fertig=!g.weitere&&g.gesamt>0&&g.offen===0;
    const offen=g.alle.filter(z=>z.art==='offen'),rest=g.alle.filter(z=>z.art!=='offen').sort(labelVergleich);
    g.zeilen=[...offen,...rest].filter(shown);
    if(g.zeilen.length)out.push(g);
  }
  const rang=(g:Gruppe)=>g.weitere?2:g.fertig?1:0;
  out.sort((a,b)=>rang(a)-rang(b)||(a.weitere?0:raumVergleich({key:a.key,floor:a.floor,name:a.name,ohne:a.ohne},{key:b.key,floor:b.floor,name:b.name,ohne:b.ohne})));
  return out;
}
/** Voreinstellung des Filters: „Offen“, solange etwas offen ist, sonst „Alle“. */
export const filterStandard=(offen:number):Filter=>offen>0?'offen':'alle';

/** Probe aus einem platzierten Punkt zurück in die offene Liste (ohne Lage und ohne Notiz). */
export function markerZuProbe(m:Marker):LabSample|null{
  if(m.kind!=='sample'||!m.lab||!/^P[1-9]\d{0,8}$/.test(m.label))return null;
  return {...copyLab(m.lab),label:m.label,...(m.typ?{typ:m.typ}:{}),...(m.shape?{shape:m.shape}:{}),/* auch ein von Hand gewählter Kreis bleibt */...(m.surface?{surface:m.surface}:{}),...(m.raum?{raum:m.raum}:{})};
}
/** Entfernt den Punkt (auch auf einem anderen Plan) und legt die Probe nach P-Nummer sortiert in `pending`. */
export function zurueckZuOffen(p:Project,id:string):LabSample|null{
  const holders=[p.markers,...otherSheets(p).map(s=>s.markers||[])];
  for(const list of holders){
    const i=list.findIndex(m=>m.id===id);if(i<0)continue;
    const probe=markerZuProbe(list[i]);if(!probe)return null;
    list.splice(i,1);p.pending=[...(p.pending||[]),probe].sort((a,b)=>Number(a.label.slice(1))-Number(b.label.slice(1)));return probe;
  }
  return null;
}

// ---- Darstellung ----
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',cls='')=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const btn=(text:string,cls:string,fn?:()=>void)=>{const b=el('button',text,cls);b.type='button';if(fn)b.onclick=fn;return b;};
export interface ListeHooks{
  selectedLabel():string|null;selectedId():string|null;activeSheet():number;
  /** offene Probe zum Platzieren wählen */choose(label:string):void;
  /** platzierten Punkt wählen (ggf. Plan wechseln) */pick(id:string,sheet:number):void;
  /** Punkt im Plan zeigen */show(id:string,sheet:number):void;
  hover(id:string|null):void;remove(label:string):void;
  /** Punkt zurück in die offene Liste; `neu`: gleich zum Platzieren wählen */back(id:string,neu:boolean):void;del(id:string):void;clear():void;save():void;
  wert(m:Marker):string;
}
const FILTER_TEXT:Record<Filter,string>={offen:'Offen',platziert:'Platziert',alle:'Alle'};
export class Probenliste{
  readonly root=el('section','','proben-section');
  /** Platz für Schalter unter der Liste. */
  readonly slot=el('div','','pl-slot');
  private filter:Filter|null=null;private query='';private expanded=new Map<string,boolean>();/** Filter der letzten Anzeige; Auf-/Zuklappen gilt je Filter (unter „Platziert“ sind fertige Räume offen). */private zeigt:Filter='offen';private menu='';private more=false;
  private progress=el('p','','pl-progress');private fill=el('div','','pl-fill');private bar=el('div','','pl-bar');private chips=new Map<Filter,HTMLButtonElement>();private search=el('input');
  private body=el('div','','pl-body');private moreBtn=btn('⋯','pl-more-top');private moreMenu=el('div','','pl-menu pl-menu-top');private clearBtn:HTMLButtonElement;private last:Project|null=null;
  constructor(private hooks:ListeHooks){
    const r=this.root;r.id='proben-section';r.hidden=false;
    const head=el('div','','section-heading'),h2=el('h2','Laborproben');this.moreBtn.id='proben-more';this.moreBtn.title='Weitere Aktionen zur Liste';this.moreBtn.setAttribute('aria-haspopup','menu');this.moreBtn.setAttribute('aria-expanded','false');this.moreBtn.setAttribute('aria-label','Weitere Aktionen zur Liste');
    this.moreBtn.onclick=()=>{this.more=!this.more;this.renderMenu();};head.append(h2,this.moreBtn);
    this.moreMenu.id='proben-more-menu';this.moreMenu.setAttribute('role','menu');this.moreMenu.hidden=true;
    this.clearBtn=btn('Liste leeren …','',()=>{this.more=false;this.renderMenu();hooks.clear();});this.clearBtn.id='proben-clear';this.clearBtn.title='Alle noch nicht platzierten Proben aus der Liste entfernen (rückgängig mit Strg+Z)';this.clearBtn.setAttribute('role','menuitem');
    const save=btn('Probenliste speichern …','',()=>{this.more=false;this.renderMenu();hooks.save();});save.id='proben-save';save.setAttribute('role','menuitem');this.moreMenu.append(this.clearBtn,save);
    this.progress.id='proben-progress';this.progress.setAttribute('role','status');this.bar.id='proben-bar';this.bar.setAttribute('role','progressbar');this.bar.setAttribute('aria-label','Platziert');this.bar.setAttribute('aria-valuemin','0');this.bar.setAttribute('aria-valuemax','100');this.bar.append(this.fill);
    const chips=el('div','','pl-chips');chips.setAttribute('role','group');chips.setAttribute('aria-label','Anzeigen');
    for(const f of ['offen','platziert','alle'] as Filter[]){const b=btn('','pl-chip',()=>{this.filter=f;this.last&&this.render(this.last);});b.id=`filter-${f}`;this.chips.set(f,b);chips.append(b);}
    this.search.type='search';this.search.id='proben-suche';this.search.className='pl-search';this.search.placeholder='Raum oder Kennung suchen';this.search.setAttribute('aria-label','Raum oder Kennung suchen');this.search.autocomplete='off';this.search.maxLength=60;
    this.search.oninput=()=>{this.query=this.search.value;this.last&&this.render(this.last);};
    this.body.id='proben-liste';
    r.append(head,this.moreMenu,this.progress,this.bar,chips,this.search,this.body,this.slot);
    this.body.addEventListener('click',e=>this.click(e));
    this.body.addEventListener('pointerover',e=>{if((e as PointerEvent).pointerType==='touch')return;const id=(e.target as HTMLElement).closest<HTMLElement>('[data-pid]')?.dataset.pid;hooks.hover(id||null);});
    this.body.addEventListener('pointerleave',()=>hooks.hover(null));
    document.addEventListener('pointerdown',e=>{const t=e.target as HTMLElement;if(this.more&&!t.closest('#proben-more,#proben-more-menu')){this.more=false;this.renderMenu();}if(this.menu&&!t.closest('.pl-item,.pl-menu')){this.menu='';this.last&&this.render(this.last);}},true);
    // Esc schließt ein offenes Menü zuerst (auf dem Dokument: nach dem Neuzeichnen hat die Liste keinen Fokus mehr).
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(this.menu||this.more)){e.preventDefault();e.stopPropagation();const m=this.menu;this.menu='';this.more=false;this.renderMenu();this.last&&this.render(this.last);if(m)this.body.querySelector<HTMLElement>(`[data-more="${CSS.escape(m)}"]`)?.focus();}},true);
  }
  /** Behälter der Zeilen (für Ziehen aus der Liste). */
  get container(){return this.body;}
  private renderMenu(){this.moreMenu.hidden=!this.more;this.moreBtn.setAttribute('aria-expanded',String(this.more));}
  /** Plan → Liste: Zeile des Punkts hervorheben. */
  markHover(id:string|null){this.body.querySelectorAll('.pl-row.hl').forEach(e=>e.classList.remove('hl'));if(id)this.body.querySelector(`.pl-row[data-pid="${CSS.escape(id)}"]`)?.classList.add('hl');}
  /** Ausgewählte Zeile ins Sichtfeld holen (z. B. nach „Weiter-Platzieren“). */
  scrollToSelected(){this.body.querySelector('.pl-row.selected')?.scrollIntoView?.({block:'nearest'});}
  private click(e:Event){
    const t=e.target as HTMLElement;
    const g=t.closest<HTMLElement>('[data-group]');if(g){const key=g.dataset.group!;this.expanded.set(`${this.zeigt}|${key}`,g.getAttribute('aria-expanded')!=='true');this.last&&this.render(this.last);return;}
    const m=t.closest<HTMLElement>('[data-more]');if(m){this.menu=this.menu===m.dataset.more?'':m.dataset.more!;this.last&&this.render(this.last);return;}
    const a=t.closest<HTMLElement>('[data-act]');
    if(a){const act=a.dataset.act!,label=a.dataset.label||'',id=a.dataset.id||'',sheet=Number(a.dataset.sheet);this.menu='';
      if(act==='remove')this.hooks.remove(label);else if(act==='show')this.hooks.show(id,sheet);else if(act==='replace')this.hooks.back(id,true);else if(act==='back')this.hooks.back(id,false);else if(act==='del')this.hooks.del(id);
      this.last&&this.render(this.last);return;}
    const row=t.closest<HTMLElement>('.pl-row');if(!row)return;
    if(row.dataset.plabel)this.hooks.choose(row.dataset.plabel);else if(row.dataset.pid)this.hooks.pick(row.dataset.pid,Number(row.dataset.sheet));
  }
  render(p:Project){
    this.last=p;
    const rows=zeilen(p,this.hooks.wert),z=zaehler(rows),filter=this.filter??filterStandard(z.offen),q=norm(this.query);this.zeigt=filter;
    const percent=z.gesamt?Math.round(z.platziert/z.gesamt*100):0;
    this.progress.textContent=z.gesamt?`${z.platziert} von ${z.gesamt} platziert${!z.offen?' · Alle Laborproben platziert.':''}`:'Noch kein Laborbericht übernommen.';
    this.bar.hidden=!z.gesamt;this.fill.style.width=`${percent}%`;this.bar.setAttribute('aria-valuenow',String(percent));
    for(const [f,b] of this.chips){const n=f==='offen'?z.offen:f==='platziert'?z.platziert+z.weitere:z.gesamt+z.weitere;b.textContent=`${FILTER_TEXT[f]} ${n}`;b.setAttribute('aria-pressed',String(f===filter));b.classList.toggle('active',f===filter);}
    this.clearBtn.hidden=z.offen<2;
    const tab=document.getElementById('tab-proben-count');if(tab){tab.textContent=String(z.offen);tab.hidden=!z.offen;}
    const sel=this.hooks.selectedLabel(),selId=this.hooks.selectedId(),active=this.hooks.activeSheet(),list=gruppen(rows,filter,this.query),mitGeschoss=list.some(g=>g.floor);
    const nodes:HTMLElement[]=[];let floor:string|null=null;
    for(const g of list){
      if(mitGeschoss&&!g.weitere&&g.floor!==floor){floor=g.floor;nodes.push(el('div',g.floor||'Ohne Geschoss','pl-floor'));}
      const enthaelt=!!sel&&g.alle.some(x=>x.art==='offen'&&x.label===sel)||!!selId&&g.alle.some(x=>x.id===selId);
      const open=!!q||enthaelt||(this.expanded.get(`${filter}|${g.key}`)??(filter==='platziert'||!g.fertig));
      const head=el('button','','pl-group');head.type='button';head.dataset.group=g.key;head.setAttribute('aria-expanded',String(open));
      const name=g.weitere?'Brandherde & weitere Markierungen':g.ohne?'Ohne Raum':g.name||'Ohne Raum';
      head.append(el('span',open?'▾':'▸','pl-caret'),el('span',name,'pl-gname'),el('span',g.weitere?String(g.alle.length):`${g.gesamt-g.offen}/${g.gesamt}${g.fertig?' ✓':''}`,`pl-gcount${g.fertig?' fertig':''}`));
      nodes.push(head);
      if(!open)continue;
      for(const r of g.zeilen)nodes.push(...this.row(r,sel,selId,active));
    }
    if(!nodes.length)nodes.push(el('p',q?'Keine Treffer.':z.gesamt+z.weitere===0?'Noch keine Proben.':filter==='offen'?(z.offen?'':'Alle Laborproben platziert.'):'Keine Einträge.','muted empty-list'));
    this.body.replaceChildren(...nodes);
  }
  private row(r:Zeile,sel:string|null,selId:string|null,active:number):HTMLElement[]{
    const key=r.id||r.label,item=el('div','','pl-item');item.dataset.label=r.label;
    const selected=r.art==='offen'?sel===r.label:!!selId&&selId===r.id;
    const b=el('button','',`pl-row ${r.art}${selected?' selected':''}`);b.type='button';b.dataset.art=r.art;
    if(r.art==='offen')b.dataset.plabel=r.label;else{b.dataset.pid=r.id;b.dataset.sheet=String(r.sheet);}
    b.setAttribute('aria-pressed',String(selected));
    b.title=r.art==='offen'?`${r.label} im Plan platzieren (antippen, dann in den Plan tippen – oder auf den Plan ziehen)`:`${r.label} im Plan auswählen`;
    const badge=el('span',r.fire?'':r.label,`pl-badge ${r.fire?'fire':r.shape}${r.art==='offen'?' open':''}`);if(r.fire)badge.setAttribute('aria-label',r.label);
    const text=el('span','','pl-text');text.append(r.fire?el('b',`${r.label} `):'',el('span',r.titel,'pl-titel'));
    b.append(badge,text);
    if(r.probenart||r.wert)b.append(el('small',r.wert||r.probenart,'pl-art'));
    const more=btn('⋯','pl-more');more.dataset.more=key;more.title=`Weitere Aktionen zu ${r.label}`;more.setAttribute('aria-label',`Weitere Aktionen zu ${r.label}`);more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded',String(this.menu===key));
    more.addEventListener('pointerdown',e=>e.stopPropagation());
    item.append(b,more);const out=[item];
    if(this.menu===key){
      const m=el('div','','pl-menu');m.setAttribute('role','menu');m.dataset.for=r.label;
      const add=(act:string,text:string,title='')=>{const x=btn(text,'');x.dataset.act=act;x.dataset.label=r.label;x.dataset.id=r.id;x.dataset.sheet=String(r.sheet);x.setAttribute('role','menuitem');if(title)x.title=title;m.append(x);};
      if(r.art==='offen')add('remove','Aus der Liste entfernen',`${r.label} aus der Liste der offenen Proben entfernen (rückgängig mit Strg+Z)`);
      else{add('show','Im Plan zeigen');
        if(r.art==='platziert'&&r.sheet===active){add('replace','Neu platzieren','Punkt entfernen und die Probe gleich neu setzen');add('back','Zurück zu offen','Punkt entfernen, die Probe bleibt in der offenen Liste (Notiz am Punkt geht verloren)');}
        if(r.sheet===active)add('del',r.art==='platziert'?'Punkt löschen':'Löschen','Punkt aus dem Plan entfernen (rückgängig mit Strg+Z)');}
      out.push(m);
    }
    return out;
  }
}
