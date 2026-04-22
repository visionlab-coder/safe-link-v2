"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const STT_LANG_MAP: Record<string, string> = {
    ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN",
    th: "th-TH", uz: "uz-UZ", id: "id-ID", ja: "ja-JP", jp: "ja-JP",
    ph: "fil-PH", km: "km-KH", mn: "mn-MN", my: "my-MM",
    ne: "ne-NP", bn: "bn-BD", kk: "kk-KZ", ru: "ru-RU",
    fr: "fr-FR", es: "es-ES", ar: "ar-SA", hi: "hi-IN",
};

function getSTTLang(code: string): string {
    return STT_LANG_MAP[code] || code;
}

function getMediaMimeType(): string {
    if (typeof MediaRecorder === "undefined") return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) return "audio/ogg;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    return "audio/ogg";
}

async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export type STTErrorType = "mic_denied" | "network" | "api_error" | "stream_lost";

interface UseCloudSTTOptions {
    lang: string;
    onTranscript: (text: string) => void;
    onError?: (type: STTErrorType, message: string) => void;
    /** VAD가 음성 시작을 감지하는 즉시 호출 — STT 완료 전 파트너에게 조기 신호 전달용 */
    onSpeechStart?: () => void;
    chunkInterval?: number;
    /** 침묵 감지 ms — 이 시간 이상 조용하면 자동 전송 (기본 2000ms) */
    silenceDuration?: number;
    /** 실시간 통역 모드: Gemini 교정 스킵하여 지연 최소화 */
    live?: boolean;
}

/** 노이즈 환경(건설 현장)에 최적화된 오디오 제약조건 */
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
};

const FETCH_TIMEOUT = 8_000;
const MIN_CHUNK_SIZE = 2000;
const MAX_EMPTY_STREAK = 2;

/** 침묵 판정 RMS 임계값 (0~1) — 건설 현장 배경음 고려해 낮게 설정 */
const SILENCE_RMS_THRESHOLD = 0.015;

export function useCloudSTT({
    lang,
    onTranscript,
    onError,
    onSpeechStart,
    chunkInterval = 10_000,
    silenceDuration = 2000,
    live = false,
}: UseCloudSTTOptions) {
    const [isRecording, setIsRecording] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const activeRef = useRef(false);
    const cyclingRef = useRef(false);
    const mutedRef = useRef(false); // muted: 녹음은 유지하되 결과 버림 (TTS/파트너 발화 중)
    const langRef = useRef(lang);
    const onTranscriptRef = useRef(onTranscript);
    const onErrorRef = useRef(onError);
    const onSpeechStartRef = useRef(onSpeechStart);
    const emptyStreakRef = useRef(0);
    // prop refs: VAD 루프가 항상 최신 값을 읽음 (모드 전환 시 콜백 재생성 불필요)
    const silenceDurationRef = useRef(silenceDuration);
    const chunkIntervalRef   = useRef(chunkInterval);
    const liveRef            = useRef(live);

    // VAD (Voice Activity Detection) refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const vadFrameRef = useRef<number | null>(null);
    const silenceStartRef = useRef<number | null>(null);
    const maxChunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordingStartRef = useRef<number>(0);

    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);
    useEffect(() => { onSpeechStartRef.current = onSpeechStart; }, [onSpeechStart]);
    useEffect(() => { silenceDurationRef.current = silenceDuration; }, [silenceDuration]);
    useEffect(() => { chunkIntervalRef.current = chunkInterval; }, [chunkInterval]);
    useEffect(() => { liveRef.current = live; }, [live]);

    const stopVAD = useCallback(() => {
        if (vadFrameRef.current) { cancelAnimationFrame(vadFrameRef.current); vadFrameRef.current = null; }
        if (maxChunkTimerRef.current) { clearTimeout(maxChunkTimerRef.current); maxChunkTimerRef.current = null; }
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            audioCtxRef.current.close().catch(() => {});
        }
        audioCtxRef.current = null;
        analyserRef.current = null;
        silenceStartRef.current = null;
    }, []);

    const stopInternal = useCallback(() => {
        activeRef.current = false;
        stopVAD();
        if (recorderRef.current?.state === "recording") {
            recorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        emptyStreakRef.current = 0;
        cyclingRef.current = false;
    }, [stopVAD]);

    useEffect(() => {
        return () => { stopInternal(); };
    }, [stopInternal]);

    const acquireStream = useCallback(async (): Promise<MediaStream> => {
        try {
            return await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        } catch {
            return await navigator.mediaDevices.getUserMedia({ audio: true });
        }
    }, []);

    const ensureStream = useCallback(async (): Promise<boolean> => {
        if (streamRef.current?.active) return true;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        try {
            streamRef.current = await acquireStream();
            return true;
        } catch {
            onErrorRef.current?.("stream_lost", "마이크 연결이 끊어졌습니다. 다시 시도해주세요.");
            return false;
        }
    }, [acquireStream]);

    const sendChunk = useCallback(async (blob: Blob) => {
        if (blob.size < MIN_CHUNK_SIZE) return;
        if (mutedRef.current) return;

        if (!liveRef.current && emptyStreakRef.current >= MAX_EMPTY_STREAK) {
            emptyStreakRef.current = 0;
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        try {
            const base64 = await blobToBase64(blob);
            if (!base64) return;

            const res = await fetch("/api/stt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    audio: base64,
                    lang: getSTTLang(langRef.current),
                    mimeType: blob.type,
                    ...(liveRef.current && { live: true }),
                }),
                signal: controller.signal,
            });

            const data = await res.json();

            if (data.error) {
                onErrorRef.current?.("api_error", data.error);
                return;
            }

            if (data.transcript?.trim()) {
                emptyStreakRef.current = 0;
                // muted 상태(TTS 재생 중 / 파트너 발화 중)면 결과 버림
                if (!mutedRef.current) {
                    onTranscriptRef.current(data.transcript.trim());
                }
            } else {
                emptyStreakRef.current += 1;
            }
        } catch (e: unknown) {
            if (e instanceof DOMException && e.name === "AbortError") {
                onErrorRef.current?.("network", "네트워크가 불안정합니다. 재시도 중...");
            } else {
                console.error("[Cloud STT] Error:", e);
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }, []);

    // 녹음 시작 + VAD 루프
    const startCycle = useCallback(async () => {
        if (!activeRef.current || cyclingRef.current) return;
        cyclingRef.current = true;

        try {
            const streamOk = await ensureStream();
            if (!streamOk || !activeRef.current || !streamRef.current) return;

            const mimeType = getMediaMimeType();
            const recorder = new MediaRecorder(streamRef.current, { mimeType });
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };
            recorder.onstop = () => {
                if (chunks.length > 0) {
                    const blob = new Blob(chunks, { type: mimeType });
                    sendChunk(blob);
                }
                // 녹음 완료 후 active 상태면 다음 사이클 즉시 시작
                if (activeRef.current) {
                    cyclingRef.current = false;
                    startCycle();
                }
            };

            recorderRef.current = recorder;
            recorder.start();
            recordingStartRef.current = Date.now();

            // ── VAD 침묵 감지 시작 ──────────────────────────────────
            // 이전 VAD 정리
            if (vadFrameRef.current) { cancelAnimationFrame(vadFrameRef.current); vadFrameRef.current = null; }
            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
                audioCtxRef.current.close().catch(() => {});
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext as typeof AudioContext;
            const ctx = new AudioCtxCtor();
            audioCtxRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyserRef.current = analyser;
            const source = ctx.createMediaStreamSource(streamRef.current);
            source.connect(analyser);
            silenceStartRef.current = null;

            const floatBuf = new Float32Array(analyser.fftSize);
            let speechFiredThisCycle = false; // 사이클당 1회만 onSpeechStart 호출

            const vadLoop = () => {
                if (!activeRef.current || recorder.state !== "recording") return;

                analyser.getFloatTimeDomainData(floatBuf);
                let sum = 0;
                for (let i = 0; i < floatBuf.length; i++) sum += floatBuf[i] * floatBuf[i];
                const rms = Math.sqrt(sum / floatBuf.length);

                const now = Date.now();

                if (rms < SILENCE_RMS_THRESHOLD) {
                    // 침묵 감지
                    if (silenceStartRef.current === null) {
                        silenceStartRef.current = now;
                    } else if (now - silenceStartRef.current >= silenceDurationRef.current) {
                        // 침묵 지속시간 초과 → 전송
                        silenceStartRef.current = null;
                        if (recorder.state === "recording") recorder.stop();
                        return; // VAD 루프 중단 (onstop에서 새 사이클 시작)
                    }
                } else {
                    // 말소리 감지 → 침묵 타이머 리셋
                    silenceStartRef.current = null;
                    // 이번 사이클에서 첫 음성 감지 + muted 아닐 때 → 파트너에게 즉시 신호
                    if (!speechFiredThisCycle && !mutedRef.current) {
                        speechFiredThisCycle = true;
                        onSpeechStartRef.current?.();
                    }
                }

                vadFrameRef.current = requestAnimationFrame(vadLoop);
            };
            vadFrameRef.current = requestAnimationFrame(vadLoop);

            // 최대 청크 길이 안전장치 (말을 너무 길게 하는 경우)
            if (maxChunkTimerRef.current) clearTimeout(maxChunkTimerRef.current);
            maxChunkTimerRef.current = setTimeout(() => {
                if (activeRef.current && recorder.state === "recording") {
                    recorder.stop();
                }
            }, chunkIntervalRef.current);

        } finally {
            cyclingRef.current = false;
        }
    }, [sendChunk, ensureStream]);

    const toggle = useCallback(async () => {
        if (activeRef.current) {
            stopInternal();
            setIsRecording(false);
            return;
        }

        try {
            streamRef.current = await acquireStream();
            activeRef.current = true;
            emptyStreakRef.current = 0;
            setIsRecording(true);
            startCycle();
        } catch {
            onErrorRef.current?.("mic_denied", "마이크 권한을 허용해주세요.");
            setIsRecording(false);
        }
    }, [startCycle, acquireStream, stopInternal]);

    const mute   = useCallback(() => { mutedRef.current = true;  }, []);
    const unmute = useCallback(() => { mutedRef.current = false; }, []);

    return { isRecording, toggle, mute, unmute };
}
