// Reiter der Seitenleiste (ab 1.48): „Proben“ · „Plan & Ausgabe“ · „Raumbuch“. Die vorhandenen Abschnitte behalten ihre IDs;
// welcher Reiter sie zeigt, entscheidet allein das CSS (`#side-panel[data-liste=neu][data-tab=…]`). Schalter „Neue Liste (Test)“ im Kopf.
export const LISTE_KEY='plankit-neue-liste';
/** Standard: an. Abschaltbar (gilt je Browser) – dann die Seitenleiste wie bisher (eine lange Spalte). */
export function listeOn(){try{return localStorage.getItem(LISTE_KEY)!=='0';}catch{return true;}}
export function setListe(on:boolean){try{localStorage.setItem(LISTE_KEY,on?'1':'0');}catch{/* ohne Speicher */}}

export type Tab='proben'|'plan'|'raumbuch';
export const TABS:readonly {tab:Tab;text:string}[]=[{tab:'proben',text:'Proben'},{tab:'plan',text:'Plan & Ausgabe'},{tab:'raumbuch',text:'Raumbuch'}];
/** Zu welchem Reiter ein Abschnitt oder Feld gehört (für „anzeigen“, z. B. nach dem Import oder beim Anwählen eines Punkts). */
export const TAB_VON:Readonly<Record<string,Tab>>={
  'proben-section':'proben','lab-panel':'proben','inspector':'proben',
  'size-section':'plan','scale-section':'plan','label-section':'plan','results-section':'plan','area-inspector':'plan','area-list':'plan',
  'raumbuch-section':'raumbuch'
};

export class PanelTabs{
  private tab:Tab='proben';private readonly strip=document.createElement('div');private readonly buttons=new Map<Tab,HTMLButtonElement>();private readonly sw=document.createElement('input');
  constructor(private panel:HTMLElement,private changed:()=>void=()=>{}){
    this.strip.id='panel-tabs';this.strip.className='panel-tabs';this.strip.setAttribute('role','tablist');this.strip.setAttribute('aria-label','Bereiche der Seitenleiste');
    for(const {tab,text} of TABS){
      const b=document.createElement('button');b.type='button';b.id=`tab-${tab}`;b.className='panel-tab';b.dataset.tab=tab;b.setAttribute('role','tab');b.append(document.createTextNode(text));
      if(tab==='proben'){const n=document.createElement('span');n.id='tab-proben-count';n.className='tab-count';n.hidden=true;n.setAttribute('aria-label','offene Proben');b.append(n);}
      b.onclick=()=>this.set(tab);
      b.onkeydown=e=>{const i=TABS.findIndex(x=>x.tab===tab),next=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:-1;if(next<0||next>=TABS.length)return;e.preventDefault();this.set(TABS[next].tab);this.buttons.get(TABS[next].tab)?.focus();};
      this.buttons.set(tab,b);this.strip.append(b);
    }
    const head=panel.querySelector('.panel-head');head?.after(this.strip);
    const label=document.createElement('label');label.className='liste-switch';label.title='Seitenleiste mit Reitern und einer Probenliste (Test). Aus = Seitenleiste wie bisher.';
    this.sw.type='checkbox';this.sw.id='liste-switch';this.sw.checked=listeOn();this.sw.onchange=()=>{setListe(this.sw.checked);this.apply();this.changed();};label.append(this.sw,document.createTextNode(' Neue Liste (Test)'));
    head?.querySelector('.eyebrow')?.after(label);
    this.apply();
  }
  get current(){return this.tab;}
  set(tab:Tab){this.tab=tab;this.apply();}
  /** Reiter zeigen, zu dem der Abschnitt `id` gehört (nur mit neuer Liste). */
  zeige(id:string){const t=TAB_VON[id];if(t&&listeOn())this.set(t);}
  apply(){
    const on=listeOn();this.sw.checked=on;this.panel.dataset.liste=on?'neu':'alt';this.panel.dataset.tab=this.tab;this.strip.hidden=!on;
    for(const [tab,b] of this.buttons){const sel=tab===this.tab;b.setAttribute('aria-selected',String(sel));b.tabIndex=sel?0:-1;b.classList.toggle('active',sel);}
  }
}
