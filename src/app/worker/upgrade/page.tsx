"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import WorkerRegistrationFrame from "@/components/WorkerRegistrationFrame";

import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";
import { workerRegistrationUI } from "@/lib/worker-registration-ui";

type Application = { status: string; local_enrollment_test?: boolean; decision_reason?: string; display_name?: string; phone?: string; site_id?: number; iris_id?: string; login_id?: string };
export default function WorkerUpgrade() {
  const language = useDisplayLanguage();
  const t = workerRegistrationUI(language);
  const [application, setApplication] = useState<Application | null>(null);
  const [sites, setSites] = useState<Array<{id:number; name:string}>>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/worker-upgrade", { cache:"no-store" });
      if (!res.ok) throw new Error(t.error);
      const data: Application = await res.json(); setApplication(data);
      if (data.status === "NONE" || data.status === "REJECTED") {
        const response = await fetch("/api/worker-upgrade?mode=sites", { cache:"no-store" });
        if (!response.ok) throw new Error(t.siteError);
        setSites(await response.json());
      }
    } catch (e) { setError(e instanceof Error && [t.error, t.siteError].includes(e.message) ? e.message : t.error); }
  }, [t.error, t.siteError]);
  useEffect(() => { void load(); }, [load]);
  return <RoleGuard allowedRole="worker"><WorkerRegistrationFrame title={t.upgrade} language={language} mode="upgrade" backHref="/worker/temporary"><div className="space-y-5">
    <p>{application?.local_enrollment_test ? "로컬 테스트: 준비된 더미 이름·전화번호·현장·홍채 ID가 일치하면 승인 대기 없이 즉시 전환됩니다. 하이정보 API 연결 테스트는 아닙니다." : t.upgradeIntro}</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    {!application && !error && <p role="status">{t.busy}</p>}
    {application?.status === "APPROVED" ? <div className="space-y-4"><p role="status">{t.approved}</p><p>{t.loginHint.replace("{id}", application.login_id || "")}</p><Link className="block rounded-xl bg-blue-700 p-4 text-center font-bold text-white" href="/worker">{t.home}</Link></div> : application?.status === "PENDING" ? <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-900">{t.pending}</p> : application && <form noValidate className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (busy || !consent) return;
      const data = new FormData(event.currentTarget);
      if (!String(data.get("name") || "").trim()) { setError(t.workerNameRequired); return; }
      if (!/^\+?[0-9]{8,15}$/.test(String(data.get("phone") || "").replace(/[\s()-]/g, ""))) { setError(t.phoneError); return; }
      if (!Number(data.get("site")) || !/^[0-9]{1,64}$/.test(String(data.get("iris") || ""))) { setError(t.error); return; }
      setBusy(true); setError("");
      try {
        const res = await fetch("/api/worker-upgrade", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
          name:data.get("name"), phone:String(data.get("phone") || "").replace(/[\s()-]/g,""), siteId:Number(data.get("site")), irisId:data.get("iris"), consent, consentVersion:"worker-upgrade-2026-09-28",
        }) });
        if (!res.ok) throw new Error(t.error);
        setConsent(false); await load();
      } catch (e) { setError(e instanceof Error && [t.error, t.siteError].includes(e.message) ? e.message : t.error); } finally { setBusy(false); }
    }}>
      {application.status === "REJECTED" && <p role="status" className="rounded-xl bg-red-50 p-3 text-red-800">{t.rejected} <span lang="ko">{application.decision_reason}</span></p>}
      <label className="block">{t.name}<input name="name" autoComplete="name" defaultValue={application.display_name} maxLength={80} required className="mt-1 w-full rounded-xl border border-slate-400 p-3" /></label>
      <label className="block">{t.phone}<input name="phone" type="tel" autoComplete="tel" defaultValue={application.phone} required className="mt-1 w-full rounded-xl border border-slate-400 p-3" /></label>
      <label className="block">{t.site}<select name="site" defaultValue={application.site_id || ""} required className="mt-1 w-full rounded-xl border border-slate-400 p-3"><option value="" disabled>{t.site}</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
      <label className="block">{t.iris}<input name="iris" inputMode="numeric" pattern="[0-9]{1,64}" maxLength={64} defaultValue={application.iris_id} required className="mt-1 w-full rounded-xl border border-slate-400 p-3" /></label>
      <p className="text-sm text-slate-600">{t.irisHelp}</p>
      <section className="space-y-2 rounded-xl border bg-slate-50 p-4 text-sm"><h2 className="font-bold">{t.privacy}</h2><p>{t.upgradeData} {t.refuse}</p><label className="flex gap-3"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} />{t.agree}</label></section>
      <button disabled={busy || !consent || !sites.length} className="w-full rounded-xl bg-blue-700 p-4 font-bold text-white disabled:bg-slate-400">{busy ? t.busy : t.upgrade}</button>
    </form>}
    <div className="flex justify-between"><Link className="underline" href="/worker/temporary">{t.back}</Link><button disabled={busy} className="underline" onClick={()=>void load()}>{t.refresh}</button></div>
  </div></WorkerRegistrationFrame></RoleGuard>;
}
