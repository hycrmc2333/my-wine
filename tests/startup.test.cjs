const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = process.env.WINE_TEST_ROOT || path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const classics = JSON.parse(fs.readFileSync(path.join(root, 'cocktails.json'), 'utf8'));
const response = (data, ok = true) => ({ok, json: async () => data});
const settle = () => new Promise(resolve => setTimeout(resolve, 25));

async function boot(t, {optional = async () => response(null, false), required = async () => response(classics), hash = ''} = {}) {
  const dom = new JSDOM(html, {url: `https://hycrmc2333.github.io/my-wine/${hash}`, runScripts: 'outside-only'});
  t.after(() => dom.window.close());
  dom.window.scrollTo = () => {};
  dom.window.matchMedia = () => ({matches: false});
  dom.window.fetch = file => file === 'cocktails.json' ? required() : optional();
  dom.window.eval(script);
  await settle();
  return dom.window;
}

test('missing optional dataset does not block 102 classics or core interactions', async t => {
  const w = await boot(t);
  const d = w.document;
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length, 102);
  assert.equal(d.querySelector('#retry'), null);
  assert.equal(d.querySelector('#nav-innovations').hidden, true);
  assert.equal(d.querySelector('#catalog-size').textContent, '102 款 IBA 经典');
  const search = d.querySelector('#search');
  search.value = 'negroni';
  search.dispatchEvent(new w.Event('input', {bubbles: true}));
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length, 1);
  d.querySelector('[data-save="negroni"]').click();
  assert.deepEqual(JSON.parse(w.localStorage.getItem('my-wine-favorites')), ['negroni']);
  w.location.hash = '#favorites';
  await settle();
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length, 1);
  w.location.hash = '#cocktail/negroni';
  await settle();
  assert.match(d.querySelector('h1').textContent, /Negroni/i);
  assert.ok(d.querySelector('#ingredients'));
});

test('an unfinished optional request does not delay the classic menu', async t => {
  const w = await boot(t, {optional: () => new Promise(() => {})});
  assert.equal(w.document.querySelectorAll('#cocktail-grid .cocktail-card').length, 102);
});

test('malformed optional JSON does not replace the working menu with an error', async t => {
  const w = await boot(t, {optional: async () => ({ok: true, json: async () => {throw new SyntaxError('bad JSON');}})});
  assert.equal(w.document.querySelectorAll('#cocktail-grid .cocktail-card').length, 102);
});

test('unavailable innovations link falls back to the classic menu', async t => {
  const w = await boot(t, {hash: '#innovations'});
  assert.equal(w.document.querySelectorAll('#cocktail-grid .cocktail-card').length, 102);
  assert.equal(w.document.querySelector('#nav-collection').getAttribute('aria-current'), 'page');
});

test('a required-data failure offers a working retry', async t => {
  let available = false;
  const w = await boot(t, {required: async () => response(classics, available)});
  assert.ok(w.document.querySelector('#retry'));
  available = true;
  w.document.querySelector('#retry').click();
  await settle();
  assert.equal(w.document.querySelectorAll('#cocktail-grid .cocktail-card').length, 102);
});

test('available optional recipes enable their navigation without changing classic count', async t => {
  const innovation = {...classics[0], id: 'test-innovation', category: 'innovations', bar: {name: 'Test bar'}};
  const w = await boot(t, {optional: async () => response([innovation])});
  assert.equal(w.document.querySelectorAll('#cocktail-grid .cocktail-card').length, 102);
  assert.equal(w.document.querySelector('#nav-innovations').hidden, false);
  assert.match(w.document.querySelector('#catalog-size').textContent, /1 款酒吧原创/);
  w.location.hash = '#innovations';
  await settle();
  assert.equal(w.document.querySelectorAll('#cocktail-grid .cocktail-card').length, 1);
});
