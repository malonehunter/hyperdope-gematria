const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'auth/auth-ui.js'), 'utf8');

function fixture({ signedIn = true, inCalculator = true, syncLoaded = true, syncSaving = false } = {}) {
	const area = { innerHTML: '' };
	let reloads = 0;
	let resets = 0;
	let localHistoryClears = 0;
	let savedHistoryClears = 0;
	let prevented = 0;
	let confirmationAttempts = 0;
	let notifications = 0;

	const context = {
		console,
		document: {
			getElementById(id) { return id === 'authNavArea' ? area : null; }
		},
		location: {
			hostname: 'example.test', search: '', pathname: '/index.html',
			reload() { reloads++; }
		},
		authIsConfigured: () => true,
		authUser: signedIn ? { id: 'synthetic-member' } : null,
		histSyncLoaded: syncLoaded,
		histSyncSaving: syncSaving,
		authAvatarUrl: () => null,
		authDisplayName: () => 'Synthetic member',
		authSignOut: () => Promise.resolve(),
		adminIsAdmin: false,
		onAuthReady() {},
		resetCalcToDefaults() { resets++; },
		phraseBoxKeypress(key) { if (key === 36) localHistoryClears++; },
		histSyncClearSaved() { savedHistoryClears++; return Promise.resolve(true); },
		profileConfirmClick() { confirmationAttempts++; return confirmationAttempts > 1; },
		displayCalcNotification() { notifications++; },
		$() { return { ready() {} }; }
	};
	if (inCalculator) context.toggleProfileMenu = () => {};
	context.window = context;

	vm.createContext(context);
	vm.runInContext(source, context, { filename: 'auth/auth-ui.js' });

	return {
		context,
		area,
		event: { preventDefault() { prevented++; } },
		counts: () => ({ reloads, resets, localHistoryClears, savedHistoryClears, prevented, confirmationAttempts, notifications })
	};
}

test('signed-in calculator members receive one explicit history-clear action', () => {
	const f = fixture();
	f.context.renderAuthNav();
	assert.match(f.area.innerHTML, /class="authNavLink authNavHistoryClear"/);
	assert.match(f.area.innerHTML, /aria-label="Clear saved phrase history"/);
	assert.match(f.area.innerHTML, /onclick="return authNavClearHistory\(this,event\)"/);
});

test('history-clear action stays off signed-out and non-calculator pages', () => {
	for (const options of [{ signedIn: false }, { signedIn: true, inCalculator: false }]) {
		const f = fixture(options);
		f.context.renderAuthNav();
		assert.doesNotMatch(f.area.innerHTML, /authNavHistoryClear/);
	}
});

test('two deliberate activations clear local and saved history without reload or reset', async () => {
	const f = fixture();
	assert.equal(f.context.authNavClearHistory({}, f.event), false);
	assert.deepEqual(f.counts(), {
		reloads: 0,
		resets: 0,
		localHistoryClears: 0,
		savedHistoryClears: 0,
		prevented: 1,
		confirmationAttempts: 1,
		notifications: 0
	});
	assert.equal(f.context.authNavClearHistory({}, f.event), false);
	await Promise.resolve();
	assert.deepEqual(f.counts(), {
		reloads: 0,
		resets: 0,
		localHistoryClears: 1,
		savedHistoryClears: 1,
		prevented: 2,
		confirmationAttempts: 2,
		notifications: 1
	});
});

test('history clear waits until saved history activity has settled', async () => {
	for (const options of [{ syncLoaded: false }, { syncSaving: true }]) {
		const f = fixture(options);
		f.context.authNavClearHistory({}, f.event);
		f.context.authNavClearHistory({}, f.event);
		await Promise.resolve();
		assert.equal(f.counts().localHistoryClears, 0);
		assert.equal(f.counts().savedHistoryClears, 0);
		assert.equal(f.counts().notifications, 1);
	}
});

test('every html consumer carries the current auth ui content key', () => {
	const key = crypto.createHash('sha256').update(source).digest('hex').slice(0, 16);
	const consumers = fs.readdirSync(root)
		.filter(name => name.endsWith('.html'))
		.map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')])
		.filter(([, html]) => html.includes('auth/auth-ui.js'));
	assert.ok(consumers.length > 0, 'the test must find served auth ui consumers');
	for (const [name, html] of consumers) {
		assert.match(html, new RegExp('auth/auth-ui\\.js\\?v=' + key + '(?:"|&)'), name);
	}
});
