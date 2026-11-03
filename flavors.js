/* Editorial flavour descriptors, not measured sweetness or acidity. */
(function (root) {
  'use strict';
  const options = [
    ['sour','酸'],['sweet','甜'],['bitter','苦'],['dry','干爽'],
    ['fruity','果香'],['herbal','草本'],['floral','花香'],
    ['smoky','烟熏'],['spicy','辛香'],['creamy','奶香'],['coffee','咖啡'],['savory','咸鲜']
  ].map(([id,label])=>({id,label}));
  // Supplement the existing short card tags where they emphasize aroma rather than taste.
  const additions = {
    sour: `mojito daiquiri cosmopolitan aviation bees-knees between-the-sheets brandy-crusta caipirinha canchanchara casino chartreuse-swizzle clover-club corpse-reviver-2 cuba-libre dons-special-daiquiri french-75 french-martini gin-basil-smash gin-fizz hemingway-special iba-tiki illegal john-collins jungle-bird last-word long-island-iced-tea mai-tai missionarys-downfall naked-and-famous old-cuban paloma paper-plane penicillin pisco-punch porn-star-martini ramos-fizz russian-spring-punch sea-breeze singapore-sling spicy-fifty suffering-bastard three-dots-and-a-dash ve-n-to white-lady zombie`.split(' '),
    sweet: `mojito old-fashioned whiskey-sour espresso-martini cosmopolitan manhattan pina-colada alexander angel-face bees-knees bellini black-russian bramble caipirinha canchanchara champagne-cocktail clover-club cuba-libre dark-n-stormy dons-special-daiquiri french-connection french-martini grasshopper horses-neck iba-tiki irish-coffee john-collins kir long-island-iced-tea mai-tai martinez mint-julep missionarys-downfall monkey-gland new-york-sour old-cuban paradise penicillin pisco-punch pisco-sour porn-star-martini porto-flip ramos-fizz remember-the-maine russian-spring-punch rusty-nail sex-on-the-beach sherry-cobbler singapore-sling stinger three-dots-and-a-dash tipperary ve-n-to vieux-carre zombie`.split(' '),
    bitter: `fernandito hanky-panky jungle-bird naked-and-famous paper-plane rabo-de-galo innovation-dantes-peak`.split(' '),
    creamy: ['pina-colada','innovation-slippery-when-wet'],
    spicy: ['moscow-mule','dark-n-stormy','horses-neck','suffering-bastard','penicillin','bloody-mary','spicy-fifty']
  };
  const patterns = {
    sour:/酸/, sweet:/甜|蜂蜜|果甜/, bitter:/苦/, dry:/干爽|清干/,
    fruity:/果|柑橘|青柠|柠檬|西柚|柚子|菠萝|苹果|桃|樱桃|橙香|葡萄|杏香/,
    herbal:/草本|薄荷|罗勒|茴香|洋甘菊/,
    floral:/花香|花果香|橙花|接骨木花|洋甘菊/,
    smoky:/烟熏/, spicy:/香料|姜香|姜辛|微辣|肉桂|丁香|肉豆蔻|黑胡椒/,
    creamy:/奶香|奶油|椰香|酸奶/, coffee:/咖啡/, savory:/咸鲜|微咸|番茄/
  };
  function profile(c) {
    const text = [...c.tags,c.flavorDescription || ''].join(' ');
    return options.filter(o=>patterns[o.id].test(text) || additions[o.id]?.includes(c.id)).map(o=>o.id);
  }
  function matches(c, selected) { const tastes = profile(c); return [...selected].every(id=>tastes.includes(id)); }
  const api = {options,profile,matches};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WineFlavors = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
