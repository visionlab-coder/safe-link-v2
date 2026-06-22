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
    const pcmQueueRef = useRef<ArrayBuffer[]>([]);
    const sendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
                    onStatusRef.current?.("recording");
                    await startAudio();
                    return;
                }

                if (payload.event === "transcript_end") {
                    const id = payload.data?.transcript_id;
                    const text = (payload.data?.text || payload.data?.final_text || "").trim();
                    if (id && text) {
                        finalTextsRef.current.set(id, text);
                        const translations = pendingTranslationsRef.current.get(id);
                        if (translations) {
                            pendingTranslationsRef.current.delete(id);
                            onTranscriptRef.current(text, translations);
                        }
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
                    if (srcText) {
                        onTranscriptRef.current(srcText, translations);
                    } else {
                        pendingTranslationsRef.current.set(id, translations);
                    }
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
    }, [hintLangs, startAudio, stop, tokenEndpoint]);

    const toggle = useCallback(() => {
        if (activeRef.current) {
            stop();
            return;
        }
        start();
    }, [start, stop]);

    return { isRecording, toggle, start, stop };
}
