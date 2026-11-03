const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = process.env.WINE_TEST_ROOT || path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pantry = JSON.parse(fs.readFileSync(path.join(root,'pantry.json'),'utf8'));
const innovations = JSON.parse(fs.readFileSync(path.join(root,'innovations.json'),'utf8'));
const classics = JSON.parse(fs.readFileSync(path.join(root, 'cocktails.json'), 'utf8'));
const response = (data, ok = true) => ({ok, json: async () => data});
const settle = () => new Promise(resolve => setTimeout(resolve, 25));

async function boot(t, {optional = async () => response(null, false), required = async () => response(classics), hash = ''} = {}) {
  const dom = new JSDOM(html, {url: `https://hycrmc2333.github.io/my-wine/${hash}`, runScripts: 'outside-only'});
  t.after(() => dom.window.close());
  dom.window.scrollTo = () => {};
  dom.window.matchMedia = () => ({matches: false});
  dom.window.fetch = file => file === 'cocktails.json' ? required() : file === 'pantry.json' ? Promise.resolve(response(pantry)) : optional();
  for (const file of ['pantry.js','flavors.js']) dom.window.eval(fs.readFileSync(path.join(root,file),'utf8'));
  dom.window.eval(script);
  await settle();
  return dom.window;
}

test('missing optional dataset does not block 102 classics or core interactions', async t => {
  const w = await boot(t);
  const d = w.document;
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length, 102);
  assert.equal(d.querySelector('#retry'), null);
  assert.equal(d.querySelector('[data-category="innovations"]'), null);
  assert.equal(d.querySelector('#catalog-size').textContent, '102 款 IBA 经典 · 0 款 Innovations');
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

test('available optional recipes join the shared catalogue and category row', async t => {
  const w = await boot(t, {optional: async () => response(innovations)});
  const d = w.document;
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length, 136);
  assert.equal(d.querySelectorAll('[data-category]').length, 5);
  d.querySelector('[data-category="innovations"]').click();
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length, 34);
  d.querySelector('[data-preparation="milk"]').click();
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length, 4);
});

test('pantry and flavour filters compose and survive detail return', async t => {
  const w = await boot(t, {optional: async () => response(innovations)});
  const d = w.document;
  for (const id of ['金酒','金巴利 Campari','甜红味美思']) {
    const input = [...d.querySelectorAll('[data-pantry-item]')].find(el=>el.dataset.pantryItem===id);
    input.checked=true; input.dispatchEvent(new w.Event('change',{bubbles:true}));
  }
  d.querySelector('[data-flavor="bitter"]').click();
  d.querySelector('[data-flavor="sweet"]').click();
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length,1);
  assert.equal(d.querySelector('#cocktail-grid h2').textContent,'Negroni');
  d.querySelector('#cocktail-grid [data-open="negroni"]').click(); await settle();
  assert.ok(d.querySelector('#ingredients'));
  w.location.hash='#'; await settle();
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length,1);
  assert.equal(d.querySelectorAll('[data-flavor][aria-pressed="true"]').length,2);
  d.querySelector('[data-flavor="sour"]').click();
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length,0);
  d.querySelector('[data-reset]').click();
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length,136);
});

test('art and real-photo views share a centered frame without cover cropping', async t => {
  const w = await boot(t, {hash: '#cocktail/negroni'});
  const style = w.document.createElement('style');
  style.textContent = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  w.document.head.append(style);
  const images = [...w.document.querySelectorAll('.gallery-slide > img')];
  assert.equal(images.length, 2);
  for (const image of images) {
    const computed = w.getComputedStyle(image);
    assert.equal(computed.objectFit, 'contain');
    assert.equal(computed.objectPosition, 'center');
    assert.equal(computed.width, '100%');
    assert.equal(computed.height, '100%');
  }
});
