import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load=createRequire(import.meta.url)('../tests/helpers/load-typescript.cjs')();
const {setupUI}=load('src/lib/profile-setup-ui.ts');
const {englishNameUI}=load('src/lib/english-name.ts');
const base=process.env.SETUP_TEST_ORIGIN || 'http://127.0.0.1:3117';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
  for(const lang of ['ko','en','vi','zh','th','uz','ph','km','id','mn','my','ne','bn','kk','ru','jp','fr','es','ar','hi']) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    let saved, fail=false, emptySites=false;
    await page.route('**/api/**',route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/api/auth/me') return route.fulfill({json:{v3:{id:99099,displayName:'5678',roles:['WORKER'],siteIds:[2,3],workerBirthDate:'010203',profileDetails:{activeSiteId:saved?3:2,siteCode:saved?'SITE B':'SITE A'}}}});
      if(path==='/api/sites/options') return route.fulfill({json:{sites:emptySites?[]:[{id:'2',name:'SITE A'},{id:'3',name:'SITE B'}]}});
      if(path==='/api/auth/setup-profile') {
        saved=route.request().postDataJSON();
        return route.fulfill({status:fail?403:200,json:fail?{error:'cross_site_access_denied'}:{id:99099,roles:['WORKER'],siteIds:[2,3],displayName:'5678',workerBirthDate:'010203'}});
      }
      return route.fulfill({json:{}});
    });
    // Intercept only the post-save destination so middleware cannot contact any backend.
    await page.route('**/worker?*',route=>route.fulfill({contentType:'text/html',body:'<main>Saved</main>'}));
    await page.addInitScript(language=>localStorage.setItem('safe-link-lang',language),lang);
    await page.goto(`${base}/auth/setup?role=worker`);
    const birth=page.locator('#worker-birth-login');
    await birth.waitFor();
    assert.equal(await birth.inputValue(),'010203');
    assert.equal(await birth.getAttribute('readonly'),'');
    assert.equal(await page.locator('main input[type=checkbox]').count(),0);
    assert.equal(await page.locator('input[name=name]').count(),0);
    const t=setupUI(lang);
    await page.getByRole('button',{name:t.next,exact:true}).click();
    await birth.waitFor({state:'detached'});
    await page.locator('main select').selectOption('3');
    // No name confirmation, phone or trade input required for a site-only update.
    await page.getByRole('button',{name:t.next,exact:true}).click();
    await page.locator('main select').waitFor({state:'detached'});
    fail=true;
    const dialogPromise=page.waitForEvent('dialog');
    await page.getByRole('button',{name:t.save,exact:true}).click();
    const dialog=await dialogPromise; assert.equal(dialog.message(),t.saveFailed); await dialog.dismiss();
    assert.equal(saved.display_name,'5678'); assert.equal(saved.site_id,'3'); assert.equal(saved.site_code,'SITE B');
    assert.equal(saved.birth_date,undefined); assert.equal(saved.workerBirthDate,undefined);
    fail=false;
    await page.getByRole('button',{name:t.save,exact:true}).click();
    await page.waitForURL('**/worker?*',{timeout:10000});
    await page.goto(`${base}/auth/setup?role=worker`);
    await birth.waitFor();
    assert.equal(await birth.inputValue(),'010203');
    await page.getByRole('button',{name:t.next,exact:true}).click();
    await birth.waitFor({state:'detached'});
    await page.locator('main select:has(option[value="3"])').waitFor();
    assert.equal(await page.locator('main select').inputValue(),'3');
    emptySites=true;
    await page.reload(); await birth.waitFor();
    await page.getByRole('button',{name:t.next,exact:true}).click();
    await birth.waitFor({state:'detached'});
    await page.locator('main select').waitFor();
    assert.equal(await page.getByRole('button',{name:t.next,exact:true}).isDisabled(),true);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${lang}: read-only birth ID, no confirmation, site-only save, rejection, success, reload, no-site guard`);
    await context.close();
  }
  for(const name of ['KIM','5678']) {
    const page=await browser.newPage();
    await page.route('**/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/auth/me'?{v3:{id:99099,displayName:name,roles:['WORKER'],siteIds:[2],workerBirthDate:null}}:{sites:[]}}));
    await page.goto(`${base}/auth/setup?lang=ko&role=worker`);
    await page.locator('input[name=name]').waitFor();
    assert.equal(await page.locator('#worker-birth-login').count(),0);
    assert.equal(await page.getByRole('button',{name:setupUI('ko').next,exact:true}).isDisabled(),true);
    const checkbox=page.getByRole('checkbox',{name:englishNameUI('ko').confirm});
    if(name==='KIM') { await checkbox.check(); assert.equal(await page.getByRole('button',{name:setupUI('ko').next,exact:true}).isEnabled(),true); }
    else assert.equal(await checkbox.isDisabled(),true,'numeric name alone must not identify a birth-login account');
    await page.close();
  }
  console.log('PASS: legacy English confirmation unchanged; no display-name inference');
} finally { await browser.close(); }
