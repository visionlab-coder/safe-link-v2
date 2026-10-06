// Isolated local backend/DB only. Does not broadcast TBM or call paid AI APIs.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const base='http://127.0.0.1:3100';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1280,height:1000}});
 const anonymous=await context.request.get(base+'/api/tbm/library');
 assert.equal(anonymous.status(),403);
 const login=await context.request.post('http://127.0.0.1:18081/api/v1/auth/login',{data:{email:'enrollment-manager@example.invalid',password:'LocalTbmTest!2026'}});
 assert.equal(login.status(),200);
 const response=await context.request.get(base+'/api/tbm/library');
 assert.equal(response.status(),200);
 const data=await response.json(); assert.equal(data.data.length,456);
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/admin/tbm/create?lang=ko');
 await page.getByRole('button',{name:'목록 열기'}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByText('451 개 항목',{exact:true}).waitFor();
 assert.equal(await dialog.locator('#tbm-risk-items input[type="checkbox"]').count(),451);
 assert.equal(await dialog.getByRole('button',{name:'다음',exact:true}).count(),0);
 for (const category of [...new Set(data.data.filter(i=>i.source_id==='seowon-initial-20261006').map(i=>i.category))]) {
   await dialog.getByRole('button',{name:category,exact:true}).click();
   assert.equal(await dialog.locator('#tbm-risk-items input[type="checkbox"]').count(), data.data.filter(i=>i.source_id==='seowon-initial-20261006'&&i.category===category).length);
 }
 await dialog.getByRole('button',{name:'전체',exact:true}).click();
 const first=data.data[0];
 await dialog.getByRole('checkbox',{name:first.hazard_description,exact:true}).check();
 await dialog.getByRole('button',{name:'철근작업',exact:true}).click();
 await dialog.getByRole('button',{name:'자료 · 검색'}).click();
 await dialog.getByRole('searchbox',{name:'검색',exact:true}).fill('지게차 유도자');
 await dialog.getByRole('combobox',{name:'세부공종',exact:true}).selectOption('철근 반입');
 await dialog.getByText('1 개 항목',{exact:true}).waitFor();
 await dialog.getByRole('checkbox',{name:data.data[1].hazard_description,exact:true}).check();
 await dialog.getByRole('button',{name:'TBM에 삽입',exact:true}).click();
 const draft=await page.locator('textarea').first().inputValue();
 assert.ok(draft.includes(first.preventive_measure));assert.ok(draft.includes(data.data[1].preventive_measure));
 assert.equal(draft.split('관리계획:').length,3);
 await page.getByRole('button',{name:'목록 열기'}).click();
 await dialog.getByRole('searchbox').fill('');
 await dialog.getByRole('button',{name:'전체',exact:true}).click();
 await dialog.getByRole('button',{name:'자료 · 검색'}).click();
 await dialog.getByRole('button',{name:'중점관리만',exact:true}).click();
 await dialog.getByText('142 개 항목',{exact:true}).waitFor();
 await page.screenshot({path:'/tmp/tbm-risk-library-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/tbm-risk-library-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
 await page.route('**/api/tbm/library',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await page.getByRole('button',{name:'목록 열기'}).click();
 await dialog.getByRole('alert').waitFor();
 assert.equal(await dialog.getByRole('button',{name:'TBM에 삽입',exact:true}).count(),0);
 await page.unroute('**/api/tbm/library');
 await dialog.getByRole('button',{name:'다시 시도',exact:true}).click();
 await dialog.getByText('142 개 항목',{exact:true}).waitFor();
 await page.setViewportSize({width:1280,height:1100});
 await dialog.getByRole('button',{name:'자료 · 검색'}).click();
 const sample=data.sources.find(s=>s.id!=='seowon-initial-20261006');
 await dialog.getByRole('combobox',{name:'자료',exact:true}).selectOption(sample.id);
 await dialog.getByRole('button',{name:'자료 · 검색'}).click();
 await dialog.getByText('5 개 항목',{exact:true}).waitFor();
 for (const cat of ['건축','공통','설비','양중','전기']) {
   await dialog.getByRole('button',{name:cat,exact:true}).click();
   assert.equal(await dialog.locator('#tbm-risk-items input[type="checkbox"]').count(),1);
 }
 await dialog.getByRole('button',{name:'전체',exact:true}).click();
 await page.mouse.move(0,0);
 await page.waitForTimeout(250); // Wait for the category's visual transition before the reference capture.
 await dialog.screenshot({path:'/tmp/tbm-risk-library-reference-light.png'});
 await dialog.getByRole('button',{name:'전체 선택',exact:true}).click();
 assert.equal(await dialog.locator('#tbm-risk-items input:checked').count(),5);
 await page.keyboard.press('End');
 await dialog.getByRole('button',{name:'TBM에 삽입',exact:true}).focus();
 await page.keyboard.press('Tab');
 assert.equal(await dialog.getByRole('button',{name:'닫기',exact:true}).evaluate(el=>el===document.activeElement),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: real admin login + BFF/backend catalog, anonymous denied, 451 rows, filters, cross-filter selection, draft insertion, mobile width, error/retry. No TBM broadcast.');
} finally {await browser.close();}
