const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs')();
const { normalizeKo, normalizeKoAsync, clearGlossaryCache } = load('src/utils/normalize.ts');
const { CONSTRUCTION_GLOSSARY } = load('src/constants/glossary.ts');
const { glossaryDeliveryTerm, GLOSSARY_POLICY_VERSION } = load('src/utils/korean-glossary.ts');
const dictionary = { ...CONSTRUCTION_GLOSSARY, 가도: '모서리', 시다: '보조원', 와꾸: '테두리', 사포도: '서포트, 동바리', 함마: '해머(망치)', 데모도: '보조공, 조수' };

const cases = [
    ['들어가도 됩니까?', '들어가도 됩니까?'],
    ['작업 시작합시다', '작업 시작합시다'],
    ['가도 됩니까?', '가도 됩니까?'],
    ['갑시다. 먹읍시다. 마십시다.', '갑시다. 먹읍시다. 마십시다.'],
    ['시간이 지나가도 안 됩니다.', '시간이 지나가도 안 됩니다.'],
    ['가리면 안 됩니다. 가다 보면 나옵니다.', '가리면 안 됩니다. 가다 보면 나옵니다.'],
    ['함마를 가져오세요.', '망치를 가져오세요.'],
    ['가타와꾸를 해체하지 마세요.', '거푸집을 해체하지 마세요.'],
    ['가다와꾸는 해체하지 마세요.', '거푸집은 해체하지 마세요.'],
    ['사포도가 없으면 들어가지 마세요.', '동바리가 없으면 들어가지 마세요.'],
    ['사포도는 반드시 확인하되 이상이 없을 때만 작업하세요.', '동바리는 반드시 확인하되 이상이 없을 때만 작업하세요.'],
    ['바라시 작업은 하지 마세요.', '해체 작업은 하지 마세요.'],
    ['바라시하지 마세요.', '해체하지 마세요.'],
    ['바라시하기 전에는 들어가지 마세요.', '해체하기 전에는 들어가지 마세요.'],
    ['바라시가 끝나지 않으면 작업하지 마세요.', '해체가 끝나지 않으면 작업하지 마세요.'],
    ['데모도와 함께 확인하세요.', '보조공과 함께 확인하세요.'],
    ['데모도가 없으면 기다리세요.', '보조공이 없으면 기다리세요.'],
    ['안전모 착용 여부를 확인하세요.', '안전모 착용 여부를 확인하세요.'],
    ['하이바를 쓰지 않으면 들어갈 수 없습니다.', '안전모를 쓰지 않으면 들어갈 수 없습니다.'],
    ['안전하게 작업하고 사전 확인합시다.', '안전하게 작업하고 사전 확인합시다.'],
    ['공기가 탁하면 들어가지 마세요.', '공기가 탁하면 들어가지 마세요.'],
    ['위험', '위험'],
    ['쉬어. 안 들어가도 돼.', '쉬어. 안 들어가도 돼.'],
    ['아시바를 확인하세요.', '비계를 확인하세요.'],
    ['겐바에서 작업 시작합시다.', '현장에서 작업 시작합시다.'],
    ['하시라, 함마, 사포도, 가타와꾸', '기둥, 망치, 동바리, 거푸집'],
    ['짬을 내서 확인하세요.', '작업 여유시간을 내서 확인하세요.'],
    ['오함마 2개와 함마 1개만 가져오세요.', '대형 망치 2개와 망치 1개만 가져오세요.'],
    ['가타와꾸? (함마) / 사포도\n바라시', '거푸집? (망치) / 동바리\n해체'],
    ['가타와꾸미등록복합어 함마드릴', '가타와꾸미등록복합어 함마드릴'],
    ['잠, 짠, 사포토', '잠, 짠, 사포토'],
    ['', ''],
];
for (const [source, expected] of cases) {
    assert.equal(normalizeKo(source, dictionary).normalized, expected, source);
    assert.equal(normalizeKo(expected, dictionary).normalized, expected, `idempotence: ${source}`);
}
// Longest match, terminal output, unknown compound, literal regex characters, no placeholder collision.
assert.equal(normalizeKo('가타와꾸', {와꾸:'테두리'}).normalized, '가타와꾸');
assert.equal(normalizeKo('오함마', {오함마:'대형 망치',함마:'망치'}).normalized, '대형 망치');
assert.equal(normalizeKo('A+B\x000\x00', {'A+B':'공구'}).normalized, '공구\x000\x00');
assert.equal(normalizeKo('foobar X 아시바', {'':'bad',아시바:'비계',비계:'작업 발판'}).normalized, 'foobar X 비계');
assert.equal(glossaryDeliveryTerm('예시', '의미1, 의미2'), '예시');
assert.equal(glossaryDeliveryTerm('쑤신다', '주입(그라우팅)한다'), '쑤신다');
// No dictionary substring can eat another word, identifier, number or combining-mark sequence.
for (const term of Object.keys(dictionary)) {
    for (const prefix of ['앞', 'X', '3', '_', 'a\u0301']) {
        const text = prefix + term + 'Z';
        assert.equal(normalizeKo(text, dictionary).normalized, text);
    }
}

(async () => {
    const priorFetch = global.fetch;
    try {
        global.fetch = async () => Response.json({terms: Object.entries(dictionary).map(([slang,standard])=>({slang,standard}))});
        clearGlossaryCache();
        for (const [source,expected] of cases) assert.equal((await normalizeKoAsync(source)).normalized,expected,`DB async: ${source}`);
    } finally { global.fetch = priorFetch; clearGlossaryCache(); }
    console.log(`${GLOSSARY_POLICY_VERSION}: ${cases.length} paired examples, idempotence, DB path and ${Object.keys(dictionary).length * 5} substring guards passed`);
})().catch(error => { console.error(error); process.exitCode=1; });
