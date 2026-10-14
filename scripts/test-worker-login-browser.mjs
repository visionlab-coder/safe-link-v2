import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin='http://127.0.0.1:3000';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
const errors=[]; page.on('pageerror',error=>errors.push(error.message));
const out=new URL('../outputs/worker-login-qa/',import.meta.url); fs.mkdirSync(out,{recursive:true});
const phone='010'+String(Date.now()).slice(-8), last4=phone.slice(-4);
const birth='90'+String(1+Math.floor(Math.random()*12)).padStart(2,'0')+String(1+Math.floor(Math.random()*28)).padStart(2,'0');
async function post(path,data={}) {
  const response=await context.request.post(origin+path,{headers:{Origin:origin},data});
  return {status:response.status(),body:await response.json().catch(()=>({}))};
}
async function login(data) {
  await page.goto(origin+'/auth?lang=ko&role=worker');
  const input=page.locator('input[autocomplete="username"]');
  await input.waitFor();
  assert.equal(await input.getAttribute('inputmode'),'text');
  assert.equal(await page.locator('input[type="checkbox"]').count(),0);
  await input.fill(data.birth_date || data.name_initials.toLowerCase());
  await page.locator('input[autocomplete="current-password"]').fill(data.phone_last4);
  const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/worker-quick-login')&&r.request().method()==='POST');
  await page.locator('input[autocomplete="current-password"]').press('Enter');
  const r=await response;
  const body=await r.json(); assert.equal(r.status(),200,JSON.stringify(body));
  const submitted=r.request().postDataJSON();
  if(data.birth_date) assert.equal(submitted.birth_date,data.birth_date);
  else {assert.equal(submitted.name_initials,data.name_initials);assert.equal(submitted.birth_date,undefined);}
  await page.waitForURL(url=>/^\/worker(?:\/temporary)?$/.test(url.pathname),{waitUntil:'domcontentloaded'});
  return body;
}
try {
  await page.goto(origin+'/auth/temporary?lang=ko');
  await page.locator('input[name=birthDate]').waitFor();
  for (const lang of ['ko','en','vi','zh','th','uz','ph','km','id','mn','my','ne','bn','kk','ru','jp','fr','es','ar','hi']) {
    await page.evaluate(lang=>{localStorage.setItem('safe-link-lang',lang);window.dispatchEvent(new Event('safe-link-language-changed'));},lang);
    await page.waitForFunction(lang=>document.querySelector('main[lang]')?.getAttribute('lang')===(lang==='jp'?'ja':lang==='ph'?'fil':lang),lang);
    assert.ok(await page.locator('h1').textContent());
    assert.equal(await page.locator('input[name=name]').count(),0);
    assert.equal(await page.locator('input[name=birthDate]').getAttribute('maxlength'),'6');
  }
  await page.evaluate(()=>{localStorage.setItem('safe-link-lang','ko');window.dispatchEvent(new Event('safe-link-language-changed'));});
  assert.equal(await page.locator('input[name=name]').count(),0);
  assert.equal(await page.locator('input[name=birthDate]').getAttribute('maxlength'),'6');
  await page.locator('input[name=birthDate]').fill(birth);
  await page.locator('input[name=phone]').fill(phone);
  await page.locator('input[type=checkbox]').check();
  await page.screenshot({path:new URL('01-signup.png',out).pathname,fullPage:true});
  const registration=page.waitForResponse(r=>r.url().endsWith('/api/auth/temporary-worker')&&r.request().method()==='POST');
  await page.locator('form button[type=submit],form button').last().click();
  assert.equal((await registration).status(),200);
  await page.waitForURL(url=>url.pathname==='/worker/temporary',{waitUntil:'domcontentloaded'});
  const initial=await (await context.request.get(origin+'/api/auth/me')).json();
  assert.equal(initial.profile.role,'TEMP_WORKER');
  assert.equal(initial.profile.display_name,last4);
  assert.equal((await context.request.get('http://127.0.0.1:18084/api/v1/tbm/notices')).status(),403);
  await post('/api/auth/logout'); await context.clearCookies();
  const before=await login({birth_date:birth,phone_last4:last4,preferred_lang:'en'});
  assert.ok(before.roles.includes('TEMP_WORKER'));
  // Exact same authenticated browser cookie is used by the actual upgrade UI.
  await page.evaluate(()=>{localStorage.setItem('safe-link-lang','en');});
  await page.goto(origin+'/worker/upgrade?lang=en');
  await page.locator('select[name=site] option[value="99002"]').waitFor({state:'attached'});
  assert.match(await page.locator('option[value="99002"]').textContent(),/Test regular-worker site/);
  await page.screenshot({path:new URL('02-upgrade-en.png',out).pathname,fullPage:true});
  await page.evaluate(()=>{localStorage.setItem('safe-link-lang','vi'); window.dispatchEvent(new Event('safe-link-language-changed'));});
  await page.waitForFunction(()=>document.querySelector('option[value="99002"]')?.textContent.includes('Công trường'));
  await page.screenshot({path:new URL('03-upgrade-vi.png',out).pathname,fullPage:true});
  await page.locator('select[name=site]').selectOption('99002');
  await page.locator('input[name=iris]').fill(String(Date.now()));
  await page.locator('input[type=checkbox]').check();
  const conversion=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/worker-upgrade'&&r.request().method()==='POST');
  await page.locator('form button').click();
  const converted=await conversion; assert.equal(converted.status(),200); assert.equal((await converted.json()).status,'APPROVED');
  await page.locator('a[href="/worker"]').waitFor();
  await page.screenshot({path:new URL('04-complete.png',out).pathname,fullPage:true});
  await post('/api/auth/logout'); await context.clearCookies();
  const after=await login({birth_date:birth,phone_last4:last4,preferred_lang:'en'});
  assert.ok(after.roles.includes('WORKER')); assert.ok(!after.roles.includes('TEMP_WORKER'));
  assert.ok(before.id); assert.equal(after.id,before.id); assert.deepEqual(after.siteIds,[99002]);
  await post('/api/auth/logout'); await context.clearCookies();
  const legacy=await login({name_initials:'LEGACY',phone_last4:'9876',preferred_lang:'ko'});
  assert.ok(legacy.roles.includes('WORKER'));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: 20-language signup UI → real signup → TEMP access denied → logout → DOB login → EN/VI site labels → immediate conversion → same user ID/login → legacy login.');
} catch(error) {
  console.log('Failure URL:',page.url());
  console.log('Browser errors:',errors);
  await page.screenshot({path:new URL('failure.png',out).pathname,fullPage:true}).catch(()=>{});
  throw error;
} finally { await browser.close(); }
