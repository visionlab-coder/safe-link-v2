// Local mock API only: no real accounts, broadcasts, AI calls or production data.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import loadFactory from "./helpers/load-typescript.cjs";
const load=loadFactory();
const {TBM_TRADES}=load("src/lib/tbm-trades.ts");
const {tbmTradeSelectorUI,tbmTradeLabel}=load("src/lib/tbm-trade-labels.ts");
const {QR_LANGUAGE_OPTIONS}=load("src/utils/qr/language-options.ts");
const origin="http://127.0.0.1:3117";
let role="WORKER";
const actor=()=>({id:99002,displayName:"LOCAL TEST",roles:[role],siteIds:[99001],preferredLanguage:"en"});
const fixture=http.createServer((req,res)=>{res.setHeader("Content-Type","application/json");res.end(JSON.stringify(actor()));});
await new Promise(resolve=>fixture.listen(0,"127.0.0.1",resolve));
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port","3117"],{
  env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,NEXT_TELEMETRY_DISABLED:"1",
    SAFE_LINK_INTERNAL_API_BASE_URL:`http://127.0.0.1:${fixture.address().port}`,SAFE_LINK_PUBLIC_APP_URL:origin},
  stdio:["ignore","pipe","pipe"],
});
let logs=""; server.stdout.on("data",d=>logs+=d);server.stderr.on("data",d=>logs+=d);
let browser;
try{
  for(let i=0;i<60&&!logs.includes("Ready in");i++)await new Promise(r=>setTimeout(r,500));
  assert.ok(logs.includes("Ready in"),logs);
  browser=await chromium.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addCookies([{name:"SQ_TEST",value:"local-only",url:origin}]);
  let selected=[], saved=[];
  const date=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul"}).format(new Date());
  await context.route("**/api/**",async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==="/api/auth/me")return route.fulfill({json:{user:{id:"99002"},profile:{role,site_id:"99001",preferred_lang:"en"},v3:actor()}});
    if(url.pathname==="/api/tbm/daily-trades"){
      if(route.request().method()==="PUT"){saved=route.request().postDataJSON().trades;selected=saved;}
      return route.fulfill({json:{date:date(),selected:selected.length>0,trades:selected}});
    }
    if(url.pathname==="/api/tbm/broadcast"){
      saved=route.request().postDataJSON().trade_types;
      return route.fulfill({json:{ok:true,tbm:{id:"local-1"}}});
    }
    if(url.pathname==="/api/live/sessions")return route.fulfill({json:{active:false}});
    if(url.pathname.endsWith("/events"))return route.fulfill({contentType:"text/event-stream",body:": fixture\n\n"});
    return route.fulfill({json:{tbms:[],has_more:false}});
  });
  const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
  async function language(lang){
    await context.addCookies([{name:"safe-link-lang",value:lang,url:origin}]);
    if(page.url().startsWith(origin))await page.evaluate(l=>localStorage.setItem("safe-link-lang",l),lang);
  }
  async function verify(selector,lang){
    const box=page.getByTestId(selector);
    await box.locator('input[type="checkbox"]').last().waitFor();
    assert.deepEqual(await box.locator("label").allTextContents(),[tbmTradeSelectorUI(lang).all,...TBM_TRADES.map(t=>tbmTradeLabel(t,lang))]);
    const all=box.getByRole("checkbox").first();
    if(selector==="tbm-trade-selector") {
      await all.check(); assert.equal(await box.locator('input:checked').count(),1);
      await box.getByRole("checkbox").nth(2).check();
      assert.equal(await all.isChecked(),false);
      await box.getByRole("checkbox").nth(3).check();
      assert.equal(await box.locator('input:checked').count(),2);
      await all.check();assert.equal(await box.locator('input:checked').count(),1);
      assert.equal(await box.evaluate(n=>n.scrollWidth>n.clientWidth+1),false,lang+" overflow");
      return;
    }
    await all.check();assert.equal(await box.locator('input:checked').count(),17);
    await box.getByRole("checkbox").nth(2).uncheck();
    assert.equal(await all.evaluate(n=>n.indeterminate),true);
    assert.equal(await box.locator('input:checked').count(),15);
    await all.click();assert.equal(await box.locator('input:checked').count(),17);
    await all.uncheck();assert.equal(await box.locator('input:checked').count(),0);
    assert.equal(await box.evaluate(n=>n.scrollWidth>n.clientWidth+1),false,lang+" overflow");
  }
  await page.goto(origin+"/worker?lang=en");
  await verify("daily-trades","en");
  await page.getByTestId("daily-trades").getByRole("checkbox").first().check();
  await page.getByTestId("daily-trades").getByRole("button",{name:"Save selection",exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="daily-trades"] input').length===0);
  assert.deepEqual(saved,TBM_TRADES);
  await page.setViewportSize({width:320,height:844});
  for(const {lang} of QR_LANGUAGE_OPTIONS){
    await language(lang);await page.goto(origin+"/worker/tbm/create?lang="+lang);
    await verify("tbm-trade-selector",lang);
    const box=page.getByTestId("tbm-trade-selector");
    assert.ok((await box.innerText()).includes(tbmTradeSelectorUI(lang).hint));
  }
  await language("en");await page.goto(origin+"/worker/tbm/create?lang=en");
  await page.getByTestId("tbm-trade-selector").getByRole("checkbox").first().check();
  await page.locator("textarea").first().fill("Check your safety helmet.");
  await page.getByRole("button",{name:"🚀 PUSH BROADCAST",exact:true}).click();
  await page.getByText("Push Successful",{exact:true}).first().waitFor();
  assert.deepEqual(saved,[]);assert.ok(!saved.includes("all"));
  role="SITE_ADMIN";await page.goto(origin+"/admin/tbm/create?lang=en");
  await verify("tbm-trade-selector","en");
  await page.setViewportSize({width:1280,height:900});
  await page.getByTestId("tbm-trade-selector").screenshot({path:"/private/tmp/tbm-trade-selector-en.png"});
  assert.deepEqual(errors,[]);
  console.log("PASS: daily/composer select all, partial state, deselect, canonical save/publish payloads; 20 languages at 320px; worker/admin shared composer.");
}finally{await browser?.close();server.kill("SIGTERM");fixture.close();}
