const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./helpers/load-typescript.cjs')({
  '@/utils/normalize': {normalizeKoAsync: async text => ({normalized:text,changes:[]})},
});
const {prepareTbmSpeechDraft} = load('src/utils/tbm-speech-draft.ts');
test('English Hello is translated with its source language, not submitted as Korean', async()=>{
  let payload;
  const result = await prepareTbmSpeechDraft('Hello','en','160',async(url,init)=>{
    assert.equal(url,'/api/tbm/speech-draft'); payload=JSON.parse(init.body);
    return Response.json({text:'안녕하세요'});
  });
  assert.deepEqual(payload,{text:'Hello',sourceLanguage:'en',siteId:160,nationwide:false});
  assert.equal(result,'안녕하세요');
});
test('all 19 selectable non-Korean languages preserve source and nationwide scope',async()=>{
  for(const language of ['en','zh','vi','th','uz','id','ja','ph','km','mn','my','ne','bn','kk','ru','fr','es','ar','hi']) {
    await prepareTbmSpeechDraft('original',language,'nationwide',async(_url,init)=>{
      assert.deepEqual(JSON.parse(init.body),{text:'original',sourceLanguage:language,siteId:null,nationwide:true});
      return Response.json({text:'번역'});
    });
  }
});
test('Korean uses no extra translation request',async()=>{
  assert.equal(await prepareTbmSpeechDraft('안녕하세요','ko-KR','160',async()=>{throw Error('unexpected call');}),'안녕하세요');
});
test('failed or empty translation never passes foreign source as Korean',async()=>{
  for(const response of [new Response('',{status:503}),Response.json({text:''}),Response.json({text:123})]) {
    await assert.rejects(prepareTbmSpeechDraft('Hello','en','160',async()=>response));
  }
});
test('TBM wires selected display language, preserves original and prevents partial final publication',()=>{
  const page=fs.readFileSync('src/app/admin/tbm/create/page.tsx','utf8');
  assert.match(page,/useCloudSTT\(\{\s*lang: displayLang \|\| adminLang/);
  assert.match(page,/setSpeechSource\(previous/);
  assert.match(page,/summaryBusy \|\| pendingSpeechRef.current.length\) return/);
  const hook=fs.readFileSync('src/hooks/useCloudSTT.ts','utf8');
  assert.match(hook,/lang: getSTTLang\(languageForChunk\)/);
  assert.match(hook,/onTranscriptForChunk\(data.transcript.trim\(\), data.translations, languageForChunk\)/);
});

test('STT API forwards selected language and does not apply Korean prompts to English',async()=>{
  let captured;
  const sttLoad = require('./helpers/load-typescript.cjs')({
    '@/utils/auth/cookie-user': {getCookieUser:async()=>({id:'fixture',source:'v3',roles:['SITE_ADMIN'],activeSiteId:160})},
    '@/utils/rate-limit': {checkSttLimit:async()=>true},
    '@/utils/auth/v3-proxy': {SAFE_LINK_V3_API_BASE_URL:'http://fixture.invalid'},
    '@/utils/ai/v3-ai-gateway': {callV3AiStt:async(_request,payload)=>{
      captured=payload; return Response.json({transcript:'Hello',vendor:'flitto'});
    }},
  });
  const {POST}=sttLoad('src/app/api/stt/route.ts');
  const response=await POST(new Request('http://localhost/api/stt',{method:'POST',body:JSON.stringify({audio:'fixture',lang:'en-US',live:true})}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).transcript,'Hello');
  assert.equal(captured.languageCode,'en-US');
  assert.deepEqual(captured.speechHints,[]);
  assert.equal(captured.prompt,undefined);
});
