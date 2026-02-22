"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";

const isoMap: Record<string, string> = {
    ko: "kr", en: "us", vi: "vn", zh: "cn", th: "th", uz: "uz", ph: "ph",
    km: "kh", id: "id", mn: "mn", my: "mm", ne: "np", bn: "bd", kk: "kz",
    ru: "ru", jp: "jp", fr: "fr", es: "es", ar: "sa", hi: "in",
};

type WorkerStatus = {
    id: string;
    display_name: string;
    preferred_lang: string;
    signed: boolean;
    signed_at?: string;
};

export default function TBMStatusPage() {
    const router = useRouter();
    const [workers, setWorkers] = useState<WorkerStatus[]>([]);
    const [latestTBM, setLatestTBM] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [adminLang, setAdminLang] = useState("ko");

    // UI 텍스트 (관리자: 한/영/중)
    const ui: Record<string, any> = {
        ko: { title: "TBM 서명 현황", signed: "서명 완료", unsigned: "미서명", total: "전체", back: "돌아가기", noTBM: "발송된 TBM이 없습니다.", noWorker: "등록된 근로자가 없습니다.", signedAt: "서명 시각", refreshBtn: "새로고침" },
        en: { title: "TBM Signature Status", signed: "Signed", unsigned: "Unsigned", total: "Total", back: "Back", noTBM: "No TBM sent yet.", noWorker: "No workers registered.", signedAt: "Signed at", refreshBtn: "Refresh" },
        zh: { title: "TBM签名状态", signed: "已签名", unsigned: "未签名", total: "全部", back: "返回", noTBM: "尚未发送TBM。", noWorker: "没有注册的工人。", signedAt: "签名时间", refreshBtn: "刷新" },
    };
    const t = ui[adminLang] || ui["en"];

    const load = async () => {
        setLoading(true);
        const supabase = createClient();

        // 관리자 언어 가져오기
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: adminProfile } = await supabase
                .from("profiles").select("preferred_lang").eq("id", session.user.id).single();
            setAdminLang(adminProfile?.preferred_lang || "ko");
        }

        // 최신 TBM 1개
        const { data: tbmRows } = await supabase
            .from("tbm_notices")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1);
        const tbm = tbmRows?.[0] || null;
        setLatestTBM(tbm);

        // 모든 WORKER 프로필 가져오기
        const { data: workerProfiles } = await supabase
            .from("profiles")
            .select("id, display_name, preferred_lang")
            .eq("role", "WORKER");

        if (!tbm || !workerProfiles) {
            setWorkers(workerProfiles?.map(w => ({ ...w, signed: false })) || []);
            setLoading(false);
            return;
        }

        // 해당 TBM에 대한 서명 목록
        const { data: ackData } = await supabase
            .from("tbm_ack")
            .select("worker_id, ack_at")
            .eq("tbm_id", tbm.id);

        const ackMap = new Map((ackData || []).map(a => [a.worker_id, a.ack_at]));

        const statusList: WorkerStatus[] = workerProfiles.map(w => ({
            id: w.id,
            display_name: w.display_name || "이름 없음",
            preferred_lang: w.preferred_lang || "ko",
            signed: ackMap.has(w.id),
            signed_at: ackMap.get(w.id),
        }));

        // 미서명 먼저, 서명 완료 나중에 정렬
        statusList.sort((a, b) => Number(a.signed) - Number(b.signed));
        setWorkers(statusList);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const signedCount = workers.filter(w => w.signed).length;
    const totalCount = workers.length;
    const signRate = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col gap-6">
                {/* 헤더 */}
                <header className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-white">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-2xl font-black text-blue-400">{t.title}</h1>
                    <button onClick={load} className="ml-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-colors">
                        ↻ {t.refreshBtn}
                    </button>
                </header>

                {/* 최신 TBM 정보 */}
                {latestTBM && (
                    <div className="p-5 bg-slate-800/80 rounded-2xl border border-slate-700">
                        <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">Latest TBM</p>
                        <p className="text-slate-300 text-sm leading-relaxed line-clamp-2">{latestTBM.content_ko}</p>
                        <p className="text-xs text-slate-600 mt-2">{new Date(latestTBM.created_at).toLocaleString()}</p>
                    </div>
                )}

                {/* 서명률 진행바 */}
                {!loading && totalCount > 0 && (
                    <div className="p-6 bg-slate-800/60 rounded-2xl border border-slate-700 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-300">
                                {t.signed}: <span className="text-green-400 text-xl font-black">{signedCount}</span>
                                <span className="text-slate-500"> / {totalCount} {t.total}</span>
                            </span>
                            <span className={`text-2xl font-black ${signRate === 100 ? "text-green-400" : signRate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                                {signRate}%
                            </span>
                        </div>
                        <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${signRate === 100 ? "bg-green-500" : signRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${signRate}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* 근로자 목록 */}
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : workers.length === 0 ? (
                    <p className="text-slate-500 text-center py-16">{latestTBM ? t.noWorker : t.noTBM}</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {workers.map(worker => (
                            <div
                                key={worker.id}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${worker.signed
                                        ? "bg-green-500/10 border-green-500/30"
                                        : "bg-red-500/10 border-red-500/30"
                                    }`}
                            >
                                {/* 국기 */}
                                <img
                                    src={`https://flagcdn.com/w40/${isoMap[worker.preferred_lang] || "un"}.png`}
                                    alt={worker.preferred_lang}
                                    className="w-8 h-6 object-cover rounded-sm flex-shrink-0"
                                />

                                {/* 이름 + 서명 시각 */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white truncate">{worker.display_name}</p>
                                    {worker.signed && worker.signed_at && (
                                        <p className="text-xs text-green-400 mt-0.5">
                                            {t.signedAt}: {new Date(worker.signed_at).toLocaleTimeString()}
                                        </p>
                                    )}
                                </div>

                                {/* 상태 뱃지 */}
                                <span className={`px-3 py-1.5 rounded-full font-black text-xs flex-shrink-0 ${worker.signed
                                        ? "bg-green-500/20 text-green-300"
                                        : "bg-red-500/20 text-red-300"
                                    }`}>
                                    {worker.signed ? `✓ ${t.signed}` : `⏳ ${t.unsigned}`}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </RoleGuard>
    );
}
