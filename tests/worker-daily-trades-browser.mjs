// Isolated loopback API/DB fixture + mocked UI states. No production users or TBM broadcasts.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import loadFactory from "./helpers/load-typescript.cjs";
const load = loadFactory();
const { QR_LANGUAGE_OPTIONS } = load("src/utils/qr/language-options.ts");
const { dailyTradeUI } = load("src/lib/worker-daily-trades.ts");
const base = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width:390, height:844 } });
  const login = await context.request.post(base+"/api/auth/worker-quick-login", {
    headers:{origin:base}, data:{name_initials:"LEGACY",phone_last4:"9876",site_id:"99001",preferred_lang:"ko"},
  });
  assert.equal(login.status(),200);
  const me = await (await context.request.get(base+"/api/auth/me")).json();
  assert.equal(String(me.user.id),"99002");
  const url = base+"/api/tbm/daily-trades?siteId=99001";
  const initial = await (await context.request.get(url)).json();
  const saved = await context.request.put(url,{headers:{origin:base},data:{date:initial.date,trades:["로프공","정리"]}});
  assert.equal(saved.status(),200);
  assert.deepEqual((await (await context.request.get(url)).json()).trades,["정리","로프공"]);
  assert.equal((await context.request.get(base+"/api/tbm/daily-trades?siteId=12345")).status(),403);
  assert.equal((await context.request.put(url,{headers:{origin:base},data:{date:initial.date,trades:[]}})).status(),400);
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-20T10:00:00Z"));
  const errors=[]; page.on("pageerror",e=>errors.push(e.message));
  let state={date:"2026-10-20",selected:false,trades:[]}, fail=false;
  const rows=[
    {id:"801",trade_types:["로프공"]}, {id:"802",trade_types:["철근"]}, {id:"803",trade_types:[]},
  ].map(n=>({...n,published_at:"2026-10-20T09:00:00Z"}));
  await page.route("**/api/**",async route=>{
    const u=new URL(route.request().url());
    if(u.pathname==="/api/auth/me") return route.fulfill({json:me});
    if(u.pathname==="/api/tbm/daily-trades"){
      if(fail) return route.fulfill({status:503,json:{error:"fixture"}});
      if(route.request().method()==="PUT"){
        const body=route.request().postDataJSON();
        state={date:state.date,selected:true,trades:body.trades};
      }
      return route.fulfill({json:state});
    }
    if(u.pathname==="/api/tbm/pending"){
      const other=u.searchParams.get("scope")==="other";
      return route.fulfill({json:{tbms:rows.filter(n=>(!n.trade_types.length||n.trade_types.some(t=>state.trades.includes(t)))!==other),has_more:false,next_cursor:null}});
    }
    if(u.pathname==="/api/live/sessions") return route.fulfill({json:{active:true,session:{session_id:"tbm_other",trade_types:["철근"],started_at:"2026-10-20T09:00:00Z"}}});
    if(u.pathname.endsWith("/events"))return route.fulfill({contentType:"text/event-stream",body:": fixture\n\n"});
    return route.fulfill({json:{}});
  });
  await page.goto(base+"/worker?lang=ko");
  await page.getByTestId("daily-trades").getByRole("checkbox",{name:"로프공",exact:true}).check();
  await page.getByRole("button",{name:"선택 완료",exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="tbm-notice"]').length===2);
  assert.deepEqual(await page.getByTestId("tbm-notice").evaluateAll(ns=>ns.map(n=>n.dataset.tbmId)),["801","803"]);
  await page.reload();
  await page.getByRole("button",{name:"오늘 공종 변경",exact:true}).waitFor();
  assert.equal(await page.getByRole("checkbox").count(),0);
  await page.getByRole("button",{name:"다른 공종 TBM 보기",exact:false}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="tbm-notice"]').length===4);
  assert.ok(await page.locator('a[href*="allTrades=1"]').count());
  await page.getByRole("button",{name:"오늘 공종 변경",exact:true}).click();
  await page.getByRole("checkbox",{name:"철근",exact:true}).check();
  await page.getByRole("button",{name:"선택 완료",exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="tbm-notice"]').length===4);
  // Reopen editor: save failure preserves existing server selection; no false success.
  await page.getByRole("button",{name:"오늘 공종 변경",exact:true}).click();
  await page.getByRole("checkbox",{name:"정리",exact:true}).check();
  fail=true; await page.getByRole("button",{name:"선택 완료",exact:true}).click();
  await page.getByRole("alert").waitFor();
  assert.equal(state.trades.includes("정리"),false);
  fail=false;
  state={date:"2026-10-21",selected:false,trades:[]};
  await page.clock.setFixedTime(new Date("2026-10-20T15:00:00Z"));
  await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
  await page.getByRole("checkbox",{name:"로프공",exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="tbm-notice"]').length===0);
  assert.equal(await page.getByRole("checkbox",{name:"로프공",exact:true}).isChecked(),false);
  await page.getByTestId("daily-trades").screenshot({path:"/private/tmp/worker-daily-trades-mobile.png"});
  await page.setViewportSize({width:320,height:844});
  for (const {lang} of QR_LANGUAGE_OPTIONS) {
    await page.evaluate(lang => {
      localStorage.setItem("safe-link-lang",lang);
      document.cookie=`safe-link-lang=${lang}; Path=/`;
      window.dispatchEvent(new Event("safe-link-language-changed"));
    },lang);
    await page.goto(base+"/worker?lang="+lang);
    await page.getByTestId("daily-trades").getByRole("heading",{name:dailyTradeUI(lang).title,exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('[data-testid="daily-trades"] input[type="checkbox"]').length===17);
    assert.equal(await page.getByTestId("daily-trades").evaluate(n=>n.scrollWidth>n.clientWidth+1),false,lang+" overflow");
  }
  assert.deepEqual(errors,[]);
  console.log("PASS: real local save/read/security, first selection, relogin/reload, multi-select/change, other/live filtering, failed save, KST midnight reset, 20 languages at 320px");
} finally {await browser.close();}
