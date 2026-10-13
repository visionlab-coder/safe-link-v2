const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./helpers/load-typescript.cjs')();
const batch = require('../scripts/data/glossary-additions-20261013.json');
const { CONSTRUCTION_GLOSSARY } = load('src/constants/glossary.ts');
const { normalizeKoreanGlossary } = load('src/utils/korean-glossary.ts');
const dictionary = { ...CONSTRUCTION_GLOSSARY };
for (const term of batch.entries) {
    if (term.is_active && !Object.hasOwn(dictionary, term.slang)) dictionary[term.slang] = term.standard;
}
assert.equal(batch.entries.length, 218);
assert.equal(new Set(batch.entries.map(t => t.slang)).size, 218);
assert.equal(batch.entries.filter(t => !t.is_active).length, 18);
for (const [key, value] of Object.entries(CONSTRUCTION_GLOSSARY)) assert.equal(dictionary[key], value);
assert.ok(!batch.entries.some(t => ['전', '~부'].includes(t.slang)));
for (const [source, expected] of [
    ['겜바에서 작업 시작합시다.', '현장에서 작업 시작합시다.'],
    ['낫또를 가져오세요.', '너트를 가져오세요.'],
    ['도란스를 확인하세요.', '변압기를 확인하세요.'],
    ['가쿠목이 없으면 작업하지 마세요.', '각목이 없으면 작업하지 마세요.'],
    ['뎃킨은 아직 옮기지 마세요.', '철근은 아직 옮기지 마세요.'],
    ['들어가도 됩니까?', '들어가도 됩니까?'],
    ['작업 시작합시다', '작업 시작합시다'],
    ['작업 전 안전을 확인합시다.', '작업 전 안전을 확인합시다.'],
    ['단가를 확인하고 소지 물품을 챙기세요.', '단가를 확인하고 소지 물품을 챙기세요.'],
    ['램프가 꺼졌습니다. 뿌리가 보입니다.', '램프가 꺼졌습니다. 뿌리가 보입니다.'],
    ['세면 후 물에 담가 주세요.', '세면 후 물에 담가 주세요.'],
    ['사뽀드를 확인하세요.', '사뽀드를 확인하세요.'], // Unreviewed multiple meanings stay out of speech.
]) {
    assert.equal(normalizeKoreanGlossary(source, dictionary).normalized, expected, source);
    assert.equal(normalizeKoreanGlossary(expected, dictionary).normalized, expected, `second pass: ${source}`);
}
for (const term of batch.entries.filter(t => t.is_active)) {
    const source = `앞${term.slang}미등록복합어`;
    assert.equal(normalizeKoreanGlossary(source, dictionary).normalized, source);
}
const sql = fs.readFileSync('scripts/import-glossary-additions-20261013.sql', 'utf8');
assert.match(sql, /ON CONFLICT DO NOTHING/);
assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE)\s+construction_glossary/i);
assert.match(sql, /existing_glossary_changed/);
assert.match(sql, /ops\.glossary_import/);
for (const term of batch.entries) assert.ok(sql.includes(`'${term.slang.replaceAll("'", "''")}'`));
console.log('218 add-only entries, 18 inactive homonyms, original mappings, 12 sentence pairs, 200 substring guards and SQL safety passed.');
