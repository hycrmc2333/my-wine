/* Ingredient matching is independent of the catalogue UI. */
(function (root) {
  'use strict';
  const available = (selected, items) => {
    const index = new Map(items.map(item => [item.id, item]));
    const result = new Set(selected);
    const visit = id => { for (const next of index.get(id)?.provides || []) if (!result.has(next)) { result.add(next); visit(next); } };
    selected.forEach(visit);
    return result;
  };
  const canMake = (requirements, stock) => Array.isArray(requirements) && requirements.length > 0 && requirements.every(options => options.some(id => stock.has(id)));
  const api = {available, canMake};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WinePantry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
