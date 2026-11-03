const assert = require('node:assert/strict');
const fs = require('node:fs');
const {options,profile,matches} = require('../flavors.js');
const recipes = ['cocktails','innovations'].flatMap(file=>JSON.parse(fs.readFileSync(`${file}.json`,'utf8')));
const drink = id => recipes.find(c=>c.id===id);
const ids = new Set(options.map(o=>o.id));
for (const c of recipes) { assert.ok(profile(c).length,c.id); assert.ok(profile(c).every(id=>ids.has(id))); assert.equal(matches(c,new Set()),true); }
assert.equal(matches(drink('negroni'),new Set(['bitter','sweet'])),true);
assert.equal(matches(drink('negroni'),new Set(['sour'])),false);
assert.equal(matches(drink('whiskey-sour'),new Set(['sour','sweet'])),true);
assert.equal(matches(drink('dry-martini'),new Set(['sweet'])),false);
assert.equal(matches(drink('dry-martini'),new Set(['dry','herbal'])),true);
assert.equal(matches(drink('innovation-the-business'),new Set(['sour','sweet'])),true);
assert.equal(matches(drink('bloody-mary'),new Set(['savory','spicy'])),true);
assert.equal(matches(drink('innovation-pineapple-milk-punch'),new Set(['creamy'])),false,'clarification does not imply milky flavour');
console.log(`PASS: ${recipes.length} flavour profiles; multi-select intersection, clear selection, classic and innovation cases.`);
