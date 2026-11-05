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

async function boot(t, {optional = async () => response(null, false), required = async () => response(classics), hash = '', enter = true, stored = {}, blocked = false} = {}) {
  const dom = new JSDOM(html, {url: `https://hycrmc2333.github.io/my-wine/${hash}`, runScripts: 'outside-only'});
  t.after(() => dom.window.close());
  dom.window.scrollTo = () => {};
  dom.window.matchMedia = () => ({matches: false});
  dom.window.fetch = file => file === 'cocktails.json' ? required() : file === 'pantry.json' ? Promise.resolve(response(pantry)) : optional();
  for (const [key, value] of Object.entries(stored)) dom.window.localStorage.setItem(key, value);
  if (blocked) dom.window.Storage.prototype.setItem = () => { throw new Error('storage blocked'); };
  for (const file of ['pantry.js','flavors.js','profiles.js']) dom.window.eval(fs.readFileSync(path.join(root,file),'utf8'));
  dom.window.eval(script);
  await settle();
  if (enter) login(dom.window, '测试昵称');
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
  assert.deepEqual(savedProfile(w).favorites, ['negroni']);
  w.location.hash = '#favorites';
  await settle();
  assert.equal(d.querySelectorAll('#cocktail-grid .cocktail-card').length, 1);
  w.location.hash = '#cocktail/negroni';
  await settle();
  assert.match(d.querySelector('#main h1').textContent, /Negroni/i);
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

test('inventory families support select-all, partial state, search and persistence', async t => {
  const w=await boot(t,{optional:async()=>response(innovations)}), d=w.document;
  const whisky=d.querySelector('[data-pantry-bulk="spirits:whisky"]');
  const whiskyItems=[...d.querySelectorAll('[data-pantry-family="spirits:whisky"] [data-pantry-item]')];
  assert.ok(whiskyItems.length>3);
  whisky.click();
  assert.ok(whiskyItems.every(i=>i.checked));
  assert.equal(d.querySelector('[data-pantry-bulk="spirits:all"]').indeterminate,true);
  assert.equal(d.querySelector('[data-pantry-bulk="liqueurs:all"]').checked,false);
  whiskyItems[0].click();
  assert.equal(whisky.indeterminate,true);
  whisky.click();assert.ok(whiskyItems.every(i=>i.checked));
  const search=d.querySelector('#pantry-search');search.value='波本';search.dispatchEvent(new w.Event('input',{bubbles:true}));
  whisky.click();assert.ok(whiskyItems.every(i=>!i.checked),'clear includes hidden members');
  const liqueurs=d.querySelector('[data-pantry-bulk="liqueurs:all"]');liqueurs.click();
  assert.ok([...d.querySelectorAll('[data-pantry-group="liqueurs"] [data-pantry-item]')].every(i=>i.checked));
  assert.equal(whisky.checked,false);
  const stored=savedProfile(w).pantry;assert.ok(stored.items.includes('甜红味美思'));
  d.querySelector('[data-pantry-clear]').click();
  assert.equal(d.querySelectorAll('[data-pantry-item]:checked').length,0);
  assert.equal(liqueurs.indeterminate,false);
});

function login(w, name) {
  const d = w.document;
  d.querySelector('#profile-name').value = name;
  d.querySelector('#profile-form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
}
function savedProfile(w, name = '测试昵称') {
  return JSON.parse(w.localStorage.getItem('my-wine-profiles-v1')).profiles.find(p => p.name === name);
}
function snapshot(w) { return Object.fromEntries(Object.keys(w.localStorage).map(key => [key, w.localStorage.getItem(key)])); }

test('entry gate is required, rejects blank names, and safely displays nickname text', async t => {
  const w = await boot(t, {enter: false}); const d = w.document;
  assert.equal(d.querySelector('#main').hidden, true);
  assert.equal(d.querySelector('#profile-gate').hidden, false);
  login(w, '   '); assert.equal(d.querySelector('#main').hidden, true);
  assert.match(d.querySelector('#profile-error').textContent, /1–24/);
  login(w, '<img src=x>');
  assert.equal(d.querySelector('#profile-current').textContent, '<img src=x>');
  assert.equal(d.querySelector('#profile-current img'), null);
  assert.equal(d.querySelector('#main').hidden, false);
});

test('nickname isolates favorites, pantry, all preference filters and restores after reload', async t => {
  const w = await boot(t, {optional: async () => response(innovations)}); const d = w.document;
  d.querySelector('[data-save="negroni"]').click();
  d.querySelector('[data-category="innovations"]').click();
  d.querySelector('[data-preparation="milk"]').click();
  d.querySelector('[data-base="朗姆酒"]').click();
  d.querySelector('[data-flavor="sweet"]').click();
  d.querySelector('[data-pantry-bulk="spirits:whisky"]').click();
  const search = d.querySelector('#search'); search.value='punch'; search.dispatchEvent(new w.Event('input'));
  const first = savedProfile(w);
  assert.ok(first.pantry.items.length > 3);
  assert.equal(first.preferences.category,'innovations');
  d.querySelector('#profile-switch').click(); login(w, '另一位');
  assert.equal(d.querySelector('#favorite-count').textContent,'0');
  assert.equal(d.querySelectorAll('[data-pantry-item]:checked').length,0);
  assert.equal(d.querySelector('[data-flavor="all"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelector('#search').value,'');
  d.querySelector('[data-save="mojito"]').click();
  d.querySelector('#profile-switch').click(); login(w, ' 测试昵称 ');
  assert.equal(d.querySelector('#favorite-count').textContent,'1');
  assert.equal(d.querySelector('[data-category="innovations"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelector('[data-preparation="milk"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelector('[data-base="朗姆酒"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelector('[data-flavor="sweet"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelector('#pantry-enabled').checked,true);
  assert.deepEqual(savedProfile(w,'另一位').favorites,['mojito']);
  const reload = await boot(t, {enter:false, stored:snapshot(w), optional:async()=>response(innovations)});
  assert.equal(reload.document.querySelector('#profile-name').value,'测试昵称');
  assert.equal(reload.document.querySelector('#main').hidden,true);
  login(reload,'测试昵称');
  assert.equal(reload.document.querySelector('#search').value,'punch');
  assert.equal(reload.document.querySelector('[data-preparation="milk"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(savedProfile(reload),first);
});

test('legacy favorites and pantry migrate only to first nickname and originals remain', async t => {
  const w = await boot(t,{stored:{'my-wine-favorites':'["negroni"]','my-wine-pantry':JSON.stringify({items:['金酒'],enabled:true})}});
  assert.deepEqual(savedProfile(w).favorites,['negroni']);
  assert.deepEqual(savedProfile(w).pantry.items,['金酒']);
  w.document.querySelector('#profile-switch').click(); login(w,'第二个');
  assert.deepEqual(savedProfile(w,'第二个').favorites,[]);
  assert.deepEqual(savedProfile(w,'第二个').pantry.items,[]);
  assert.equal(w.localStorage.getItem('my-wine-favorites'),'["negroni"]');
});

test('blocked storage still supports separate profiles during the current visit', async t => {
  const w=await boot(t,{blocked:true}); const d=w.document;
  d.querySelector('[data-save="negroni"]').click();
  assert.match(d.querySelector('#toast').textContent,/未允许保存/);
  d.querySelector('#profile-switch').click(); login(w,'二号');
  assert.equal(d.querySelector('#favorite-count').textContent,'0');
  d.querySelector('#profile-switch').click(); login(w,'测试昵称');
  assert.equal(d.querySelector('#favorite-count').textContent,'1');
});

test('delayed innovations preserve saved category, preparation and classic availability', async t => {
  let resolve;
  const profile={name:'测试昵称',favorites:[],pantry:{items:[],enabled:false},preferences:{category:'innovations',preparation:'milk',base:'全部',flavors:[],query:''}};
  const w=await boot(t,{stored:{'my-wine-profiles-v1':JSON.stringify({version:1,profiles:[profile]})},optional:()=>new Promise(r=>{resolve=r;})});
  assert.equal(w.document.querySelectorAll('.cocktail-card').length,102);
  resolve(response(innovations)); await settle();
  assert.equal(w.document.querySelector('[data-preparation="milk"]').getAttribute('aria-pressed'),'true');
  assert.equal(w.document.querySelectorAll('.cocktail-card').length,4);
});

test('switch can be canceled and deep recipe links wait behind the gate', async t => {
  const w=await boot(t,{hash:'#cocktail/negroni',enter:false});const d=w.document;
  assert.equal(d.querySelector('#main').hidden,true);
  login(w,'小柠檬'); assert.ok(d.querySelector('#ingredients'));
  d.querySelector('#profile-switch').click(); d.querySelector('#profile-name').value='未提交';
  d.querySelector('#profile-cancel').click();
  assert.equal(d.querySelector('#profile-current').textContent,'小柠檬');
  assert.ok(d.querySelector('#ingredients'));
});


test('clearing innovation filters also clears the route so reload retains the reset', async t => {
  const w=await boot(t,{optional:async()=>response(innovations)});const d=w.document;
  d.querySelector('[data-category="innovations"]').click();
  const search=d.querySelector('#search');search.value='no-such-cocktail';search.dispatchEvent(new w.Event('input'));
  d.querySelector('[data-reset]').click();
  assert.notEqual(w.location.hash,'#innovations');
  assert.equal(savedProfile(w).preferences.category,'all');
  assert.equal(d.querySelectorAll('.cocktail-card').length,136);
});

test('late optional data cannot overwrite a newer category choice', async t => {
  let resolve;
  const w=await boot(t,{hash:'#innovations',optional:()=>new Promise(r=>{resolve=r;})});const d=w.document;
  d.querySelector('[data-category="contemporary"]').click();
  resolve(response(innovations));await settle();
  assert.equal(d.querySelector('[data-category="contemporary"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelectorAll('.cocktail-card').length,34);
});

test('profile storage accepts special names without object-key collisions', () => {
  const {createStore}=require('../profiles.js');
  const values=new Map(); const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const store=createStore(storage);
  const a=store.open('__proto__').profile; a.favorites=['negroni'];store.save(a);
  assert.deepEqual(store.open('constructor').profile.favorites,[]);
  assert.deepEqual(store.open('__proto__').profile.favorites,['negroni']);
  assert.equal(store.open(' Ａ  B ').profile.name,'A B');
  assert.throws(()=>store.open('a'.repeat(25)),/1–24/);
});
