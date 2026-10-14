import { chromium } from 'playwright-core';
import pg from 'pg';
import assert from 'node:assert/strict';
const db=new pg.Client({host:'127.0.0.1',port:55441,database:'worker_login_test',user:'worker_login_test',password:'local-fixture-only'});
await db.connect();
const {rows}=await db.query('select birth_date,phone_last4 from worker_quick_login_credentials where birth_date is not null order by user_id desc limit 1');
await db.end(); assert.ok(rows.length);
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
  for(const test of [{id:'legacy',password:'9876',key:'name_initials'}, {id:rows[0].birth_date,password:rows[0].phone_last4,key:'birth_date'}]) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:3000/auth?lang=ko&role=worker');
    const input=page.locator('input[autocomplete=username]');
    await input.waitFor();
    assert.equal(await input.getAttribute('inputmode'),'text');
    assert.equal(await page.locator('input[type=checkbox]').count(),0);
    await input.fill(test.id);
    assert.equal(await input.inputValue(),test.id.toUpperCase());
    const password=page.locator('input[autocomplete=current-password]');
    await password.fill(test.password);
    await page.screenshot({path:`outputs/worker-login-qa/login-${test.key}.png`,fullPage:true});
    const pending=page.waitForResponse(r=>r.url().endsWith('/api/auth/worker-quick-login')&&r.request().method()==='POST');
    await password.press('Enter');
    const response=await pending;
    assert.equal(response.request().postDataJSON()[test.key],test.id.toUpperCase());
    assert.equal(response.status(),200,JSON.stringify(await response.json()));
    const me=await context.request.get('http://127.0.0.1:3000/api/auth/me'); assert.equal(me.status(),200);
    await page.waitForURL(url=>/^\/worker(?:\/temporary)?$/.test(url.pathname),{waitUntil:'domcontentloaded'});
    console.log(`PASS ${test.key}: same input, correct API payload, authenticated session, worker navigation`);
    await context.close();
  }
} finally { await browser.close(); }
