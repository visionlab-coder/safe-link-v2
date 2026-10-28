const assert = require('node:assert/strict');
const {NextRequest} = require('next/server');
const fixture = require('./fixtures/deepl-source-conflicts.json');
const createLoader = require('./helpers/load-typescript.cjs');
const calls=[];
const dictionary=Object.fromEntries(fixture.map(f=>[f.source,f.standard]));
Object.assign(dictionary,{가도:'모서리',시다:'보조원',나라시:'평탄화'});
process.env.TRAVEL_API_SECRET='fixture-only';
process.env.SAFE_LINK_PUBLIC_APP_URL='https://fixture.example';
const load=createLoader({
 '@/utils/auth/cookie-user':{getCookieUser:async()=>({id:'fixture',source:'v3',siteIds:[160],activeSiteId:160,roles:['SITE_ADMIN']})},
 '@/utils/rate-limit':{checkTranslateLimit:async()=>true},
 '@/utils/auth/v3-proxy':{SAFE_LINK_V3_API_BASE_URL:'http://fixture.invalid'},
 '@/lib/travel-auth':{verifyTravelToken:()=>false},
 '@/utils/lab/engine-config':{getLabOverride:async()=>null},
 '@/utils/auth/mobile-cors':{withMobileCors:r=>r,handleMobilePreflight:()=>null},
 '@/utils/ai/v3-ai-gateway':{callV3AiVendor:async(_r,p)=>{calls.push(p);return {text:'fixture',vendor:'deepl',model:'fixture'};}},
});
global.fetch=async(url,options)=>{
 if(String(url).includes('/glossary?'))return Response.json({terms:Object.entries(dictionary).map(([slang,standard])=>({slang,standard}))});
 const p=JSON.parse(options.body);calls.push(p);return Response.json({translated:'fixture',engine:'deepl'});
};
const {normalizeKoreanGlossary:normal,koreanTranslationSource:source}=load('src/utils/korean-glossary.ts');
const {TranslationSourceBuffer}=load('src/utils/translation-source-buffer.ts');
const route=load('src/app/api/translate/route.ts');
const free=load('src/app/api/free-talk/[action]/route.ts');
const req=(path,body)=>new NextRequest('https://fixture.example'+path,{method:'POST',headers:{origin:'https://fixture.example',cookie:'SAFE_LINK_FREE_TALK='+'a'.repeat(43),'Content-Type':'application/json'},body:JSON.stringify(body)});
(async()=>{
 for(const f of fixture){
  assert.equal(normal(f.source,dictionary).normalized,f.standard);
  assert.equal(source(f.source,dictionary),f.source);
  assert.equal(source(f.standard,dictionary,f.source),f.source);
  for(const target of ['en','ja','vi','zh']){
   const a=await route.POST(req('/api/translate',{text:f.standard,originalText:f.source,sl:'ko',tl:target,fast:true}));
   assert.equal(a.status,200);assert.equal(calls.at(-1).text,f.source);
   const b=await free.POST(req('/api/free-talk/translate',{text:f.source,from:'ko',to:target}),{params:Promise.resolve({action:'translate'})});
   assert.equal(b.status,200);assert.equal(calls.at(-1).text,f.source);assert.equal((await b.json()).normalizedText,f.standard);
  }
 }
 const raw='가꾸목과 가쿠목을 확인하고, 몰탈과 시멘트풀을 섞지 마세요. 나라시 하지 마세요.';
 const display=normal(raw,dictionary).normalized;
 assert.equal(source(display,dictionary,raw),raw.replace('나라시','평탄화'));
 assert.equal(source('각목',dictionary),'각목','Never guess a source for old normalized records');
 assert.equal(source('각목을 쓰지 마세요.',dictionary,'가꾸목을 쓰세요.'),'각목을 쓰지 마세요.','Reject stale evidence');
 for(const s of ['들어가도 됩니까?','작업 시작합시다','가꾸목업체','가꾸목이 없으면 들어가지 마세요.']){
  assert.equal(source(s,dictionary),s);
 }
 const other=await route.POST(req('/api/translate',{text:'각목',originalText:'가꾸목',sl:'ko',tl:'km',fast:true}));
 assert.equal(other.status,200);assert.equal(calls.at(-1).text,'각목');
 const buffer=new TranslationSourceBuffer();
 let text=buffer.append('','각목','가꾸목');text=buffer.append(text,'각목','가쿠목');
 assert.equal(buffer.resolve(text),'가꾸목 가쿠목');
 assert.equal(buffer.resolve('수정된 각목'),'수정된 각목');
 buffer.clear();assert.equal(buffer.resolve('각목'),'각목');
 console.log('PASS: 18 conflicts × 4 languages × 2 API routes (144), display/source separation, suffix/negative/conditional safety, stale evidence, old records, other language, buffer reset. Provider mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
