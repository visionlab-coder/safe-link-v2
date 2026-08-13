"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountDeletePage() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmation !== "회원탈퇴") {
      setError("확인을 위해 ‘회원탈퇴’를 정확히 입력해 주세요.");
      return;
    }
    if (!window.confirm("계정을 탈퇴하면 로그인할 수 없습니다. 계속할까요?")) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, reason }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || body.message || "account_deletion_failed");
      localStorage.removeItem("safe-link-remember");
      sessionStorage.removeItem("safe-link-session-active");
      window.location.href = "/auth?account_deleted=1";
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "account_deletion_failed";
      setError(
        code === "root_self_deletion_not_allowed"
          ? "루트 관리자는 서비스 내에서 본인 계정을 삭제할 수 없습니다. 다른 루트 관리자가 권한을 이관한 뒤 처리해야 합니다."
          : code === "account_deletion_policy_not_approved"
            ? "개인정보 보존·삭제 정책 승인 전에는 계정 탈퇴를 처리할 수 없습니다. 관리자에게 문의해 주세요."
            : "탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050508] px-5 py-16 text-white">
      <section className="mx-auto max-w-md rounded-3xl border border-red-500/20 bg-white/[0.04] p-6 shadow-2xl">
        <button type="button" onClick={() => router.back()} className="mb-6 text-sm font-bold text-slate-400">← 돌아가기</button>
        <h1 className="text-2xl font-black">계정 탈퇴</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          탈퇴 즉시 로그인 정보와 현장 권한을 해제하고 개인정보를 가명 처리합니다. 산업안전 관련 기록과 감사 로그는 법적·운영상의 보존기간 동안 별도로 보관될 수 있습니다.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-bold text-slate-300">
            탈퇴 사유 (선택)
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500}
              className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-red-400" />
          </label>
          <label className="block text-sm font-bold text-slate-300">
            확인을 위해 <strong className="text-red-400">회원탈퇴</strong> 입력
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white outline-none focus:border-red-400" />
          </label>
          {error && <p role="alert" className="text-sm font-bold text-red-400">{error}</p>}
          <button type="submit" disabled={loading || confirmation !== "회원탈퇴"}
            className="w-full rounded-xl bg-red-600 py-3.5 font-black disabled:cursor-not-allowed disabled:opacity-40">
            {loading ? "처리 중…" : "계정 탈퇴"}
          </button>
        </form>
      </section>
    </main>
  );
}
