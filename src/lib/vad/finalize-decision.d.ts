export interface VadConfig {
    absoluteFloor: number;
    silenceMs: number;
    maxUtteranceMs: number;
    noiseEma: number;
    speechMargin: number;
    calibrationMs: number;
}

export interface VadState {
    noiseFloor: number;
    speechDetected: boolean;
    speechStartedAt: number;
    silenceStartedAt: number;
    calibrationUntil: number;
}

export type VadAction = "none" | "finalize" | "finalize-maxlen";

export interface VadStep extends VadState {
    threshold: number;
    action: VadAction;
}

export declare const VAD_DEFAULTS: VadConfig;
export declare const LIVE_CAPTURE: { minChunkMs: number; maxChunkMs: number; silenceMs: number };
export declare function canSendLiveChunk(speechDetected: boolean, contaminated: boolean): boolean;
export declare function createVadState(): VadState;
export declare function stepVad(state: VadState, rms: number, now: number, cfg?: VadConfig): VadStep;
