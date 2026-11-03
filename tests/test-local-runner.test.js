// Exercise the real shell runner against disposable, synthetic test files.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const required = [
  'refresh-safety.test.js',
  'cloud-restore-safety.test.js',
  'history-sync-reconciliation.test.js'
];
const pass = "require('node:test').test('synthetic pass', () => {});\n";
const fail = "require('node:test').test('synthetic failure', () => { throw new Error('expected failure'); });\n";

function runFixture(files, mode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cyphers-test-runner-'));
  try {
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.mkdirSync(path.join(root, 'tests'));
    fs.copyFileSync(path.join(__dirname, '../scripts/test-local.sh'), path.join(root, 'scripts/test-local.sh'));
    for (const [name, contents] of Object.entries(files)) {
      fs.writeFileSync(path.join(root, 'tests', name), contents);
    }
    const env = { ...process.env, PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH };
    // This is an independent test-runner invocation, not a nested test worker.
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync('bash', [path.join(root, 'scripts/test-local.sh'), mode], {
      cwd: os.tmpdir(), env, encoding: 'utf8', timeout: 15000
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, result.stderr);
    return result;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

for (const missing of required) {
  test(`safety runner rejects missing ${missing} even when the remaining files pass`, () => {
    const files = Object.fromEntries(required.filter(name => name !== missing).map(name => [name, pass]));
    const result = runFixture(files, 'safety');
    assert.notEqual(result.status, 0, 'a partially absent safety suite must not pass');
    assert.ok(result.stderr.includes(missing), 'identify the missing required test');
  });
}

test('safety runner rejects an entirely absent safety suite', () => {
  assert.notEqual(runFixture({}, 'safety').status, 0);
});

test('full runner rejects an empty test directory', () => {
  assert.notEqual(runFixture({}, 'full').status, 0);
});

test('runner rejects an unknown suite name', () => {
  assert.equal(runFixture({ 'passing.test.js': pass }, 'unknown').status, 2);
});

test('safety runner executes only its required files and succeeds from another directory', () => {
  const files = Object.fromEntries(required.map(name => [name, pass]));
  files['outside-safety.test.js'] = fail;
  assert.equal(runFixture(files, 'safety').status, 0);
});

for (const failing of required) {
  test(`safety runner propagates failure in ${failing}`, () => {
    const files = Object.fromEntries(required.map(name => [name, name === failing ? fail : pass]));
    assert.notEqual(runFixture(files, 'safety').status, 0);
  });
}

test('full runner succeeds with passing tests', () => {
  assert.equal(runFixture({ 'passing.test.js': pass }, 'full').status, 0);
});

test('full runner discovers a failing test outside the safety list', () => {
  const files = Object.fromEntries(required.map(name => [name, pass]));
  files['other.test.js'] = fail;
  assert.notEqual(runFixture(files, 'full').status, 0);
});
