const TARGET_SAMPLE_RATE = 16000;

function mixToMono(buffer: AudioBuffer): Float32Array {
    const mono = new Float32Array(buffer.length);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const data = buffer.getChannelData(channel);
        for (let index = 0; index < data.length; index += 1) {
            mono[index] += data[index] / buffer.numberOfChannels;
        }
    }

    return mono;
}

function resampleLinear(
    input: Float32Array,
    sourceRate: number,
    targetRate: number,
): Float32Array {
    if (sourceRate === targetRate) return input;

    const ratio = sourceRate / targetRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);

    for (let index = 0; index < outputLength; index += 1) {
        const sourceIndex = index * ratio;
        const lower = Math.floor(sourceIndex);
        const upper = Math.min(lower + 1, input.length - 1);
        const weight = sourceIndex - lower;
        output[index] = input[lower] * (1 - weight) + input[upper] * weight;
    }

    return output;
}

export async function decodeRecordedAudio(blob: Blob): Promise<Float32Array> {
    const context = new AudioContext();

    try {
        const buffer = await context.decodeAudioData(await blob.arrayBuffer());
        return resampleLinear(mixToMono(buffer), buffer.sampleRate, TARGET_SAMPLE_RATE);
    } finally {
        await context.close();
    }
}

export const ON_DEVICE_STT_SAMPLE_RATE = TARGET_SAMPLE_RATE;
