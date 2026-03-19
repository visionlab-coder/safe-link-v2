"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Shield, Users, ArrowLeft, Download, QrCode } from "lucide-react";

export default function QRDistributionPage() {
    const router = useRouter();
    const [baseUrl, setBaseUrl] = useState("");

    useEffect(() => {
        // 클라이언트 사이드에서 현재 호스트 도메인을 가져옴
        if (typeof window !== "undefined") {
            setBaseUrl(window.location.origin);
        }
    }, []);

    const qrData = {
        admin: `${baseUrl}/?role=admin`,
        worker: `${baseUrl}/?role=worker`,
    };

    const qrs = [
        {
            title: "관리자/안전관리용 (Admin/Officer)",
            desc: "현장소장 및 안전관리자 배포용 QR입니다. 역할을 설정하고 TBM을 관리할 수 있습니다.",
            url: qrData.admin,
            color: "blue",
            icon: <Shield className="w-8 h-8" />,
        },
        {
            title: "근로자용 (Worker)",
            desc: "현장 근로자 배포용 QR입니다. 스캔 즉시 회원가입 및 TBM 서명이 가능합니다.",
            url: qrData.worker,
            color: "emerald",
            icon: <Users className="w-8 h-8" />,
        },
    ];

    return (
        <main className="min-h-screen bg-[#070710] text-white p-6 md:p-12 font-sans selection:bg-purple-500/30">
            {/* Header */}
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
                        <p className="text-slate-500 font-bold tracking-tight uppercase text-sm">Onboard your team instantly</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {qrs.map((qr, idx) => (
                        <motion.section
                            key={idx}
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
                                    <p className="text-slate-400 font-bold leading-relaxed max-w-sm">
                                        {qr.desc}
                                    </p>
                                </div>
                            </div>

                            {/* QR Code Mirror */}
                            <div className="flex flex-col items-center gap-6 bg-white/5 p-10 rounded-[40px] border border-white/5 relative group-hover:bg-white/10 transition-colors">
                                <div className="bg-white p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                    <Image
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr.url)}`}
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
                                <button className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95">
                                    <Download className="w-5 h-5" />
                                    Download Image
                                </button>
                                <button className="w-16 py-5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl flex items-center justify-center transition-all active:scale-95">
                                    <QrCode className="w-6 h-6" />
                                </button>
                            </div>
                        </motion.section>
                    ))}
                </div>

                <div className="glass rounded-[40px] p-8 border-dashed border-white/10 text-center">
                    <p className="text-slate-500 font-bold italic">
                        * 휴대폰 카메라로 QR 코드를 스캔하면 별도의 앱 설치 없이 웹 버전으로 즉시 실행됩니다.<br />
                        * 현장 입구 또는 휴게실에 비치하여 근로자들이 쉽게 접속할 수 있도록 안내해 주세요.
                    </p>
                </div>
            </div>
        </main>
    );
}
