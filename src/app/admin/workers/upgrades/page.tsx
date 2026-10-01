"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
type RequestRow = { id:number; revision:number; display_name:string; phone:string; iris_id:string; site_name:string; requested_at:string };
export default function WorkerUpgrades() {
  const [rows,setRows]=useState<RequestRow[]>([]);
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<number | null>(null);
  const [verified,setVerified]=useState<Record<number,boolean>>({});
  const [reasons,setReasons]=useState<Record<number,string>>({});
  const load=useCallback(async()=>{
    setLoading(true);
    try { const res=await fetch("/api/worker-upgrade?mode=admin",{cache:"no-store"}); if(!res.ok) throw new Error("목록 조회에 실패했습니다. 현장 사용자 관리 권한을 확인해 주세요."); setRows(await res.json()); setVerified({}); }
    catch(e){setNotice(e instanceof Error?e.message:"연결을 확인해 주세요.");} finally {setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const decide=async(id:number,approve:boolean)=>{
    if(busy!==null) return; setBusy(id); setNotice("");
    try {const res=await fetch(`/api/worker-upgrade?decision=${id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({approve,contractVerified:!!verified[id],reason:reasons[id] || "",revision:rows.find(row=>row.id===id)?.revision})});
      if(!res.ok) throw new Error("처리하지 못했습니다. 이미 처리된 신청인지, 현장 권한 및 홍채 번호·전화번호 중복 여부를 확인해 주세요.");
      setNotice(approve?"승인했습니다. 같은 계정이 정식 근로자로 전환되었습니다.":"반려했습니다. 근로자가 수정 후 재신청할 수 있습니다."); await load();
    }catch(e){setNotice(e instanceof Error?e.message:"연결을 확인해 주세요.");}finally{setBusy(null);}
  };
  return <RoleGuard allowedRole="admin"><main className="min-h-screen bg-slate-50 p-5 text-slate-900"><section className="mx-auto max-w-3xl space-y-5">
    <Link href="/admin/workers" className="underline">근로자 관리로 돌아가기</Link><h1 className="text-2xl font-bold">정식 근로자 전환 신청</h1>
    <p>해당 현장의 근로계약 정보와 신청자 정보를 대조한 후 승인해 주세요. 홍채 번호 입력만으로 자동 승인되지 않습니다.</p>
    {notice && <p role="status" className="rounded-xl border bg-white p-4">{notice}</p>}
    <button disabled={busy!==null || loading} className="underline" onClick={()=>void load()}>목록 새로고침</button>
    {loading ? <p>불러오는 중…</p> : rows.length===0 ? <p>확인할 신청이 없습니다.</p> : rows.map(row=><article key={row.id} className="space-y-3 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-bold">{row.display_name}</h2><p>현장: {row.site_name}</p><p>전화번호: {row.phone}</p><p className="break-all">홍채 아이디: {row.iris_id}</p>
      <label className="flex gap-3"><input type="checkbox" checked={!!verified[row.id]} onChange={e=>setVerified({...verified,[row.id]:e.target.checked})} />근로계약서의 이름·전화번호·현장·홍채 아이디가 신청 내용과 일치함을 확인했습니다.</label>
      <button disabled={busy!==null || !verified[row.id]} onClick={()=>void decide(row.id,true)} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:bg-slate-400">{busy===row.id?"처리 중…":"확인 후 승인"}</button>
      <label className="block">반려 사유<textarea maxLength={500} value={reasons[row.id] || ""} onChange={e=>setReasons({...reasons,[row.id]:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-400 p-3" /></label>
      <button disabled={busy!==null || !reasons[row.id]?.trim()} onClick={()=>void decide(row.id,false)} className="rounded-xl border border-red-700 px-5 py-3 font-bold text-red-800 disabled:opacity-40">반려</button>
    </article>)}
  </section></main></RoleGuard>;
}
