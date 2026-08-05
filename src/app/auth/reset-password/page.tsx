"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("reset_request_failed");
      setMessage("등록 여부와 관계없이, 계정이 확인되면 재설정 안내를 발송합니다.");
    } catch {
      setMessage("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "reset_failed");
      }
      setMessage("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.");
      setTimeout(() => router.replace("/auth"), 1200);
    } catch (error) {
      const code = error instanceof Error ? error.message : "reset_failed";
      setMessage(code.includes("expired") ? "재설정 링크가 만료되었습니다." : code.includes("used") ? "이미 사용된 재설정 링크입니다." : "재설정 링크가 올바르지 않거나 처리할 수 없습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
        <BrandLogo compact showProduct imageClassName="max-w-[180px]" />
        <div className="flex items-center gap-3 my-6">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-400/20"><Lock className="w-5 h-5 text-blue-300" /></div>
          <div><h1 className="text-lg font-black">비밀번호 재설정</h1><p className="text-xs text-slate-400 mt-1">재설정 안내를 요청하거나 전달받은 토큰을 입력하세요.</p></div>
        </div>
        <form onSubmit={requestReset} className="space-y-3">
          <label className="text-sm font-bold" htmlFor="reset-email">이메일</label>
          <input id="reset-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-4 py-3" />
          <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black disabled:opacity-50">재설정 안내 요청</button>
        </form>
        <div className="my-6 border-t border-white/10" />
        <form onSubmit={confirmReset} className="space-y-3">
          <label className="text-sm font-bold" htmlFor="reset-token">재설정 토큰</label>
          <input id="reset-token" required value={token} onChange={(event) => setToken(event.target.value)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-4 py-3" />
          <label className="text-sm font-bold" htmlFor="reset-password">새 비밀번호 (12자 이상)</label>
          <input id="reset-password" type="password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl bg-slate-950 border border-white/10 px-4 py-3" />
          <button disabled={busy} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black disabled:opacity-50">비밀번호 변경</button>
        </form>
        {message && <p role="status" className="mt-4 text-sm text-slate-300 leading-6">{message}</p>}
        <button onClick={() => router.replace("/auth")} className="mt-5 w-full flex items-center justify-center gap-2 text-sm text-slate-400"><ArrowLeft className="w-4 h-4" />로그인으로 돌아가기</button>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
