// Run from a built, env-free release snapshot. Fixture auth only; no production writes.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import XLSX from 'xlsx';

const origin='http://127.0.0.1:3114';
const fixture=http.createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({id:10,displayName:'TEST ADMIN',roles:['ROOT'],siteIds:[2],preferredLanguage:'ko'}));
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
const api=`http://127.0.0.1:${fixture.address().port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3114'],{
  cwd:process.cwd(),env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'production',SAFE_LINK_INTERNAL_API_BASE_URL:api,
    SAFE_LINK_PUBLIC_APP_URL:origin,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],
});
let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
let browser;
try {
  for(let i=0;i<60&&!logs.includes('Ready in');i++)await new Promise(resolve=>setTimeout(resolve,500));
  assert.ok(logs.includes('Ready in'),logs);
  browser=await chromium.launch({executablePath:process.env.SQ_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  await context.addCookies([{name:'SQ_TEST',value:'fixture-only',url:origin}]);
  const terms=[{id:1,slang:'겐바',standard:'현장',category:'작업',is_active:true},
    {id:2,slang:'오함마',standard:'대형 망치',category:'도구',is_active:true},
    {id:3,slang:'폼',standard:'FORM',category:'구조',is_active:false}];
  let glossaryReads=0;
  await context.route('**/api/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/auth/me')return route.fulfill({json:{user:{id:'10'},profile:{role:'ROOT',preferred_lang:'ko',site_id:'2'},v3:{id:10,roles:['ROOT'],siteIds:[2]}}});
    if(url.pathname==='/api/glossary'){glossaryReads++;return route.fulfill({json:{terms}});}
    return route.fulfill({json:{}});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/admin/glossary?lang=ko');
  const input=page.getByRole('searchbox');const list=page.getByTestId('glossary-term-list');
  await list.getByText('겐바',{exact:true}).waitFor();
  const visible=async text=>list.getByText(text,{exact:true}).isVisible();
  for(const [query,expected] of [['겐바','겐바'],['현장','겐바'],['망치','오함마'],['fOrm','폼'],['도구','오함마']]){
    await input.fill(query);await new Promise(resolve=>setTimeout(resolve,300));
    assert.equal(await visible(expected),true);
    for(const term of terms.filter(t=>t.slang!==expected))await list.getByText(term.slang,{exact:true}).waitFor({state:'hidden'});
  }
  await input.fill('존재하지않는단어');await list.getByText('검색 결과가 없습니다.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'검색어 지우기',exact:true}).click();
  await list.getByText('겐바',{exact:true}).waitFor();
  assert.equal(await visible('오함마'),true);
  await input.fill('현장');await list.getByText('오함마',{exact:true}).waitFor({state:'hidden'});
  await input.scrollIntoViewIfNeeded();
  await input.evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:'/private/tmp/glossary-search-mobile.png'});
  await page.getByRole('button',{name:'내보내기',exact:true}).click();
  const downloaded=page.waitForEvent('download');
  await page.getByRole('menuitem',{name:'Excel',exact:true}).click();
  const file=await downloaded;
  const book=XLSX.read(fs.readFileSync(await file.path()),{type:'buffer'});
  const cells=JSON.stringify(XLSX.utils.sheet_to_json(book.Sheets.data,{header:1}));
  for(const term of terms)assert.ok(cells.includes(term.slang),'export must retain the complete glossary');
  assert.equal(glossaryReads,1,'typing must not cause API calls');
  await page.setViewportSize({width:1280,height:900});await input.scrollIntoViewIfNeeded();
  assert.equal(await input.isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile/desktop search, slang/standard/category, no results, clear, no extra API calls, full-list Excel download.');
} finally {await browser?.close();server.kill('SIGTERM');fixture.close();}
