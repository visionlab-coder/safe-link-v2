import type * as ort from "onnxruntime-web";

export class Style {
    ttl: ort.Tensor;
    dp: ort.Tensor;
}

export class TextToSpeech {
    sampleRate: number;
    dpOrt: ort.InferenceSession;
    textEncOrt: ort.InferenceSession;
    vectorEstOrt: ort.InferenceSession;
    vocoderOrt: ort.InferenceSession;
    call(
        text: string,
        lang: string,
        style: Style,
        totalStep: number,
        speed?: number,
        silenceDuration?: number,
        progressCallback?: (step: number, total: number) => void,
    ): Promise<{ wav: number[]; duration: number[] }>;
}

export function configureRuntimeForLatency(): void;

export function loadTextToSpeech(
    onnxDir: string,
    sessionOptions?: ort.InferenceSession.SessionOptions,
    progressCallback?: (modelName: string, current: number, total: number) => void,
): Promise<{ textToSpeech: TextToSpeech; cfgs: unknown }>;

export function loadVoiceStyle(
    voiceStylePaths: string[],
    verbose?: boolean,
): Promise<Style>;

export function writeWavFile(audioData: number[], sampleRate: number): ArrayBuffer;
