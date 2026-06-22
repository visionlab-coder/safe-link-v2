/// <reference lib="webworker" />

import {
    configureRuntimeForLatency,
    loadTextToSpeech,
    loadVoiceStyle,
    writeWavFile,
    type Style,
    type TextToSpeech,
} from "@/utils/on-device-speech/supertonic-runtime.js";
import type { OnDeviceSpeechBackend } from "@/utils/on-device-speech/types";

const MODEL_ROOT = "https://huggingface.co/Supertone/supertonic-3/resolve/main";
const ONNX_ROOT = `${MODEL_ROOT}/onnx`;
const VOICE_ROOT = `${MODEL_ROOT}/voice_styles`;

type VoiceId = "M1" | "M2" | "F1" | "F2";

type WorkerRequest =
    | { type: "load"; backend: OnDeviceSpeechBackend; voiceId: VoiceId }
    | {
        type: "synthesize";
        backend: OnDeviceSpeechBackend;
        voiceId: VoiceId;
        text: string;
        language: string;
        speed: number;
        qualitySteps: number;
    }
    | { type: "dispose" };

let engine: TextToSpeech | null = null;
let loadedBackend: OnDeviceSpeechBackend | null = null;
let style: Style | null = null;
let loadedVoiceId: VoiceId | null = null;
let warmedUp = false;

configureRuntimeForLatency();

function send(type: string, payload: Record<string, unknown> = {}) {
    self.postMessage({ type, ...payload });
}

async function loadEngine(backend: OnDeviceSpeechBackend) {
    if (engine && loadedBackend === backend) return engine;

    await disposeEngine();
    let activeBackend = backend;
    let result;

    try {
        result = await createEngine(activeBackend);
    } catch (error) {
        if (backend !== "webgpu") throw error;
        activeBackend = "wasm";
        send("status", {
            message: "WebGPU 어댑터를 사용할 수 없어 WASM으로 다시 시도합니다.",
        });
        result = await createEngine(activeBackend);
    }

    engine = result.textToSpeech;
    loadedBackend = activeBackend;
    return engine;
}

function createEngine(backend: OnDeviceSpeechBackend) {
    return loadTextToSpeech(
        ONNX_ROOT,
        {
            executionProviders: [backend],
            graphOptimizationLevel: "all",
        },
        (modelName, current, total) => {
            send("progress", {
                phase: "model",
                current,
                total,
                message: `${modelName} 모델을 ${backend.toUpperCase()}으로 불러오는 중입니다.`,
            });
        },
    );
}

async function loadStyle(voiceId: VoiceId) {
    if (style && loadedVoiceId === voiceId) return style;
    send("progress", {
        phase: "voice",
        current: 1,
        total: 1,
        message: `${voiceId} 음색을 불러오는 중입니다.`,
    });
    style = await loadVoiceStyle([`${VOICE_ROOT}/${voiceId}.json`]);
    loadedVoiceId = voiceId;
    return style;
}

async function warmUp(activeEngine: TextToSpeech, activeStyle: Style) {
    if (warmedUp) return;
    send("status", { message: "첫 음성 지연을 줄이기 위해 모델을 워밍업하고 있습니다." });
    await activeEngine.call("안전.", "ko", activeStyle, 1, 1.2, 0);
    warmedUp = true;
}

async function disposeEngine() {
    if (engine) {
        await Promise.all([
            engine.dpOrt.release(),
            engine.textEncOrt.release(),
            engine.vectorEstOrt.release(),
            engine.vocoderOrt.release(),
        ]);
    }
    engine = null;
    loadedBackend = null;
    style = null;
    loadedVoiceId = null;
    warmedUp = false;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    try {
        if (event.data.type === "dispose") {
            await disposeEngine();
            return;
        }

        if (event.data.type === "load") {
            const activeEngine = await loadEngine(event.data.backend);
            const activeStyle = await loadStyle(event.data.voiceId);
            await warmUp(activeEngine, activeStyle);
            send("ready", {
                backend: loadedBackend,
                voiceId: loadedVoiceId,
                sampleRate: activeEngine.sampleRate,
            });
            return;
        }

        const startedAt = performance.now();
        const activeEngine = await loadEngine(event.data.backend);
        const activeStyle = await loadStyle(event.data.voiceId);
        send("status", { message: "Supertonic 음성을 생성하고 있습니다." });

        const { wav, duration } = await activeEngine.call(
            event.data.text,
            event.data.language,
            activeStyle,
            event.data.qualitySteps,
            event.data.speed,
            0.3,
            (step, total) => {
                send("progress", {
                    phase: "synthesis",
                    current: step,
                    total,
                    message: `음성 정제 ${step}/${total}`,
                });
            },
        );

        const wavLength = Math.floor(activeEngine.sampleRate * duration[0]);
        const wavBuffer = writeWavFile(wav.slice(0, wavLength), activeEngine.sampleRate);
        self.postMessage(
            {
                type: "result",
                audio: wavBuffer,
                durationSeconds: duration[0],
                processingMs: Math.round(performance.now() - startedAt),
                backend: loadedBackend,
                voiceId: loadedVoiceId,
                sampleRate: activeEngine.sampleRate,
            },
            { transfer: [wavBuffer] },
        );
    } catch (error) {
        send("error", {
            message: error instanceof Error ? error.message : "Supertonic 음성 합성에 실패했습니다.",
        });
    }
};

export {};
