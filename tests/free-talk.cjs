const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const loadFactory = require('./helpers/load-typescript.cjs');
process.env.TRAVEL_API_SECRET = 'test-fixture-not-production';
process.env.SAFE_LINK_PUBLIC_APP_URL = 'https://fixture.example';
const load = loadFactory({ '@/utils/auth/v3-proxy': { SAFE_LINK_V3_API_BASE_URL: 'http://fixture.invalid' } });
const route = load('src/app/api/free-talk/[action]/route.ts');
const dictionary = { 나라시:'평탄화', 가도:'모서리', 시다:'보조원', 가타와꾸:'거푸집', 바라시:'해체', 함마:'망치' };
let calls = [];
let failVendor = false;
global.fetch = async (url, options) => {
  if (String(url).includes('/glossary?')) return Response.json({ terms:Object.entries(dictionary).map(([slang,standard])=>({slang,standard})) });
  assert.equal(options.headers.cookie, undefined, 'Never forward SQ-LINK auth cookies');
  assert.equal(options.headers['X-Safe-Link-Internal-Secret'],process.env.TRAVEL_API_SECRET);
  const body = JSON.parse(options.body || '{}'); calls.push({ url, body });
  if (String(url).endsWith('/session')) return Response.json({ handle:'a'.repeat(43), maxAge:7200 });
  if (String(url).endsWith('/tts')) return Response.json({ audioBase64:Buffer.from('audio fixture').toString('base64'), contentType:'audio/mpeg' });
  if (String(url).endsWith('/stt')) return Response.json({ transcript:'나라시 하지 마세요.', originalTranscript:'나라시 하지 마세요.', engine:'fixture' });
  if (failVendor) return Response.json({ error:'upstream' },{status:503});
  return Response.json({ translated:'TRANSLATION_FIXTURE', engine:'fixture' });
};
const request=(action,body={},headers={},method='POST')=>new NextRequest(`https://fixture.example/api/free-talk/${action}`, {
  method, headers:{ origin:'https://fixture.example',cookie:'SAFE_LINK_FREE_TALK='+'a'.repeat(43)+'; SAFE_LINK_SESSION=must-not-forward',...headers },
  ...(method==='POST'?{body:JSON.stringify(body)}:{}),
});
const post=(action,body,headers)=>route.POST(request(action,body,headers),{params:Promise.resolve({action})});
(async()=>{
  const session=await post('session',{});
  assert.deepEqual(await session.json(),{ok:true});
  assert.match(session.headers.get('set-cookie'),/HttpOnly/i);
  assert.match(session.headers.get('set-cookie'),/SameSite=strict/i);
  assert.match(session.headers.get('set-cookie'),/Path=\/api\/free-talk/i);
  const cases=[['나라시 하지 마세요.','평탄화 하지 마세요.'],['들어가도 됩니까?','들어가도 됩니까?'],['작업 시작합시다','작업 시작합시다'],['가타와꾸가 없으면 작업하지 마세요.','거푸집이 없으면 작업하지 마세요.']];
  for (const [text,expected] of cases) {
    const res=await post('translate',{text,from:'ko',to:'en'});
    assert.equal(res.status,200); const data=await res.json();
    assert.equal(data.originalText,text); assert.equal(data.normalizedText,expected);
    assert.equal(calls.at(-1).body.text,expected); assert.equal(data.translated,'TRANSLATION_FIXTURE');
  }
  const speech=await post('stt',{audio:'fixture',lang:'ko'});
  const raw=(await speech.json()).originalTranscript;
  assert.equal(raw,'나라시 하지 마세요.');
  const translated=await post('translate',{text:raw,from:'ko',to:'vi'});
  assert.equal((await translated.json()).normalizedText,'평탄화 하지 마세요.');
  assert.equal((await post('translate',{text:'hi',from:'en',to:'ko'},{origin:'https://evil.invalid'})).status,403);
  assert.equal((await post('translate',{text:'hi',from:'en',to:'ko'},{cookie:''})).status,401);
  assert.equal((await post('translate',{text:'hi',from:'xx',to:'ko'})).status,400);
  assert.equal((await post('translate',{text:'a'.repeat(2001),from:'en',to:'ko'})).status,400);
  assert.equal((await post('admin',{})).status,404);
  const tts=await post('tts',{text:'hello',lang:'en',gender:'female'});
  assert.equal(tts.headers.get('content-type'),'audio/mpeg'); assert.equal(await tts.text(),'audio fixture');
  failVendor=true;
  assert.equal((await post('translate',{text:'hello',from:'en',to:'ko'})).status,503);
  console.log('Free Talk BFF: cookie isolation, CSRF/origin, glossary boundaries, STT raw/translation separation, audio response and failure paths passed. Vendors mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
