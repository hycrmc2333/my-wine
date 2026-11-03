const assert = require('node:assert/strict');
const fs = require('node:fs');
const {available,canMake} = require('../pantry.js');
const data = JSON.parse(fs.readFileSync('pantry.json','utf8'));
const recipes = ['cocktails','innovations'].flatMap(file=>JSON.parse(fs.readFileSync(`${file}.json`,'utf8')));
const ids = new Set(data.items.map(i=>i.id));
assert.equal(ids.size,data.items.length);
assert.equal(Object.keys(data.requirements).length,recipes.length);
for(const c of recipes){
  assert.ok(data.requirements[c.id]?.length, c.id);
  for(const group of data.requirements[c.id]) { assert.ok(group.length); for(const id of group) assert.ok(ids.has(id),`${c.id}: ${id}`); }
}
const make = (id,stock) => canMake(data.requirements[id],available(new Set(stock),data.items));
assert.equal(make('negroni',['金酒','金巴利 Campari']),false,'missing vermouth must block');
assert.equal(make('negroni',['金酒','金巴利 Campari','甜红味美思']),true);
assert.equal(make('negroni',['金酒','金巴利 Campari','干味美思']),false,'dry is not sweet vermouth');
assert.equal(make('negroni',['伦敦干金酒','金巴利 Campari','甜红味美思']),true,'specific gin meets generic requirement');
assert.equal(make('innovation-the-business',['金酒','青柠汁','蜂蜜水（3:1）']),false,'generic gin must not satisfy specified London dry');
assert.equal(make('old-fashioned',['波本威士忌','方糖','安格仕芳香苦精']),true,'either whiskey and default water');
assert.equal(make('old-fashioned',['黑麦威士忌','方糖','安格仕芳香苦精']),true);
assert.equal(make('whiskey-sour',['波本威士忌','柠檬汁','普通糖浆（1:1）']),true,'optional egg white excluded');
assert.equal(make('whiskey-sour',['波本威士忌','柠檬汁','白砂糖']),false,'syrup is not automatically prepared');
assert.equal(make('whiskey-sour',['波本威士忌','柠檬（整果）','普通糖浆（1:1）']),true,'whole fruit can supply juice');
const bloody=['伏特加','番茄汁','柠檬汁','伍斯特酱 Worcestershire Sauce','塔巴斯科辣椒汁','芹菜盐'];
assert.equal(make('bloody-mary',bloody),false,'compound seasoning requires each ingredient');
assert.equal(make('bloody-mary',[...bloody,'黑胡椒']),true);
assert.equal(make('innovation-pineapple-milk-punch',['阿萨姆红茶包','柠檬汁','菠萝汁','普通糖浆（1:1）','全脂牛奶','伏特加','金酒']),true,'batch + per-glass alternative');
assert.equal(make('innovation-pineapple-milk-punch',['阿萨姆红茶包','柠檬汁','菠萝汁','普通糖浆（1:1）','全脂牛奶','金酒']),false,'batch vodka required even when gin is serving choice');
assert.equal(canMake(undefined,new Set()),false);
for(const c of recipes) assert.equal(make(c.id,[]),false);
console.log(`PASS: pantry coverage for ${recipes.length} recipes, ${ids.size} materials; exact requirements, aliases, alternatives, compound ingredients, optional items and batch additions.`);

const groupOf = id => data.items.find(i=>i.id===id).group;
assert.equal(groupOf('龙舌兰糖浆'),'mixers');
assert.equal(groupOf('白葡萄酒醋'),'mixers');
assert.equal(groupOf('君度橙酒 Cointreau'),'liqueurs');

for (const item of data.items) assert.ok(data.families[item.group].some(f=>f.id===item.subgroup), `Missing family: ${item.id}`);
assert.equal(data.items.find(i=>i.id==='波本威士忌').subgroup,'whisky');
assert.equal(data.items.find(i=>i.id==='干邑白兰地').subgroup,'brandy');
assert.equal(data.items.find(i=>i.id==='君度橙酒 Cointreau').subgroup,'orange');
