const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const createLoader = require('./helpers/load-typescript.cjs');
const dictionary = {가도:'모서리',시다:'보조원',와꾸:'테두리',가타와꾸:'거푸집',사포도:'서포트, 동바리',함마:'해머(망치)',바라시:'해체, 뜯기',데모도:'보조공, 조수',안전모:'안전 헬멧(의무 착용)'};
const cases = [
    ['들어가도 됩니까?', '들어가도 됩니까?'],
    ['작업 시작합시다', '작업 시작합시다'],
    ['가타와꾸를 확인하세요.', '거푸집을 확인하세요.'],
    ['사포도가 없으면 들어가지 마세요.', '서포트가 없으면 들어가지 마세요.'],
    ['함마를 가져오세요.', '망치를 가져오세요.'],
    ['바라시하지 마세요.', '해체하지 마세요.'],
    ['데모도와 함께 확인하세요.', '보조공과 함께 확인하세요.'],
    ['안전모 착용 여부를 확인하세요.', '안전모 착용 여부를 확인하세요.'],
];
let actor = {id: 'fixture',source:'v3',roles:['SITE_ADMIN'],activeSiteId:1,siteIds:[1]};
let raw = '';
let providerText = '';
const stubs = {
    '@/utils/auth/cookie-user': { getCookieUser: async()=>actor },
    '@/utils/rate-limit': {checkSttLimit:async()=>true,checkTranslateLimit:async()=>true},
    '@/utils/auth/v3-proxy': {SAFE_LINK_V3_API_BASE_URL:'http://fixture.invalid'},
    '@/utils/ai/v3-ai-gateway': {
        callV3AiStt: async()=>Response.json({transcript:raw,vendor:'flitto',translations:{en:'PRE_NORMALIZATION_FIXTURE'}}),
        callV3AiVendor:async(_req,payload)=>{providerText=payload.text;return {text:'TRANSLATION_FIXTURE',vendor:'fixture'};},
    },
    '@/lib/travel-auth': {verifyTravelToken:()=>false},
    '@/utils/lab/engine-config': {getLabOverride:async()=>({translateEngine:'google'})},
    '@/utils/auth/mobile-cors': {withMobileCors:r=>r,handleMobilePreflight:()=>null},
};
const load = createLoader(stubs);
const stt = load('src/app/api/stt/route.ts');
const translate = load('src/app/api/translate/route.ts');
const priorFetch = global.fetch;
global.fetch = async url => {
    assert.match(String(url), /^http:\/\/fixture.invalid\/api\/v1\/glossary\?active=true$/);
    return Response.json({terms:Object.entries(dictionary).map(([slang,standard])=>({slang,standard}))});
};
const request = (url,body)=>new NextRequest('http://localhost'+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
(async()=>{
    for (const live of [false,true]) for (const [source,expected] of cases) {
        raw=source;
        const speech=await stt.POST(request('/api/stt',{audio:'TEST_FIXTURE_NOT_AUDIO',lang:'ko-KR',live}));
        assert.equal(speech.status,200);
        const s=await speech.json();
        assert.equal(s.originalTranscript,source);
        assert.equal(s.normalizedTranscript,expected);
        assert.equal(s.transcript,expected);
        assert.equal(s.glossaryPolicyVersion,'ko-glossary-2026-10-15.1');
        if (live && source!==expected) assert.equal(s.translations,undefined,'Never reuse pre-normalization RTT output');
        for (const fast of [false,true]) {
            const response=await translate.POST(request('/api/translate',{text:s.transcript,sl:'ko',tl:'en',fast,pronunciation:false}));
            assert.equal(response.status,200);
            const t=await response.json();
            assert.equal(t.originalText,expected);
            assert.equal(t.normalizedText,expected,'no second-pass expansion');
            assert.equal(t.translated,'TRANSLATION_FIXTURE');
            assert.equal(t.glossaryPolicyVersion,s.glossaryPolicyVersion);
        }
        const typed=await translate.POST(request('/api/translate',{text:source,sl:'ko',tl:'en',fast:true}));
        assert.equal((await typed.json()).normalizedText,expected);
        assert.equal(providerText,expected,'provider receives normalized text, not dictionary explanation');
    }
    raw='你好';
    const foreign=await stt.POST(request('/api/stt',{audio:'fixture',lang:'zh-CN',live:true}));
    assert.equal((await foreign.json()).originalTranscript,'你好');
    actor=null;
    assert.equal((await stt.POST(request('/api/stt',{}))).status,401);
    assert.equal((await translate.POST(request('/api/translate',{}))).status,401);
    console.log('API contract: 16 STT paths, 32 translations, 16 typed translations, raw/normalized/final separation and authentication passed. Providers mocked; NOT a foreign-language accuracy or real-audio test.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.fetch=priorFetch;});
