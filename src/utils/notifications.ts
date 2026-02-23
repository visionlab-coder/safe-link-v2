/**
 * SAFE-LINK Notification Sound Utility
 * Uses Web Audio API to generate a clean, premium notification chime.
 */

export const playNotificationSound = () => {
    if (typeof window === 'undefined') return;

    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const now = ctx.currentTime;

        // Create a simple, elegant two-tone chime
        const playTone = (freq: number, start: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, start + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + duration);
        };

        // Chime: E5 -> A5 (Musical interval)
        playTone(659.25, now, 0.5); // E5
        playTone(880.00, now + 0.1, 0.6); // A5

    } catch (e) {
        console.warn("[Notification] Audio API failed:", e);
    }
};
