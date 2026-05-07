"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Shield, Users, ArrowLeft, Download, QrCode } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";

type Site = {
    id: string;
    name: string;
    code?: string | null;
    address?: string | null;
};

export default function QRDistributionPage() {
    const router = useRouter();
    const [baseUrl, setBaseUrl] = useState("");
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState("");
    const [loadingSites, setLoadingSites] = useState(true);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setBaseUrl(window.location.origin);
        }
    }, []);

    useEffect(() => {
        const loadSites = async () => {
            setLoadingSites(true);
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setLoadingSites(false);
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("role, site_id")
                .eq("id", session.user.id)
                .single();

            let siteRows: Site[] = [];

            if (profile?.role === "HQ_ADMIN" || profile?.role === "ROOT" || profile?.role === "HQ_OFFICER") {
                const { data } = await supabase
                    .from("sites")
                    .select("id, name, code, address")
                    .order("name", { ascending: true });
                siteRows = data || [];
            } else if (profile?.site_id) {
                const { data } = await supabase
                    .from("sites")
                    .select("id, name, code, address")
                    .eq("id", profile.site_id)
                    .limit(1);
                siteRows = data || [];
            }

            setSites(siteRows);
            setSelectedSiteId(profile?.site_id || siteRows[0]?.id || "");
            setLoadingSites(false);
        };

        loadSites();
    }, []);

    const selectedSite = sites.find((site) => site.id === selectedSiteId) || null;

    const buildRoleUrl = (role: "admin" | "worker") => {
        const base = `${baseUrl}/?role=${role}`;
        return selectedSiteId ? `${base}&site_id=${encodeURIComponent(selectedSiteId)}` : base;
    };

    const qrData = {
        admin: buildRoleUrl("admin"),
        worker: buildRoleUrl("worker"),
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
        } catch (error) {
            console.error("[QR] Download failed:", error);
            alert("QR 이미지 다운로드에 실패했습니다.");
        }
    };

    const handleCopyUrl = async (key: string, url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedKey(key);
            window.setTimeout(() => setCopiedKey(null), 1500);
        } catch (error) {
            console.error("[QR] Copy failed:", error);
            alert("URL 복사에 실패했습니다.");
        }
    };

    const qrs = [
        {
            key: "admin",
            title: "관리자/안전관리자 QR",
            desc: "선택한 현장에 연결된 관리자 진입 QR입니다. role=admin과 site_id를 함께 전달합니다.",
            url: qrData.admin,
            color: "blue",
            icon: <Shield className="w-8 h-8" />,
        },
        {
            key: "worker",
            title: "근로자 QR",
            desc: "선택한 현장에 연결된 근로자 진입 QR입니다. role=worker와 site_id를 함께 전달합니다.",
            url: qrData.worker,
            color: "emerald",
            icon: <Users className="w-8 h-8" />,
        },
    ];

    return (
        <RoleGuard allowedRole="admin">
            <main className="min-h-screen bg-[#070710] text-white p-6 md:p-12 font-sans selection:bg-purple-500/30">
                <div className="max-w-6xl mx-auto flex flex-col gap-10">
                    <header className="flex items-center gap-6">
                        <button
                            onClick={() => router.back()}
                            className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-lg active:scale-90"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="flex flex-col gap-1">
                            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase text-gradient">QR Distribution Center</h1>
                            <p className="text-slate-500 font-bold tracking-tight uppercase text-sm">PoC site-bound onboarding QR</p>
                        </div>
                    </header>

                    <section className="glass rounded-[40px] p-8 border-white/10 flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Site Binding</h2>
                            <p className="text-slate-400 font-bold text-sm">
                                현재 2.0 PoC에서는 QR에 `site_id`를 포함해야 현장별 진입이 정확합니다.
                            </p>
                        </div>

                        {loadingSites ? (
                            <div className="text-sm font-bold text-slate-500">현장 목록을 불러오는 중...</div>
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
                                        <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest">Selected Site</p>
                                        <p className="mt-1 text-lg font-black text-white">
                                            {selectedSite.code ? `[${selectedSite.code}] ` : ""}{selectedSite.name}
                                        </p>
                                        {selectedSite.address && (
                                            <p className="mt-1 text-sm font-bold text-slate-500">{selectedSite.address}</p>
                                        )}
                                        <p className="mt-2 text-xs font-mono text-slate-600">site_id={selectedSite.id}</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-300">
                                연결된 현장 정보가 없습니다. `sites` 또는 `profiles.site_id`를 먼저 확인해야 합니다.
                            </div>
                        )}
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {qrs.map((qr, idx) => (
                            <motion.section
                                key={qr.key}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="glass rounded-[48px] p-10 border-white/10 relative overflow-hidden flex flex-col gap-8 group"
                            >
                                <div className={`absolute top-0 right-0 w-64 h-64 bg-${qr.color}-500/10 blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none group-hover:bg-${qr.color}-500/20 transition-all duration-1000`} />

                                <div className="flex items-start justify-between relative">
                                    <div className="flex flex-col gap-3">
                                        <div className={`w-16 h-16 glass rounded-2xl flex items-center justify-center text-${qr.color}-400 mb-2 shadow-lg`}>
                                            {qr.icon}
                                        </div>
                                        <h3 className="text-3xl font-black text-white italic">{qr.title}</h3>
                                        <p className="text-slate-400 font-bold leading-relaxed max-w-sm">{qr.desc}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center gap-6 bg-white/5 p-10 rounded-[40px] border border-white/5 relative group-hover:bg-white/10 transition-colors">
                                    <div className="bg-white p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                        <Image
                                            src={getQrImageUrl(qr.url)}
                                            alt="QR Code"
                                            width={300}
                                            height={300}
                                            className="w-full h-auto"
                                            unoptimized
                                        />
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Target URL</p>
                                        <p className="text-xs font-mono text-blue-400 opacity-60 break-all text-center px-4">{qr.url}</p>
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-auto">
                                    <button
                                        onClick={() => handleDownload(qr.title, qr.url)}
                                        className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95"
                                    >
                                        <Download className="w-5 h-5" />
                                        Download Image
                                    </button>
                                    <button
                                        onClick={() => handleCopyUrl(qr.key, qr.url)}
                                        title="Copy target URL"
                                        className="w-16 py-5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl flex items-center justify-center transition-all active:scale-95"
                                    >
                                        <QrCode className="w-6 h-6" />
                                    </button>
                                </div>
                                {copiedKey === qr.key && (
                                    <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">URL copied</p>
                                )}
                            </motion.section>
                        ))}
                    </div>

                    <div className="glass rounded-[40px] p-8 border-dashed border-white/10 text-center">
                        <p className="text-slate-500 font-bold italic">
                            * 관리자와 근로자 QR 모두 현재 선택한 `site_id`를 포함합니다.<br />
                            * 현장마다 다른 QR을 배포해야 PoC 동안 사용자 현장 배정이 정확하게 유지됩니다.
                        </p>
                    </div>
                </div>
            </main>
        </RoleGuard>
    );
}
