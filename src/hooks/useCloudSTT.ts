"use client";

import { useRef, useState, useCallback } from "react";

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

interface UseCloudSTTOptions {
    lang: string;
    onTranscript: (text: string) => void;
    chunkInterval?: number;
}

export function useCloudSTT({ lang, onTranscript, chunkInterval = 5000 }: UseCloudSTTOptions) {
    const [isRecording, setIsRecording] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const activeRef = useRef(false);
    const langRef = useRef(lang);
    const onTranscriptRef = useRef(onTranscript);

    langRef.current = lang;
    onTranscriptRef.current = onTranscript;

    const sendChunk = useCallback(async (blob: Blob) => {
        if (blob.size < 500) return;

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
            });
            const data = await res.json();
            if (data.transcript?.trim()) {
                onTranscriptRef.current(data.transcript.trim());
            }
        } catch (e) {
            console.error("[Cloud STT] Error:", e);
        }
    }, []);

    const startCycle = useCallback(() => {
        if (!streamRef.current || !activeRef.current) return;

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
    }, [sendChunk]);

    const toggle = useCallback(async () => {
        if (activeRef.current) {
            activeRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (recorderRef.current?.state === "recording") {
                recorderRef.current.stop();
            }
            setIsRecording(false);
            return;
        }

        try {
            if (!streamRef.current) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            activeRef.current = true;
            setIsRecording(true);
            startCycle();

            intervalRef.current = setInterval(() => {
                if (!activeRef.current) return;
                if (recorderRef.current?.state === "recording") {
                    recorderRef.current.stop();
                }
                startCycle();
            }, chunkInterval);
        } catch (e) {
            console.error("[Cloud STT] Mic access denied:", e);
            setIsRecording(false);
        }
    }, [startCycle, chunkInterval]);

    return { isRecording, toggle };
}
