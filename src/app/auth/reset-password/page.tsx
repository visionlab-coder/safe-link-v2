"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function ResetPasswordDisabledPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white px-5">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
        <div className="mb-6">
          <BrandLogo compact showProduct imageClassName="max-w-[180px]" />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-400/20">
            <Lock className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-lg font-black">비밀번호 재설정 준비 중</h1>
            <p className="text-xs text-slate-400 mt-1">V3에서는 Spring Boot 계정 관리 API로만 처리합니다.</p>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-6 mb-6">
          관리자 비밀번호 변경은 운영자 승인 절차로 처리해야 합니다. 임시로 필요한 경우 상위 관리자에게 재설정을 요청하세요.
        </p>
        <button
          onClick={() => router.replace("/auth")}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-3 text-sm font-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          로그인으로 돌아가기
        </button>
      </section>
    </main>
  );
}
