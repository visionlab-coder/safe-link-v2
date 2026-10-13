const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs')();
const {filterGlossaryTerms: search, glossarySearchUI} = load('src/lib/glossary-search.ts');
const terms = [
  {slang:'겐바',standard:'현장',category:'작업',is_active:true},
  {slang:'오함마',standard:'대형 망치',category:'도구',is_active:true},
  {slang:'폼',standard:'FORM',category:'구조',is_active:false},
];
assert.equal(search(terms,'  '),terms);
for(const query of ['겐바','현장','작업','겐바 현장', '겐바']) assert.deepEqual(search(terms,query),[terms[0]]);
assert.deepEqual(search(terms,'망치'),[terms[1]]);
assert.deepEqual(search(terms,'fOrM'),[terms[2]]);
assert.deepEqual(search(terms,'ｆｏｒｍ'),[terms[2]]);
assert.deepEqual(search(terms,'없는단어'),[]);
assert.deepEqual(search(terms,'.*'),[]);
assert.deepEqual(search(terms,'겐바 도구'),[]);
assert.equal(terms.length,3);
assert.match(glossarySearchUI('ko').placeholder,/표준어/);
assert.deepEqual(glossarySearchUI('jp'),glossarySearchUI('ja'));
console.log('Glossary search: term, standard, category, multiple words, case, Unicode, inactive entries, clear and literal matching passed.');
