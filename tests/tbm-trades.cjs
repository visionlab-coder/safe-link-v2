const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/tbm-trades.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject});
const {TBM_TRADES,normalizeTbmTrades,toggleTbmTrade}=exportsObject;
test('all sixteen labels match the backend catalog exactly',()=>{
  const java=fs.readFileSync('backend/src/main/java/com/safelink/v3/tbm/TbmTrades.java','utf8');
  const labels=[...java.match(/ALL = List.of\(([\s\S]*?)\);/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(Array.from(TBM_TRADES),labels);
  assert.equal(new Set(labels).size,16);
});
test('checkboxes support multiple selections, deselection and canonical ordering',()=>{
  let selected=toggleTbmTrade([],'정리');
  selected=toggleTbmTrade(selected,'철근');
  assert.deepEqual(Array.from(selected),['철근','정리']);
  assert.deepEqual(Array.from(toggleTbmTrade(selected,'정리')),['철근']);
  assert.deepEqual(Array.from(normalizeTbmTrades(['철근','철근','invalid'])),['철근']);
  assert.deepEqual(Array.from(normalizeTbmTrades(undefined)),[]);
});
