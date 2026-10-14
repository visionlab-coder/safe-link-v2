"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import WorkerRegistrationFrame from "@/components/WorkerRegistrationFrame";

import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";
import { workerRegistrationUI } from "@/lib/worker-registration-ui";
import EnglishNameField from "@/components/EnglishNameField";
import { workerLoginUI } from "@/lib/worker-login";

type Application = { status: string; birth_date?: string; local_enrollment_test?: boolean; decision_reason?: string; display_name?: string; phone?: string; site_id?: number; iris_id?: string; login_id?: string };
export default function WorkerUpgrade() {
  const language = useDisplayLanguage();
  const t = workerRegistrationUI(language);
  const login = workerLoginUI(language);
  const [application, setApplication] = useState<Application | null>(null);
  const [sites, setSites] = useState<Array<{id:number; name:string; original_name?:string; translation_available?:boolean}>>([]);
  const [siteBusy, setSiteBusy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [nameReady, setNameReady] = useState(false);
  const canChooseSite = application?.status === "NONE" || application?.status === "REJECTED";
  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/worker-upgrade", { cache:"no-store" });
      if (!res.ok) throw new Error(t.error);
      const data: Application = await res.json(); setApplication(data);
      setName(data.display_name || ""); setNameReady(Boolean(data.birth_date));
    } catch (e) { setError(e instanceof Error && [t.error, t.siteError].includes(e.message) ? e.message : t.error); }
  }, [t.error, t.siteError]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!canChooseSite) return;
    const controller = new AbortController();
    setSiteBusy(true); setSites([]);
    void fetch("/api/worker-upgrade?mode=sites", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ language }), signal:controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error(t.siteError);
      const data = await response.json();
      if (!controller.signal.aborted) setSites(data);
    }).catch(() => { if (!controller.signal.aborted) setError(t.siteError); })
      .finally(() => { if (!controller.signal.aborted) setSiteBusy(false); });
    return () => controller.abort();
  }, [canChooseSite, language, t.siteError]);
  return <RoleGuard allowedRole="worker"><WorkerRegistrationFrame title={t.upgrade} language={language} mode="upgrade" backHref="/worker/temporary"><div className="space-y-5">
    <p>{application?.birth_date ? login.upgrade : t.upgradeIntro}</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    {!application && !error && <p role="status">{t.busy}</p>}
    {application?.status === "APPROVED" ? <div className="space-y-4"><p role="status">{t.approved}</p><p>{t.loginHint.replace("{id}", application.login_id || "")}</p><Link className="block rounded-xl bg-blue-700 p-4 text-center font-bold text-white" href="/worker">{t.home}</Link></div> : application?.status === "PENDING" ? <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-900">{t.pending}</p> : application && <form noValidate className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (busy || !consent || !nameReady) return;
      const data = new FormData(event.currentTarget);
      if (!application.birth_date && !String(data.get("name") || "").trim()) { setError(t.workerNameRequired); return; }
      if (!application.birth_date && !/^\+?[0-9]{8,15}$/.test(String(data.get("phone") || "").replace(/[\s()-]/g, ""))) { setError(t.phoneError); return; }
      if (!Number(data.get("site")) || !/^[0-9]{1,64}$/.test(String(data.get("iris") || ""))) { setError(t.error); return; }
      setBusy(true); setError("");
      try {
        const res = await fetch("/api/worker-upgrade", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
          ...(application.birth_date ? {} : {name:data.get("name"), phone:String(data.get("phone") || "").replace(/[\s()-]/g,"")}), siteId:Number(data.get("site")), irisId:data.get("iris"), consent, consentVersion:"worker-upgrade-2026-09-28",
        }) });
        if (!res.ok) throw new Error(t.error);
        setConsent(false); await load();
      } catch (e) { setError(e instanceof Error && [t.error, t.siteError].includes(e.message) ? e.message : t.error); } finally { setBusy(false); }
    }}>
      {application.status === "REJECTED" && <p role="status" className="rounded-xl bg-red-50 p-3 text-red-800">{t.rejected} <span lang="ko">{application.decision_reason}</span></p>}
      {application.birth_date ? <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="block">{login.nickname}<input value={name} readOnly className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 p-3" /></label>
        <label className="block">{login.birth}<input value={application.birth_date} readOnly className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 p-3" /></label>
      </section> : <EnglishNameField language={language} value={name} onChange={setName} onReadyChange={setNameReady} />}
      <label className="block">{t.phone}<input name="phone" type="tel" autoComplete="tel" defaultValue={application.phone} readOnly={Boolean(application.birth_date)} required className="mt-1 w-full rounded-xl border border-slate-400 p-3 read-only:bg-slate-100" /></label>
      <label className="block">{t.site}<select name="site" disabled={siteBusy} defaultValue={application.site_id || ""} required className="mt-1 w-full rounded-xl border border-slate-400 p-3"><option value="" disabled>{siteBusy ? t.busy : t.site}</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}{site.original_name && site.original_name !== site.name ? ` (${site.original_name})` : ""}</option>)}</select></label>
      {sites.some(site => site.translation_available === false) && <p role="status" className="text-sm text-amber-800">{login.siteFallback}</p>}
      <label className="block">{t.iris}<input name="iris" inputMode="numeric" pattern="[0-9]{1,64}" maxLength={64} defaultValue={application.iris_id} required className="mt-1 w-full rounded-xl border border-slate-400 p-3" /></label>
      <p className="text-sm text-slate-600">{t.irisHelp}</p>
      <section className="space-y-2 rounded-xl border bg-slate-50 p-4 text-sm"><h2 className="font-bold">{t.privacy}</h2><p>{t.upgradeData} {t.refuse}</p><label className="flex gap-3"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} />{t.agree}</label></section>
      <button disabled={busy || !consent || !sites.length || !nameReady} className="w-full rounded-xl bg-blue-700 p-4 font-bold text-white disabled:bg-slate-400">{busy ? t.busy : t.upgrade}</button>
    </form>}
    <div className="flex justify-between"><Link className="underline" href="/worker/temporary">{t.back}</Link><button disabled={busy} className="underline" onClick={()=>void load()}>{t.refresh}</button></div>
  </div></WorkerRegistrationFrame></RoleGuard>;
}
