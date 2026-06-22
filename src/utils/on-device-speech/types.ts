export type OnDeviceSpeechBackend = "webgpu" | "wasm";

export type OnDeviceSpeechStatus =
    | "idle"
    | "checking"
    | "downloading"
    | "loading"
    | "ready"
    | "running"
    | "error";

export interface OnDeviceSpeechCapabilities {
    secureContext: boolean;
    webAssembly: boolean;
    webGpu: boolean;
    mediaDevices: boolean;
    audioWorklet: boolean;
    serviceWorker: boolean;
    indexedDb: boolean;
    recommendedBackend: OnDeviceSpeechBackend | null;
    supported: boolean;
    warnings: string[];
}

export interface OnDeviceModelDescriptor {
    id: string;
    task: "stt" | "tts";
    runtime: "transformers-js" | "supertonic";
    languages: string[];
    license: string;
    assetBaseUrl?: string;
}

export interface OnDeviceSttOptions {
    language: string;
    sampleRate?: number;
    chunkLengthSeconds?: number;
    backend?: OnDeviceSpeechBackend;
}

export interface OnDeviceSttResult {
    transcript: string;
    language: string;
    processingMs: number;
    backend: OnDeviceSpeechBackend;
    modelId: string;
}

export interface OnDeviceTtsOptions {
    language: string;
    voiceId?: string;
    speed?: number;
    qualitySteps?: number;
    backend?: OnDeviceSpeechBackend;
}

export interface OnDeviceTtsResult {
    audio: Float32Array;
    sampleRate: number;
    durationSeconds: number;
    processingMs: number;
    backend: OnDeviceSpeechBackend;
    modelId: string;
}

export interface OnDeviceSttEngine {
    readonly model: OnDeviceModelDescriptor;
    load(options?: { backend?: OnDeviceSpeechBackend }): Promise<void>;
    transcribe(audio: Float32Array, options: OnDeviceSttOptions): Promise<OnDeviceSttResult>;
    dispose(): Promise<void>;
}

export interface OnDeviceTtsEngine {
    readonly model: OnDeviceModelDescriptor;
    load(options?: { backend?: OnDeviceSpeechBackend }): Promise<void>;
    synthesize(text: string, options: OnDeviceTtsOptions): Promise<OnDeviceTtsResult>;
    dispose(): Promise<void>;
}
