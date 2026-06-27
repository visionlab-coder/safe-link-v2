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
export declare function createVadState(): VadState;
export declare function stepVad(state: VadState, rms: number, now: number, cfg?: VadConfig): VadStep;
