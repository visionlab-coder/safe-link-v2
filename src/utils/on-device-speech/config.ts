import type { OnDeviceModelDescriptor } from "./types";

export const ON_DEVICE_STT_MODEL: OnDeviceModelDescriptor = {
    id: "Xenova/whisper-tiny",
    task: "stt",
    runtime: "transformers-js",
    languages: ["ko", "en", "vi", "zh", "ja", "th", "id", "ru", "uz", "ne", "km", "my"],
    license: "Apache-2.0",
};

export const ON_DEVICE_TTS_MODEL: OnDeviceModelDescriptor = {
    id: "Supertone/supertonic-3",
    task: "tts",
    runtime: "supertonic",
    languages: [
        "ko", "en", "vi", "id", "ja", "ru", "hi", "fr", "es", "de",
        "it", "pt", "tr", "uk", "ar", "nl", "pl", "sv",
    ],
    license: "OpenRAIL-M",
    assetBaseUrl: "/models/supertonic-3",
};

export const ON_DEVICE_SPEECH_DEFAULTS = {
    stt: {
        sampleRate: 16000,
        chunkLengthSeconds: 6,
    },
    tts: {
        speed: 1.2,
        qualitySteps: 2,
    },
    fallback: {
        sttApi: "/api/stt",
        useExistingBrowserTts: true,
    },
} as const;
