// Real sync scripts in an isolated VM; no SDK and no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture(kind, reply) {
  const history = kind === 'history';
  const calls = [], ready = [], authReady = [], intervals = [], events = {};
  let now = 10000;
  const blocked = () => { throw new Error('Network forbidden'); };
  const client = { auth: { onAuthStateChange() {} }, rpc(name, args) {
    calls.push({ operation: 'rpc', table: 'history_entries', name, args });
    return Promise.resolve({ error: null });
  }, from(table) {
    let operation;
    const query = {
      select() { operation = 'select'; return query; },
      delete() { operation = 'delete'; return query; },
      upsert(rows) { calls.push({ operation: 'upsert', table, rows }); return Promise.resolve({ error: null }); },
      eq(column, value) { calls.push({ filter: [column, value] }); return query; },
      not() { return query; }, order() { return query; }, maybeSingle() { return query; },
      then(ok, fail) {
        calls.push({ operation, table });
        return Promise.resolve().then(() => operation === 'select' ? reply() : { error: null }).then(ok, fail);
      }
    };
    return query;
  } };
  const context = {
    console: { warn(...args) { calls.push({ warning: args[0] }); } },
    Date: class extends Date { static now() { return now; } },
    fetch: blocked, XMLHttpRequest: blocked, WebSocket: blocked,
    document: { getElementById() { return { classList: { toggle() {} } }; } },
    setInterval(fn) { intervals.push(fn); return intervals.length; }, clearInterval() {},
    setTimeout() {}, clearTimeout() {},
    authUser: { id: 'synthetic-user' }, getAuthClient: () => client,
    onAuthReady: fn => authReady.push(fn), sHistory: [], settings: 'local workspace',
    exportCiphersDB: () => context.settings,
    applyCalcSettingsString(settings) { context.settings = settings; return true; },
    updateTables() {},
    $(target) { return { ready(fn) { ready.push(fn); }, on(event, fn) { (events[event] ||= []).push(fn); } }; }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'auth', `${kind}-sync.js`), 'utf8'), context);
  const prefix = history ? 'hist' : 'ws';
  return { context, calls,
    writes: () => calls.filter(c => c.operation === 'delete' || c.operation === 'upsert' || c.operation === 'rpc'),
    async load() { ready.forEach(fn => fn()); authReady.forEach(fn => fn(context.authUser)); await settle(); },
    async tick() { now += 10000; intervals.forEach(fn => fn()); await settle(); },
    async unload() { (events.beforeunload || []).forEach(fn => fn()); await settle(); },
    save: force => context[`${prefix}SyncSave`](force),
    retry: () => context[`${prefix}SyncLoad`](),
    respond(fn) { reply = fn; }
  };
}
for (const kind of ['history', 'workspace']) {
  test(`${kind}: pending retry blocks writes and successful retry resumes ordinary edits`, async () => {
    const data = kind === 'history' ? [{ phrase: 'remote phrase', position: 0 }] : { settings: 'remote workspace' };
    const f = fixture(kind, () => ({ data, error: null }));
    await f.load();
    let release;
    f.respond(() => new Promise(resolve => { release = resolve; }));
    const pending = f.retry();
    await settle();
    f.context.sHistory.push('local phrase'); f.context.settings = 'local workspace';
    await f.tick(); await f.tick(); await f.unload(); await f.save(true);
    assert.equal(f.writes().length, 0, 'no write while read is held');
    release({ error: new Error('offline'), data: null }); await pending;
    await f.tick(); await f.unload();
    assert.equal(f.writes().length, 0, 'failed retry revokes write permission');
    f.respond(() => ({ data, error: null }));
    await f.retry(); await settle();
    f.context.sHistory.push('post-restore edit'); f.context.settings = 'post-restore edit';
    await f.tick(); await f.tick(); await f.unload();
    assert.ok(f.writes().some(c => c.operation === (kind === 'history' ? 'rpc' : 'upsert')));
    if (kind === 'history') {
      assert.ok(f.context.sHistory.includes('remote phrase'));
      assert.ok(f.context.sHistory.includes('local phrase'));
    }
  });
  test(`${kind}: initial held read blocks writes, then absence permits edits`, async () => {
    let release;
    const f = fixture(kind, () => new Promise(resolve => { release = resolve; }));
    await f.load(); await f.tick(); await f.unload(); await f.save(true);
    assert.equal(f.writes().length, 0);
    release({ data: kind === 'history' ? [] : null, error: null }); await settle();
    await f.tick(); await f.unload();
    assert.equal(f.writes().length, 0, 'adopting empty cloud is read-only');
    f.context.sHistory.push('new phrase'); f.context.settings = 'new workspace';
    await f.tick(); await f.tick(); await f.unload();
    assert.ok(f.writes().some(c => c.operation === (kind === 'history' ? 'rpc' : 'upsert')));
    if (kind === 'workspace') assert.equal(await f.save(true), true);
  });
}
const validCipher = 'new cipher("Synthetic", "Test", 0, 50, 50, [97], [1], true, true, false)';
const validSettings = `calcOptions = []\ncipherList = [${validCipher}]`;
function useRealSettingsParser(f) {
  Object.assign(f.context, {
    calcOptionsArr: ["'option'+' = '+option"], toggleCodeRain() {},
    initCalc() {}, updateInterfaceColor() {}, userDBlive: []
  });
  for (const script of ['calc/gematria.js', 'calc/export-csv.js', 'calc/localstorage.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', script), 'utf8'), f.context);
  }
}
for (const settings of [
  `calcOptions = [broken]\ncipherList = [${validCipher}]`,
  `calcOptions = ["option = broken"]\ncipherList = [${validCipher}]`,
  `calcOptions = ["notAnOption = 42"]\ncipherList = [${validCipher}]`,
  `calcOptions = [42]\ncipherList = [${validCipher}]`,
  'calcOptions = []\ncipherList = [new cipher(broken)]',
  `calcOptions = []\ncipherList = [${validCipher},new cipher(broken)]`,
  'not a settings blob'
]) {
  test(`workspace: actual parser refuses malformed cloud blob ${settings}`, async () => {
    const f = fixture('workspace', () => ({ data: { settings }, error: null }));
    useRealSettingsParser(f);
    await f.load(); await f.tick(); await f.tick(); await f.unload(); await f.save(true);
    assert.equal(f.writes().length, 0);
    assert.equal(f.context.wsSyncLoaded, false);
    assert.ok(f.calls.some(c => c.warning));
    f.respond(() => ({ data: { settings: validSettings }, error: null }));
    await f.retry();
    assert.equal(f.context.wsSyncLoaded, true, 'valid blob repairs the blocked state');
    assert.equal(f.context.cipherList[0].cipherName, 'Synthetic');
    f.context.settings = 'post-restore settings';
    assert.equal(await f.save(), true);
  });
}
test('workspace: real export/import restores options and ciphers before allowing a save', async () => {
  const f = fixture('workspace', () => ({ data: { settings: blob }, error: null }));
  useRealSettingsParser(f);
  for (const script of ['calc/export-csv.js', 'calc/export.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', script), 'utf8'), f.context);
  }
  f.context.toggleCodeRain = () => {};
  f.context.calcOptionsArr = ["'syntheticOption'+' = '+syntheticOption"];
  f.context.syntheticOption = 'saved option';
  f.context.cipherList = f.context.ciphersFromListBody(validCipher.slice(10));
  const blob = f.context.exportCiphersDB(true);
  f.context.syntheticOption = 'local option';
  await f.load(); await f.tick(); await f.unload();
  assert.equal(f.context.syntheticOption, 'saved option');
  assert.equal(f.context.cipherList[0].cipherName, 'Synthetic');
  assert.equal(f.writes().length, 0);
  f.context.syntheticOption = 'edited option';
  await f.tick(); await f.tick();
  assert.equal(f.writes().length, 1);
});
for (const caption of ['My [saved] table', String.raw`My [saved] "quoted" \\ table ] [`, String.raw`["nested"] backslash before bracket \] and trailing \\`]) {
  test(`workspace: actual exporter restores bracketed caption ${caption}`, async () => {
    const f = fixture('workspace', () => ({ data: { settings: blob }, error: null }));
    useRealSettingsParser(f);
    for (const script of ['calc/ciphers.js', 'calc/export.js']) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, '..', script), 'utf8'), f.context);
    }
    f.context.calcOptionsArr = ["'optHistTableCaption'+' = '+JSON.stringify(optHistTableCaption)"];
    f.context.optHistTableCaption = caption;
    const savedCiphers = JSON.stringify(f.context.cipherList);
    assert.equal(f.context.cipherList.length, 173, 'exercise every shipped cipher');
    const blob = f.context.exportCiphersDB(true);
    f.context.optHistTableCaption = 'local caption';
    f.context.cipherList = [];
    await f.load(); await f.tick(); await f.unload();
    assert.equal(f.context.wsSyncLoaded, true, 'strict restore accepts the actual export');
    assert.equal(f.context.optHistTableCaption, caption);
    assert.equal(JSON.stringify(f.context.cipherList), savedCiphers);
    assert.equal(f.writes().length, 0, 'restore alone never writes');
    assert.equal(f.calls.some(c => c.warning), false);
    f.context.optHistTableCaption = caption + ' edited';
    await f.tick(); await f.tick();
    assert.equal(f.writes().length, 1, 'ordinary edit saves after successful restore');
    assert.equal(f.writes()[0].rows.settings, f.context.exportCiphersDB(true));
  });
}
for (const kind of ['history', 'workspace']) {
  test(`${kind}: unsuccessful first load can be retried successfully`, async () => {
    const f = fixture(kind, () => ({ error: new Error('offline') }));
    await f.load();
    f.respond(() => ({ data: kind === 'history' ? [{ phrase: 'saved', position: 0 }] : { settings: 'saved' }, error: null }));
    await f.retry();
    f.context.sHistory.push('edited'); f.context.settings = 'edited';
    await f.tick(); await f.tick(); await f.unload();
    assert.ok(f.writes().some(c => c.operation === (kind === 'history' ? 'rpc' : 'upsert')));
  });
  test(`${kind}: explicit clear remains usable after unsuccessful load`, async () => {
    const f = fixture(kind, () => ({ error: new Error('offline') }));
    await f.load();
    const clear = kind === 'history' ? f.context.histSyncClearSaved : f.context.wsSyncClear;
    assert.equal(await clear(), true);
    assert.equal(f.writes().length, 1);
    assert.equal(f.writes()[0].operation, 'delete');
    assert.ok(f.calls.some(c => c.filter?.[0] === 'user_id' && c.filter[1] === 'synthetic-user'));
    await f.tick(); await f.tick(); await f.unload();
    assert.equal(f.writes().length, 1, 'explicit clear does not authorize automatic saves');
  });
}
for (const [kind, invalid] of [
  ['history', null], ['history', {}], ['history', [{ position: 0 }]],
  ['history', [{ phrase: 42, position: 0 }]],
  ['workspace', {}], ['workspace', { settings: '' }], ['workspace', { settings: 42 }]
]) {
  test(`${kind}: malformed response ${JSON.stringify(invalid)} is not empty cloud`, async () => {
    const f = fixture(kind, () => ({ data: invalid, error: null }));
    await f.load(); await f.tick(); await f.tick(); await f.unload(); await f.save();
    assert.equal(f.writes().length, 0);
    assert.ok(f.calls.some(c => c.warning));
  });
}
for (const result of ['false', 'throw']) {
  test(`workspace: apply ${result} does not authorize saves`, async () => {
    const f = fixture('workspace', () => ({ data: { settings: 'unreadable' }, error: null }));
    f.context.applyCalcSettingsString = () => {
      if (result === 'throw') throw new Error('synthetic restore failure');
      return false;
    };
    await f.load(); await f.tick(); await f.tick(); await f.unload();
    assert.equal(f.writes().length, 0);
    assert.ok(f.calls.some(c => c.warning));
    assert.equal(f.context.wsRestoreInProgress, false);
  });
}
test('workspace: force bypasses only unchanged hash, never failed restoration', async () => {
  const f = fixture('workspace', () => ({ error: new Error('offline') }));
  await f.load();
  assert.equal(await f.save(true), false);
  assert.equal(f.writes().length, 0);
});
for (const kind of ['history', 'workspace']) {
  for (const rejection of [false, true]) {
    test(`${kind}: failed initial read never authorizes watcher/unload writes (rejection=${rejection})`, async () => {
      const f = fixture(kind, () => {
        if (rejection) throw new Error('synthetic offline');
        return { error: new Error('synthetic offline'), data: null };
      });
      await f.load();
      await f.tick(); await f.tick(); await f.unload(); await f.save();
      assert.equal(f.writes().length, 0);
      assert.ok(f.calls.some(c => c.warning), 'failure is reported');
    });
  }
}
