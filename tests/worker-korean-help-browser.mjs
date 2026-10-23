// Isolated localhost fixtures only. No real accounts, AI calls or broadcasts.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import loadFactory from './helpers/load-typescript.cjs';
const load = loadFactory();
const { koreanHelpText, withKoreanHelp } = load('src/lib/korean-help.ts');
const { workerRegistrationUI } = load('src/lib/worker-registration-ui.ts');
const { workerLoginUI } = load('src/lib/worker-login.ts');
const { tbmTradeSelectorUI, tbmTradeLabel } = load('src/lib/tbm-trade-labels.ts');
const { TBM_TRADES } = load('src/lib/tbm-trades.ts');
const { QR_LANGUAGE_OPTIONS } = load('src/utils/qr/language-options.ts');
const origin = 'http://127.0.0.1:3124';
let role = 'WORKER', language = 'en', applicationStatus = 'NONE';
const actor = () => ({ id:99002, displayName:'TEST WORKER', roles:[role], siteIds:[99001], preferredLanguage:language, workerBirthDate:'991111' });
const fixture = http.createServer((req,res) => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(actor())); });
await new Promise(resolve => fixture.listen(0,'127.0.0.1',resolve));
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3124'],{
  env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,NEXT_TELEMETRY_DISABLED:'1',
    SAFE_LINK_INTERNAL_API_BASE_URL:`http://127.0.0.1:${fixture.address().port}`, SAFE_LINK_PUBLIC_APP_URL:origin},stdio:['ignore','pipe','pipe'],
});
let logs='', browser;
server.stdout.on('data',d=>logs+=d); server.stderr.on('data',d=>logs+=d);
try {
  for(let i=0;i<90&&!logs.includes('Ready in');i++) await new Promise(r=>setTimeout(r,500));
  assert.ok(logs.includes('Ready in'),logs);
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addCookies([{name:'SQ_TEST',value:'local-fixture-only',url:origin}]);
  let signup, upgrade, broadcast;
  await context.route('**/api/**',route=>{
    const url=new URL(route.request().url()), method=route.request().method();
    if(url.pathname==='/api/auth/me') return route.fulfill({json:{user:{id:'99002'},profile:{id:'99002',display_name:'TEST WORKER',role,site_id:'99001',preferred_lang:language},v3:actor()}});
    if(url.pathname==='/api/auth/temporary-worker') { signup=route.request().postDataJSON(); return route.fulfill({status:409,json:{error:'temporary_registration_unavailable'}}); }
    if(url.pathname==='/api/worker-upgrade') {
      if(url.searchParams.get('mode')==='sites') return route.fulfill({json:[{id:99001,name:'Test site',original_name:'테스트 현장'}]});
      if(method==='POST') { upgrade=route.request().postDataJSON(); applicationStatus='APPROVED'; }
      return route.fulfill({json:{status:applicationStatus,birth_date:'991111',display_name:'8019',phone:'01000008019',login_id:'991111'}});
    }
    if(url.pathname==='/api/tbm/broadcast') { broadcast=route.request().postDataJSON(); return route.fulfill({json:{ok:true,tbm:{id:'fixture-tbm'}}}); }
    if(url.pathname==='/api/tbm/daily-trades') return route.fulfill({json:{selected:false,trades:[]}});
    if(url.pathname==='/api/live/sessions') return route.fulfill({json:{active:false}});
    if(url.pathname.endsWith('/events')) return route.fulfill({contentType:'text/event-stream',body:': fixture\n\n'});
    return route.fulfill({json:{tbms:[],has_more:false}});
  });
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  async function go(path,lang) {
    language=lang;
    await context.addCookies([{name:'safe-link-lang',value:lang,url:origin}]);
    if(page.url().startsWith(origin)) await page.evaluate(l=>localStorage.setItem('safe-link-lang',l),lang);
    await page.goto(`${origin}${path}?lang=${lang}`);
  }
  async function noOverflow(label) {
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: horizontal overflow`);
  }
  for(const {lang} of QR_LANGUAGE_OPTIONS) {
    const t=withKoreanHelp(workerRegistrationUI(lang),workerRegistrationUI('ko'),lang);
    const login=withKoreanHelp(workerLoginUI(lang),workerLoginUI('ko'),lang);
    await go('/auth',lang); await page.goto(origin+'/auth?lang='+lang+'&role=worker');
    await page.locator('input[autocomplete=username]').waitFor();
    assert.equal(await page.locator('input[autocomplete=current-password]').getAttribute('aria-label'),login.password);
    await noOverflow('login '+lang);
    await go('/auth/temporary',lang);
    await page.getByRole('heading',{name:t.temporary,exact:true}).waitFor();
    assert.equal(await page.locator('input[name=phone]').evaluate(n=>n.closest('label').textContent),t.phone);
    assert.equal(await page.locator('input[name=birthDate]').evaluate(n=>n.closest('label').textContent),login.birth);
    await noOverflow(`signup ${lang}`);
    if(lang==='zh') {
      await page.locator('input[name=birthDate]').fill('991111'); await page.locator('input[name=phone]').fill('01000008019');
      await page.getByRole('checkbox').check(); await page.getByRole('button',{name:t.doSignup,exact:true}).click();
      await page.locator('main [role=alert]').waitFor();
      assert.equal(signup.language,'zh'); assert.equal(signup.birthDate,'991111'); assert.equal(signup.phone,'01000008019');
      assert.equal(await page.locator('main [role=alert]').textContent(),t.conflict);
      await page.screenshot({path:'/private/tmp/worker-signup-korean-help-zh.png',fullPage:true});
    }
    await go('/worker/upgrade',lang); await page.locator('input[name=iris]').waitFor();
    assert.equal(await page.locator('input[name=iris]').evaluate(n=>n.closest('label').textContent),t.iris);
    assert.equal(await page.locator('input[name=name]').count(),0);
    await noOverflow(`upgrade ${lang}`);
    await go('/worker/tbm/create',lang); const box=page.getByTestId('tbm-trade-selector');
    await box.locator('input[type=checkbox]').last().waitFor();
    assert.deepEqual(await box.locator('label').allTextContents(),[
      koreanHelpText(tbmTradeSelectorUI(lang).all,tbmTradeSelectorUI('ko').all,lang),
      ...TBM_TRADES.map(trade=>koreanHelpText(tbmTradeLabel(trade,lang),tbmTradeLabel(trade,'ko'),lang)),
    ]);
    await noOverflow(`composer ${lang}`);
    console.log(`PASS ${lang}: signup / upgrade / TBM labels, mobile width`);
  }
  await go('/worker/upgrade','en'); await page.locator('input[name=iris]').fill('990001');
  await page.locator('select[name=site]').selectOption('99001'); await page.getByRole('checkbox').check();
  await page.locator('form button[type=submit],form > button').click();
  await page.getByRole('status').waitFor();
  assert.equal(upgrade.siteId,99001); assert.equal(upgrade.irisId,'990001');
  assert.ok(!(await page.locator('main').innerText()).includes('{id}'));
  await page.setViewportSize({width:320,height:844});
  for(const {lang} of QR_LANGUAGE_OPTIONS) {
    await go('/worker',lang); await page.getByTestId('daily-trades').waitFor(); await noOverflow(`home ${lang}`);
    if(lang==='en') await page.screenshot({path:'/private/tmp/worker-home-korean-help-en.png',fullPage:true});
  }
  await go('/auth','en'); await page.goto(origin+'/auth?lang=en&role=worker');
  await page.locator('input[autocomplete=username]').waitFor();
  assert.ok((await page.locator('main').innerText()).includes('생년월일'));
  await go('/worker/tbm/create','en'); await page.locator('textarea').first().fill('Check your safety helmet.');
  await page.screenshot({path:'/private/tmp/worker-tbm-korean-help-en.png',fullPage:true});
  await page.getByRole('button',{name:/PUSH BROADCAST/}).click();
  await page.getByText('Push Successful (전파 완료)',{exact:true}).first().waitFor();
  assert.equal(broadcast.content_ko,'Check your safety helmet.'); assert.deepEqual(broadcast.trade_types,[]);
  await page.setViewportSize({width:320,height:844}); await noOverflow('composer 320');
  role='SITE_ADMIN'; await go('/admin/tbm/create','en');
  await page.getByTestId('tbm-trade-selector').locator('input').last().waitFor();
  assert.equal(await page.getByTestId('tbm-trade-selector').locator('label').first().textContent(),tbmTradeSelectorUI('en').all);
  assert.equal(await page.getByRole('button',{name:'🚀 PUSH BROADCAST',exact:true}).count(),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: signup/upgrade/publish payloads unchanged; Korean not duplicated; admin composer unchanged.');
} finally { await browser?.close(); server.kill('SIGTERM'); fixture.closeAllConnections(); fixture.close(); }
