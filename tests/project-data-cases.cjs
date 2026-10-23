// Shared synthetic tests for the identical F7 reader in both repositories.
const assert = require('node:assert/strict');
module.exports = async function run(create, warning) {
  let count = 0;
  const test = async (title, run) => { await run(); count++; console.log('OK F7: ' + title); };
  const fixture = () => {
    const disk = {text: '{"format":"mosaik-projekt","version":1,"objekt":"ALT","extension":{"keep":true}}', fault: '', listingFault: '', permission: 'granted', listed: true, request: 'denied', wait: null, reads: 0};
    const error = name => Object.assign(new Error('synthetisch'), {name});
    const context = {name: '26.0101 Synthetisch', dir: {
      queryPermission: async () => disk.permission,
      requestPermission: async () => (disk.permission = disk.request),
      async getFileHandle(name, opts) {
        assert.equal(name, '_Projekt.json'); assert.equal(opts, undefined, 'Keine Schreib-/Create-Option'); disk.reads++;
        const text = disk.text, fault = disk.fault, wait = disk.wait;
        if (wait) await wait;
        if (fault) throw error(fault);
        if (text === null) throw error('NotFoundError');
        return {getFile: async () => new File([text], name, {lastModified: 1234567890000})};
      },
      async *values() { if (disk.listingFault) throw error(disk.listingFault); if (disk.listed) yield {kind: 'file', name: '_Projekt.json'}; }
    }};
    const reader = create(() => {}, 40); reader.select(context);
    return {disk, context, reader};
  };
  await test('erfolgreiches Lesen mit unveränderten unbekannten Daten und Quellenbytes', async () => {
    const {disk, reader} = fixture(); assert.equal(await reader.refresh(), true); assert.equal(reader.state.status, 'ok');
    assert.equal(reader.state.stale, false); assert.equal(reader.state.data.objekt, 'ALT');
    assert.equal(reader.state.data.extension.keep, true); assert.equal(await reader.state.file.text(), disk.text);
  });
  for (const [fault, status] of [['NetworkError','network'], ['NotReadableError','read-error'], ['AbortError','read-error'], ['NotAllowedError','permission'], ['SecurityError','permission'], ['Error','read-error']]) {
    await test('Test A: ' + fault + ' erhält bekannte Angaben mit sichtbarem Warntext', async () => {
      const {disk, reader} = fixture(); await reader.refresh(); disk.text = '{"objekt":"NEU"}'; disk.fault = fault;
      await reader.refresh(); assert.equal(reader.state.status, status); assert.equal(reader.state.stale, true);
      assert.equal(reader.state.data.objekt, 'ALT'); assert.match(warning(reader.state), /möglicherweise veraltet/);
    });
  }
  await test('neues erreichbares Projekt ohne Datei ist kein Netzwerkfehler', async () => {
    const {disk, reader} = fixture(); disk.text = null; disk.listed = false; await reader.refresh();
    assert.equal(reader.state.status, 'missing'); assert.equal(reader.state.stale, false); assert.equal(warning(reader.state), '');
  });
  await test('fehlende zuvor geladene Datei erhält Werte mit Warnung', async () => {
    const {disk, reader} = fixture(); await reader.refresh(); disk.text = null; disk.listed = false; await reader.refresh();
    assert.equal(reader.state.status, 'missing'); assert.equal(reader.state.stale, true); assert.equal(reader.state.data.objekt, 'ALT');
  });
  await test('NotFound bei weiter vorhandener Datei wird nicht als neues Projekt behandelt', async () => {
    const {disk, reader} = fixture(); disk.fault = 'NotFoundError'; await reader.refresh();
    assert.equal(reader.state.status, 'read-error'); assert.equal(reader.state.stale, true);
  });
  await test('nicht erreichbare Verzeichnisauflistung verhindert falsche Missing-Erkennung', async () => {
    const {disk, reader} = fixture(); disk.text = null; disk.listingFault = 'NetworkError'; await reader.refresh();
    assert.equal(reader.state.status, 'network'); assert.equal(reader.state.stale, true);
  });
  for (const text of ['', '{', 'null', '[]', '"Text"']) await test('ungültiges JSON/Objekt: ' + JSON.stringify(text), async () => {
    const {disk, reader} = fixture(); await reader.refresh(); disk.text = text; await reader.refresh();
    assert.equal(reader.state.status, 'invalid'); assert.equal(reader.state.stale, true); assert.equal(reader.state.data.objekt, 'ALT');
  });
  for (const text of ['{"format":"fremd"}', '{"version":2}']) await test('nicht unterstützter Inhalt: ' + text, async () => {
    const {disk, reader} = fixture(); disk.text = text; await reader.refresh(); assert.equal(reader.state.status, 'unsupported'); assert.equal(reader.state.stale, true);
  });
  await test('gültiges leeres Objekt ist ein erfolgreicher aktueller Stand', async () => {
    const {disk, reader} = fixture(); await reader.refresh(); disk.text = '{}'; await reader.refresh();
    assert.equal(reader.state.status, 'ok'); assert.equal(Object.keys(reader.state.data).length, 0); assert.equal(reader.state.stale, false);
  });
  await test('Berechtigungsproblem und ausdrückliche Wiederholung', async () => {
    const {disk, reader} = fixture(); disk.permission = 'prompt'; await reader.refresh();
    assert.equal(reader.state.status, 'permission'); assert.equal(disk.reads, 0);
    disk.request = 'granted'; await reader.refresh(true); assert.equal(reader.state.status, 'ok'); assert.equal(disk.reads, 1);
  });
  await test('Test C: erfolgreiche Wiederholung ersetzt alte Werte und entfernt Warnung', async () => {
    const {disk, reader} = fixture(); await reader.refresh(); disk.fault = 'NetworkError'; await reader.refresh();
    disk.fault = ''; disk.text = '{"objekt":"NEU"}'; await reader.refresh();
    assert.equal(reader.state.data.objekt, 'NEU'); assert.equal(reader.state.stale, false); assert.equal(warning(reader.state), '');
  });
  await test('keine Daten nach Fehler und danach bestätigt fehlende Datei', async () => {
    const {disk, reader} = fixture(); disk.fault = 'NetworkError'; await reader.refresh();
    disk.fault = ''; disk.text = null; disk.listed = false; await reader.refresh();
    assert.equal(reader.state.status, 'missing'); assert.equal(reader.state.stale, false);
  });
  await test('Test D: spätes A-Ergebnis kann B nicht verändern', async () => {
    const a = fixture(), b = fixture(); let release;
    a.disk.wait = new Promise(r => {release = r;}); const pending = a.reader.refresh();
    a.reader.select(b.context); b.disk.text = '{"objekt":"B"}'; await a.reader.refresh(); release();
    assert.equal(await pending, false); assert.equal(a.reader.state.data.objekt, 'B'); assert.equal(a.reader.state.stale, false);
  });
  await test('später Erfolg desselben Projekts kann neuere Fehlerwarnung nicht löschen', async () => {
    const {disk, reader} = fixture(); await reader.refresh(); let release;
    disk.wait = new Promise(r => {release = r;}); const old = reader.refresh(); disk.wait = null; disk.fault = 'NetworkError'; await reader.refresh(); release();
    assert.equal(await old, false); assert.equal(reader.state.stale, true); assert.equal(reader.state.status, 'network');
  });
  await test('Timeout und später Abschluss verändern keinen bestätigten neueren Stand', async () => {
    const {disk, reader} = fixture(); await reader.refresh(); let release;
    disk.wait = new Promise(r => {release = r;}); await reader.refresh(); assert.equal(reader.state.status, 'network'); assert.equal(reader.state.stale, true);
    disk.wait = null; disk.text = '{"objekt":"Aktuell"}'; await reader.refresh(); release(); await Promise.resolve();
    assert.equal(reader.state.data.objekt, 'Aktuell'); assert.equal(reader.state.stale, false);
  });
  await test('Projektabmeldung verwirft auch ein noch laufendes Lesen', async () => {
    const {disk, reader} = fixture(); let release; disk.wait = new Promise(r => {release = r;}); const old = reader.refresh();
    reader.select(null); release(); assert.equal(await old, false); assert.equal(reader.state.status, 'idle'); assert.equal(reader.state.known, false);
  });
  console.log(`F7: ${count} synthetische Reader-Regressionen bestanden`);
};
