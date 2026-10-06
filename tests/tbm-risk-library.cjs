const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const lib={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/tbm-risk-library.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:lib});
const catalog=JSON.parse(fs.readFileSync('backend/src/main/resources/tbm/seowon-risk-assessment.json','utf8'));
const base={source:catalog.source.id,category:'',subcategory:'',critical:false,query:''};
test('451 rows and source provenance retained, including merged categories',()=>{
 assert.equal(catalog.items.length,451); assert.equal(new Set(catalog.items.map(i=>i.category)).size,9);
 assert.equal(catalog.items[1].category,'철근작업'); assert.match(catalog.source.sha256,/^[a-f0-9]{64}$/);
});
test('category, subcategory, critical mark and multi-word search combine',()=>{
 assert.equal(lib.filterRiskLibrary(catalog.items,{...base,critical:true}).length,142);
 const found=lib.filterRiskLibrary(catalog.items,{...base,category:'철근작업',subcategory:'철근 반입',query:'지게차 유도자'});
 assert.equal(found.length,1); assert.equal(found[0].source_row,12);
 assert.equal(lib.filterRiskLibrary(catalog.items,{...base,query:'NOTFOUND'}).length,0);
});
test('selection is independent from visible filters, source text not rewritten',()=>{
 const selected=new Set([catalog.items[0].id,catalog.items[100].id]);
 const draft=lib.riskLibraryDraft(catalog.items,selected);
 assert.ok(draft.includes(catalog.items[0].hazard_description));
 assert.ok(draft.includes(catalog.items[100].preventive_measure));
 assert.equal(draft.split('관리계획:').length,3);
 assert.equal(lib.riskLibraryDraft(catalog.items,new Set()),'');
});
