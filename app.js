(() => {
  'use strict';
  const main = document.querySelector('#main');
  document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); main.focus(); main.scrollIntoView(); });
  const icon = (name, extra = '') => `<img class="icon ${extra}" src="assets/icons/${name}.svg" alt="" width="20" height="20">`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const baseOrder = ['金酒', '朗姆酒', '龙舌兰', '威士忌', '伏特加', '白兰地', '葡萄酒', '利口酒', '混合基酒', '其他'];
  const categories = [
    {id:'all',name:'全部酒款',en:'All cocktails'},
    {id:'unforgettables',name:'历久弥新',en:'The Unforgettables'},
    {id:'contemporary',name:'当代经典',en:'Contemporary Classics'},
    {id:'new-era',name:'新浪潮',en:'New Era'},
    {id:'innovations',name:'创意酒类',en:'Innovations'}
  ];
  const categoryName = c => categories.find(x => x.id === c.category)?.name || 'IBA 官方酒单';
  const isInnovation = c => c.category === 'innovations';
  const isMilkSupplement = c => c.provenanceType === 'milk-supplement';
  const rankingLink = c => c.bar?.rankingSource ? `<a href="${esc(c.bar.rankingSource)}" target="_blank" rel="noopener noreferrer">World’s 50 Best Bars ${c.bar.rankYear} · No.${c.bar.rank} ${icon('external-link')}</a>` : '<span class="supplement-label">奶洗补充 · 专业公开配方</span>';
  const scopeDrinks = () => cocktails;
  const listCategories = () => categories.filter(c=>c.id!=='innovations' || cocktails.some(isInnovation));
  const containsBase = (c,b) => c.base === b || (c.bases || []).includes(b);
  const bases = () => ['全部', ...baseOrder.filter(b => scopeDrinks().some(c => containsBase(c,b)))];
  const descriptions = {
    negroni: ['Equal parts. Perfect company.', '苦甜之间，是刚刚好的平衡。'],
    mojito: ['A breath of fresh mint.', '薄荷、青柠，还有一点轻快。'],
    margarita: ['A little salt. A little sunshine.', '把柑橘的明亮，留在杯口。'],
    'old-fashioned': ['Good things take their time.', '简单的原料，慢慢调出层次。'],
    'dry-martini': ['Less, beautifully mixed.', '极简配方，也值得认真对待。'],
    daiquiri: ['Three ingredients. One classic.', '朗姆、青柠与糖，就已足够。'],
    'whiskey-sour': ['A softer side of whiskey.', '酸甜与醇厚，恰好相遇。'],
    'espresso-martini': ['For the love of coffee.', '让咖啡的香气，多停留一会儿。'],
    cosmopolitan: ['A bright little occasion.', '莓果与柑橘，一起亮起来。'],
    manhattan: ['A classic worth stirring.', '慢慢搅拌，让香气融合。'],
    'pina-colada': ['A small tropical escape.', '椰香和菠萝，把日常调轻一点。'],
    'moscow-mule': ['Ginger with a little kick.', '一口姜香，一口清爽。']
  };
  let cocktails = [], selectedBase = '全部', selectedCategory = 'all', selectedPreparation = 'all', query = '', portions = 1, activeSlide = 0;
  let favorites = new Set(), completed = new Set(), origin = '#', lastOpened = '', scrollBeforeDetail = 0, toastTimer, previousListScope = '', detailIsInnovation = false;
  try { const stored = JSON.parse(localStorage.getItem('my-wine-favorites') || '[]'); if (Array.isArray(stored)) favorites = new Set(stored.filter(x => typeof x === 'string')); } catch {}
  let pantryData = {items:[], requirements:{}}, pantryOwned = new Set(), pantryEnabled = false, pantryQuery = '';
  try { const saved = JSON.parse(localStorage.getItem('my-wine-pantry') || '{}'); if (Array.isArray(saved.items)) pantryOwned = new Set(saved.items.filter(id=>typeof id==='string')); pantryEnabled = saved.enabled === true; } catch {}
  const pantryGroups = [['spirits','酒类','烈酒 · 葡萄酒 · 起泡酒'],['liqueurs','配制酒与利口酒','味美思 · 开胃酒 · 苦精'],['mixers','其他配料','果汁 · 水果 · 糖浆 · 乳制品']];
  function persistPantry() {
    try { localStorage.setItem('my-wine-pantry', JSON.stringify({items:[...pantryOwned], enabled:pantryEnabled})); }
    catch { notify('本次选择已生效；浏览器未允许保存材料清单'); }
  }
  const pantryExpanded = new Set();
  function pantryBulkItems(key) {
    const [group, family] = key.split(':');
    return pantryData.items.filter(item=>item.group===group && (family==='all' || item.subgroup===family));
  }
  function pantryGroupMarkup(id, title, description) {
    const families = pantryData.families?.[id] || [{id:'other',label:'其他'}];
    return `<details class="pantry-group" data-pantry-group="${id}" open><summary>${title}<span>${description}</span></summary><label class="pantry-bulk pantry-group-all"><input type="checkbox" data-pantry-bulk="${id}:all" aria-label="全选${title}"><span>全选${title}</span><small data-pantry-total="${id}:all"></small></label><div class="pantry-families">${families.map(f=>{
      const key = `${id}:${f.id}`, items = pantryBulkItems(key); if(!items.length) return '';
      return `<section class="pantry-family" data-pantry-family="${key}"><div class="pantry-family-head"><label class="pantry-bulk"><input type="checkbox" data-pantry-bulk="${key}" aria-label="全选${f.label}"><span>${f.label}</span></label><button type="button" data-pantry-expand="${key}" aria-expanded="${pantryExpanded.has(key)}" aria-controls="pantry-${id}-${f.id}" aria-label="展开或收起${f.label}"><small data-pantry-total="${key}"></small><span class="pantry-chevron" aria-hidden="true">⌄</span></button></div><div class="pantry-options" id="pantry-${id}-${f.id}" ${pantryExpanded.has(key)?'':'hidden'}>${items.map(i=>`<label class="pantry-option" data-pantry-option="${esc(i.id)}"><input type="checkbox" data-pantry-item="${esc(i.id)}" ${pantryOwned.has(i.id)?'checked':''}><span>${esc(i.label)}</span></label>`).join('')}</div></section>`;
    }).join('')}</div></details>`;
  }
  function pantryPanel() {
    return `<section class="pantry-panel" aria-label="我有的材料"><div class="pantry-heading"><div><h2>我有的材料 <span id="pantry-count">已选 ${pantryOwned.size} 种</span></h2><p>按类型勾选库存，或展开查看具体酒款。</p></div><label class="pantry-mode"><input type="checkbox" id="pantry-enabled" ${pantryEnabled?'checked':''}>只看材料齐全的酒</label></div><details class="pantry-picker" ${pantryOwned.size?'':'open'}><summary>选择酒类、配制酒与配料</summary><label class="pantry-search">${icon('search')}<input id="pantry-search" type="search" placeholder="搜索材料，如金巴利、柠檬汁" aria-label="搜索可选材料" value="${esc(pantryQuery)}"></label><p class="pantry-bulk-hint">勾选类别即全选；半选表示部分已选。全选包含搜索未显示的本类材料。</p><div class="pantry-groups">${pantryGroups.map(([id,title,description])=>pantryGroupMarkup(id,title,description)).join('')}</div><p id="pantry-search-empty" hidden>没有找到这项材料，试试中文名称或酒款品牌。</p></details><div class="pantry-selected" id="pantry-selected"></div><div class="pantry-bottom"><p>冰和饮用水默认备有；可选项与单列装饰不计入。按原料种类匹配，不核对库存用量；糖浆请按已备好的种类勾选，指定酒型仍需备齐。</p><button type="button" data-pantry-clear>清空材料</button></div></section>`;
  }
  function updatePantry() {
    const count = document.getElementById('pantry-count'); if (!count) return;
    count.textContent = `已选 ${pantryOwned.size} 种`;
    document.getElementById('pantry-enabled').checked = pantryEnabled;
    document.getElementById('pantry-selected').innerHTML = [...pantryOwned].map(id=>`<button class="pantry-chip" data-pantry-remove="${esc(id)}" aria-label="移除材料：${esc(id)}">${esc(id)}<span aria-hidden="true">×</span></button>`).join('');
    main.querySelectorAll('[data-pantry-item]').forEach(input => { input.checked = pantryOwned.has(input.dataset.pantryItem); });
    main.querySelectorAll('[data-pantry-bulk]').forEach(input=>{
      const items = pantryBulkItems(input.dataset.pantryBulk), count = items.filter(item=>pantryOwned.has(item.id)).length;
      input.checked = items.length > 0 && count===items.length;
      input.indeterminate = count > 0 && count < items.length;
      input.setAttribute('aria-checked', input.indeterminate ? 'mixed' : String(input.checked));
    });
    main.querySelectorAll('[data-pantry-total]').forEach(el=>{ const items=pantryBulkItems(el.dataset.pantryTotal); el.textContent=`${items.filter(i=>pantryOwned.has(i.id)).length}/${items.length}`; });
    main.querySelector('[data-pantry-clear]').disabled = !pantryOwned.size;
  }
  function searchPantry() {
    const words = pantryQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    main.querySelectorAll('[data-pantry-option]').forEach(label => {
      const item = pantryData.items.find(i=>i.id===label.dataset.pantryOption);
      label.hidden = !words.every(word => [item.label,...item.aliases,pantryData.families?.[item.group]?.find(f=>f.id===item.subgroup)?.label || ''].join(' ').toLocaleLowerCase().includes(word));
      if (!label.hidden) visible++;
    });
    main.querySelectorAll('[data-pantry-family]').forEach(family=>{
      family.hidden = ![...family.querySelectorAll('[data-pantry-option]')].some(label=>!label.hidden);
      const expanded = words.length ? !family.hidden : pantryExpanded.has(family.dataset.pantryFamily);
      family.querySelector('.pantry-options').hidden = !expanded;
      family.querySelector('[data-pantry-expand]').setAttribute('aria-expanded',String(expanded));
    });
    main.querySelectorAll('[data-pantry-group]').forEach(group => { group.hidden = ![...group.querySelectorAll('[data-pantry-option]')].some(label=>!label.hidden); if (words.length) group.open = true; });
    document.getElementById('pantry-search-empty').hidden = visible > 0;
  }
  const selectedFlavors = new Set();
  function flavorPanel() {
    return `<section class="flavor-panel" aria-label="按味型筛选"><div class="flavor-heading"><h2>想喝什么味道？</h2><p>可多选，同时满足所选味型；选「酸」＋「甜」找酸甜口。</p></div><div class="flavor-filters" role="group" aria-label="味型选项"><button class="filter" data-flavor="all" aria-pressed="${selectedFlavors.size===0}">不限味型</button>${WineFlavors.options.map(f=>`<button class="filter" data-flavor="${f.id}" aria-pressed="${selectedFlavors.has(f.id)}">${f.label}</button>`).join('')}</div><p class="flavor-note">按配方与风味描述归类，非实测糖度或酸度；同一杯可兼有多种味道。</p></section>`;
  }
  const illustration = c => `assets/illustrations/${c.id}.webp?v=640-1`;
  const notify = text => {
    const toast = document.querySelector('#toast'); toast.textContent = text; toast.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  };
  function updateNav() {
    document.querySelector('#favorite-count').textContent = favorites.size;
    document.querySelector('#catalog-size').textContent = `${cocktails.filter(c=>!isInnovation(c)).length} 款 IBA 经典 · ${cocktails.filter(isInnovation).length} 款 Innovations`;
    const saved = location.hash === '#favorites';
    for (const [id, active] of [['nav-collection', !saved], ['nav-favorites', saved]]) {
      const link = document.getElementById(id); link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
  }
  function saveButton(c, detail = false) {
    const saved = favorites.has(c.id);
    return `<button class="save-button${detail ? ' detail-save' : ''}" data-save="${c.id}" aria-label="${saved ? '取消收藏' : '收藏'} ${esc(c.name)}" aria-pressed="${saved}">${icon('heart')}</button>`;
  }
  function card(c) {
    return `<article class="cocktail-card" style="--tile:${c.color}"><a class="card-link" href="#cocktail/${c.id}" data-open="${c.id}" aria-label="查看 ${esc(c.name)} ${esc(c.zh)} 的配方"><span class="card-top${isInnovation(c) ? ' card-bar' : ''}" title="${esc(c.bar?.name || c.base)}">${isInnovation(c) ? esc(c.bar.name) : `${esc(c.base)} · ${esc(c.tags[0])}`}</span><div class="card-illustration"><img src="${illustration(c)}" width="400" height="400" loading="lazy" alt="${esc(c.zh)}的纸感手绘插画" data-art="${c.id}"></div><div class="card-copy"><h2 lang="en">${esc(c.name)}</h2><div class="card-bottom"><p>${esc(c.zh)} · ${c.milkWashed ? '奶洗澄清' : esc(c.tags[1])}</p>${icon('arrow-up-right')}</div></div></a>${saveButton(c)}</article>`;
  }
  function listPage(savedOnly) {
    const scopeKey = savedOnly ? 'favorites' : 'collection';
    if (previousListScope !== scopeKey) { selectedCategory = location.hash === '#innovations' ? 'innovations' : 'all'; selectedPreparation = 'all'; selectedBase = '全部'; query = ''; previousListScope = scopeKey; }
    if (selectedCategory === 'innovations' && !cocktails.some(isInnovation)) selectedCategory = 'all';
    const innovative = selectedCategory === 'innovations';
    const list = scopeDrinks();
    const innovations = list.filter(isInnovation);
    const hero = cocktails.find(c=>c.id==='negroni');
    document.title = `${savedOnly ? '我的收藏' : '一杯经典'} · My Wine`;
    main.innerHTML = `${savedOnly ? `<section class="favorites-intro"><h1>留给下一杯的灵感。</h1><p>收藏喜欢的配方，在想调一杯的时候回来。</p></section>` : `<section class="intro"><div><h1>每一杯经典，<br>都有<em>好配方。</em></h1><p>从一张手绘酒单开始，认识 ${list.filter(c=>!isInnovation(c)).length} 款 IBA 经典与 ${innovations.length} 款创意酒。<br>选一杯喜欢的，跟着步骤慢慢调。</p></div>${hero ? `<a class="intro-art" href="#cocktail/${hero.id}" data-open="${hero.id}" aria-label="认识今日经典：${esc(hero.zh)}"><img src="${illustration(hero)}" width="320" height="320" fetchpriority="high" alt="${esc(hero.zh)}手绘插画" data-art="${hero.id}"><span class="intro-note">Hello, Negroni.<br><span>从一杯经典开始</span></span></a>` : ''}</section>`}
      <section aria-label="${savedOnly ? '已收藏的鸡尾酒' : '鸡尾酒酒单'}"><div class="category-filters" style="--category-count:${listCategories().length}" role="group" aria-label="按酒单分类筛选">${listCategories().map(cat => `<button class="category-filter" data-category="${cat.id}" aria-pressed="${selectedCategory === cat.id}"><span>${cat.name}<small>${list.filter(c => cat.id === 'all' || c.category === cat.id).filter(c=>!savedOnly || favorites.has(c.id)).length}</small></span><span lang="en">${cat.en}</span></button>`).join('')}</div>
      ${innovative ? `<div class="innovation-context"><p>从水果的明亮酸度，到花草、香料与甜点般的层次。</p><span>30 款酒吧原创 · 4 款奶洗补充</span></div><div class="preparation-filters filters" role="group" aria-label="按制作方式筛选">${[['all','全部配方'],['direct','直接调制'],['milk','奶洗澄清']].map(([id,label])=>`<button class="filter" data-preparation="${id}" aria-pressed="${selectedPreparation===id}">${label} <span>${innovations.filter(c=>(!savedOnly || favorites.has(c.id)) && (id==='all'||Boolean(c.milkWashed)===(id==='milk'))).length}</span></button>`).join('')}</div>` : ''}
      <div class="collection-toolbar"><div class="filters" role="group" aria-label="按基酒筛选">${bases().map(b => `<button class="filter" data-base="${b}" aria-pressed="${selectedBase === b}">${b}</button>`).join('')}</div><label class="search-box">${icon('search')}<input id="search" type="search" placeholder="搜索酒名、酒吧或原料" aria-label="搜索酒名、酒吧、基酒或原料" autocomplete="off" value="${esc(query)}"></label></div>${flavorPanel()}${pantryPanel()}<div class="collection-caption"><p id="result-count" role="status" aria-live="polite"></p><button class="random-button" id="random">${icon('arrows-shuffle')}帮我选一杯</button></div><div class="cocktail-grid" id="cocktail-grid"></div></section>
      <aside class="source-note">${icon('book')}<p>${innovative ? `<strong>创意有来处，配方可追溯。</strong> 30 款酒吧原创来自历届 World's 50 Best Bars 全球前 50；另附的奶洗配方来自专业调酒媒体或调酒师，不计入榜单酒吧。所列排名为历史记录。配方采用注明来源的公开版本；风味描述为编辑整理。操作时间与顺序仅在来源有说明时记录，未公开的参数不补写。` : '<strong>经典有出处，调酒有章法。</strong> IBA 经典采用官方配方，原创酒款采用酒吧或创作者公开的配方，步骤为中文整理。插画是风格化演绎，点开酒款可对照实拍；每杯均附配方与图片来源。'}</p></aside>`;
    updatePantry(); searchPantry();
    renderGrid();
    document.getElementById('pantry-search').addEventListener('input', event => { pantryQuery = event.target.value; searchPantry(); });
    document.getElementById('search').addEventListener('input', event => { query = event.target.value; renderGrid(); });
    document.getElementById('random').addEventListener('click', () => {
      const list = filtered(); if (!list.length) return;
      openDrink(list[Math.floor(Math.random() * list.length)].id);
    });
  }
  function filtered() {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const stock = WinePantry.available(pantryOwned, pantryData.items);
    return scopeDrinks().filter(c => WineFlavors.matches(c, selectedFlavors) && (!pantryEnabled || WinePantry.canMake(pantryData.requirements[c.id], stock)) && (location.hash !== '#favorites' || favorites.has(c.id)) && (selectedCategory !== 'innovations' || selectedPreparation === 'all' || Boolean(c.milkWashed) === (selectedPreparation === 'milk')) && (selectedCategory === 'all' || c.category === selectedCategory) && (selectedBase === '全部' || containsBase(c,selectedBase)) && words.every(word => [c.name,c.zh,c.base,...(c.bases || []),c.categoryOriginal,categoryName(c),c.bar?.name,c.bar?.city,c.bar?.country,c.creator,c.flavorDescription,...c.tags,...c.ingredients.map(i => i.name)].join(' ').toLocaleLowerCase().includes(word)));
  }
  function renderGrid() {
    const list = filtered();
    const savedOnly = location.hash === '#favorites';
    document.getElementById('result-count').textContent = `${savedOnly ? '我的收藏' : selectedCategory === 'all' ? '完整酒单' : categories.find(c=>c.id===selectedCategory).name} / ${list.length} 款${selectedBase !== '全部' ? ` · ${selectedBase}` : ''}${selectedFlavors.size ? ` · ${WineFlavors.options.filter(f=>selectedFlavors.has(f.id)).map(f=>f.label).join('＋')}` : ''}${pantryEnabled ? ' · 材料齐全' : ''}`;
    main.querySelectorAll('[data-category] small').forEach(el => {
      const id = el.closest('[data-category]').dataset.category;
      el.textContent = scopeDrinks().filter(c => (id === 'all' || c.category === id) && (!savedOnly || favorites.has(c.id))).length;
    });
    document.getElementById('random').disabled = list.length === 0;
    document.getElementById('cocktail-grid').innerHTML = list.length ? list.map(card).join('') : `<div class="empty-state">${icon(savedOnly && !favorites.size ? 'heart' : 'search')}<h2>${savedOnly && !favorites.size ? '下一杯喜欢的，先收在这里。' : '这次还没找到合适的一杯。'}</h2><p>${savedOnly && !favorites.size ? '点亮酒单上的爱心，就能把配方留下。' : pantryEnabled ? (pantryOwned.size ? '已按现有材料严格匹配；可以补选材料，或关闭「只看材料齐全的酒」浏览完整酒单。' : '先勾选你有的酒和配料，就能看到材料齐全的配方。') : '试试减少所选味型、调整酒名或原料，或清除当前筛选。'}</p>${savedOnly && !favorites.size ? '<a class="solid-button" href="#">去看看经典酒单</a>' : '<button class="solid-button" data-reset>清除筛选</button>'}</div>`;
  }
  function openDrink(id) {
    if (!location.hash.startsWith('#cocktail/')) {
      origin = ['#favorites','#innovations'].includes(location.hash) ? location.hash : '#';
      scrollBeforeDetail = window.scrollY; lastOpened = id;
    }
    location.hash = `cocktail/${id}`;
  }
  function amount(i) {
    if (i.amount === null) return esc(i.note || '适量');
    return `${Number((i.amount * portions).toFixed(2))} <span>${esc(i.unit)}</span>`;
  }
  function ingredients(c) {
    const render = i => `<li class="ingredient-item"><span class="ingredient-name">${esc(i.name)}${i.amount !== null && i.note ? `<small class="ingredient-note">${esc(i.note)}</small>` : ''}</span><span class="ingredient-amount${i.amount === null ? ' flexible' : ''}">${amount(i)}</span></li>`;
    const batch = c.ingredients.filter(i=>i.scope!=='serve'), serve = c.ingredients.filter(i=>i.scope==='serve');
    return batch.map(render).join('') + (serve.length ? `<li class="ingredient-group">出杯时另备 · 每杯</li>${serve.map(render).join('')}` : '');
  }
  function detailPage(c) {
    portions = 1; activeSlide = 0; completed = new Set();
    document.title = `${c.name} ${c.zh} · 一杯经典`;
    detailIsInnovation = isInnovation(c);
    if (!lastOpened) origin = detailIsInnovation ? '#innovations' : '#';
    const siblings = cocktails.filter(d=>isInnovation(d)===detailIsInnovation);
    const number = siblings.indexOf(c) + 1;
    const copy = descriptions[c.id];
    const related = siblings.filter(d => d.id !== c.id).sort((a,b) => (b.base === c.base) - (a.base === c.base)).slice(0,4);
    main.innerHTML = `<div class="detail-topbar"><a class="back-link" href="${origin}" data-back>${icon('arrow-left')}返回${origin === '#favorites' ? '收藏' : origin === '#innovations' ? ' Innovations' : '酒单'}</a><span class="detail-position">${detailIsInnovation ? 'INNOVATIONS' : 'THE CLASSICS'} &nbsp; ${String(number).padStart(2,'0')} / ${siblings.length}</span></div>
      <div class="detail-layout"><section class="detail-visual" aria-label="${esc(c.zh)}图片"><div class="gallery" style="--tile:${c.color}"><span class="gallery-type" id="gallery-type">手绘插画</span><div class="gallery-track" id="gallery-track" tabindex="0" aria-roledescription="轮播" aria-label="鸡尾酒图片，左右方向键切换"><div class="gallery-slide" role="group" aria-label="1 / 2，手绘插画"><img src="${illustration(c)}" width="600" height="600" alt="${esc(c.zh)}的纸感手绘插画" data-art="${c.id}"></div><div class="gallery-slide photo-slide${detailIsInnovation ? ' innovation-photo' : ''}" role="group" aria-label="2 / 2，${detailIsInnovation ? '来源实拍' : 'IBA 实拍'}"><img src="${c.photo}?v=640-1" width="600" height="600" alt="${esc(c.zh)}的${detailIsInnovation ? '来源' : ' IBA '}实拍照片" data-photo="${c.id}"></div></div><button class="gallery-arrow gallery-prev" aria-label="上一张图片" data-slide="-1">${icon('chevron-left')}</button><button class="gallery-arrow gallery-next" aria-label="下一张图片" data-slide="1">${icon('chevron-right')}</button></div><div class="gallery-bottom"><div class="gallery-tabs" role="group" aria-label="图片类型"><button data-gallery-index="0" aria-pressed="true">手绘插画</button><button data-gallery-index="1" aria-pressed="false">真实酒图</button></div><p class="swipe-hint">左右滑动，换个视角看这杯</p></div><p class="photo-credit">插画为 AI 风格演绎 · 实拍来源 <a href="${esc(detailIsInnovation ? c.photoSource : c.source)}" target="_blank" rel="noopener noreferrer">${esc(detailIsInnovation ? c.photoCredit : 'IBA 官方酒款页')}</a></p>${c.photoNote ? `<p class="photo-credit photo-version-note">${esc(c.photoNote)}</p>` : ''}${copy ? `<div class="visual-quote" lang="en">${esc(copy[0])}<span lang="zh-CN">${esc(copy[1])}</span></div>` : ''}</section>
      <article class="recipe" aria-label="${esc(c.zh)}配方"><div class="recipe-title"><h1 lang="en" tabindex="-1">${esc(c.name)}</h1><p class="chinese-name">${esc(c.zh)}</p>${saveButton(c,true)}</div>${detailIsInnovation ? `<div class="bar-provenance"><p><strong>${esc(c.bar.name)}</strong><span>${esc(c.bar.city)} · ${esc(c.bar.country)}</span></p>${rankingLink(c)}${c.creator ? `<p class="recipe-creator">创作者：${esc(c.creator)}</p>` : ''}<p class="flavor-description">${esc(c.flavorDescription)}</p>${c.ingredientAccessibility ? `<p class="ingredient-accessibility"><strong>备料</strong>${esc(c.ingredientAccessibility)}</p>` : ''}</div>` : ''}<div class="recipe-tags"><span>${detailIsInnovation ? (isMilkSupplement(c) ? '奶洗补充 · 公开配方' : '酒吧原创 · 公开配方') : 'IBA 官方配方'}</span><span>${c.milkWashed ? '奶洗澄清' : esc(categoryName(c))}</span><span>${esc(c.base)}</span>${c.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><dl class="recipe-facts"><div><dt>调制方式</dt><dd>${esc(c.method)}</dd></div><div><dt>建议杯型</dt><dd>${esc(c.glass)}</dd></div>${c.preparationTime ? `<div class="preparation-time"><dt>预留时间</dt><dd>${esc(c.preparationTime)}</dd></div>` : ''}</dl>
      <section aria-labelledby="ingredients-title"><div class="section-head"><h2 id="ingredients-title">准备原料<span lang="en">Ingredients</span></h2>${c.servingUnit === '批' ? '<div class="servings batch-label"><span>原方 · 1 批</span></div>' : `<div class="servings" aria-label="调整杯数"><button data-portions="-1" aria-label="减少一杯" disabled>${icon('minus')}</button><output id="portions" aria-live="polite">1 杯</output><button data-portions="1" aria-label="增加一杯">${icon('plus')}</button></div>`}</div>${c.yieldNote ? `<p class="yield-note">${esc(c.yieldNote)}</p>` : ''}<ul class="ingredient-list" id="ingredients">${ingredients(c)}</ul>${c.ingredients.some(i=>['oz','cup','quart'].includes(i.unit)) ? '<p class="unit-note">美制容量换算：1 oz ≈ 29.6 ml · 1 cup ≈ 237 ml · 1 quart ≈ 946 ml</p>' : ''}<p class="garnish"><span>每杯装饰</span>${esc(c.garnish)}</p><p class="scale-note" id="scale-note" hidden>原料已按杯数换算；步骤以单杯为例，装饰与「适量」原料按每杯准备。摇和请视雪克壶容量分次操作；下方备料配方保持其原始批次用量。</p></section>
      <section aria-labelledby="steps-title"><div class="section-head"><h2 id="steps-title">开始调制<span lang="en">Method</span></h2><span class="step-progress" id="step-progress" role="status">点击序号标记完成</span></div><ol class="steps-list">${c.steps.map((s,i)=>`<li class="step-item"><button class="step-toggle" data-step="${i}" aria-label="标记第 ${i+1} 步完成：${esc(s.title)}" aria-pressed="false">${i+1}</button><div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div></li>`).join('')}</ol></section>
      ${(c.recipeNotes || []).map(note=>`<aside class="recipe-tip recipe-extra"><strong>${esc(note.title)}</strong><p>${esc(note.text)}</p></aside>`).join('')}<aside class="recipe-tip"><strong>调酒小记</strong><p>${esc(c.tip)}</p>${c.sourceNote ? `<p class="source-caveat">来源说明：${esc(c.sourceNote)}</p>` : ''}</aside>${detailIsInnovation ? `<section class="recipe-references" aria-label="配方与图片来源"><h2>配方与来源</h2><ul>${c.recipeSources.map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ${icon('external-link')}</a></li>`).join('')}${c.bar.rankingSource ? `<li>${rankingLink(c)}</li>` : ''}<li><a href="${esc(c.photoSource)}" target="_blank" rel="noopener noreferrer">实拍：${esc(c.photoCredit)} ${icon('external-link')}</a></li></ul><p>核对于 ${esc(c.checkedAt.replaceAll('-','.'))} · 公开版本的中文整理</p></section>` : `<p class="recipe-source">配方与实拍：<a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">International Bartenders Association ${icon('external-link')}</a><span>· 核对于 ${esc((c.checkedAt || '2026-11-02').replaceAll('-','.'))}</span></p>`}</article></div>
      <section class="related"><div class="related-head"><h2>下一杯，也许是它。</h2><a href="${detailIsInnovation ? '#innovations' : '#'}">回到${detailIsInnovation ? ' Innovations' : '完整酒单'}</a></div><div class="cocktail-grid">${related.map(card).join('')}</div></section>`;
    const track = document.getElementById('gallery-track');
    track.addEventListener('scroll', () => {
      const index = Math.round(track.scrollLeft / track.clientWidth);
      if (index !== activeSlide) { activeSlide = index; updateGallery(); }
    }, {passive:true});
    track.addEventListener('keydown', event => {
      if (['ArrowRight','ArrowLeft'].includes(event.key)) { event.preventDefault(); slideTo(activeSlide + (event.key === 'ArrowRight' ? 1 : -1)); }
    });
  }
  function updateGallery() {
    document.getElementById('gallery-type').textContent = activeSlide ? (detailIsInnovation ? '来源实拍' : 'IBA 实拍') : '手绘插画';
    document.getElementById('gallery-type').classList.toggle('is-photo', activeSlide === 1);
    main.querySelectorAll('[data-gallery-index]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.galleryIndex) === activeSlide)));
  }
  function slideTo(index) {
    activeSlide = (index + 2) % 2; updateGallery();
    const track = document.getElementById('gallery-track');
    track.scrollTo({left:track.clientWidth * activeSlide, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }
  function renderRoute() {
    const hash = location.hash;
    if (hash.startsWith('#cocktail/')) {
      const c = cocktails.find(c => c.id === hash.slice(10));
      if (c) detailPage(c); else main.innerHTML = '<section class="not-found"><h1>这杯酒还没有收录。</h1><p>回到酒单，从已有的经典中选一杯。</p><a class="solid-button" href="#">返回酒单</a></section>';
      window.scrollTo({top:0,behavior:'instant'});
      const heading = main.querySelector('h1'); if (heading) heading.focus({preventScroll:true});
    } else {
      if (!lastOpened && hash !== '#favorites') { selectedCategory = hash === '#innovations' ? 'innovations' : 'all'; selectedPreparation = 'all'; }
      listPage(hash === '#favorites');
      if (lastOpened) {
        const link = main.querySelector(`[data-open="${lastOpened}"]`);
        window.scrollTo({top:scrollBeforeDetail,behavior:'instant'}); link?.focus({preventScroll:true}); lastOpened = '';
      } else window.scrollTo({top:0,behavior:'instant'});
    }
    updateNav();
  }
  main.addEventListener('click', event => {
    const expand = event.target.closest('[data-pantry-expand]');
    if (expand) { const key=expand.dataset.pantryExpand, open=expand.getAttribute('aria-expanded')!=='true'; if(open) pantryExpanded.add(key); else pantryExpanded.delete(key); expand.setAttribute('aria-expanded',String(open)); document.getElementById(expand.getAttribute('aria-controls')).hidden=!open; return; }
    const removeMaterial = event.target.closest('[data-pantry-remove]');
    if (removeMaterial) { pantryOwned.delete(removeMaterial.dataset.pantryRemove); persistPantry(); updatePantry(); renderGrid(); document.getElementById('pantry-enabled').focus({preventScroll:true}); return; }
    if (event.target.closest('[data-pantry-clear]')) { pantryOwned.clear(); pantryEnabled=false; persistPantry(); updatePantry(); renderGrid(); return; }
    const save = event.target.closest('[data-save]');
    if (save) {
      const id = save.dataset.save;
      const saveIndex = [...main.querySelectorAll('[data-save]')].indexOf(save);
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      let persisted = true;
      try { localStorage.setItem('my-wine-favorites', JSON.stringify([...favorites])); } catch { persisted = false; }
      main.querySelectorAll(`[data-save="${id}"]`).forEach(button => { button.setAttribute('aria-pressed',String(favorites.has(id))); button.setAttribute('aria-label', `${favorites.has(id) ? '取消收藏' : '收藏'} ${cocktails.find(c=>c.id===id).name}`); });
      updateNav();
      if (location.hash === '#favorites') {
        renderGrid();
        const remaining = [...main.querySelectorAll('[data-save]')];
        const nextFocus = remaining[Math.min(saveIndex, remaining.length - 1)] || main.querySelector('.empty-state a, .empty-state button');
        nextFocus?.focus({preventScroll:true});
      }
      notify(persisted ? (favorites.has(id) ? '已加入我的收藏' : '已取消收藏') : '本次已更新收藏；浏览器未允许保存');
      return;
    }
    const open = event.target.closest('[data-open]');
    if (open && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openDrink(open.dataset.open); return; }
    const flavor = event.target.closest('[data-flavor]');
    if (flavor) { const id = flavor.dataset.flavor; if (id==='all') selectedFlavors.clear(); else if (selectedFlavors.has(id)) selectedFlavors.delete(id); else selectedFlavors.add(id); main.querySelectorAll('[data-flavor]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.flavor==='all' ? !selectedFlavors.size : selectedFlavors.has(b.dataset.flavor)))); renderGrid(); return; }
    const base = event.target.closest('[data-base]');
    if (base) { selectedBase = base.dataset.base; main.querySelectorAll('[data-base]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.base === selectedBase))); renderGrid(); return; }
    const preparation = event.target.closest('[data-preparation]');
    if (preparation) { selectedPreparation = preparation.dataset.preparation; main.querySelectorAll('[data-preparation]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.preparation === selectedPreparation))); renderGrid(); return; }
    const category = event.target.closest('[data-category]');
    if (category) { selectedCategory = category.dataset.category; selectedPreparation = 'all'; if (location.hash !== '#favorites') history.replaceState(null, '', selectedCategory === 'innovations' ? '#innovations' : '#'); listPage(location.hash === '#favorites'); main.querySelector(`[data-category="${selectedCategory}"]`).focus({preventScroll:true}); return; }
    if (event.target.closest('[data-reset]')) { selectedBase='全部'; selectedCategory='all'; selectedPreparation='all'; query=''; selectedFlavors.clear(); pantryEnabled=false; persistPantry(); listPage(location.hash === '#favorites'); document.getElementById('search').focus(); return; }
    const gallery = event.target.closest('[data-gallery-index]');
    if (gallery) { slideTo(Number(gallery.dataset.galleryIndex)); return; }
    const arrow = event.target.closest('[data-slide]');
    if (arrow) { slideTo(activeSlide + Number(arrow.dataset.slide)); return; }
    const portion = event.target.closest('[data-portions]');
    if (portion) {
      portions = Math.max(1,Math.min(4,portions+Number(portion.dataset.portions)));
      document.getElementById('portions').textContent = `${portions} 杯`;
      document.getElementById('ingredients').innerHTML = ingredients(cocktails.find(c => c.id === location.hash.slice(10)));
      main.querySelector('[data-portions="-1"]').disabled = portions === 1; main.querySelector('[data-portions="1"]').disabled = portions === 4;
      document.getElementById('scale-note').hidden = portions === 1; return;
    }
    const step = event.target.closest('[data-step]');
    if (step) {
      const index = Number(step.dataset.step); if (completed.has(index)) completed.delete(index); else completed.add(index);
      step.setAttribute('aria-pressed', String(completed.has(index))); step.innerHTML = completed.has(index) ? icon('check') : index+1;
      step.closest('.step-item').classList.toggle('completed',completed.has(index));
      const total = main.querySelectorAll('[data-step]').length;
      document.getElementById('step-progress').textContent = completed.size === total ? '调制完成，好好享用这一杯。' : `${completed.size} / ${total} 步已完成`;
    }
  });
  main.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('[data-pantry-bulk]')) {
      const items=pantryBulkItems(input.dataset.pantryBulk);
      items.forEach(item=>input.checked ? pantryOwned.add(item.id) : pantryOwned.delete(item.id));
      if(input.checked) pantryEnabled=true;
    } else if (input.matches('[data-pantry-item]')) {
      if (input.checked) { pantryOwned.add(input.dataset.pantryItem); pantryEnabled = true; }
      else pantryOwned.delete(input.dataset.pantryItem);
    } else if (input.id === 'pantry-enabled') pantryEnabled = input.checked;
    else return;
    persistPantry(); updatePantry(); renderGrid();
  });
  main.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || (!img.dataset.art && !img.dataset.photo)) return;
    const c = cocktails.find(c=>c.id === (img.dataset.art || img.dataset.photo));
    const message = document.createElement('p'); message.className = 'image-error';
    message.innerHTML = img.dataset.photo ? `实拍图片暂时无法显示<br><a href="${esc(c?.source)}" target="_blank" rel="noopener noreferrer">查看来源图片</a>` : '插画暂时无法显示';
    img.replaceWith(message);
  },true);
  window.addEventListener('hashchange',renderRoute);
  async function start() {
    try {
      const datasets = await Promise.all(['cocktails.json'].map(async file => {
        const response = await fetch(file, {cache:'no-cache'}); if (!response.ok) throw new Error('recipe fetch failed');
        const data = await response.json(); if (!Array.isArray(data)) throw new Error('invalid recipe data'); return data;
      }));
      const pantryResponse = await fetch('pantry.json', {cache:'no-cache'});
      if (!pantryResponse.ok) throw new Error('pantry fetch failed');
      pantryData = await pantryResponse.json();
      pantryOwned = new Set([...pantryOwned].filter(id=>pantryData.items.some(i=>i.id===id)));
      cocktails = datasets.flat();
      if (!Array.isArray(cocktails) || !cocktails.length) throw new Error('empty recipe data');
      renderRoute();
      // Optional collection must never delay or break the working classic catalogue.
      fetch('innovations.json', {cache:'no-cache'}).then(async response => {
        if (!response.ok) return;
        const extra = await response.json();
        if (!Array.isArray(extra) || !extra.every(c=>c && typeof c.id==='string' && c.category==='innovations' && c.bar?.name && Array.isArray(c.tags) && Array.isArray(c.ingredients) && Array.isArray(c.steps))) return;
        const existing = new Set(cocktails.map(c=>c.id));
        cocktails.push(...extra.filter(c=>!existing.has(c.id)));
        if (location.hash.startsWith('#cocktail/')) { if (!document.querySelector('.recipe')) renderRoute(); else updateNav(); }
        else {
          if (location.hash==='#innovations') selectedCategory='innovations';
          listPage(location.hash==='#favorites'); updateNav();
        }
      }).catch(() => { /* Keep the already rendered catalogue usable. */ });
    } catch {
      main.innerHTML = `<section class="empty-state"><h1>酒单暂时没有打开。</h1><p>请检查连接，再试一次。</p><button class="solid-button" id="retry">重新加载酒单</button></section>`;
      document.getElementById('retry').addEventListener('click',start);
    }
  }
  start();
})();
