"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FlittoTranslation = Record<string, string>;

interface UseFlittoRTTOptions {
    hintLangs?: string[];
    targetLangs: string[];
    onTranscript: (text: string, translations?: FlittoTranslation) => void;
    onStatus?: (status: string) => void;
    onError?: (message: string) => void;
    tokenEndpoint?: string;
}

type FlittoTokenResponse = {
    url?: string;
    token?: string;
    error?: string;
};

type FlittoEvent = {
    event?: string;
    data?: {
        transcript_id?: string;
        text?: string;
        final_text?: string;
        non_final_text?: string;
        src_text?: string;
        language_code?: string;
        translation_list?: Array<{ lang_code?: string; text?: string }>;
    };
    error?: string;
};

const PCM_TARGET_SAMPLE_RATE = 16000;
const SEND_CHUNK_MS = 100;
const SPEECH_RMS_THRESHOLD = 0.012;        // absolute floor (quiet rooms)
const END_OF_SPEECH_SILENCE_MS = 800;
const FINISH_DEBOUNCE_MS = 250;
const NOISE_FLOOR_EMA = 0.05;              // ambient-noise tracking rate (per frame)
const SPEECH_MARGIN = 2.5;                 // speech must exceed ambient noise floor × this
const MAX_UTTERANCE_MS = 12000;            // force-finalize cap when no silence gap appears
const TRANSLATION_FALLBACK_MS = 1500;      // deliver source-only if `finish` never arrives

function convertFloatTo16BitPcm(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return buffer;
}

function downsampleTo16k(input: Float32Array, sourceSampleRate: number): Float32Array {
    if (sourceSampleRate === PCM_TARGET_SAMPLE_RATE) return input;
    if (sourceSampleRate < PCM_TARGET_SAMPLE_RATE) {
        throw new Error(`Unsupported sample rate: ${sourceSampleRate}`);
    }

    const ratio = sourceSampleRate / PCM_TARGET_SAMPLE_RATE;
    const newLength = Math.floor(input.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.floor((offsetResult + 1) * ratio);
        let accum = 0;
        let count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {
            accum += input[i];
            count++;
        }
        result[offsetResult] = count > 0 ? accum / count : 0;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }

    return result;
}

export function useFlittoRTT({
    hintLangs = ["ko"],
    targetLangs,
    onTranscript,
    onStatus,
    onError,
    tokenEndpoint = "/api/flitto/rtt-token",
}: UseFlittoRTTOptions) {
    const [isRecording, setIsRecording] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const activeRef = useRef(false);
    const serverStartRef = useRef(false);
    const pendingTranslationsRef = useRef<Map<string, FlittoTranslation>>(new Map());
    const finalTextsRef = useRef<Map<string, string>>(new Map());
    const finishTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const pcmQueueRef = useRef<ArrayBuffer[]>([]);
    const sendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const speechDetectedRef = useRef(false);
    const silenceStartedAtRef = useRef(0);
    const speechStartedAtRef = useRef(0);
    const noiseFloorRef = useRef(0);
    const stopSentRef = useRef(false);
    const targetLangsRef = useRef(targetLangs);
    const onTranscriptRef = useRef(onTranscript);
    const onStatusRef = useRef(onStatus);
    const onErrorRef = useRef(onError);

    useEffect(() => { targetLangsRef.current = targetLangs; }, [targetLangs]);
    useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
    useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    const stop = useCallback(() => {
        activeRef.current = false;
        serverStartRef.current = false;
        setIsRecording(false);

        if (sendTimerRef.current) {
            clearInterval(sendTimerRef.current);
            sendTimerRef.current = null;
        }
        pcmQueueRef.current = [];
        speechDetectedRef.current = false;
        silenceStartedAtRef.current = 0;
        speechStartedAtRef.current = 0;
        noiseFloorRef.current = 0;
        stopSentRef.current = false;
        for (const timer of finishTimersRef.current.values()) clearTimeout(timer);
        finishTimersRef.current.clear();

        try {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ event: "stop" }));
                wsRef.current.close(1000, "client stop");
            }
        } catch {}
        wsRef.current = null;

        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            audioContextRef.current.close().catch(() => {});
        }
        audioContextRef.current = null;

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        onStatusRef.current?.("stopped");
    }, []);

    useEffect(() => () => stop(), [stop]);

    const flushPcmQueue = useCallback(() => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !serverStartRef.current) return;
        const queue = pcmQueueRef.current;
        if (queue.length === 0) return;
        const chunks = queue.splice(0, queue.length);
        for (const chunk of chunks) {
            ws.send(chunk);
        }
    }, []);

    const restartStreaming = useCallback(() => {
        const ws = wsRef.current;
        if (!activeRef.current || !ws || ws.readyState !== WebSocket.OPEN || !stopSentRef.current) return;
        stopSentRef.current = false;
        speechDetectedRef.current = false;
        silenceStartedAtRef.current = 0;
        speechStartedAtRef.current = 0;
        ws.send(JSON.stringify({ event: "start" }));
        onStatusRef.current?.("restarting");
    }, []);

    const deliverFinal = useCallback((id: string, sourceText?: string, delayMs: number = FINISH_DEBOUNCE_MS) => {
        const existingTimer = finishTimersRef.current.get(id);
        if (existingTimer) clearTimeout(existingTimer);
        finishTimersRef.current.set(id, setTimeout(() => {
            finishTimersRef.current.delete(id);
            const text = sourceText || finalTextsRef.current.get(id);
            // Read translations at fire time: `finish` may have populated them after this
            // was scheduled. If still absent (translation never arrived), deliver source-only.
            const translations = pendingTranslationsRef.current.get(id);
            if (text) onTranscriptRef.current(text, translations);
            pendingTranslationsRef.current.delete(id);
            finalTextsRef.current.delete(id);
            restartStreaming();
        }, delayMs));
    }, [restartStreaming]);

    const startAudio = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });
        streamRef.current = stream;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext as typeof AudioContext;
        const ctx = new AudioContextCtor();
        audioContextRef.current = ctx;
        if (ctx.state === "suspended") {
            await ctx.resume();
        }

        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
            if (!activeRef.current || !serverStartRef.current) return;
            const input = event.inputBuffer.getChannelData(0);
            try {
                const downsampled = downsampleTo16k(input, ctx.sampleRate);
                pcmQueueRef.current.push(convertFloatTo16BitPcm(downsampled));

                let sum = 0;
                for (let index = 0; index < input.length; index += 1) {
                    sum += input[index] * input[index];
                }
                const rms = Math.sqrt(sum / Math.max(input.length, 1));
                const now = Date.now();
                // Adaptive end-of-speech: threshold tracks ambient noise so loud
                // construction sites don't keep the gate permanently "speaking".
                const speechThreshold = Math.max(SPEECH_RMS_THRESHOLD, noiseFloorRef.current * SPEECH_MARGIN);
                if (rms >= speechThreshold) {
                    if (!speechDetectedRef.current) speechStartedAtRef.current = now;
                    speechDetectedRef.current = true;
                    silenceStartedAtRef.current = 0;
                } else if (!speechDetectedRef.current) {
                    // Track ambient noise floor only between utterances (EMA).
                    noiseFloorRef.current = noiseFloorRef.current === 0
                        ? rms
                        : noiseFloorRef.current * (1 - NOISE_FLOOR_EMA) + rms * NOISE_FLOOR_EMA;
                } else if (!stopSentRef.current && !silenceStartedAtRef.current) {
                    silenceStartedAtRef.current = now;
                }

                if (speechDetectedRef.current && !stopSentRef.current) {
                    const silenceEnded = silenceStartedAtRef.current > 0
                        && now - silenceStartedAtRef.current >= END_OF_SPEECH_SILENCE_MS;
                    const tooLong = speechStartedAtRef.current > 0
                        && now - speechStartedAtRef.current >= MAX_UTTERANCE_MS;
                    if (silenceEnded || tooLong) {
                        flushPcmQueue();
                        wsRef.current?.send(JSON.stringify({ event: "stop" }));
                        stopSentRef.current = true;
                        serverStartRef.current = false;
                        onStatusRef.current?.(tooLong ? "finalizing-maxlen" : "finalizing");
                    }
                }
            } catch (error) {
                onErrorRef.current?.(error instanceof Error ? error.message : "PCM conversion failed");
            }
        };

        source.connect(processor);
        // Some browsers require a destination connection for ScriptProcessorNode callbacks.
        processor.connect(ctx.destination);

        sendTimerRef.current = setInterval(flushPcmQueue, SEND_CHUNK_MS);
    }, [flushPcmQueue]);

    const start = useCallback(async () => {
        if (activeRef.current) return;
        activeRef.current = true;
        setIsRecording(true);
        pendingTranslationsRef.current.clear();
        finalTextsRef.current.clear();
        onStatusRef.current?.("token");

        try {
            const tokenRes = await fetch(tokenEndpoint, { cache: "no-store" });
            const tokenData = await tokenRes.json() as FlittoTokenResponse;
            if (!tokenRes.ok || !tokenData.url || !tokenData.token) {
                throw new Error(tokenData.error || `Flitto token unavailable (${tokenRes.status})`);
            }

            const ws = new WebSocket(`${tokenData.url}?token=${encodeURIComponent(tokenData.token)}`);
            wsRef.current = ws;
            onStatusRef.current?.("connecting");

            ws.onopen = () => {
                onStatusRef.current?.("connect");
                ws.send(JSON.stringify({
                    event: "connect",
                    data: {
                        hint_lang_code_list: hintLangs,
                        tgt_lang_code_list: targetLangsRef.current,
                    },
                }));
            };

            ws.onmessage = async (message) => {
                let payload: FlittoEvent;
                try {
                    payload = JSON.parse(String(message.data)) as FlittoEvent;
                } catch {
                    return;
                }

                if (payload.event === "ready_for_transcript") {
                    onStatusRef.current?.("ready");
                    ws.send(JSON.stringify({ event: "start" }));
                    return;
                }

                if (payload.event === "start") {
                    serverStartRef.current = true;
                    speechDetectedRef.current = false;
                    silenceStartedAtRef.current = 0;
                    speechStartedAtRef.current = 0;
                    onStatusRef.current?.("recording");
                    if (!streamRef.current) await startAudio();
                    return;
                }

                if (payload.event === "transcript_end") {
                    const id = payload.data?.transcript_id;
                    const text = (payload.data?.text || payload.data?.final_text || "").trim();
                    if (id && text) {
                        finalTextsRef.current.set(id, text);
                        const translations = pendingTranslationsRef.current.get(id);
                        // If translation already arrived, deliver promptly; otherwise schedule
                        // a source-only fallback so a transcript is never lost when `finish`
                        // is delayed or dropped. A later `finish` reschedules with translations.
                        deliverFinal(id, text, translations ? FINISH_DEBOUNCE_MS : TRANSLATION_FALLBACK_MS);
                    }
                    return;
                }

                if (payload.event === "finish") {
                    const id = payload.data?.transcript_id;
                    if (!id) return;
                    const translations: FlittoTranslation = {};
                    for (const item of payload.data?.translation_list ?? []) {
                        if (item.lang_code && item.text) translations[item.lang_code] = item.text;
                    }
                    const srcText = payload.data?.src_text?.trim() || finalTextsRef.current.get(id);
                    pendingTranslationsRef.current.set(id, translations);
                    if (srcText) deliverFinal(id, srcText);
                    return;
                }

                if (payload.error) {
                    onErrorRef.current?.(payload.error);
                }
            };

            ws.onerror = () => {
                onErrorRef.current?.("Flitto RTT WebSocket error");
            };

            ws.onclose = (event) => {
                if (activeRef.current && event.code !== 1000) {
                    onErrorRef.current?.(`Flitto RTT closed (${event.code}${event.reason ? `: ${event.reason}` : ""})`);
                }
                if (activeRef.current) {
                    stop();
                }
            };
        } catch (error) {
            stop();
            onErrorRef.current?.(error instanceof Error ? error.message : "Flitto RTT start failed");
        }
    }, [deliverFinal, hintLangs, startAudio, stop, tokenEndpoint]);

    const toggle = useCallback(() => {
        if (activeRef.current) {
            stop();
            return;
        }
        start();
    }, [start, stop]);

    return { isRecording, toggle, start, stop };
}
