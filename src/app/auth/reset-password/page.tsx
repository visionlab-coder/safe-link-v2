"use client";

import { useState, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function ResetContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createClient(), []);

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const lang = searchParams.get("lang") || "ko";

    const handleReset = async () => {
        if (!password || password.length < 8 || password !== confirm) return;
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        setLoading(false);
        if (error) { alert(error.message); return; }
        setDone(true);
        setTimeout(() => router.push(`/auth?lang=${lang}`), 2000);
    };

    const inputCls = "w-full p-4 bg-slate-900/80 border border-slate-700 rounded-2xl text-base focus:border-blue-500 outline-none transition-colors placeholder:text-slate-600";

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#070710] text-white">
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-black tracking-tight">
                    <span className="text-white">SAFE</span><span className="text-blue-400">-LINK</span>
                </h1>
            </div>
            <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
                {done ? (
                    <div className="text-center py-4">
                        <div className="text-4xl mb-4">✅</div>
                        <p className="text-emerald-300 font-black text-xl">비밀번호가 변경되었습니다!</p>
                        <p className="text-slate-500 text-sm mt-2">잠시 후 로그인 화면으로 이동합니다...</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="mb-2">
                            <h2 className="text-2xl font-black text-yellow-300">🔑 새 비밀번호 설정</h2>
                            <p className="text-slate-500 text-sm mt-1">새 비밀번호를 입력해주세요. (최소 8자)</p>
                        </div>
                        <input type="password" placeholder="새 비밀번호 (최소 8자)" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
                        <div className="relative">
                            <input
                                type="password" placeholder="비밀번호 확인" value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleReset()}
                                className={`${inputCls} ${confirm && confirm !== password ? "border-red-500" : confirm && confirm === password ? "border-emerald-500" : ""}`}
                            />
                            {confirm && <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xl ${confirm === password ? "text-emerald-400" : "text-red-400"}`}>{confirm === password ? "✓" : "✗"}</span>}
                        </div>
                        <button
                            onClick={handleReset}
                            disabled={loading || !password || password.length < 8 || password !== confirm}
                            className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95 disabled:opacity-40"
                        >
                            {loading ? "..." : "비밀번호 변경하기"}
                        </button>
                        <button onClick={() => router.push(`/auth?lang=${lang}`)} className="text-slate-600 hover:text-slate-400 text-sm font-bold text-center">← 로그인으로 돌아가기</button>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#070710]" />}>
            <ResetContent />
        </Suspense>
    );
}
