const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'auth/auth-ui.js'), 'utf8');

function fixture({ signedIn = true, inCalculator = true } = {}) {
	const area = { innerHTML: '' };
	let reloads = 0;
	let resets = 0;
	let savedHistoryClears = 0;
	let prevented = 0;

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
		authAvatarUrl: () => null,
		authDisplayName: () => 'Synthetic member',
		authSignOut: () => Promise.resolve(),
		adminIsAdmin: false,
		onAuthReady() {},
		resetCalcToDefaults() { resets++; },
		histSyncClearSaved() { savedHistoryClears++; },
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
		counts: () => ({ reloads, resets, savedHistoryClears, prevented })
	};
}

test('signed-in calculator members receive one explicit reload action', () => {
	const f = fixture();
	f.context.renderAuthNav();
	assert.match(f.area.innerHTML, /class="authNavLink authNavReload"/);
	assert.match(f.area.innerHTML, /href="index\.html"/);
	assert.match(f.area.innerHTML, /aria-label="Reload calculator"/);
	assert.match(f.area.innerHTML, /onclick="return authNavReload\(event\)"/);
});

test('reload action stays off signed-out and non-calculator pages', () => {
	for (const options of [{ signedIn: false }, { signedIn: true, inCalculator: false }]) {
		const f = fixture(options);
		f.context.renderAuthNav();
		assert.doesNotMatch(f.area.innerHTML, /authNavReload/);
	}
});

test('one activation requests one ordinary reload and no reset or clear', () => {
	const f = fixture();
	assert.equal(f.context.authNavReload(f.event), false);
	assert.deepEqual(f.counts(), {
		reloads: 1,
		resets: 0,
		savedHistoryClears: 0,
		prevented: 1
	});
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
