// PUB-20B: execute production scripts, never load an SDK or contact a server.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture({ signedIn = true, historyOnly = false, failure = false,
  storage = new Map(), now = 10000 } = {}) {
  const calls = [], ready = [], authReady = [], intervals = [], events = {};
  const elements = new Map();
  const user = signedIn ? { id: 'synthetic-user' } : null;
  const blocked = () => { throw new Error('Network forbidden in refresh fixture'); };
  const client = {
    auth: { onAuthStateChange() {} },
    from(table) {
      let operation;
      const query = {
        select() { operation = 'select'; return query; },
        delete() { operation = 'delete'; return query; },
        upsert(rows) { operation = 'upsert'; calls.push({ table, operation, rows }); return Promise.resolve({ error: null }); },
        eq(column, value) { calls.push({ table, filter: [column, value] }); return query; },
        not() { return query; }, order() { return query; }, maybeSingle() { return query; },
        then(ok, fail) {
          calls.push({ table, operation });
          const data = table === 'history_entries'
            ? [{ phrase: 'synthetic saved phrase', position: 0 }]
            : { settings: 'synthetic custom workspace' };
          return Promise.resolve({ data, error: failure && operation === 'select' ? new Error('synthetic offline') : null }).then(ok, fail);
        }
      };
      return query;
    }
  };
  const context = {
    console: { warn(...args) { calls.push({ warning: args[0] }); } },
    Date: class extends Date { static now() { return now; } },
    fetch: blocked, XMLHttpRequest: blocked, WebSocket: blocked,
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, { innerHTML: 'synthetic markup', classList: { toggle() {} } });
      return elements.get(id);
    } },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setInterval(fn) { intervals.push(fn); return intervals.length; }, clearInterval() {},
    setTimeout() {}, clearTimeout() {},
    sHistory: ['synthetic saved phrase'], userHistory: ['synthetic saved phrase'],
    userOpenCiphers: ['custom'], histDisplayOrder: ['custom'],
    authUser: user, getAuthClient: () => client, onAuthReady: fn => authReady.push(fn),
    settings: 'synthetic custom workspace', option: 'factory', coderainStyle: 'factory rain',
    exportCalcOptions() { return 'calcOptions = ' + JSON.stringify(['option = "factory"', 'coderainStyle = "factory rain"']); },
    isJsonString: text => { JSON.parse(text); return true; },
    importCalcOptions(options) { for (const option of options) vm.runInContext(option, context); context.settings = 'factory workspace'; },
    exportCiphersDB: () => context.settings,
    applyCalcSettingsString(settings) { context.settings = settings; return true; },
    initCalc() {}, enableDefaultCiphers() { context.userOpenCiphers = ['default']; },
    updateTables() {}, updateInterfaceColor() {}, displayCalcNotification() {},
    $(target) { return {
      ready(fn) { ready.push(fn); }, on(event, fn) { (events[event] ||= []).push(fn); },
      val(value) { calls.push({ input: target, value }); }, html() {}
    }; }
  };
  context.window = context;
  vm.createContext(context);
  const scripts = historyOnly ? ['auth/history-sync.js']
    : ['calc/reset-defaults.js', 'auth/history-sync.js', 'auth/workspace-sync.js'];
  for (const script of scripts) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', script), 'utf8'), context, { filename: script });
  context.option = 'custom'; context.coderainStyle = 'custom rain';
  return { context, calls, elements, async load() {
    ready.forEach(fn => fn()); authReady.forEach(fn => fn(user)); await settle();
  }, async tickAndUnload() {
    intervals.forEach(fn => fn()); now += 10000; intervals.forEach(fn => fn());
    await settle(); (events.beforeunload || []).forEach(fn => fn()); await settle();
  } };
}

for (const signedIn of [false, true]) {
  test(`history-only rapid loads preserve history (${signedIn ? 'signed in' : 'signed out'})`, async () => {
    const storage = new Map();
    for (const now of [10000, 11000, 12000, 13000]) {
      const f = fixture({ signedIn, historyOnly: true, storage, now });
      await f.load(); await f.tickAndUnload();
      assert.deepEqual(Array.from(f.context.sHistory), ['synthetic saved phrase']);
      assert.equal(f.calls.filter(c => c.operation === 'delete').length, 0, 'reload must not delete account history');
      assert.equal(f.calls.filter(c => c.operation === 'select').length, signedIn ? 1 : 0);
    }
  });
}

for (const signedIn of [false, true]) {
  for (const failure of [false, true]) {
    test(`calculator reload never resets or forces a save (signedIn=${signedIn}, loadFailure=${failure})`, async () => {
      // Include an old-version timing marker already present on the first load.
      const storage = new Map([['histLastLoad', '9900']]);
      for (const now of [10000, 11000, 12000, 13000, 20000]) {
        const f = fixture({ signedIn, failure, storage, now });
        await f.load();
        assert.equal(f.calls.filter(c => c.operation === 'delete').length, 0, 'reload must not delete history');
        assert.equal(f.calls.filter(c => c.operation === 'upsert').length, 0, 'reload must not force a workspace save');
        assert.deepEqual(Array.from(f.context.sHistory), ['synthetic saved phrase']);
        assert.equal(f.context.settings, 'synthetic custom workspace');
        assert.equal(f.context.option, 'custom');
        assert.equal(f.context.coderainStyle, 'custom rain');
        assert.equal(f.calls.filter(c => c.operation === 'select').length, signedIn ? 2 : 0);
        // Successful restores must stay read-only through watcher and unload.
        // Failed-load autosave policy is a separate, pre-existing concern.
        if (!failure) {
          await f.tickAndUnload();
          assert.equal(f.calls.filter(c => c.operation === 'delete' || c.operation === 'upsert').length, 0);
        }
      }
    });
  }
}

for (const signedIn of [false, true]) {
  test(`explicit reset still clears history and resets options, keeping rain (signedIn=${signedIn})`, async () => {
    const f = fixture({ signedIn });
    await f.load();
    assert.equal(f.context.resetCalcToDefaults(false), true);
    await settle();
    assert.deepEqual(Array.from(f.context.sHistory), []);
    assert.deepEqual(Array.from(f.context.userHistory), []);
    assert.equal(f.context.option, 'factory');
    assert.equal(f.context.coderainStyle, 'custom rain');
    assert.equal(f.elements.get('HistoryTableArea').innerHTML, '');
    assert.deepEqual(Array.from(f.context.userOpenCiphers), ['default']);
    assert.equal(f.calls.filter(c => c.operation === 'delete').length, signedIn ? 1 : 0);
    assert.equal(f.calls.filter(c => c.table === 'workspaces' && c.operation === 'delete').length, 0);
    if (signedIn) assert.ok(f.calls.some(c => c.table === 'history_entries' && c.filter?.[0] === 'user_id' && c.filter[1] === 'synthetic-user'));
  });
}

