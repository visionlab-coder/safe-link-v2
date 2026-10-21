const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/tbm-trades.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject});
const {TBM_TRADES,normalizeTbmTrades,toggleTbmTrade,toggleAllTbmTrades}=exportsObject;
test('live discovery preserves every TBM channel and never guesses between multiple broadcasts',()=>{
  const {liveTbmSessions}=require('./helpers/load-typescript.cjs')()('src/lib/tbm-live-sessions.ts');
  const common={session_id:'tbm_common',trade_types:[]};
  const rope={session_id:'tbm_rope',trade_types:['로프공']};
  assert.deepEqual(liveTbmSessions({active:true,sessions:[common,rope,{session_id:'generic_live'}]}),[common,rope]);
  assert.deepEqual(liveTbmSessions({active:true,session:common}),[common]);
  assert.deepEqual(liveTbmSessions({active:false,sessions:[common]}),[]);
});
test('all sixteen labels match the backend catalog exactly',()=>{
  const java=fs.readFileSync('backend/src/main/java/com/safelink/v3/tbm/TbmTrades.java','utf8');
  const labels=[...java.match(/ALL = List.of\(([\s\S]*?)\);/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(Array.from(TBM_TRADES),labels);
  assert.equal(new Set(labels).size,16);
});
test('select all expands to canonical values, partial selection selects all, full selection clears',()=>{
  for (const selection of [[],['로프공'],['철근','invalid','철근']])
    assert.deepEqual(Array.from(toggleAllTbmTrades(selection)),Array.from(TBM_TRADES));
  assert.deepEqual(Array.from(toggleAllTbmTrades([...TBM_TRADES])),[]);
  const partial=toggleTbmTrade([...TBM_TRADES],'거푸집');
  assert.equal(partial.length,15);
  assert.deepEqual(Array.from(toggleAllTbmTrades(partial)),Array.from(TBM_TRADES));
});
test('all trade selector labels are localized for the twenty supported languages',()=>{
  const load=require('./helpers/load-typescript.cjs')();
  const {tbmTradeLabel,tbmTradeSelectorUI}=load('src/lib/tbm-trade-labels.ts');
  const {QR_LANGUAGE_OPTIONS}=load('src/utils/qr/language-options.ts');
  for(const {lang} of QR_LANGUAGE_OPTIONS){
    const text=[...TBM_TRADES.map(t=>tbmTradeLabel(t,lang)),...Object.values(tbmTradeSelectorUI(lang))];
    assert.ok(text.every(Boolean),lang);
    if(lang!=='ko')assert.ok(text.every(t=>!/[가-힣]/.test(t)),lang+' Korean fallback');
  }
  assert.equal(tbmTradeLabel('거푸집','en'),'Formwork');
  assert.deepEqual(tbmTradeSelectorUI('ja'),tbmTradeSelectorUI('jp'));
  assert.deepEqual(tbmTradeSelectorUI('fil'),tbmTradeSelectorUI('ph'));
});
test('checkboxes support multiple selections, deselection and canonical ordering',()=>{
  let selected=toggleTbmTrade([],'정리');
  selected=toggleTbmTrade(selected,'철근');
  assert.deepEqual(Array.from(selected),['철근','정리']);
  assert.deepEqual(Array.from(toggleTbmTrade(selected,'정리')),['철근']);
  assert.deepEqual(Array.from(normalizeTbmTrades(['철근','철근','invalid'])),['철근']);
  assert.deepEqual(Array.from(normalizeTbmTrades(undefined)),[]);
});
