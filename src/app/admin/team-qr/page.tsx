"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Hammer, RefreshCw } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { TRADE_LABEL, type TradeType } from "@/lib/roles";
import { QRCodeCanvas } from "qrcode.react";
import Image from "next/image";

// 🆕 2026-06-09 — 사이트+공종 QR 생성 페이지
//
// 흐름:
//   1. /api/auth/me 로 본인 profile 가져옴 (role, site_id, trade)
//   2. TEAM_LEADER → 본인 site_id + trade 자동 박힘 (변경 불가)
//   3. SAFETY_OFFICER/SITE_ADMIN → 본인 site_id 고정 + trade dropdown 선택 가능
//   4. HQ_ADMIN/ROOT/SUPER_ADMIN → site + trade 둘 다 dropdown
//   5. URL: /qr/site?site_id={spring-site-id}&trade={code}&lang=ko
//   6. QR 이미지 다운로드 / URL 복사 / Native NFC 발급 (Web NFC 지원 시)

type Site = { id: string; name: string; site_code?: string | null };

type Me = {
    user: { id: string; email: string | null };
    profile: {
        role: string;
        site_id: string | null;
        trade?: string | null;
        display_name: string | null;
    } | null;
};

const TRADE_KEYS: TradeType[] = [
    "rebar", "formwork", "concrete", "scaffold", "electrical",
    "mep", "finishing", "earthwork", "structural", "general",
];

export default function TeamQrPage() {
    const router = useRouter();

    const [me, setMe] = useState<Me | null>(null);
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string>("");
    const [selectedTrade, setSelectedTrade] = useState<TradeType>("general");
    const [baseUrl, setBaseUrl] = useState<string>("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setBaseUrl(window.location.origin);
        (async () => {
            const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
            if (!res.ok) return;
            const data = (await res.json()) as Me;
            setMe(data);

            const role = (data.profile?.role ?? "").toUpperCase();
            const isGlobal = ["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER"].includes(role);

            // 본인 trade 고정 (TEAM_LEADER)
            if (data.profile?.trade && TRADE_KEYS.includes(data.profile.trade as TradeType)) {
                setSelectedTrade(data.profile.trade as TradeType);
            }

            const sitesRes = await fetch("/api/sites/options", { credentials: "include", cache: "no-store" });
            const siteData = sitesRes.ok
                ? await sitesRes.json() as { sites?: Site[] }
                : { sites: [] };
            const siteRows = siteData.sites ?? [];
            setSites(siteRows);

            const profileSiteId = data.profile?.site_id ?? "";
            if (!isGlobal && profileSiteId) {
                setSelectedSiteId(profileSiteId);
            } else {
                setSelectedSiteId(profileSiteId || siteRows[0]?.id || "");
            }
        })();
    }, []);

    const role = (me?.profile?.role ?? "").toUpperCase();
    const isTeamLeader = role === "TEAM_LEADER";
    const isGlobalAdmin = ["ROOT", "SUPER_ADMIN", "HQ_ADMIN", "HQ_OFFICER"].includes(role);

    const selectedSite = sites.find((s) => s.id === selectedSiteId);
    const qrUrl = selectedSiteId
        ? `${baseUrl}/qr/site?site_id=${encodeURIComponent(selectedSiteId)}&trade=${selectedTrade}&lang=ko`
        : "";
    const handleCopy = async () => {
        if (!qrUrl) return;
        await navigator.clipboard.writeText(qrUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleDownload = async () => {
        if (!qrUrl) return;
        try {
            const canvas = document.getElementById("team-qr-canvas");
            if (!(canvas instanceof HTMLCanvasElement)) throw new Error("qr_canvas_not_found");
            const a = document.createElement("a");
            a.href = canvas.toDataURL("image/png");
            a.download = `qr_${selectedSite?.site_code ?? "site"}_${selectedTrade}.png`;
            a.click();
        } catch {
            alert("QR 이미지 다운로드에 실패했습니다.");
        }
    };

    return (
        <RoleGuard allowedRole="admin">
            <main className="visualization-light min-h-screen p-6 md:p-12 font-sans">
                <div className="max-w-3xl mx-auto flex flex-col gap-8">
                    {/* Header */}
                    <header className="concept-page-header">
                        <button
                            onClick={() => router.back()}
                            className="w-11 h-11 glass rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <span className="text-base font-black tracking-tight text-[#063789]">SQ-LINK</span>
                    </header>

                    <div className="admin-concept-hero relative h-44 w-full overflow-hidden">
                        <picture>
                            <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/nfc-qr.webp" />
                            <Image src="/images/mobile-v3/website/nfc-qr.webp" alt="팀별 QR 생성" fill className="object-cover" priority />
                        </picture>
                        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
                        <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
                            <p className="text-[10px] font-black tracking-[.18em] text-blue-200">SQ-LINK TEAM ACCESS</p>
                            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">팀별 QR 생성</h1>
                            <p className="mt-2 text-sm font-bold text-slate-100">
                                {isTeamLeader
                                    ? "본인 현장과 공종이 자동 설정됩니다. QR 스캔 시 근로자가 자동 배속됩니다."
                                    : isGlobalAdmin
                                      ? "현장과 공종을 선택해 팀별 QR을 생성합니다."
                                      : "본인 현장의 공종을 선택해 팀별 QR을 생성합니다."}
                            </p>
                        </div>
                    </div>

                    {/* 본인 정보 */}
                    <section className="glass rounded-3xl p-6 border border-white/10 flex flex-col gap-4">
                        <h2 className="text-xs font-black tracking-widest text-slate-500 uppercase">로그인 정보</h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-slate-500 text-xs">이름</p>
                                <p className="font-bold">{me?.profile?.display_name ?? "..."}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs">역할</p>
                                <p className="font-bold">{role || "..."}</p>
                            </div>
                            {me?.profile?.site_id && (
                                <div>
                                    <p className="text-slate-500 text-xs">소속 현장</p>
                                    <p className="font-bold">{sites.find((s) => s.id === me.profile?.site_id)?.name ?? "..."}</p>
                                </div>
                            )}
                            {me?.profile?.trade && (
                                <div>
                                    <p className="text-slate-500 text-xs">소속 팀</p>
                                    <p className="font-bold">{TRADE_LABEL[me.profile.trade as TradeType] ?? me.profile.trade}</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 현장 선택 — 글로벌 admin 만 변경 가능 */}
                    <section className="glass rounded-3xl p-6 border border-white/10 flex flex-col gap-4">
                        <h2 className="text-xs font-black tracking-widest text-slate-500 uppercase">현장</h2>
                        <select
                            value={selectedSiteId}
                            onChange={(e) => setSelectedSiteId(e.target.value)}
                            disabled={!isGlobalAdmin}
                            className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none disabled:opacity-60"
                        >
                            <option value="">선택…</option>
                            {sites.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}{s.site_code ? ` · ${s.site_code}` : ""}
                                </option>
                            ))}
                        </select>
                    </section>

                    {/* 공종 선택 — TEAM_LEADER 만 disabled */}
                    <section className="glass rounded-3xl p-6 border border-white/10 flex flex-col gap-4">
                        <h2 className="text-xs font-black tracking-widest text-slate-500 uppercase">공종 (팀)</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {TRADE_KEYS.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => !isTeamLeader && setSelectedTrade(t)}
                                    disabled={isTeamLeader && selectedTrade !== t}
                                    className={`px-4 py-3 rounded-2xl font-bold text-sm transition-all border ${
                                        selectedTrade === t
                                            ? "bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-500/30"
                                            : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                                    } ${isTeamLeader && selectedTrade !== t ? "opacity-30 cursor-not-allowed" : ""}`}
                                >
                                    <Hammer className="w-3.5 h-3.5 inline mr-1.5" />
                                    {TRADE_LABEL[t]}
                                </button>
                            ))}
                        </div>
                        {isTeamLeader && (
                            <p className="text-xs text-amber-400/70">
                                팀장은 본인 팀의 QR 만 생성할 수 있습니다. (보안 정책)
                            </p>
                        )}
                    </section>

                    {/* QR 결과 */}
                    {qrUrl && (
                        <section className="glass rounded-3xl p-8 border border-white/10 flex flex-col items-center gap-6">
                            <h2 className="text-xs font-black tracking-widest text-blue-300 uppercase">팀 QR</h2>
                            <p className="text-center text-lg font-black">
                                {selectedSite?.name} · {TRADE_LABEL[selectedTrade]}
                            </p>
                            <div className="bg-white p-5 rounded-3xl shadow-2xl">
                                <QRCodeCanvas
                                    id="team-qr-canvas"
                                    value={qrUrl}
                                    size={320}
                                    level="M"
                                    marginSize={1}
                                />
                            </div>
                            <div className="w-full bg-slate-950 rounded-xl p-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    QR URL
                                </p>
                                <p className="text-xs font-mono text-cyan-400 break-all">{qrUrl}</p>
                            </div>
                            <div className="flex flex-wrap gap-3 w-full">
                                <button
                                    onClick={handleDownload}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all"
                                >
                                    <Download className="w-4 h-4" /> QR 다운로드
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className={`flex-1 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all ${
                                        copied ? "bg-green-600" : "bg-white/5 hover:bg-white/10"
                                    }`}
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    {copied ? "복사됨!" : "URL 복사"}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 text-center max-w-md">
                                근로자가 이 QR 을 스캔하면 자동으로 <strong className="text-blue-300">{selectedSite?.name}</strong> 의{" "}
                                <strong className="text-blue-300">{TRADE_LABEL[selectedTrade]}</strong> 으로 배속됩니다.
                                기존 trade 가 &apos;general&apos; 인 경우에만 자동 변경되며, 명시적 trade 가 이미 있는 경우 보존됩니다.
                            </p>
                        </section>
                    )}
                </div>
            </main>
        </RoleGuard>
    );
}
