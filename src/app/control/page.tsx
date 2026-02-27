"use client";
import { useEffect, useState, Suspense } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import HQCommandSwarm from "@/components/agents/HQCommandSwarm";
import SwarmVisualizer from "@/components/agents/SwarmVisualizer";

function ControlDashboardContent() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string; prefLang: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role, preferred_lang, display_name")
                    .eq("id", session.user.id)
                    .single();

                setCurrentUser({
                    name: profile?.display_name || "Manager",
                    email: session.user.email || "",
                    role: profile?.role || "HQ_ADMIN",
                    prefLang: profile?.preferred_lang || "ko",
                });
            }
        };
        load();
    }, []);

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
    };

    return (
        <RoleGuard allowedRole="hq">
            <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 flex flex-col gap-8 pb-12 font-sans selection:bg-indigo-500/30">

                {/* 💎 Premium Header */}
                <header className="flex justify-between items-start animate-float">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase text-gradient bg-gradient-to-r from-indigo-400 to-purple-500">Safe-Link</h1>
                            <div className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[10px] text-indigo-400 font-black tracking-widest leading-none">HQ CONTROL</span>
                            </div>
                        </div>
                        <p className="text-slate-400 font-bold text-lg leading-tight uppercase tracking-tight">
                            {currentUser ? `Welcome, ${currentUser.name}` : "Authenticating..."}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className="px-4 py-2 glass rounded-full border border-indigo-500/20 shadow-xl text-xs font-black tracking-widest uppercase text-indigo-400">
                            HQ Admin
                        </div>
                        <button onClick={handleSignOut} className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest py-1 transition-colors">
                            Sign out
                        </button>
                    </div>
                </header>

                <div className="flex flex-col gap-2 relative mt-4">
                    <h2 className="text-5xl font-black text-white text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600 tracking-tighter uppercase">Integrated Dashboard</h2>
                    <p className="text-slate-500 font-bold tracking-tight uppercase text-sm">Monitor overall site status and download evidence logs.</p>
                </div>

                {/* 🤖 Tier 1: HQ Command Swarm Intelligence */}
                <HQCommandSwarm lang={currentUser?.prefLang || 'ko'} />

                {/* 🌌 Swarm Live Feed (Proof of Scale) */}
                <SwarmVisualizer />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Placeholder Cards */}
                    <section className="glass rounded-[48px] p-10 border-white/5 shadow-3xl relative overflow-hidden flex flex-col gap-10 group bg-slate-900/40">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 blur-[80px] rounded-full -mr-24 -mt-24 pointer-events-none group-hover:bg-indigo-600/20 transition-all duration-1000" />
                        <div className="flex flex-col gap-4 relative">
                            <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-indigo-400 mb-2">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight italic">Site Statistics</h3>
                            <p className="text-slate-400 font-bold leading-relaxed">View overall TBM completion rates and active language usage.</p>
                        </div>
                    </section>

                    <section className="glass rounded-[48px] p-10 border-white/5 shadow-3xl relative overflow-hidden flex flex-col gap-10 group bg-slate-900/40">
                        <div className="absolute top-0 left-0 w-48 h-48 bg-purple-500/10 blur-[80px] rounded-full -ml-24 -mt-24 pointer-events-none group-hover:bg-purple-500/20 transition-all duration-1000" />
                        <div className="flex flex-col gap-4 relative">
                            <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-purple-400 mb-2">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight italic">Export Logs</h3>
                            <p className="text-slate-400 font-bold leading-relaxed">Download critical communication and TBM logs for audit and evidence.</p>
                        </div>
                    </section>
                </div>

                <footer className="mt-auto flex flex-col items-center gap-4 py-8">
                    <div className="flex items-center gap-2 opacity-10">
                        <div className="w-10 h-10 rounded-xl bg-white/20" />
                        <span className="font-black text-2xl italic text-white uppercase tracking-tighter">HQ Console</span>
                    </div>
                </footer>
            </div>
        </RoleGuard>
    );
}

export default function ControlDashboard() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
            <ControlDashboardContent />
        </Suspense>
    );
}
