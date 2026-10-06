"use client";

import { useState } from "react";
import WorkerRegistrationFrame from "@/components/WorkerRegistrationFrame";
import { useRouter } from "next/navigation";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

import { workerRegistrationUI } from "@/lib/worker-registration-ui";
import EnglishNameField from "@/components/EnglishNameField";

export default function TemporaryRegistration() {
  const router = useRouter();
  const language = useDisplayLanguage();
  const t = workerRegistrationUI(language);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [nameReady, setNameReady] = useState(false);
  return <WorkerRegistrationFrame title={t.temporary} language={language} mode="temporary" backHref="/auth">
    <form noValidate onSubmit={async event => {
      event.preventDefault();
      if (busy || !consent || !nameReady) return;
      const form = new FormData(event.currentTarget);
      if (!String(form.get("name") || "").trim()) { setError(t.workerNameRequired); return; }
      if (!/^\+?[0-9]{8,15}$/.test(String(form.get("phone") || "").replace(/[\s()-]/g, ""))) { setError(t.phoneError); return; }
      setBusy(true); setError("");
      try {
        const response = await fetch("/api/auth/temporary-worker", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ name: form.get("name"), phone: String(form.get("phone") || "").replace(/[\s()-]/g, ""),
            language, consent, consentVersion: "temporary-worker-2026-09-28" }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { error?: string };
          const messages: Record<string, string> = {
            privacy_consent_required: t.agree,
            name_required: t.workerNameRequired,
            phone_invalid: t.phoneError,
            language_invalid: t.error,
            temporary_registration_unavailable: t.conflict,
            temporary_site_requires_configuration: t.siteError,
            origin_denied: t.error,
          };
          throw new Error(messages[body.error || ""] || (response.status === 429
            ? t.error
            : response.status >= 500 || response.status === 404
              ? t.error
              : t.error));
        }
        router.replace("/worker/temporary"); router.refresh();
      } catch (e) { setError(e instanceof Error && Object.values(t).includes(e.message) ? e.message : t.error); }
      finally { setBusy(false); }
    }}>
      <p>{t.intro}</p>
      <EnglishNameField language={language} value={name} onChange={setName} onReadyChange={setNameReady} />
      <label className="block">{t.phone}<input name="phone" required type="tel" autoComplete="tel" className="mt-2 w-full rounded-xl border border-slate-400 p-3" /></label>
      <section className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm">
        <h2 className="font-bold">{t.privacy}</h2>
        <p className="mt-2">{t.temporaryData}</p>
        <p className="mt-2">{t.refuse}</p>
        <label className="mt-3 flex items-start gap-3"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 h-5 w-5" />{t.agree}</label>
      </section>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      <button disabled={busy || !consent || !nameReady} className="w-full rounded-xl bg-blue-700 p-4 font-bold text-white disabled:bg-slate-300 disabled:text-slate-600">{busy ? t.busy : t.doSignup}</button>
    </form>
  </WorkerRegistrationFrame>;
}
