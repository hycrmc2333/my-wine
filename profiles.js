/* Local nickname profiles. Nicknames are labels, not authenticated accounts. */
(function (root) {
  'use strict';
  const KEY = 'my-wine-profiles-v1';
  const normalize = name => String(name || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const strings = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string'))] : [];
  function clean(profile) {
    const p = profile?.preferences || {};
    return {name: normalize(profile?.name), favorites: strings(profile?.favorites),
      pantry: {items: strings(profile?.pantry?.items), enabled: profile?.pantry?.enabled === true},
      preferences: {base: typeof p.base === 'string' ? p.base : '全部', category: typeof p.category === 'string' ? p.category : 'all', preparation: ['all','direct','milk'].includes(p.preparation) ? p.preparation : 'all', flavors: strings(p.flavors), query: typeof p.query === 'string' ? p.query : ''}};
  }
  function createStore(storage) {
    let memory = {version: 1, lastNickname: '', legacyImported: false, profiles: []};
    let persistent = true;
    function read() {
      if (!persistent) return memory;
      try {
        const data = JSON.parse(storage.getItem(KEY) || 'null');
        if (data?.version === 1 && Array.isArray(data.profiles)) memory = {...data, profiles: data.profiles.map(clean).filter(p => p.name)};
      } catch { persistent = false; }
      return memory;
    }
    function write(data) {
      memory = data;
      try { storage.setItem(KEY, JSON.stringify(data)); persistent = true; } catch { persistent = false; }
      return persistent;
    }
    return {
      read,
      open(value) {
        const name = normalize(value);
        if (!name || [...name].length > 24 || /[\p{Cc}\p{Cf}]/u.test(name)) throw new Error('请输入 1–24 个字的昵称。');
        const data = read();
        let profile = data.profiles.find(p => p.name === name), migrated = false;
        if (!profile) {
          profile = clean({name});
          if (!data.legacyImported && !data.profiles.length) {
            try {
              profile.favorites = strings(JSON.parse(storage.getItem('my-wine-favorites') || '[]'));
              const pantry = JSON.parse(storage.getItem('my-wine-pantry') || '{}');
              profile.pantry = {items: strings(pantry?.items), enabled: pantry?.enabled === true};
              migrated = profile.favorites.length > 0 || profile.pantry.items.length > 0;
            } catch { /* Invalid legacy data does not block entry. */ }
          }
          data.profiles.push(profile);
        }
        data.legacyImported = true; data.lastNickname = name;
        return {profile: clean(profile), migrated, persisted: write(data)};
      },
      save(profile) {
        const data = read(), entry = clean(profile), index = data.profiles.findIndex(p => p.name === entry.name);
        if (index < 0) data.profiles.push(entry); else data.profiles[index] = entry;
        data.lastNickname = entry.name; data.legacyImported = true;
        return write(data);
      }
    };
  }
  root.WineProfiles = {KEY, normalize, createStore};
  if (typeof module !== 'undefined') module.exports = root.WineProfiles;
})(typeof window !== 'undefined' ? window : globalThis);
