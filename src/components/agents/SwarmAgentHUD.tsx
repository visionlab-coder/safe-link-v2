"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Mic, MicOff, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type AgentStatus = "waiting" | "warning" | "normal" | "monitoring" | "permission" | "stopped";

const noiseLabels: Record<string, string> = {
    ko: "소음 감지",
    en: "Noise monitor",
    zh: "噪音监测",
    vi: "Đo tiếng ồn",
    th: "ตรวจจับเสียง",
    uz: "Shovqin nazorati",
    tl: "Pagsukat ng ingay",
    km: "តាមដានសំឡេង",
    mn: "Дуу чимээ",
    my: "ဆူညံသံစောင့်ကြည့်",
    ne: "आवाज निगरानी",
    bn: "শব্দ পর্যবেক্ষণ",
    kk: "Шуды бақылау",
    ru: "Контроль шума",
    ar: "مراقبة الضوضاء",
    hi: "शोर निगरानी",
    id: "Pantau kebisingan",
    ja: "騒音検知",
    fr: "Bruit ambiant",
    es: "Control de ruido",
};

/**
 * 🟢 Tier 3: 현장 환경 제어 에이전트 (Ambient Device Agent)
 * 스마트폰의 마이크와 환경광 상태를 스니핑하여 프론트엔드 환경을 자율적으로 조절합니다.
 */
export default function SwarmAgentHUD({ lang = "ko", placement = "default" }: { lang?: string; placement?: "default" | "worker-home" }) {
    const [isActive, setIsActive] = useState(false);
    const [noiseLevel, setNoiseLevel] = useState(0); // 0 ~ 100 퍼센트에지
    const [isNoisy, setIsNoisy] = useState(false);
    const [agentStatus, setAgentStatus] = useState<AgentStatus>("waiting");
    const [isMinimized, setIsMinimized] = useState(true);
    const noiseLabel = noiseLabels[lang] || noiseLabels.en;
    const agentMessage = agentStatus === "permission"
        ? "MIC · PERMISSION"
        : `${noiseLabel} · ${agentStatus === "warning" ? "HIGH" : agentStatus === "normal" ? "OK" : agentStatus === "monitoring" ? "ON" : agentStatus === "stopped" ? "OFF" : "READY"}`;

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const requestFrameRef = useRef<number | null>(null);

    // AI 자율 조작 트리거
    useEffect(() => {
        if (!isActive) return;

        // 소음도에 따른 반응
        if (noiseLevel > 75) {
            if (!isNoisy) {
                setIsNoisy(true);
                setAgentStatus("warning");
                // 폰 진동 (지원되는 경우)
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200, 100, 200]);
                }
            }
        } else if (noiseLevel < 50) {
            if (isNoisy) {
                setIsNoisy(false);
                setAgentStatus("normal");
            }
        }
    }, [noiseLevel, isActive, isNoisy]);

    const startAgent = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = stream;

            const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) {
                throw new Error("AudioContext not supported");
            }
            const audioCtx = new AudioContextCtor();
            audioContextRef.current = audioCtx;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            setIsActive(true);
            setAgentStatus("monitoring");
            loop();
        } catch (err) {
            console.error("Ambient Agent Error:", err);
            setAgentStatus("permission");
        }
    };

    const stopAgent = () => {
        setIsActive(false);
        setAgentStatus("stopped");
        if (requestFrameRef.current) cancelAnimationFrame(requestFrameRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(console.error);
        }
    };

    const loop = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // 평균 볼륨 계산 (간단한 RMS 시뮬레이션)
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const avg = sum / dataArray.length;

        // 대략 0 ~ 128 범위를 0 ~ 100%로 매핑
        const percentage = Math.min(100, Math.round((avg / 128) * 100));
        setNoiseLevel(percentage);

        requestFrameRef.current = requestAnimationFrame(loop);
    };

    // 정리(Cleanup)
    useEffect(() => {
        return () => {
            if (requestFrameRef.current) cancelAnimationFrame(requestFrameRef.current);
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(console.error);
            }
        };
    }, []);

    return (
        <AnimatePresence mode="wait">
            {!isMinimized ? (
                <motion.div
                    key="full-hud"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    style={{
                        insetInlineEnd: "calc(env(safe-area-inset-right, 0px) + 1rem)",
                        bottom: placement === "worker-home"
                            ? "calc(env(safe-area-inset-bottom, 0px) + 7rem)"
                            : "calc(env(safe-area-inset-bottom, 0px) + 4.25rem)",
                    }}
                    className={`fixed z-[100] w-56 rounded-2xl p-3 shadow-2xl border-2 backdrop-blur-xl transition-colors duration-500
                        ${isNoisy ? 'bg-red-900/90 border-red-500 text-white' : 'bg-slate-900/80 border-slate-700 text-slate-100'}
                    `}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 leading-none">
                                <Activity className={`block h-4 w-4 ${isActive ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
                            </span>
                            <span className="truncate text-[11px] font-black leading-none tracking-tight">{noiseLabel}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={isActive ? stopAgent : startAgent}
                                aria-label={`${noiseLabel} ${isActive ? "OFF" : "ON"}`}
                                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full p-0 transition-colors ${isActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40'}`}
                            >
                                {isActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsMinimized(true)}
                                aria-label={`${noiseLabel} close`}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 p-0 text-white transition-colors hover:bg-white/20"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="mt-2 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-black/50 rounded-full h-2.5 overflow-hidden">
                                <motion.div
                                    className={`h-full ${isNoisy ? 'bg-red-500' : 'bg-blue-400'}`}
                                    animate={{ width: `${noiseLevel}%` }}
                                    transition={{ type: "tween", ease: "linear", duration: 0.1 }}
                                />
                            </div>
                            <span className="text-[10px] font-bold w-8 text-right font-mono">{noiseLevel}%</span>
                        </div>

                        <div className="flex min-h-5 items-center gap-1.5 text-[10px] font-bold leading-none opacity-90">
                            <span aria-hidden="true">🤖</span>
                            <span className="truncate">{agentMessage}</span>
                        </div>
                    </div>

                    {isNoisy && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute -top-12 -left-4 bg-red-600 text-white text-[10px] uppercase font-black px-3 py-1.5 rounded-full shadow-lg border border-red-400 flex items-center gap-1 animate-bounce"
                        >
                            <ShieldAlert className="w-3 h-3" />
                            Extreme Noise Detected
                        </motion.div>
                    )}
                </motion.div>
            ) : (
                <motion.button
                    key="mini-hud"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => setIsMinimized(false)}
                    type="button"
                    aria-label={`${noiseLabel} ${isActive ? "ON" : "open"}`}
                    style={{
                        insetInlineEnd: "calc(env(safe-area-inset-right, 0px) + 1rem)",
                        bottom: placement === "worker-home"
                            ? "calc(env(safe-area-inset-bottom, 0px) + 7rem)"
                            : "calc(env(safe-area-inset-bottom, 0px) + 4.25rem)",
                    }}
                    className={`fixed z-[100] h-10 max-w-[11rem] whitespace-nowrap rounded-full border px-3 leading-none shadow-xl backdrop-blur-md transition-colors
                        ${isActive ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-400' : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-white'}`}
                >
                    <span className="flex h-full w-full items-center justify-center gap-2 leading-none">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                            <Activity className={`block h-4 w-4 ${isActive ? 'animate-pulse text-emerald-400' : ''}`} />
                        </span>
                        <span className="block truncate text-center text-[11px] font-black leading-none tracking-tight">
                            {noiseLabel}{isActive ? ' · ON' : ''}
                        </span>
                    </span>
                </motion.button>
            )}
        </AnimatePresence>
    );
}
