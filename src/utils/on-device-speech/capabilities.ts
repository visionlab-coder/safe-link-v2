import type { OnDeviceSpeechCapabilities } from "./types";

export function detectOnDeviceSpeechCapabilities(): OnDeviceSpeechCapabilities {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return {
            secureContext: false,
            webAssembly: false,
            webGpu: false,
            mediaDevices: false,
            audioWorklet: false,
            serviceWorker: false,
            indexedDb: false,
            recommendedBackend: null,
            supported: false,
            warnings: ["온디바이스 음성 기능은 브라우저에서만 사용할 수 있습니다."],
        };
    }

    const secureContext = window.isSecureContext;
    const webAssembly = typeof WebAssembly !== "undefined";
    const webGpu = "gpu" in navigator;
    const mediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);
    const audioWorklet = typeof AudioWorkletNode !== "undefined";
    const serviceWorker = "serviceWorker" in navigator;
    const indexedDb = typeof indexedDB !== "undefined";
    const warnings: string[] = [];

    if (!secureContext) warnings.push("마이크 사용과 모델 캐시에는 HTTPS 또는 localhost가 필요합니다.");
    if (!webGpu) warnings.push("WebGPU를 사용할 수 없어 WASM 모드로 실행합니다.");
    if (!mediaDevices) warnings.push("이 브라우저에서는 마이크 입력을 사용할 수 없습니다.");
    if (!serviceWorker || !indexedDb) {
        warnings.push("모델 영구 캐시가 제한되어 재접속 시 모델을 다시 받을 수 있습니다.");
    }

    const supported = secureContext && webAssembly && mediaDevices;

    return {
        secureContext,
        webAssembly,
        webGpu,
        mediaDevices,
        audioWorklet,
        serviceWorker,
        indexedDb,
        recommendedBackend: supported ? (webGpu ? "webgpu" : "wasm") : null,
        supported,
        warnings,
    };
}
