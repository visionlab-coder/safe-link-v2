export { detectOnDeviceSpeechCapabilities } from "./capabilities";
export { decodeRecordedAudio, ON_DEVICE_STT_SAMPLE_RATE } from "./audio";
export {
    ON_DEVICE_SPEECH_DEFAULTS,
    ON_DEVICE_STT_MODEL,
    ON_DEVICE_TTS_MODEL,
    getOnDeviceSttModelId,
} from "./config";
export type {
    OnDeviceModelDescriptor,
    OnDeviceSpeechBackend,
    OnDeviceSpeechCapabilities,
    OnDeviceSpeechStatus,
    OnDeviceSttEngine,
    OnDeviceSttOptions,
    OnDeviceSttResult,
    OnDeviceTtsEngine,
    OnDeviceTtsOptions,
    OnDeviceTtsResult,
} from "./types";
