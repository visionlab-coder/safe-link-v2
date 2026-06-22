/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers";
import { ON_DEVICE_STT_MODEL } from "@/utils/on-device-speech/config";
import type { OnDeviceSpeechBackend } from "@/utils/on-device-speech/types";

type WorkerRequest =
    | { type: "load"; backend: OnDeviceSpeechBackend }
    | {
        type: "transcribe";
        audio: Float32Array;
        language: string;
        backend: OnDeviceSpeechBackend;
    }
    | { type: "dispose" };

type ProgressInfo = {
    status?: string;
    progress?: number;
    file?: string;
};

let transcriber: Awaited<ReturnType<typeof pipeline<"automatic-speech-recognition">>> | null = null;
let loadedBackend: OnDeviceSpeechBackend | null = null;

env.allowLocalModels = false;
env.useBrowserCache = true;

function send(type: string, payload: Record<string, unknown> = {}) {
    self.postMessage({ type, ...payload });
}

async function loadModel(backend: OnDeviceSpeechBackend) {
    if (transcriber && loadedBackend === backend) return transcriber;

    if (transcriber) {
        await transcriber.dispose();
        transcriber = null;
    }

    send("status", { status: "loading", message: "Whisper 모델을 준비하고 있습니다." });
    transcriber = await pipeline(
        "automatic-speech-recognition",
        ON_DEVICE_STT_MODEL.id,
        {
            device: backend,
            dtype: backend === "webgpu" ? "fp32" : "q8",
            progress_callback: (info: ProgressInfo) => {
                send("progress", {
                    status: info.status ?? "downloading",
                    progress: typeof info.progress === "number" ? info.progress : null,
                    file: info.file ?? null,
                });
            },
        },
    );
    loadedBackend = backend;
    send("ready", { backend, modelId: ON_DEVICE_STT_MODEL.id });
    return transcriber;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    try {
        if (event.data.type === "load") {
            await loadModel(event.data.backend);
            return;
        }

        if (event.data.type === "dispose") {
            await transcriber?.dispose();
            transcriber = null;
            loadedBackend = null;
            return;
        }

        const startedAt = performance.now();
        const model = await loadModel(event.data.backend);
        send("status", { status: "running", message: "녹음 내용을 분석하고 있습니다." });

        const output = await model(event.data.audio, {
            language: event.data.language,
            task: "transcribe",
            return_timestamps: false,
        });
        const result = Array.isArray(output) ? output[0] : output;

        send("result", {
            transcript: result.text.trim(),
            language: event.data.language,
            processingMs: Math.round(performance.now() - startedAt),
            backend: event.data.backend,
            modelId: ON_DEVICE_STT_MODEL.id,
        });
    } catch (error) {
        send("error", {
            message: error instanceof Error ? error.message : "음성 인식 중 알 수 없는 오류가 발생했습니다.",
        });
    }
};

export {};
