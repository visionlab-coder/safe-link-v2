// Pure, side-effect-free VAD (voice activity detection) finalize decision.
// Extracted from useFlittoRTT so the end-of-speech state machine can be unit
// tested without a microphone (see scripts/vad-decision-test.mjs).

/** @typedef {Object} VadConfig
 * @property {number} absoluteFloor  Minimum speech RMS (quiet rooms).
 * @property {number} silenceMs      Silence after speech to finalize.
 * @property {number} maxUtteranceMs Force-finalize cap when no silence gap appears.
 * @property {number} noiseEma       Ambient-noise EMA rate per frame (0..1).
 * @property {number} speechMargin   Speech must exceed ambient noise floor x this.
 * @property {number} calibrationMs  Initial window that only learns ambient noise.
 */

/** @type {VadConfig} */
export const VAD_DEFAULTS = {
    absoluteFloor: 0.012,
    silenceMs: 800,
    maxUtteranceMs: 12000,
    noiseEma: 0.05,
    speechMargin: 2.5,
    calibrationMs: 400,
};

/** @typedef {Object} VadState
 * @property {number} noiseFloor
 * @property {boolean} speechDetected
 * @property {number} speechStartedAt
 * @property {number} silenceStartedAt
 * @property {number} calibrationUntil  0 until the first frame primes it.
 */

/** Fresh VAD state for a new capture session. @returns {VadState} */
export function createVadState() {
    return {
        noiseFloor: 0,
        speechDetected: false,
        speechStartedAt: 0,
        silenceStartedAt: 0,
        calibrationUntil: 0,
    };
}

/**
 * Advance the VAD one audio frame. Returns the next state plus an `action`:
 * "none" | "finalize" (silence gap) | "finalize-maxlen" (cap hit).
 *
 * Ambient noise is learned during an initial calibration window AND on every
 * non-speech frame thereafter (including the post-speech silence), so loud
 * constant-noise sites raise the threshold instead of latching "speaking"
 * forever. Quiet rooms keep the absolute floor.
 *
 * @param {VadState} state
 * @param {number} rms   Frame RMS energy (0..1).
 * @param {number} now   Timestamp (ms).
 * @param {VadConfig} [cfg]
 * @returns {VadState & { threshold: number, action: "none"|"finalize"|"finalize-maxlen" }}
 */
export function stepVad(state, rms, now, cfg = VAD_DEFAULTS) {
    let { noiseFloor, speechDetected, speechStartedAt, silenceStartedAt, calibrationUntil } = state;

    if (calibrationUntil === 0) calibrationUntil = now + cfg.calibrationMs;
    const calibrating = now < calibrationUntil;
    const threshold = Math.max(cfg.absoluteFloor, noiseFloor * cfg.speechMargin);
    const isSpeech = !calibrating && rms >= threshold;

    if (isSpeech) {
        if (!speechDetected) speechStartedAt = now;
        speechDetected = true;
        silenceStartedAt = 0;
    } else {
        noiseFloor = noiseFloor === 0
            ? rms
            : noiseFloor * (1 - cfg.noiseEma) + rms * cfg.noiseEma;
        if (speechDetected && silenceStartedAt === 0) silenceStartedAt = now;
    }

    let action = "none";
    if (speechDetected) {
        const silenceEnded = silenceStartedAt > 0 && now - silenceStartedAt >= cfg.silenceMs;
        const tooLong = speechStartedAt > 0 && now - speechStartedAt >= cfg.maxUtteranceMs;
        if (silenceEnded) action = "finalize";
        else if (tooLong) action = "finalize-maxlen";
    }

    return { noiseFloor, speechDetected, speechStartedAt, silenceStartedAt, calibrationUntil, threshold, action };
}
