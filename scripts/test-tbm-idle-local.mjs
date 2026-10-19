// Real local API/DB/scheduler + browser. Never connect to production or paid voice services.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import pg from 'pg';
const origin='http://127.0.0.1:3000';
const db=new pg.Client({host:'127.0.0.1',port:55441,database:'worker_login_test',user:'worker_login_test',password:'local-fixture-only'});
await db.connect();
assert.equal((await db.query('select current_database() as name')).rows[0].name,'worker_login_test');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
  const context=await browser.newContext();
  await context.addInitScript(()=>{
    navigator.mediaDevices.getUserMedia=async()=>{
      const audio=new AudioContext();
      return audio.createMediaStreamDestination().stream; // silent microphone; no actual device capture
    };
  });
  const login=await context.request.post(origin+'/api/auth/worker-quick-login',{
    headers:{Origin:origin},data:{name_initials:'LEGACY',phone_last4:'9876',preferred_lang:'ko'},
  });
  assert.equal(login.status(),200,await login.text());
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/worker/tbm/create?lang=ko');
  const start=page.getByRole('button',{name:'TBM 방송 시작',exact:true});
  await start.waitFor({timeout:60000});
  const started=page.waitForResponse(r=>r.url().endsWith('/api/live/sessions')&&r.request().method()==='POST');
  await start.click();
  const result=await started;
  assert.equal(result.status(),200,await result.text());
  const session=result.request().postDataJSON();
  await page.waitForTimeout(2000);
  assert.equal((await (await context.request.get(origin+'/api/live/sessions/status?'+new URLSearchParams({sessionId:session.sessionId}))).json()).active,true);
  // Only this local fixture: advance the activity clock, not production or global system time.
  await db.query("update live_broadcast_sessions set last_activity_at=now()-interval '301 seconds' where session_id=$1 and started_by=99002",[session.sessionId]);
  await page.getByText('방송이 종료되었습니다. 5분간 발화·내용 전송이 없으면 자동 종료됩니다. 작성한 초안은 유지됩니다.',{exact:true}).waitFor({timeout:35000});
  await start.waitFor();
  assert.equal(await start.isEnabled(),true);
  const row=(await db.query('select active,ended_at from live_broadcast_sessions where session_id=$1',[session.sessionId])).rows[0];
  assert.equal(row.active,false); assert.ok(row.ended_at);
  assert.equal(Number((await db.query("select count(*) from audit_logs where resource_id=$1 and action='tbm.live.auto_stop'",[session.sessionId])).rows[0].count),1);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'/private/tmp/tbm-idle-local.png',fullPage:true});
  console.log('PASS: real login → real TBM start with silent microphone → server scheduler expires → browser microphone/state reset → restart enabled; one audit event.');
} finally { await browser.close(); await db.end(); }
