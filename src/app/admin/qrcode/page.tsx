"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Shield, Users, ArrowLeft, Download, QrCode, Nfc, CheckCircle, AlertCircle, UserPlus } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";
import { detectNfcSupport, writeNfcUrl } from "@/utils/nfc/web-nfc";

type Site = {
    id: string;
    name: string;
    code?: string | null;
    address?: string | null;
};

type NfcStep = "idle" | "writing" | "done" | "error";

export default function QRDistributionPage() {
    const router = useRouter();
    const [baseUrl, setBaseUrl] = useState("");
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState("");
    const [loadingSites, setLoadingSites] = useState(true);

    // NFC 상태
    const [nfcWorkerName, setNfcWorkerName] = useState("");
    const [nfcStep, setNfcStep] = useState<NfcStep>("idle");
    const [nfcUrl, setNfcUrl] = useState("");
    const [nfcWorkerCode, setNfcWorkerCode] = useState("");
    const [nfcError, setNfcError] = useState("");
    const [nfcLoading, setNfcLoading] = useState(false);

    const nfcSupport = detectNfcSupport();

    useEffect(() => {
        if (typeof window !== "undefined") setBaseUrl(window.location.origin);
    }, []);

    useEffect(() => {
        const loadSites = async () => {
            setLoadingSites(true);
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { setLoadingSites(false); return; }

            const { data: profile } = await supabase
                .from("profiles")
                .select("role, site_id")
                .eq("id", session.user.id)
                .single();

            let siteRows: Site[] = [];
            if (profile?.role === "HQ_ADMIN" || profile?.role === "ROOT" || profile?.role === "HQ_OFFICER") {
                const { data } = await supabase.from("sites").select("id, name, code, address").order("name");
                siteRows = data || [];
            } else if (profile?.site_id) {
                const { data } = await supabase.from("sites").select("id, name, code, address").eq("id", profile.site_id).limit(1);
                siteRows = data || [];
            }

            setSites(siteRows);
            setSelectedSiteId(profile?.site_id || siteRows[0]?.id || "");
            setLoadingSites(false);
        };
        loadSites();
    }, []);

    const selectedSite = sites.find((s) => s.id === selectedSiteId) || null;

    const buildRoleUrl = (role: "admin" | "worker") => {
        const base = `${baseUrl}/?role=${role}`;
        return selectedSiteId ? `${base}&site_id=${encodeURIComponent(selectedSiteId)}` : base;
    };

    const getQrImageUrl = (url: string) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

    const handleDownload = async (title: string, url: string) => {
        try {
            const response = await fetch(getQrImageUrl(url));
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = `${title.replace(/[^a-zA-Z0-9]+/g, "_")}_qr.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
        } catch {
            alert("QR 이미지 다운로드에 실패했습니다.");
        }
    };

    const handleCopyUrl = async (key: string, url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedKey(key);
            window.setTimeout(() => setCopiedKey(null), 1500);
        } catch {
            alert("URL 복사에 실패했습니다.");
        }
    };

    // NFC 근로자 카드 발급
    const handleNfcIssue = async () => {
        const name = nfcWorkerName.trim();
        if (!name) { setNfcError("근로자 이름을 입력해주세요."); return; }
        setNfcError("");
        setNfcLoading(true);

        try {
            // 근로자 등록
            const regRes = await fetch("/api/nfc/workers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    full_name: name,
                    assigned_site_id: selectedSiteId || undefined,
                    consent_signed_at: new Date().toISOString(),
                    nationality: "KR",
                    trade: "general",
                    preferred_lang: "ko",
                }),
            });
            const regData = await regRes.json() as { worker?: { id: string; worker_code: string }; error?: string };
            if (!regRes.ok) { setNfcError(regData.error || "등록 실패"); setNfcLoading(false); return; }

            const workerId = regData.worker!.id;
            setNfcWorkerCode(regData.worker!.worker_code);

            // 스티커 URL 발급
            const issueRes = await fetch("/api/nfc/sticker/issue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ worker_id: workerId, revoke_previous: true }),
            });
            const issueData = await issueRes.json() as { url?: string; error?: string; detail?: string };
            if (!issueRes.ok) { setNfcError(issueData.detail || issueData.error || "URL 발급 실패"); setNfcLoading(false); return; }

            setNfcUrl(issueData.url!);
            setNfcLoading(false);

            // NFC 쓰기
            if (nfcSupport.supported) {
                setNfcStep("writing");
                await writeNfcUrl(issueData.url!);
                setNfcStep("done");
            } else {
                setNfcStep("done");
            }
        } catch {
            setNfcError("NFC 쓰기 실패. 아래 URL을 QR로 출력하세요.");
            setNfcStep("error");
            setNfcLoading(false);
        }
    };

    const resetNfc = () => {
        setNfcStep("idle");
        setNfcWorkerName("");
        setNfcUrl("");
        setNfcWorkerCode("");
        setNfcError("");
        setNfcLoading(false);
    };

    const qrs = [
        {
            key: "admin",
            title: "관리자 / 안전관리자 QR",
            desc: "현장에 부착. 관리자가 스캔하면 role=admin과 site_id를 함께 전달합니다.",
            url: buildRoleUrl("admin"),
            color: "blue",
            icon: <Shield className="w-8 h-8" />,
        },
        {
            key: "worker",
            title: "근로자 QR",
            desc: "현장에 부착. 근로자가 스캔하면 역할 선택 없이 바로 로그인 화면으로 진입합니다.",
            url: buildRoleUrl("worker"),
            color: "emerald",
            icon: <Users className="w-8 h-8" />,
        },
    ];

    return (
        <RoleGuard allowedRole="admin">
            <main className="min-h-screen bg-[#070710] text-white p-6 md:p-12 font-sans">
                <div className="max-w-6xl mx-auto flex flex-col gap-10">

                    {/* Header */}
                    <header className="flex items-center gap-6">
                        <button
                            onClick={() => router.back()}
                            className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-lg active:scale-90"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase text-gradient">Access Center</h1>
                            <p className="text-slate-500 font-bold tracking-tight uppercase text-sm">QR 배포 · NFC 카드 발급 통합</p>
                        </div>
                    </header>

                    {/* Site Binding */}
                    <section className="glass rounded-[40px] p-8 border-white/10 flex flex-col gap-4">
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">현장 설정</h2>
                            <p className="text-slate-400 font-bold text-sm mt-1">
                                선택한 현장이 QR과 NFC 카드 모두에 자동 적용됩니다.
                            </p>
                        </div>

                        {loadingSites ? (
                            <p className="text-sm font-bold text-slate-500">현장 목록 불러오는 중...</p>
                        ) : sites.length > 0 ? (
                            <>
                                <select
                                    value={selectedSiteId}
                                    onChange={(e) => setSelectedSiteId(e.target.value)}
                                    className="w-full bg-slate-900/70 border border-white/10 rounded-2xl px-4 py-4 text-white font-bold focus:outline-none focus:border-blue-500/40"
                                >
                                    {sites.map((site) => (
                                        <option key={site.id} value={site.id}>
                                            {site.code ? `[${site.code}] ` : ""}{site.name}
                                        </option>
                                    ))}
                                </select>
                                {selectedSite && (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest">선택된 현장</p>
                                        <p className="mt-1 text-lg font-black text-white">
                                            {selectedSite.code ? `[${selectedSite.code}] ` : ""}{selectedSite.name}
                                        </p>
                                        {selectedSite.address && (
                                            <p className="mt-1 text-sm font-bold text-slate-500">{selectedSite.address}</p>
                                        )}
                                        <p className="mt-2 text-xs font-mono text-slate-600">site_id = {selectedSite.id}</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-300">
                                연결된 현장이 없습니다. 프로필에서 현장명을 먼저 입력해주세요.
                                <button onClick={() => router.push("/auth/setup")} className="ml-2 underline">프로필 설정 →</button>
                            </div>
                        )}
                    </section>

                    {/* NFC 근로자 카드 발급 */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="glass rounded-[48px] p-10 border-white/10 hover:border-cyan-500/20 transition-all shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/5 blur-[120px] rounded-full -ml-48 -mt-48 pointer-events-none" />
                        <div className="relative flex flex-col gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center text-cyan-400 shadow-lg">
                                    <Nfc className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white uppercase italic">NFC 근로자 카드 발급</h2>
                                    <p className="text-slate-400 font-bold text-sm">이름 입력 → NFC 태그 쓰기. 근로자는 터치 후 국적만 선택합니다.</p>
                                </div>
                            </div>

                            {nfcStep === "idle" && (
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block">근로자 이름 (카드 라벨용)</label>
                                        <div className="flex gap-3">
                                            <input
                                                value={nfcWorkerName}
                                                onChange={(e) => setNfcWorkerName(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleNfcIssue()}
                                                placeholder="홍길동"
                                                className="flex-1 bg-slate-900/70 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold focus:outline-none focus:border-cyan-500/40 placeholder-slate-700"
                                            />
                                            <button
                                                onClick={handleNfcIssue}
                                                disabled={nfcLoading || !nfcWorkerName.trim()}
                                                className="px-6 py-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black rounded-2xl transition-all flex items-center gap-2 whitespace-nowrap"
                                            >
                                                <UserPlus className="w-4 h-4" />
                                                {nfcLoading ? "처리 중..." : nfcSupport.supported ? "발급 + NFC 쓰기" : "URL 발급"}
                                            </button>
                                        </div>
                                    </div>
                                    {nfcError && (
                                        <p className="text-red-400 text-sm font-bold">{nfcError}</p>
                                    )}
                                    {!nfcSupport.supported && (
                                        <p className="text-yellow-400/70 text-xs font-bold">
                                            이 기기는 Web NFC를 지원하지 않습니다. (Android Chrome + HTTPS 필요) URL만 발급됩니다.
                                        </p>
                                    )}
                                </div>
                            )}

                            {nfcStep === "writing" && (
                                <div className="flex flex-col items-center gap-4 py-6">
                                    <Nfc className="w-16 h-16 text-cyan-400 animate-pulse" />
                                    <p className="text-white font-black text-lg">NFC 카드를 기기에 가까이 대세요</p>
                                    <p className="text-slate-400 text-sm">URL을 기록 중입니다...</p>
                                </div>
                            )}

                            {(nfcStep === "done" || nfcStep === "error") && (
                                <div className="flex flex-col gap-4">
                                    <div className={`rounded-2xl p-5 border ${nfcStep === "done" ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                                        <div className="flex items-center gap-3 mb-3">
                                            {nfcStep === "done"
                                                ? <CheckCircle className="w-6 h-6 text-green-400" />
                                                : <AlertCircle className="w-6 h-6 text-red-400" />}
                                            <div>
                                                <p className="text-white font-black">{nfcStep === "done" ? "카드 발급 완료" : "NFC 쓰기 실패"}</p>
                                                <p className="text-slate-400 text-sm">근로자 코드: <span className="font-mono text-white">{nfcWorkerCode}</span></p>
                                            </div>
                                        </div>
                                        {nfcUrl && (
                                            <div className="bg-slate-900 rounded-xl p-3">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">발급 URL (QR 출력 가능)</p>
                                                <p className="text-xs font-mono text-cyan-400 break-all">{nfcUrl}</p>
                                            </div>
                                        )}
                                        {nfcStep === "error" && nfcError && (
                                            <p className="text-red-400 text-sm font-bold mt-2">{nfcError}</p>
                                        )}
                                        {nfcStep === "done" && !nfcSupport.supported && (
                                            <p className="text-yellow-400/70 text-xs font-bold mt-2">
                                                위 URL을 QR 코드로 출력하거나 별도 NFC 라이터로 기록하세요.
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={resetNfc} className="flex-1 bg-cyan-600 hover:bg-cyan-500 py-3 rounded-2xl font-black text-white transition-all">
                                            다음 카드 발급
                                        </button>
                                        {nfcUrl && (
                                            <button
                                                onClick={() => handleDownload(`NFC_${nfcWorkerCode}`, getQrImageUrl(nfcUrl))}
                                                className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-2xl font-black text-slate-300 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Download className="w-4 h-4" /> QR 출력
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.section>

                    {/* QR 배포 */}
                    <div className="flex flex-col gap-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight px-2">QR 배포 (현장 부착용)</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {qrs.map((qr, idx) => (
                                <motion.section
                                    key={qr.key}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + idx * 0.1 }}
                                    className="glass rounded-[48px] p-10 border-white/10 relative overflow-hidden flex flex-col gap-8 group"
                                >
                                    <div className={`absolute top-0 right-0 w-64 h-64 bg-${qr.color}-500/10 blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none group-hover:bg-${qr.color}-500/20 transition-all duration-1000`} />

                                    <div className="flex items-start justify-between relative">
                                        <div className="flex flex-col gap-3">
                                            <div className={`w-16 h-16 glass rounded-2xl flex items-center justify-center text-${qr.color}-400 mb-2 shadow-lg`}>
                                                {qr.icon}
                                            </div>
                                            <h3 className="text-2xl font-black text-white italic">{qr.title}</h3>
                                            <p className="text-slate-400 font-bold leading-relaxed max-w-sm text-sm">{qr.desc}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-6 bg-white/5 p-8 rounded-[40px] border border-white/5 group-hover:bg-white/10 transition-colors">
                                        <div className="bg-white p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                            <Image
                                                src={getQrImageUrl(qr.url)}
                                                alt="QR Code"
                                                width={240}
                                                height={240}
                                                className="w-full h-auto"
                                                unoptimized
                                            />
                                        </div>
                                        <p className="text-xs font-mono text-blue-400 opacity-60 break-all text-center px-2">{qr.url}</p>
                                    </div>

                                    <div className="flex gap-4 mt-auto">
                                        <button
                                            onClick={() => handleDownload(qr.title, qr.url)}
                                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                                        >
                                            <Download className="w-5 h-5" /> 다운로드
                                        </button>
                                        <button
                                            onClick={() => handleCopyUrl(qr.key, qr.url)}
                                            className="w-14 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl flex items-center justify-center transition-all active:scale-95"
                                        >
                                            <QrCode className="w-5 h-5" />
                                        </button>
                                    </div>
                                    {copiedKey === qr.key && (
                                        <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">URL 복사됨</p>
                                    )}
                                </motion.section>
                            ))}
                        </div>
                    </div>

                    <footer className="glass rounded-[40px] p-6 border-dashed border-white/10 text-center">
                        <p className="text-slate-500 font-bold text-sm">
                            * 근로자 QR: 스캔 시 역할 선택 없이 바로 로그인. 터치 NFC: 국적만 선택하면 완료.<br />
                            * 관리자 QR: 현장 소장/안전관리자용. 스캔 후 역할 선택 화면 표시.
                        </p>
                    </footer>
                </div>
            </main>
        </RoleGuard>
    );
}
