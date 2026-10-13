const assert = require('node:assert/strict');
const fs = require('node:fs');
const {NextRequest} = require('next/server');
const createLoader = require('./helpers/load-typescript.cjs');
let actor = {id:'fixture',source:'v3',siteIds:[160],activeSiteId:160,roles:['SITE_ADMIN']};
let fail = false;
let raw = '가타와꾸를 확인하세요.';
let forced;
const calls = [];
const load = createLoader({
  '@/utils/auth/cookie-user':{getCookieUser:async()=>actor},
  '@/utils/rate-limit':{checkTranslateLimit:async()=>true,checkSttLimit:async()=>true},
  '@/utils/auth/v3-proxy':{SAFE_LINK_V3_API_BASE_URL:'http://fixture.invalid'},
  '@/lib/travel-auth':{verifyTravelToken:()=>false},
  '@/utils/lab/engine-config':{getLabOverride:async()=>forced?{translateEngine:forced}:null},
  '@/utils/auth/mobile-cors':{withMobileCors:r=>r,handleMobilePreflight:()=>null},
  '@/utils/ai/v3-ai-gateway':{
    callV3AiStt:async()=>Response.json({transcript:raw,vendor:'deepl',translations:{}}),
    callV3AiVendor:async(_request,payload)=>{
      calls.push(payload);
      if(fail)return null;
      return {text:'TRANSLATED FIXTURE',vendor:payload.targetLanguage==='km'?'google':'deepl',model:'fixture'};
    },
  },
});
const priorFetch=global.fetch;
global.fetch=async()=>Response.json({terms:[{slang:'가타와꾸',standard:'거푸집'}]});
const translate=load('src/app/api/translate/route.ts');
const stt=load('src/app/api/stt/route.ts');
const req=(path,body)=>new NextRequest('http://localhost'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
(async()=>{
  for(const mode of [undefined,'deepl']) {
    forced=mode;
    for(const target of ['en','zh','km']) {
      calls.length=0;
      const result=await translate.POST(req('/api/translate',{text:raw,sl:'ko',tl:target,fast:true,quality:'high'}));
      assert.equal(result.status,200);
      const body=await result.json();
      assert.equal(body.engine,target==='km'?'google':'deepl');
      assert.equal(calls.length,1,'No contextual OpenAI rewrite of the DeepL result');
      assert.equal(calls[0].provider,mode||'auto');
      assert.equal(calls[0].text,'거푸집을 확인하세요.');
    }
  }
  forced=undefined;
  calls.length=0;
  await translate.POST(req('/api/translate',{text:'Hello',sl:'en',tl:'ko',fast:false,pronunciation:false}));
  assert.equal(calls.length,2,'Forward and reverse translation only');
  assert.ok(calls.every(c=>c.provider==='auto'));
  fail=true;calls.length=0;
  assert.equal((await translate.POST(req('/api/translate',{text:'Hello',sl:'en',tl:'ko',fast:true}))).status,503);
  assert.equal(calls.length,1,'No hidden fallback after provider failure');
  fail=false;
  const speech=await (await stt.POST(req('/api/stt',{audio:'fixture',lang:'ko-KR',live:true,mimeType:'audio/pcm',sampleRateHertz:16000}))).json();
  assert.equal(speech.engine,'deepl');
  assert.equal(speech.originalTranscript,raw);
  assert.equal(speech.transcript,'거푸집을 확인하세요.');
  raw='Hello';
  const foreign=await (await stt.POST(req('/api/stt',{audio:'fixture',lang:'en-US',live:true}))).json();
  assert.equal(foreign.transcript,'Hello');
  actor=null;
  assert.equal((await translate.POST(req('/api/translate',{}))).status,401);
  assert.equal((await stt.POST(req('/api/stt',{}))).status,401);
  const hook=fs.readFileSync('src/hooks/useCloudSTT.ts','utf8');
  assert.ok(!hook.includes('flitto'));
  assert.match(hook,/await blobToPcm16Base64\(blob\)/);
  assert.match(hook,/sampleRateHertz: 16000/);
  console.log('DeepL routing PASS: default/explicit selection, glossary, high-quality path, Khmer vendor label, reverse translation, no hidden fallback, source language and auth. Network mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.fetch=priorFetch;});
