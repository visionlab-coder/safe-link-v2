// Unit test for the pure VAD finalize decision (no microphone needed).
// Run: node scripts/vad-decision-test.mjs
import assert from "node:assert/strict";
import { createVadState, stepVad, VAD_DEFAULTS } from "../src/lib/vad/finalize-decision.mjs";

const FRAME_MS = 100; // ~4096 samples @ 16k ≈ 256ms; 100ms keeps the math readable.

/** Feed a sequence of {rms, ms} segments; return the first finalize action + frame index. */
function run(segments, cfg = VAD_DEFAULTS) {
    let state = createVadState();
    let t = 0;
    let frame = 0;
    for (const seg of segments) {
        const frames = Math.round(seg.ms / FRAME_MS);
        for (let i = 0; i < frames; i += 1) {
            const step = stepVad(state, seg.rms, t, cfg);
            state = step;
            if (step.action !== "none") return { action: step.action, atMs: t, frame, threshold: step.threshold };
            t += FRAME_MS;
            frame += 1;
        }
    }
    return { action: "none", atMs: t, frame, threshold: state.noiseFloor * cfg.speechMargin };
}

let passed = 0;
function check(name, cond, detail) {
    assert.ok(cond, `${name} :: ${detail}`);
    console.log(`  ✓ ${name}`);
    passed += 1;
}

// 1) Quiet room → speech → silence: finalize on the 800ms silence gap.
{
    const r = run([
        { rms: 0.002, ms: 500 },  // calibration / quiet
        { rms: 0.08, ms: 1000 },  // speech
        { rms: 0.002, ms: 1000 }, // silence
    ]);
    check("quiet→speech→silence finalizes on gap", r.action === "finalize", JSON.stringify(r));
    // Speech started at 500ms, last speech frame ~1500ms, +800ms silence ⇒ ~2300ms.
    check("…at ~silenceMs after speech", r.atMs >= 2200 && r.atMs <= 2500, `atMs=${r.atMs}`);
}

// 2) Pure constant noise (no speech): never finalizes — we must not translate ambient.
{
    const r = run([{ rms: 0.05, ms: 5000 }]);
    check("constant noise never finalizes", r.action === "none", JSON.stringify(r));
    check("…noise raised threshold above noise level", r.threshold > 0.05, `threshold=${r.threshold.toFixed(3)}`);
}

// 3) Loud site noise with real speech bursts: adapts, then finalizes on silence.
//    Calibrate to ~0.05 noise ⇒ threshold ~0.125. Speech at 0.25 detected; drop back to
//    noise (0.05 < threshold) is treated as silence ⇒ finalize. Proves adaptation works.
{
    const r = run([
        { rms: 0.05, ms: 600 },   // calibration learns the loud ambient
        { rms: 0.25, ms: 1200 },  // clear speech above adapted threshold
        { rms: 0.05, ms: 1000 },  // back to ambient = end of speech
    ]);
    check("noisy site: speech detected & finalizes on ambient return", r.action === "finalize", JSON.stringify(r));
}

// 4) Continuous speech with no silence gap → max-utterance cap fires.
{
    const r = run([
        { rms: 0.002, ms: 400 },   // calibration
        { rms: 0.09, ms: 13000 },  // unbroken speech past the 12s cap
    ]);
    check("no-gap continuous speech hits maxlen cap", r.action === "finalize-maxlen", JSON.stringify(r));
    check("…cap fires at ~maxUtteranceMs", r.atMs >= 12000 && r.atMs <= 12800, `atMs=${r.atMs}`);
}

// 5) Quiet room speech below loud-noise threshold still detected (absolute floor protects).
{
    const r = run([
        { rms: 0.001, ms: 500 },  // very quiet calibration
        { rms: 0.03, ms: 900 },   // soft speech, above 0.012 floor
        { rms: 0.001, ms: 1000 },
    ]);
    check("quiet-room soft speech detected via absolute floor", r.action === "finalize", JSON.stringify(r));
}

console.log(`\nVAD decision: ${passed} checks passed`);
