/**
 * SAFE-LINK Premium STT Utility
 * Uses Google Cloud Speech-to-Text via internal Proxy
 */

export const transcribeAudio = async (blob: Blob, lang: string = 'ko-KR'): Promise<string> => {
    try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
        });
        reader.readAsDataURL(blob);
        const audioBase64 = await base64Promise;

        const response = await fetch('/api/stt', {
            method: 'POST',
            body: JSON.stringify({ audio: audioBase64, lang }),
            headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        return data.transcript || "";
    } catch (err) {
        console.error("[PremiumSTT] Error:", err);
        return "";
    }
};

/**
 * Creates a MediaRecorder instance optimized for STT
 */
export const createSTTRecorder = async (onData: (blob: Blob) => void) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) onData(e.data);
    };

    return recorder;
};
