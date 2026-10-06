// Dedicated loopback sandbox only: real BFF/backend/Postgres/SSE; no paid speech APIs.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const base='http://127.0.0.1:3100';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
let hq, sessionId;
async function login(email) {
  const context=await browser.newContext({viewport:{width:1280,height:1000}});
  const response=await context.request.post('http://127.0.0.1:18081/api/v1/auth/login',{data:{email,password:'LocalTbmTest!2026'}});
  assert.equal(response.status(),200);
  return context;
}
async function call(context,path,data,status=200) {
  const response=data===undefined ? await context.request.get(base+path) : await context.request.post(base+path,{data});
  const body=await response.json(); assert.equal(response.status(),status,JSON.stringify(body)); return body;
}
try {
  hq=await login('nationwide-hq@example.invalid');
  const me=await call(hq,'/api/auth/me');
  assert.deepEqual(me.v3.siteIds,[]); assert.ok(me.v3.roles.includes('HQ_ADMIN'));
  const targets=await call(hq,'/api/tbm/nationwide/targets'); assert.ok(targets.targetCount>=3);
  const adminPage=await hq.newPage(); const errors=[];
  adminPage.on('pageerror',e=>errors.push(e.message));
  await adminPage.goto(base+'/admin/tbm/create?lang=ko');
  await adminPage.getByText('TBM 전파 대상',{exact:true}).waitFor();
  const confirmation=adminPage.getByRole('checkbox',{name:'전국 모든 활성 현장에 방송·전파하는 것을 확인했습니다.'});
  const record=adminPage.getByRole('button',{name:/TBM 방송 시작/});
  await record.waitFor(); assert.equal(await record.isDisabled(),true);
  await confirmation.check();
  await adminPage.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('TBM 방송 시작')&&!b.disabled));
  assert.equal(await record.isEnabled(),true,'HQ without a site can start after confirming');
  await adminPage.setViewportSize({width:390,height:844});
  assert.equal(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await adminPage.screenshot({path:'/tmp/tbm-nationwide-admin-mobile.png',fullPage:true});
  const a=await login('nationwide-worker-a@example.invalid'), b=await login('nationwide-worker-b@example.invalid');
  const aId=(await call(a,'/api/auth/me')).v3.siteIds[0], bId=(await call(b,'/api/auth/me')).v3.siteIds[0];
  assert.notEqual(aId,bId);
  await call(a,'/api/tbm/nationwide/targets',undefined,403);
  const manager=await login('enrollment-manager@example.invalid');
  await call(manager,'/api/tbm/nationwide/targets',undefined,403);
  const workerPage=await a.newPage();
  await workerPage.goto(base+'/worker/tbm/today?lang=ko');
  await workerPage.evaluate(site => {
    window.tbmTestEvents=[];
    window.tbmTestStream=new EventSource('/api/live/events?type=translations&siteId='+site);
    for (const name of ['connected','broadcast-start','translation','tbm-draft','broadcast-stop','tbm-summary'])
      window.tbmTestStream.addEventListener(name,e=>window.tbmTestEvents.push({name,data:JSON.parse(e.data)}));
  },aId);
  await workerPage.waitForFunction(()=>window.tbmTestEvents.some(e=>e.name==='connected'));
  sessionId='tbm_browser_'+Date.now();
  await call(hq,'/api/tbm/nationwide/sessions',{sessionId,confirmed:true});
  await workerPage.waitForFunction(()=>window.tbmTestEvents.some(e=>e.name==='broadcast-start'));
  const aLive=await call(a,'/api/live/sessions?siteId='+aId), bLive=await call(b,'/api/live/sessions?siteId='+bId);
  assert.equal(aLive.session.session_id,sessionId+'_s'+aId); assert.equal(bLive.session.session_id,sessionId+'_s'+bId);
  await call(a,'/api/live/sessions?siteId='+bId,undefined,403);
  await call(a,'/api/live/tbm-participation',{sessionId:aLive.session.session_id,siteId:aId});
  await call(hq,'/api/tbm/nationwide/translations',{sessionId,text_ko:'안전대를 확인하세요.'});
  await workerPage.waitForFunction(()=>window.tbmTestEvents.some(e=>e.name==='translation'));
  await call(hq,'/api/tbm/nationwide/draft',{sessionId,content:'안전대와 작업발판을 확인하세요.'});
  await workerPage.waitForFunction(()=>window.tbmTestEvents.some(e=>e.name==='tbm-draft'));
  await call(hq,'/api/tbm/nationwide/stop',{sessionId});
  await call(hq,'/api/tbm/nationwide/summary',{sessionId,content_ko:'안전대와 작업발판을 확인하세요.',summary_ko:'- 안전대 확인\n- 작업발판 확인'});
  await workerPage.waitForFunction(()=>window.tbmTestEvents.some(e=>e.name==='tbm-summary'));
  const events=await workerPage.evaluate(()=>window.tbmTestEvents);
  const result=events.find(e=>e.name==='tbm-summary').data;
  assert.equal(result.sessionId,aLive.session.session_id);
  const peers=await call(a,'/api/worker/chat/admins');
  assert.ok(peers.admins.some(admin=>admin.id===me.user.id));
  await call(a,'/api/chat/messages?peer_id='+me.user.id);
  const attended=await call(a,`/api/live/tbm-participation?siteId=${aId}&tbmId=${result.tbmId}`); assert.equal(attended.attended,true);
  const bSummary=await call(b,`/api/live/summary?siteId=${bId}&sessionId=${encodeURIComponent(bLive.session.session_id)}`);
  assert.notEqual(bSummary.summary.tbmId,result.tbmId);
  const late=await call(b,`/api/live/tbm-participation?siteId=${bId}&tbmId=${bSummary.summary.tbmId}`); assert.equal(late.attended,false);
  await workerPage.getByRole('checkbox').waitFor({timeout:30000});
  assert.equal(workerPage.url(),base+'/worker/tbm/today?lang=ko');
  await workerPage.screenshot({path:'/tmp/tbm-nationwide-worker-summary.png',fullPage:true});
  assert.deepEqual(errors,[]);
  // Ordinary nationwide publication and retry produce the same notice, without live participation.
  await adminPage.locator('textarea').first().fill('로컬 전국 전파 검증: 보호구 확인');
  const sent=adminPage.waitForResponse(response=>response.url().endsWith('/api/tbm/nationwide/broadcast')&&response.request().method()==='POST');
  await adminPage.getByRole('button',{name:/TBM 브로드캐스트/}).click();
  const sentResponse=await sent; assert.equal(sentResponse.status(),200);
  const ordinary=sentResponse.request().postDataJSON();
  const published=await sentResponse.json();
  assert.equal(published.targetCount,targets.targetCount);
  assert.deepEqual(await call(hq,'/api/tbm/nationwide/broadcast',ordinary),published);
  console.log('PASS: HQ with no membership → national confirmation UI → per-site real SSE/live/draft/summary; attendee/late split, role/site isolation, ordinary publication and idempotent retry. No real audio/provider/signature-storage test.');
} finally {
  if(hq&&sessionId) await hq.request.post(base+'/api/tbm/nationwide/stop',{data:{sessionId}}).catch(()=>{});
  await browser.close();
}
