// Isolated local DB + real authenticated API/browser. No production or paid AI calls.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import pg from 'pg';
const origin='http://127.0.0.1:3000';
const db=new pg.Client({host:'127.0.0.1',port:55441,database:'worker_login_test',user:'worker_login_test',password:'local-fixture-only'});
await db.connect();
assert.equal((await db.query('select current_database() as name')).rows[0].name,'worker_login_test');
const tag=Date.now();
const session=`tbm_pending_regression_${tag}`;
const noticeIds=[];
async function publish(text,age='0 seconds') {
  const result=await db.query(`insert into tbm_notices(site_id,created_by,title,source_text,normalized_text,status,published_at,created_at)
    values(99001,99001,$1,$1,$1,'PUBLISHED',now()-$2::interval,now()-$2::interval) returning id`,[text,age]);
  noticeIds.push(result.rows[0].id); return String(result.rows[0].id);
}
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
  await publish(`이전 일반 안내 ${tag}`,'2 minutes');
  await db.query(`insert into live_broadcast_sessions(session_id,site_id,started_by,started_at,ended_at,active)
    values($1,99001,99001,now()-interval '1 minute',now()-interval '30 seconds',false)`,[session]);
  await db.query('insert into tbm_live_participation(session_id,worker_id,site_id) values($1,99002,99001)',[session]);
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const login=await context.request.post(origin+'/api/auth/worker-quick-login',{
    headers:{Origin:origin},data:{name_initials:'LEGACY',phone_last4:'9876',preferred_lang:'ko'},
  });
  assert.equal(login.status(),200,await login.text());
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/worker/tbm/today?lang=ko');
  await page.getByTestId('tbm-live-state').waitFor({timeout:60000});
  const firstText=`텍스트 전파 첫 번째 보호구 확인 ${tag}`;
  const first=await publish(firstText);
  await page.getByText(firstText,{exact:true}).first().waitFor({timeout:30000});
  assert.equal(await page.getByTestId('tbm-live-state').count(),0);
  await page.getByText('🔒 먼저 브리핑 음성을 끝까지 들어주세요.',{exact:true}).waitFor();
  assert.equal((await (await context.request.get(origin+`/api/live/tbm-participation?siteId=99001&tbmId=${first}`)).json()).attended,false);
  const secondText=`텍스트 전파 두 번째 통로 정리 ${tag}`;
  await publish(secondText);
  await page.getByText(secondText,{exact:true}).first().waitFor({timeout:20000});
  await page.reload();
  await page.getByText(secondText,{exact:true}).first().waitFor({timeout:30000});
  assert.equal(await page.getByTestId('tbm-live-state').count(),0);
  await page.getByText('🔒 먼저 브리핑 음성을 끝까지 들어주세요.',{exact:true}).waitFor();
  await page.screenshot({path:'/private/tmp/tbm-ordinary-pending-fixed.png',fullPage:true});
  await db.query('update live_broadcast_sessions set active=true,ended_at=null,last_activity_at=now() where session_id=$1',[session]);
  await page.reload();
  await page.getByTestId('tbm-live-badge').waitFor();
  await publish(`라이브 중 일반 전파 ${tag}`);
  await page.waitForTimeout(6000); // ordinary notification must not interrupt active live
  assert.equal(await page.getByTestId('tbm-live-badge').count(),1);
  await db.query('begin');
  await db.query('update live_broadcast_sessions set active=false,ended_at=now() where session_id=$1',[session]);
  const finalId=await publish(`라이브 최종 원문 ${tag}`);
  await db.query('update tbm_notices set summary_text=$1 where id=$2',['- 보호구 확인',finalId]);
  await db.query(`insert into live_tbm_summaries(session_id,site_id,created_by,source_transcript,summary_text,model,tbm_notice_id)
    values($1,99001,99001,'라이브 최종 원문','- 보호구 확인','local-fixture',$2)`,[session,finalId]);
  await db.query('commit');
  const review=page.getByRole('checkbox',{name:'TBM 요약 확인 및 서명'});
  await review.waitFor({timeout:20000});
  await review.check();
  const sign=page.getByRole('button',{name:/서명 완료하기/});
  assert.equal(await sign.isEnabled(),true); // Do not submit a signature.
  await page.waitForTimeout(6000); // same-notice notification must not clear the handoff
  assert.equal(await sign.isEnabled(),true);
  const afterLive=`라이브 이후 일반 전파 ${tag}`;
  await publish(afterLive);
  await page.getByText(afterLive,{exact:true}).first().waitFor({timeout:20000});
  await page.getByText('🔒 먼저 브리핑 음성을 끝까지 들어주세요.',{exact:true}).waitFor();
  assert.equal(await page.getByTestId('tbm-live-state').count(),0);
  assert.equal(Number((await db.query('select count(*) from tbm_live_participation where session_id=$1',[session])).rows[0].count),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: pending → ordinary publication; consecutive notices; reload; active live preserved; final summary review unlocks signing without replay; duplicate notification safe; next ordinary notice requires listening; attendance retained.');
} finally {
  await browser.close();
  await db.query('rollback');
  // Remove only fixtures generated by this run, not other local test records.
  await db.query('delete from live_tbm_summaries where session_id=$1',[session]);
  await db.query('delete from tbm_live_participation where session_id=$1',[session]);
  await db.query('delete from live_broadcast_sessions where session_id=$1',[session]);
  await db.query('delete from tbm_notices where id=any($1::bigint[])',[noticeIds]);
  await db.end();
}
