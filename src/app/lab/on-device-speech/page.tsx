"use client";

import { Cpu, Download, LoaderCircle, Mic, MicOff, Play, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
    detectOnDeviceSpeechCapabilities,
    ON_DEVICE_STT_MODEL,
    ON_DEVICE_TTS_MODEL,
} from "@/utils/on-device-speech";
import { decodeRecordedAudio } from "@/utils/on-device-speech/audio";
import type {
    OnDeviceSpeechBackend,
    OnDeviceSpeechCapabilities,
    OnDeviceSpeechStatus,
    OnDeviceSttResult,
} from "@/utils/on-device-speech";

type SttWorkerEvent = {
    type: "status" | "progress" | "ready" | "result" | "error";
    status?: OnDeviceSpeechStatus;
    message?: string;
    progress?: number | null;
    transcript?: string;
    language?: string;
    processingMs?: number;
    backend?: OnDeviceSpeechBackend;
    modelId?: string;
};

type TtsWorkerEvent = {
    type: "status" | "progress" | "ready" | "result" | "error";
    message?: string;
    current?: number;
    total?: number;
    audio?: ArrayBuffer;
    durationSeconds?: number;
    processingMs?: number;
    backend?: OnDeviceSpeechBackend;
    voiceId?: string;
};

type VoiceId = "M1" | "M2" | "F1" | "F2";

const LANGUAGES = [
    ["ko", "한국어"],
    ["en", "English"],
    ["vi", "Tiếng Việt"],
    ["zh", "中文"],
    ["ja", "日本語"],
] as const;

const VOICES: Array<[VoiceId, string]> = [
    ["M1", "남성 1"],
    ["M2", "남성 2"],
    ["F1", "여성 1"],
    ["F2", "여성 2"],
];

export default function OnDeviceSpeechPage() {
    const sttWorkerRef = useRef<Worker | null>(null);
    const ttsWorkerRef = useRef<Worker | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioUrlRef = useRef<string | null>(null);

    const [capabilities, setCapabilities] = useState<OnDeviceSpeechCapabilities | null>(null);
    const [language, setLanguage] = useState("ko");

    const [sttStatus, setSttStatus] = useState<OnDeviceSpeechStatus>("checking");
    const [sttMessage, setSttMessage] = useState("실행 환경을 확인하고 있습니다.");
    const [sttProgress, setSttProgress] = useState<number | null>(null);
    const [recording, setRecording] = useState(false);
    const [sttResult, setSttResult] = useState<OnDeviceSttResult | null>(null);

    const [ttsStatus, setTtsStatus] = useState<OnDeviceSpeechStatus>("idle");
    const [ttsMessage, setTtsMessage] = useState("Supertonic 모델을 불러오면 합성할 수 있습니다.");
    const [ttsProgress, setTtsProgress] = useState<number | null>(null);
    const [ttsText, setTtsText] = useState("안전모를 반드시 착용해 주세요.");
    const [voiceId, setVoiceId] = useState<VoiceId>("M1");
    const [speed, setSpeed] = useState(1.15);
    const [qualitySteps, setQualitySteps] = useState(4);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [ttsStats, setTtsStats] = useState<{
        duration: number;
        processingMs: number;
        backend: OnDeviceSpeechBackend;
    } | null>(null);

    const backend = capabilities?.recommendedBackend ?? "wasm";

    useEffect(() => {
        const detected = detectOnDeviceSpeechCapabilities();
        const initialBackend = detected.recommendedBackend ?? "wasm";
        setCapabilities(detected);
        setSttStatus(detected.supported ? "idle" : "error");
        setSttMessage(detected.supported ? "모델을 불러오면 바로 녹음할 수 있습니다." : "지원 조건을 충족하지 못했습니다.");

        const sttWorker = new Worker(
            new URL("../../../workers/on-device-stt.worker.ts", import.meta.url),
            { type: "module" },
        );
        sttWorker.onmessage = (event: MessageEvent<SttWorkerEvent>) => {
            const data = event.data;
            if (data.type === "progress") {
                setSttStatus("downloading");
                setSttProgress(typeof data.progress === "number" ? data.progress : null);
                setSttMessage(data.progress == null ? "모델 파일을 내려받고 있습니다." : `모델 다운로드 ${Math.round(data.progress)}%`);
            } else if (data.type === "ready") {
                setSttStatus("ready");
                setSttProgress(null);
                setSttMessage("Whisper 모델 준비가 완료되었습니다.");
            } else if (data.type === "status") {
                setSttStatus(data.status ?? "loading");
                setSttMessage(data.message ?? "처리 중입니다.");
            } else if (data.type === "result") {
                setSttResult({
                    transcript: data.transcript ?? "",
                    language: data.language ?? "ko",
                    processingMs: data.processingMs ?? 0,
                    backend: data.backend ?? initialBackend,
                    modelId: data.modelId ?? ON_DEVICE_STT_MODEL.id,
                });
                setSttStatus("ready");
                setSttMessage("기기 내부 음성 인식이 완료되었습니다.");
            } else {
                setSttStatus("error");
                setSttMessage(data.message ?? "온디바이스 음성 인식에 실패했습니다.");
            }
        };
        sttWorkerRef.current = sttWorker;

        const ttsWorker = new Worker(
            new URL("../../../workers/on-device-tts.worker.ts", import.meta.url),
            { type: "module" },
        );
        ttsWorker.onmessage = (event: MessageEvent<TtsWorkerEvent>) => {
            const data = event.data;
            if (data.type === "progress") {
                setTtsStatus("loading");
                setTtsProgress(data.total ? Math.round(((data.current ?? 0) / data.total) * 100) : null);
                setTtsMessage(data.message ?? "Supertonic 모델을 처리하고 있습니다.");
            } else if (data.type === "ready") {
                setTtsStatus("ready");
                setTtsProgress(null);
                setTtsMessage(`${data.voiceId} 음색과 Supertonic 모델 준비가 완료되었습니다. (${data.backend?.toUpperCase()})`);
            } else if (data.type === "status") {
                setTtsStatus("running");
                setTtsMessage(data.message ?? "음성을 생성하고 있습니다.");
            } else if (data.type === "result" && data.audio) {
                if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
                const url = URL.createObjectURL(new Blob([data.audio], { type: "audio/wav" }));
                audioUrlRef.current = url;
                setAudioUrl(url);
                setTtsStats({
                    duration: data.durationSeconds ?? 0,
                    processingMs: data.processingMs ?? 0,
                    backend: data.backend ?? initialBackend,
                });
                setTtsStatus("ready");
                setTtsProgress(null);
                setTtsMessage("Supertonic 온디바이스 음성 합성이 완료되었습니다.");
            } else {
                setTtsStatus("error");
                setTtsProgress(null);
                setTtsMessage(data.message ?? "Supertonic 음성 합성에 실패했습니다.");
            }
        };
        ttsWorkerRef.current = ttsWorker;
        if (detected.supported) {
            setTtsStatus("loading");
            setTtsMessage("지연시간 단축을 위해 Supertonic 모델을 미리 준비하고 있습니다.");
            ttsWorker.postMessage({
                type: "load",
                backend: initialBackend,
                voiceId: "M1",
            });
        }

        return () => {
            sttWorker.postMessage({ type: "dispose" });
            ttsWorker.postMessage({ type: "dispose" });
            sttWorker.terminate();
            ttsWorker.terminate();
            streamRef.current?.getTracks().forEach((track) => track.stop());
            if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        };
    }, []);

    const loadSttModel = () => {
        setSttStatus("loading");
        setSttMessage("Whisper 모델을 초기화하고 있습니다.");
        sttWorkerRef.current?.postMessage({ type: "load", backend });
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            chunksRef.current = [];
            const recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data);
            };
            recorder.onstop = async () => {
                try {
                    setSttStatus("running");
                    setSttMessage("녹음 파일을 변환하고 있습니다.");
                    const audio = await decodeRecordedAudio(new Blob(chunksRef.current, { type: recorder.mimeType }));
                    sttWorkerRef.current?.postMessage(
                        { type: "transcribe", audio, language, backend },
                        [audio.buffer],
                    );
                } catch (error) {
                    setSttStatus("error");
                    setSttMessage(error instanceof Error ? error.message : "녹음 변환에 실패했습니다.");
                } finally {
                    stream.getTracks().forEach((track) => track.stop());
                }
            };
            recorderRef.current = recorder;
            recorder.start();
            setRecording(true);
            setSttResult(null);
            setSttMessage("녹음 중입니다. 문장을 말한 뒤 정지하세요.");
        } catch (error) {
            setSttStatus("error");
            setSttMessage(error instanceof Error ? error.message : "마이크를 시작할 수 없습니다.");
        }
    };

    const loadTtsModel = () => {
        setTtsStatus("loading");
        setTtsMessage("약 398MB의 Supertonic 모델을 불러오고 있습니다.");
        ttsWorkerRef.current?.postMessage({ type: "load", backend, voiceId });
    };

    const synthesize = () => {
        setTtsStatus("running");
        setTtsProgress(null);
        setTtsMessage("Supertonic 음성을 생성하고 있습니다.");
        setAudioUrl(null);
        setTtsStats(null);
        ttsWorkerRef.current?.postMessage({
            type: "synthesize",
            backend,
            voiceId,
            text: ttsText.trim(),
            language,
            speed,
            qualitySteps,
        });
    };

    const sttBusy = ["loading", "downloading", "running"].includes(sttStatus);
    const ttsBusy = ["loading", "downloading", "running"].includes(ttsStatus);

    return (
        <main className="min-h-screen bg-[#07100d] px-4 py-8 text-slate-100 sm:px-8">
            <div className="mx-auto max-w-5xl">
                <header className="border-b border-emerald-900/70 pb-5">
                    <p className="text-xs font-semibold text-emerald-400">SAFE-LINK AI LAB</p>
                    <h1 className="mt-2 text-2xl font-bold sm:text-3xl">온디바이스 STT / TTS 검증</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                        음성 데이터의 서버 전송 없이 브라우저 내부에서 인식하고 합성합니다.
                    </p>
                </header>

                <section className="mt-6 grid gap-3 sm:grid-cols-3">
                    <StatusItem label="권장 백엔드" value={backend.toUpperCase()} active={Boolean(capabilities?.supported)} />
                    <StatusItem label="WebGPU" value={capabilities?.webGpu ? "사용 가능" : "WASM 대체"} active={Boolean(capabilities?.webGpu)} />
                    <StatusItem label="마이크" value={capabilities?.mediaDevices ? "사용 가능" : "사용 불가"} active={Boolean(capabilities?.mediaDevices)} />
                </section>

                {capabilities?.warnings.map((warning) => (
                    <p key={warning} className="mt-3 border-l-2 border-amber-500 pl-3 text-sm text-amber-200">{warning}</p>
                ))}

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    <section className="border border-slate-800 bg-[#0b1713] p-5">
                        <PanelHeader title="STT 음성 인식" detail={`${ON_DEVICE_STT_MODEL.id} · Apache-2.0`} icon="stt" />
                        <LanguageSelect language={language} setLanguage={setLanguage} disabled={recording || sttBusy || ttsBusy} />

                        <div className="mt-4">
                            {sttStatus !== "ready" && !recording ? (
                                <ActionButton onClick={loadSttModel} disabled={!capabilities?.supported || sttBusy}>
                                    {sttBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                    모델 불러오기
                                </ActionButton>
                            ) : recording ? (
                                <ActionButton onClick={() => { recorderRef.current?.stop(); setRecording(false); }} danger>
                                    <Square className="h-4 w-4" /> 녹음 정지
                                </ActionButton>
                            ) : (
                                <ActionButton onClick={startRecording} disabled={!capabilities?.supported || sttStatus !== "ready"}>
                                    <Mic className="h-4 w-4" /> 녹음 시작
                                </ActionButton>
                            )}
                        </div>

                        <StatusBox message={sttMessage} progress={sttProgress} recording={recording} />
                        {sttResult && (
                            <div className="mt-4 border-l-2 border-emerald-500 bg-emerald-950/30 p-4">
                                <p className="leading-7">{sttResult.transcript || "(인식된 문장이 없습니다.)"}</p>
                                <p className="mt-3 text-xs text-slate-500">{sttResult.processingMs.toLocaleString()}ms · {sttResult.backend.toUpperCase()}</p>
                            </div>
                        )}
                    </section>

                    <section className="border border-slate-800 bg-[#0b1713] p-5">
                        <PanelHeader title="TTS 음성 합성" detail={`${ON_DEVICE_TTS_MODEL.id} · OpenRAIL-M`} icon="tts" />
                        <LanguageSelect language={language} setLanguage={setLanguage} disabled={ttsBusy || recording} />

                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <Control label="음색">
                                <select value={voiceId} onChange={(event) => setVoiceId(event.target.value as VoiceId)} disabled={ttsBusy} className="control">
                                    {VOICES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                </select>
                            </Control>
                            <Control label={`품질 단계 ${qualitySteps} ${qualitySteps === 4 ? "· 저지연" : ""}`}>
                                <input type="range" min={4} max={8} value={qualitySteps} onChange={(event) => setQualitySteps(Number(event.target.value))} disabled={ttsBusy} className="w-full" />
                            </Control>
                        </div>

                        <Control label={`속도 ${speed.toFixed(2)}`}>
                            <input type="range" min={0.9} max={1.5} step={0.05} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} disabled={ttsBusy} className="w-full" />
                        </Control>

                        <Control label="합성 문장">
                            <textarea value={ttsText} onChange={(event) => setTtsText(event.target.value)} rows={4} disabled={ttsBusy} className="control resize-none leading-6" />
                        </Control>

                        {ttsStatus !== "ready" ? (
                            <ActionButton onClick={loadTtsModel} disabled={!capabilities?.supported || ttsBusy}>
                                {ttsBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                Supertonic 모델 불러오기
                            </ActionButton>
                        ) : (
                            <ActionButton onClick={synthesize} disabled={!ttsText.trim() || ttsBusy}>
                                <Volume2 className="h-4 w-4" /> 온디바이스 음성 생성
                            </ActionButton>
                        )}

                        <StatusBox message={ttsMessage} progress={ttsProgress} />
                        {audioUrl && (
                            <div className="mt-4 border border-sky-900 bg-sky-950/20 p-3">
                                <audio controls src={audioUrl} className="w-full" />
                                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                                    <span>{ttsStats?.duration.toFixed(2)}초 · {ttsStats?.processingMs.toLocaleString()}ms · {ttsStats?.backend.toUpperCase()}</span>
                                    <a href={audioUrl} download="safe-link-supertonic.wav" className="font-bold text-sky-300">WAV 다운로드</a>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
            <style jsx global>{`
                .control {
                    width: 100%;
                    border: 1px solid rgb(51 65 85);
                    background: rgb(2 6 23);
                    padding: 0.625rem 0.75rem;
                    font-size: 0.875rem;
                }
            `}</style>
        </main>
    );
}

function PanelHeader({ title, detail, icon }: { title: string; detail: string; icon: "stt" | "tts" }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
            {icon === "stt" ? <Cpu className="h-5 w-5 text-emerald-400" /> : <Volume2 className="h-5 w-5 text-sky-400" />}
        </div>
    );
}

function LanguageSelect({ language, setLanguage, disabled }: { language: string; setLanguage: (value: string) => void; disabled: boolean }) {
    return (
        <Control label="언어">
            <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={disabled} className="control">
                {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
        </Control>
    );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
    return <label className="mt-4 block text-sm font-medium">{label}<span className="mt-2 block">{children}</span></label>;
}

function ActionButton({ children, onClick, disabled = false, danger = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} className={`flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "bg-red-600" : "bg-emerald-600"}`}>
            {children}
        </button>
    );
}

function StatusBox({ message, progress, recording = false }: { message: string; progress: number | null; recording?: boolean }) {
    return (
        <div className="mt-4 min-h-20 border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
                {recording ? <Mic className="h-4 w-4 text-red-400" /> : <MicOff className="h-4 w-4" />}
                {message}
            </div>
            {progress != null && <progress className="mt-3 h-2 w-full" max={100} value={progress} />}
        </div>
    );
}

function StatusItem({ label, value, active }: { label: string; value: string; active: boolean }) {
    return (
        <div className="border border-slate-800 bg-[#0b1713] px-4 py-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 text-sm font-bold ${active ? "text-emerald-300" : "text-slate-300"}`}>{value}</p>
        </div>
    );
}
