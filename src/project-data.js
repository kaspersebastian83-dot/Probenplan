/* F7-READER-START: same read-only state machine in LabelKit and PlanKit. */
function createProjectDataReader(onChange = () => {}, timeout = 10000) {
  let context = null, serial = 0;
  const empty = () => ({status: 'idle', data: {}, file: null, known: false, stale: false, checking: false});
  let state = empty();
  const notify = () => onChange(state);
  const failure = error => ({status: error?.name === 'SyntaxError' || error?.name === 'EncodingError' ? 'invalid'
    : ['NotAllowedError', 'SecurityError'].includes(error?.name) ? 'permission'
    : ['NetworkError', 'TimeoutError'].includes(error?.name) || (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'network' : 'read-error'});
  async function read(dir, request) {
    try {
      if (dir.queryPermission && await dir.queryPermission({mode: 'read'}) !== 'granted') {
        if (!request || !dir.requestPermission || await dir.requestPermission({mode: 'read'}) !== 'granted') return {status: 'permission'};
      }
      const original = await (await dir.getFileHandle('_Projekt.json')).getFile();
      const bytes = await original.arrayBuffer();
      let text;
      try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
      catch { return {status: 'invalid'}; }
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {status: 'invalid'};
      if ((data.format !== undefined && data.format !== 'mosaik-projekt') || (data.version !== undefined && data.version !== 1)) return {status: 'unsupported'};
      // Memory snapshot: a confirmed stale export must not pretend that a later
      // unreadable/replaced disk file supplied these values or its checksum.
      return {status: 'ok', data, file: new File([bytes], '_Projekt.json', {lastModified: original.lastModified})};
    } catch (error) {
      if (error?.name !== 'NotFoundError') return failure(error);
      // A missing file is not the same as an inaccessible/disconnected directory.
      try {
        for await (const h of dir.values()) if (h.name === '_Projekt.json') return {status: 'read-error'};
        return {status: 'missing'};
      } catch (listingError) { return failure(listingError); }
    }
  }
  return {
    get context() { return context; }, get state() { return state; },
    select(next) {
      if (context === next) return;
      context = next; serial++; state = empty(); notify();
    },
    async refresh(request = false) {
      if (!context) return false;
      const origin = context, ticket = ++serial;
      state = {...state, checking: true}; notify();
      let timer;
      const result = await Promise.race([read(origin.dir, request), new Promise(resolve => {
        timer = setTimeout(() => resolve({status: 'network'}), timeout);
      })]);
      clearTimeout(timer);
      if (context !== origin || serial !== ticket) return false;
      if (result.status === 'ok') state = {...result, known: true, stale: false, checking: false};
      else if (result.status === 'missing' && !state.known) state = {...empty(), status: 'missing'};
      else state = {...state, status: result.status, stale: true, checking: false};
      notify(); return true;
    }
  };
}
function projectDataWarning(state) {
  const reasons = {missing: 'Die zuvor geladene _Projekt.json fehlt jetzt.', permission: 'Der Lesezugriff auf _Projekt.json fehlt.',
    invalid: '_Projekt.json enthält ungültige oder unvollständige Projektdaten.', unsupported: '_Projekt.json verwendet ein nicht unterstütztes Format.',
    network: '_Projekt.json konnte wegen einer Verbindungsunterbrechung oder Zeitüberschreitung nicht aktualisiert werden.',
    'read-error': '_Projekt.json konnte nicht gelesen werden. Bitte auch die Verbindung zum Projektordner prüfen.'};
  return state.stale ? (reasons[state.status] || 'Die Aktualisierung ist noch nicht bestätigt.') +
    ' Gemeinsame Projektdaten möglicherweise veraltet. ' + (state.known ? 'Die zuletzt erfolgreich gelesenen Angaben bleiben erhalten.' : 'Es liegen noch keine bestätigten Angaben vor.') : '';
}
/* F7-READER-ENDE */

export {createProjectDataReader, projectDataWarning};
