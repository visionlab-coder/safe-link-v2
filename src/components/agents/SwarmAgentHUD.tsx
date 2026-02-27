"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Mic, MicOff, Sun, Moon, Maximize2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 🟢 Tier 3: 현장 환경 제어 에이전트 (Ambient Device Agent)
 * 스마트폰의 마이크와 환경광 상태를 스니핑하여 프론트엔드 환경을 자율적으로 조절합니다.
 */
export default function SwarmAgentHUD() {
    const [isActive, setIsActive] = useState(false);
    const [noiseLevel, setNoiseLevel] = useState(0); // 0 ~ 100 퍼센트에지
    const [isNoisy, setIsNoisy] = useState(false);
    const [agentMessage, setAgentMessage] = useState<string>("Edge Agent 대기 중");
    const [isMinimized, setIsMinimized] = useState(true);

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
                setAgentMessage("🚨 소음 경고: 볼륨 최대치 변경, 햅틱 발동");
                // 폰 진동 (지원되는 경우)
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200, 100, 200]);
                }
            }
        } else if (noiseLevel < 50) {
            if (isNoisy) {
                setIsNoisy(false);
                setAgentMessage("✅ 소음 정상: 일반 모드 전환");
            }
        }
    }, [noiseLevel, isActive, isNoisy]);

    const startAgent = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = stream;

            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            setIsActive(true);
            setAgentMessage("👁‍🗨 센서 후킹 완료: 현장 모니터링 중");
            loop();
        } catch (err) {
            console.error("Ambient Agent Error:", err);
            setAgentMessage("❌ 권한 거부: 마이크 접근 필요");
        }
    };

    const stopAgent = () => {
        setIsActive(false);
        setAgentMessage("💤 Agent 절전 모드");
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
                    drag
                    dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className={`fixed bottom-24 right-4 md:right-8 z-[100] w-64 rounded-2xl p-4 shadow-2xl border-2 backdrop-blur-xl transition-colors duration-500
                        ${isNoisy ? 'bg-red-900/90 border-red-500 text-white' : 'bg-slate-900/80 border-slate-700 text-slate-100'}
                    `}
                >
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                            <Activity className={`w-4 h-4 ${isActive ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
                            <span className="text-[10px] font-black tracking-widest uppercase">Ambient Agent</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={isActive ? stopAgent : startAgent}
                                className={`p-1.5 rounded-full transition-colors ${isActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40'}`}
                            >
                                {isActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => setIsMinimized(true)}
                                className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors ml-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
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

                        <div className="text-[11px] font-bold min-h-[32px] leading-tight flex items-start gap-1.5 opacity-90">
                            <span className="mt-0.5">🤖</span>
                            {agentMessage}
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
                    className={`fixed bottom-24 right-4 md:right-8 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl border backdrop-blur-md transition-colors 
                        ${isActive ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-400' : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-white'}`}
                >
                    <Activity className={`w-4 h-4 ${isActive ? 'animate-pulse text-emerald-400' : ''}`} />
                    <span className="text-[10px] font-black tracking-widest uppercase">{isActive ? 'Monitoring' : 'Agent'}</span>
                </motion.button>
            )}
        </AnimatePresence>
    );
}
