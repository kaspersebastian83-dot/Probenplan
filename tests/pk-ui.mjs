// Bedienung der einfachen Oberfläche (PlanKit 2.0) für die Browsertests: Schritt wählen, Werkzeug, „Mehr …“, Plan, Ausgabe.
// Leitfaden alt → neu (für Suites aus der Zeit vor 2.0):
//   Werkzeugleiste links [data-mode=…]  → modus(page,'sample'|'fire'|'edit'|'navigate'|'area-draw'|'area-edit')
//   „↓ Export …“ + „↓ Bild exportieren“ → schritt(page,3) + ausgeben(page)   (runtime.openExport/closeExport tun das ebenfalls)
//   „＋ Plan“/„＋ Skizze“, Planleiste     → schritt(page,1) – Planliste, #sheet-add, #sheet-sketch; Plan wechseln: plan(page,i)
//   Drehen/Zuschnitt/Ausrichten/Entzerren, Maßstab → vorbereiten(page,'crop-start') (wechselt nach ①)
//   „Proben übernehmen …“               → proben(page) (②, Kopf der Probenliste bzw. großer Knopf im Leer-Zustand)
//   „Ergebnisse“ (Kopfzeile)            → ergebnisse(page) („Ergebnisfarben zeigen“ unter der Probenliste in ②)
//   Raumbuch, Wandansichten, Punktgröße, Beschriftung → schritt(page,3)
//   Projektordner, Projektdatei, Notfallkopie, Projektdaten, Kurzanleitung → mehr(page,'pk-m-…')
//   alte Listen „Noch zu platzieren“/„Markierungen“ → Probenliste: zeile(page,'P1'), Menü je Zeile: zeilenMenue(page,'P1','show'|…)
export async function aktuell(page){return page.evaluate(()=>document.body.dataset.pkSchritt);}
/** Schritt ①/②/③ über den Kreis auf der Karte wählen. */
export async function schritt(page,n){
 const s=String(n);if(await aktuell(page)===s)return;
 await page.locator(`[data-pk-step="${s}"]`).click();await page.waitForFunction(s=>document.body.dataset.pkSchritt===s,s);
}
/** Eintrag aus „Mehr …“ (Fußleiste links). */
export async function mehr(page,id){
 await page.locator('#pk-mehr').click();const e=page.locator(`#mosaikMehrPop #${id}`);await e.waitFor();await e.click();
}
/** Flächen-Ansicht (Mehr › Schadensflächen …). */
export async function flaechen(page){if(await aktuell(page)!=='f')await mehr(page,'pk-m-flaechen');await page.waitForFunction(()=>document.body.dataset.pkSchritt==='f');}
/** Werkzeug wählen wie früher in der Werkzeugleiste: erst in den passenden Schritt, dann das Werkzeug (Zustand `mode` wie bisher). */
export async function modus(page,m){
 if(m==='area-draw'||m==='area-edit')await flaechen(page);else if(m!=='navigate')await schritt(page,2);
 await page.evaluate(m=>{const b=document.querySelector(`button[data-mode="${m}"]`);if(!b)throw Error(`kein Werkzeug ${m}`);if(b.disabled)throw Error(`Werkzeug ${m} gesperrt`);b.click();},m);
}
/** Knopf aus „Plan vorbereiten“/„Maßstab & Norden“ (Schritt ①). */
export async function vorbereiten(page,id){await schritt(page,1);await page.locator(`#${id}`).click();}
/** Plan wechseln über die Plan-Chips oben rechts (ab 5 Plänen Auswahlliste). */
export async function plan(page,i){
 const sel=page.locator('#pk-plan-wahl');if(await sel.count()){await sel.selectOption(String(i));return;}
 await page.locator(`#pk-plaene [data-pk-sheet="${i}"]`).click();
}
/** „Proben übernehmen …“ in ② (Kopf der Probenliste oder großer Knopf im Leer-Zustand). */
export async function proben(page){
 await schritt(page,2);const klein=page.locator('#lab-import');if(await klein.isVisible())await klein.click();else await page.locator('#pk-import-gross').click();
}
/** „Ergebnisfarben zeigen“ (unter der Probenliste in ②). */
export async function ergebnisse(page){await schritt(page,2);await page.locator('#results-toggle').click();}
/** Hauptaktion in ③ („… speichern →“); nach einer Ausgabe „Erneut ausgeben“. */
export async function ausgeben(page){
 await schritt(page,3);const haupt=page.locator('#pk-haupt');
 if(await haupt.getAttribute('data-aktion')==='ausgeben')await haupt.click();else await page.locator('#pk-neben[data-aktion="ausgeben"]').click();
}
/** Zeile der Probenliste – Filter „Platziert“ (alle Gruppen offen; fertige Räume sind sonst zugeklappt) bzw. „Offen“ für offene Proben. */
export async function zeile(page,label,{filter='platziert'}={}){
 await schritt(page,2);if(await page.locator(`#filter-${filter}`).getAttribute('aria-pressed')!=='true')await page.locator(`#filter-${filter}`).click();
 return page.locator(`.pl-item[data-label="${label}"] .pl-row`);
}
/** Menü „⋯“ einer Zeile: act = show | pick | neu | back | remove | del (Im Plan zeigen, …). */
export async function zeilenMenue(page,label,act){
 await zeile(page,label,{filter:act==='remove'?'offen':'platziert'});await page.locator(`.pl-item[data-label="${label}"] .pl-more`).click();await page.locator(`.pl-menu button[data-act="${act}"][data-label="${label}"]`).click();
}
/** Spalte rechts öffnen (L / Lasche). */
export async function spalte(page){if(!await page.evaluate(()=>document.body.classList.contains('panel-open')))await page.locator('#panel-toggle').click();}
/** Schritt ③ › „Darstellung“ › „Ergebniskarte einstellen“ aufklappen. */
export async function ergebniskarte(page){await schritt(page,3);await page.evaluate(()=>{const d=document.getElementById('pk-ergebniskarte');if(d&&!d.open)d.open=true;});}
/** n-te Markierung des aktiven Plans wählen (früher „Markierungen“-Liste): über die Probenliste (Filter „Alle“). */
export async function markierung(page,n=0){
 const id=await page.locator('#marks>[data-id]').nth(n).getAttribute('data-id');await zeile(page,'');
 await page.locator(`.pl-row[data-pid="${id}"]`).click();await offenFilter(page);
}
/** Fläche aus der Flächenliste wählen (Flächen-Ansicht). */
export async function flaeche(page,n=0){await flaechen(page);await page.locator('.area-row').nth(n).click();}
/** „Probenliste speichern …“ (Menü ⋯ oben in der Probenliste, ②). */
export async function probenlisteSpeichern(page){await schritt(page,2);await page.locator('#proben-more').click();await page.locator('#proben-save').click();}
/** Markierung mit bekannter Kennung (id) wählen – über die Probenliste (Filter „Alle“) in ②. */
export async function markierungId(page,id){await zeile(page,'');await page.locator(`.pl-row[data-pid="${id}"]`).click();await offenFilter(page);}
/** Filter der Probenliste zurück auf „Offen“ (Standard), damit [data-plabel] die offenen Proben findet. */
async function offenFilter(page){const f=page.locator('#filter-offen');if(await f.isVisible()&&await f.getAttribute('aria-pressed')!=='true')await f.click();}
