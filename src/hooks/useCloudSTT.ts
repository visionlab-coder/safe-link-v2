"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const STT_LANG_MAP: Record<string, string> = {
    ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN",
    th: "th-TH", uz: "uz-UZ", id: "id-ID", jp: "ja-JP",
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
    chunkInterval?: number;
}

/** 노이즈 환경(건설 현장)에 최적화된 오디오 제약조건 */
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
};

/** API 타임아웃 (ms) */
const FETCH_TIMEOUT = 15_000;

/** 최소 유효 청크 크기 (bytes) - 이 이하는 무음/소음만 포함 가능성 높음 */
const MIN_CHUNK_SIZE = 2000;

/** 연속 빈 응답 허용 횟수 - 초과 시 전송 스킵 */
const MAX_EMPTY_STREAK = 2;

export function useCloudSTT({
    lang,
    onTranscript,
    onError,
    chunkInterval = 10_000,
}: UseCloudSTTOptions) {
    const [isRecording, setIsRecording] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const activeRef = useRef(false);
    const cyclingRef = useRef(false);
    const langRef = useRef(lang);
    const onTranscriptRef = useRef(onTranscript);
    const onErrorRef = useRef(onError);
    const emptyStreakRef = useRef(0);

    // ref 동기화
    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    /** 녹음 중지 + 리소스 정리 (내부용) */
    const stopInternal = useCallback(() => {
        activeRef.current = false;
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (recorderRef.current?.state === "recording") {
            recorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        emptyStreakRef.current = 0;
        cyclingRef.current = false;
    }, []);

    // 컴포넌트 언마운트 시 자동 정리 (마이크 + 인터벌 누수 방지)
    useEffect(() => {
        return () => {
            stopInternal();
        };
    }, [stopInternal]);

    /** 마이크 스트림 획득 (실패 시 기본 제약조건으로 재시도) */
    const acquireStream = useCallback(async (): Promise<MediaStream> => {
        try {
            return await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        } catch {
            return await navigator.mediaDevices.getUserMedia({ audio: true });
        }
    }, []);

    /** 스트림 활성 상태 확인 + 비활성 시 재연결 */
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

        if (emptyStreakRef.current >= MAX_EMPTY_STREAK) {
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
                onTranscriptRef.current(data.transcript.trim());
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

    const startCycle = useCallback(async () => {
        // 사이클 겹침 방지
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
            };

            recorderRef.current = recorder;
            recorder.start();
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

            intervalRef.current = setInterval(() => {
                if (!activeRef.current) return;
                if (recorderRef.current?.state === "recording") {
                    recorderRef.current.stop();
                }
                startCycle();
            }, chunkInterval);
        } catch {
            onErrorRef.current?.("mic_denied", "마이크 권한을 허용해주세요.");
            setIsRecording(false);
        }
    }, [startCycle, chunkInterval, acquireStream, stopInternal]);

    return { isRecording, toggle };
}
