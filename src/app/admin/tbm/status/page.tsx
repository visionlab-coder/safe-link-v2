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

    const ui: Record<string, any> = {
        ko: { title: "TBM 서명 현황", signed: "서명 완료", unsigned: "미서명", total: "전체", back: "돌아가기", noTBM: "발송된 TBM이 없습니다.", noWorker: "등록된 근로자가 없습니다.", signedAt: "서명 시각", refreshBtn: "새로고침", status: "실시간 모니터링" },
        en: { title: "TBM Status", signed: "Signed", unsigned: "Unsigned", total: "Total", back: "Back", noTBM: "No TBM sent yet.", noWorker: "No workers registered.", signedAt: "Signed at", refreshBtn: "Refresh", status: "Live Monitoring" },
        zh: { title: "TBM签名状态", signed: "已签名", unsigned: "未签名", total: "全部", back: "返回", noTBM: "尚未发送TBM。", noWorker: "没有注册的工人。", signedAt: "签名时间", refreshBtn: "刷新", status: "实时监控" },
    };
    const t = ui[adminLang] || ui["en"];

    const load = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: adminProfile } = await supabase.from("profiles").select("preferred_lang").eq("id", session.user.id).single();
            setAdminLang(adminProfile?.preferred_lang || "ko");
        }
        const { data: tbmRows } = await supabase.from("tbm_notices").select("*").order("created_at", { ascending: false }).limit(1);
        const tbm = tbmRows?.[0] || null;
        setLatestTBM(tbm);
        const { data: workerProfiles } = await supabase.from("profiles").select("id, display_name, preferred_lang").eq("role", "WORKER");
        if (!tbm || !workerProfiles) {
            setWorkers(workerProfiles?.map(w => ({ ...w, signed: false })) || []);
            setLoading(false);
            return;
        }
        const { data: ackData } = await supabase.from("tbm_ack").select("worker_id, ack_at").eq("tbm_id", tbm.id);
        const ackMap = new Map((ackData || []).map(a => [a.worker_id, a.ack_at]));
        const statusList: WorkerStatus[] = workerProfiles.map(w => ({
            id: w.id,
            display_name: w.display_name || "이름 없음",
            preferred_lang: w.preferred_lang || "ko",
            signed: ackMap.has(w.id),
            signed_at: ackMap.get(w.id),
        }));
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
            <div className="min-h-screen bg-mesh text-slate-50 flex flex-col font-sans selection:bg-blue-500/30">

                {/* 💎 Admin Header */}
                <header className="sticky top-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors tap-effect text-slate-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black tracking-tight text-white uppercase italic">Safe-Link</span>
                                <span className="px-2 py-0.5 bg-blue-500 text-[10px] font-black rounded text-white tracking-widest uppercase">Admin</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={load} className="glass px-5 py-2 rounded-full text-xs font-black text-slate-400 hover:text-white transition-all tap-effect uppercase tracking-widest">
                        {t.refreshBtn}
                    </button>
                </header>

                <main className="flex-1 flex flex-col p-4 md:p-8 gap-8 max-w-3xl mx-auto w-full pb-20">

                    <div className="flex flex-col gap-2">
                        <h2 className="text-4xl font-black text-white text-gradient tracking-tighter uppercase">{t.title}</h2>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{t.status}</p>
                        </div>
                    </div>

                    {/* 📊 Summary Dashboard Card */}
                    {!loading && totalCount > 0 && (
                        <section className="glass rounded-[48px] p-8 md:p-10 border-white/10 shadow-3xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none" />

                            <div className="flex justify-between items-end mb-8 relative">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Total Attendance</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-6xl font-black text-white">{signedCount}</span>
                                        <span className="text-2xl font-black text-slate-700 italic">/ {totalCount}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-5xl font-black italic text-gradient tracking-tighter">{signRate}%</span>
                                    <span className="text-[10px] font-black text-green-500/50 uppercase tracking-widest">Signed Rate</span>
                                </div>
                            </div>

                            <div className="relative h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <div
                                    className={`h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_20px_rgba(34,197,94,0.3)] ${signRate === 100 ? "bg-green-500" : signRate >= 50 ? "bg-blue-500" : "bg-red-500"
                                        }`}
                                    style={{ width: `${signRate}%` }}
                                />
                            </div>
                        </section>
                    )}

                    {/* 📜 Current TBM Brief */}
                    {latestTBM && (
                        <div className="glass rounded-[32px] p-6 border-white/5 flex flex-col gap-3 group animate-float">
                            <div className="flex justify-between items-center">
                                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Active Dispatch</h3>
                                <span className="text-[10px] text-slate-700 font-bold">{new Date(latestTBM.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-400 font-bold leading-relaxed line-clamp-2 italic">"{latestTBM.content_ko}"</p>
                        </div>
                    )}

                    {/* 👥 Worker Status List */}
                    <section className="flex flex-col gap-4">
                        <div className="flex justify-between items-center px-4">
                            <h3 className="text-xs font-black text-slate-600 uppercase tracking-[0.4em]">Worker Registry</h3>
                            <span className="text-[10px] text-slate-700 font-bold uppercase">{workers.length} Members</span>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20">
                                <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                        ) : workers.length === 0 ? (
                            <div className="glass rounded-[40px] p-16 text-center text-slate-600 font-bold italic border-dashed border-white/5">
                                {t.noWorker}
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {workers.map(worker => (
                                    <div
                                        key={worker.id}
                                        className={`glass p-5 rounded-[32px] border-white/5 transition-all tap-effect flex items-center justify-between group ${!worker.signed ? "hover:border-red-500/20" : "hover:border-green-500/20"
                                            }`}
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="relative">
                                                <img
                                                    src={`https://flagcdn.com/w80/${isoMap[worker.preferred_lang] || "un"}.png`}
                                                    alt={worker.preferred_lang}
                                                    className="w-12 h-8.5 object-cover rounded-xl shadow-lg border border-white/10"
                                                />
                                                {!worker.signed && (
                                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse" />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xl font-black text-white tracking-tight">{worker.display_name}</span>
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                                    <span>{worker.preferred_lang}</span>
                                                    {worker.signed && <span>• {new Date(worker.signed_at!).toLocaleTimeString()}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${worker.signed
                                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                                : "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse"
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${worker.signed ? "bg-green-500" : "bg-red-500"}`} />
                                            {worker.signed ? t.signed : t.unsigned}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </RoleGuard>
    );
}
