// Local disposable fixture DB only. No production accounts, signatures or paid AI.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import pg from 'pg';
const origin='http://127.0.0.1:3000';
const db=new pg.Client({host:'127.0.0.1',port:55441,database:'worker_login_test',user:'worker_login_test',password:'local-fixture-only'});
await db.connect();
assert.equal((await db.query('select current_database() as name')).rows[0].name,'worker_login_test');
const tag=Date.now();
const session=`tbm_trades_qa_${tag}`;
const noticeIds=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const login=await context.request.post(origin+'/api/auth/worker-quick-login',{
    headers:{Origin:origin},data:{name_initials:'LEGACY',phone_last4:'9876',preferred_lang:'ko'},
  });
  assert.equal(login.status(),200,await login.text());
  async function post(path,data) {
    const response=await context.request.post(origin+path,{headers:{Origin:origin},data});
    assert.equal(response.status(),200,await response.text());
    return response.json();
  }
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/worker/tbm/create?lang=ko');
  const selector=page.getByTestId('tbm-trade-selector');
  await selector.waitFor({timeout:60000});
  assert.equal(await selector.getByRole('checkbox').count(),16);
  await selector.getByRole('checkbox',{name:'철근',exact:true}).check();
  await selector.getByRole('checkbox',{name:'거푸집',exact:true}).check();
  await selector.getByRole('checkbox',{name:'정리',exact:true}).check();
  await selector.getByRole('checkbox',{name:'정리',exact:true}).uncheck();
  await selector.screenshot({path:'/private/tmp/tbm-trade-selection.png'});
  await page.getByPlaceholder('오늘의 안전 수칙을 입력하세요...').fill(`공종 테스트 원문 ${tag}`);
  const sent=page.waitForResponse(r=>r.url().endsWith('/api/tbm/broadcast')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'📡 TBM 브로드캐스트',exact:true}).click();
  const response=await sent;
  assert.equal(response.status(),200,await response.text());
  assert.deepEqual(response.request().postDataJSON().trade_types,['철근','거푸집']);
  const ordinary=(await response.json()).tbm;
  noticeIds.push(ordinary.id);
  assert.deepEqual(ordinary.trade_types,['철근','거푸집']);
  await page.getByTestId('tbm-trade-badges').filter({hasText:'철근'}).first().waitFor();
  const receiver=await context.newPage();
  receiver.on('pageerror',e=>errors.push(e.message));
  await receiver.goto(origin+'/worker/tbm/today?lang=ko');
  await receiver.getByTestId('tbm-trade-badges').filter({hasText:'거푸집'}).waitFor();
  assert.equal(await receiver.getByTestId('tbm-live-state').count(),0);
  const live=await post('/api/live/sessions',{sessionId:session,siteId:'99001',trade_types:['해체','정리']});
  assert.deepEqual(live.trade_types,['해체','정리']);
  await receiver.getByTestId('tbm-live-state').waitFor({timeout:15000});
  const liveBadges=receiver.getByTestId('tbm-trade-badges');
  await liveBadges.filter({hasText:'해체'}).waitFor();
  assert.equal(await liveBadges.getByText('철근',{exact:true}).count(),0);
  await receiver.screenshot({path:'/private/tmp/tbm-trade-live.png',fullPage:true});
  const stop=await context.request.delete(origin+`/api/live/sessions?sessionId=${session}&siteId=99001`,{headers:{Origin:origin}});
  assert.equal(stop.status(),200,await stop.text());
  const finished=await post('/api/live/summary',{sessionId:session,siteId:99001,content_ko:`라이브 원문 ${tag}`,summary_ko:'- 정리 확인'});
  noticeIds.push(finished.tbmId);
  const persisted=(await db.query('select trade_types from tbm_notices where id=$1',[finished.tbmId])).rows[0];
  assert.deepEqual(persisted.trade_types,['해체','정리']);
  await receiver.getByTestId('tbm-trade-badges').filter({hasText:'해체'}).waitFor();
  await receiver.getByRole('checkbox',{name:'TBM 요약 확인 및 서명'}).waitFor({timeout:20000});
  await receiver.screenshot({path:'/private/tmp/tbm-trade-final.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: 16 checkboxes, multi-selection/deselection, ordinary publish request + DB + history + receiver, live metadata + final summary, no page errors.');
} finally {
  // Exact IDs created by this test only; no preexisting records are removed.
  await db.query('delete from live_tbm_summaries where session_id=$1',[session]);
  await db.query('delete from tbm_live_participation where session_id=$1',[session]);
  await db.query('delete from live_broadcast_sessions where session_id=$1',[session]);
  await db.query('delete from tbm_notices where id=any($1::bigint[])',[noticeIds]);
  await db.end();
  console.log('Local test fixtures cleaned.');
  await browser.close();
}
