// Runs the actual React capture hook with deterministic microphone/browser doubles.
// No credentials, network, database writes, or real microphone required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as vad from '../src/lib/vad/finalize-decision.mjs';

const source = fs.readFileSync(new URL('../src/hooks/useCloudSTT.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;

function harness() {
    let now = 1000, energy = 0.001, nextId = 1;
    const timers = new Map(), requests = [], delivered = [], errors = [], cleanups = [];
    const timer = (fn, delay, repeat = false) => {
        const id = nextId++;
        timers.set(id, { fn, at: now + delay, delay, repeat });
        return id;
    };
    const stream = { active: true, getTracks: () => [{ stop() {} }],
        getAudioTracks: () => [{ getSettings: () => ({ sampleRate: 48000 }) }] };
    class Recorder {
        static isTypeSupported() { return true; }
        state = 'inactive';
        start() { this.state = 'recording'; }
        stop() {
            this.state = 'inactive';
            queueMicrotask(() => {
                this.ondataavailable({ data: new Blob(['a'.repeat(1000)]) });
                this.onstop();
            });
        }
    }
    class AudioContext {
        state = 'suspended'; sampleRate = 48000;
        async resume() { this.state = 'running'; }
        async close() { this.state = 'closed'; }
        createAnalyser() { return { fftSize: 512, getFloatTimeDomainData: buf => buf.fill(this.state === 'running' ? energy : 0) }; }
        createMediaStreamSource() { return { connect() {} }; }
    }
    class FileReader {
        readAsDataURL() { this.result = 'data:audio/webm;base64,YQ=='; this.onloadend(); }
    }
    const exports = {};
    const sandbox = {
        exports, console, Blob, FileReader, MediaRecorder: Recorder, AbortController,
        DOMException, Float32Array, queueMicrotask,
        Date: { now: () => now },
        process: { env: {} },
        window: { AudioContext },
        navigator: { mediaDevices: { getUserMedia: async () => stream } },
        setTimeout: (fn, ms) => timer(fn, ms), clearTimeout: id => timers.delete(id),
        setInterval: (fn, ms) => timer(fn, ms, true), clearInterval: id => timers.delete(id),
        // Deliberately never render animation frames: live delivery must still work.
        requestAnimationFrame: () => 99999, cancelAnimationFrame() {},
        fetch: (_url, options) => new Promise((resolve, reject) => {
            requests.push({ at: now, finish: text => resolve({ json: async () => ({ transcript: text }) }) });
            options.signal.addEventListener('abort', () => reject(new Error('timeout')));
        }),
        require: name => {
            if (name.includes('finalize-decision')) return vad;
            if (name === 'react') return {
                useRef: current => ({ current }), useState: initial => [initial, () => {}],
                useCallback: fn => fn, useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
            };
            throw new Error(name);
        },
    };
    vm.runInNewContext(compiled, sandbox);
    const hook = exports.useCloudSTT({ lang: 'ko', live: true,
        onTranscript: async text => { delivered.push(text); }, onError: (...args) => errors.push(args),
    });
    async function flush() { for (let i = 0; i < 25; i++) await Promise.resolve(); }
    async function advance(ms, rms) {
        energy = rms;
        const end = now + ms;
        while (true) {
            const entry = [...timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
            if (!entry) break;
            const [id, t] = entry;
            now = t.at;
            if (t.repeat) t.at += t.delay; else timers.delete(id);
            t.fn();
            await flush();
        }
        now = end;
        await flush();
    }
    return { hook, requests, delivered, errors, advance, flush, cleanup: () => cleanups.forEach(fn => fn()) };
}

// Silence must not consume quota or generate phantom TBM sentences.
{
    const h = harness(); await h.hook.toggle();
    await h.advance(12000, 0.001);
    assert.equal(h.requests.length, 0);
    h.cleanup(); await h.flush();
    assert.equal(h.requests.length, 0);
}
// A pause sends DURING broadcast, without pressing stop or rendering frames.
{
    const h = harness(); await h.hook.toggle();
    await h.advance(600, 0.001); await h.advance(900, 0.1); await h.advance(800, 0.001);
    assert.equal(h.requests.length, 1);
    h.requests[0].finish('첫 문장'); await h.flush();
    assert.deepEqual(h.delivered, ['첫 문장']);
    h.cleanup();
}
// Continuous speech is cut repeatedly; later clips are not recalibrated as noise.
// Responses may complete out of order, but publication must retain capture order.
{
    const h = harness(); await h.hook.toggle();
    await h.advance(600, 0.001); await h.advance(7500, 0.1);
    assert.equal(h.requests.length, 2);
    assert.ok(h.requests[1].at - h.requests[0].at >= vad.LIVE_CAPTURE.minChunkMs);
    h.requests[1].finish('둘째'); await h.flush(); assert.equal(h.delivered.length, 0);
    h.requests[0].finish('첫째'); await h.flush();
    assert.deepEqual(h.delivered, ['첫째', '둘째']);
    h.cleanup();
}
// TTS echo is discarded; leaving the page must not publish late responses.
{
    const h = harness(); await h.hook.toggle();
    await h.advance(600, 0.001); h.hook.mute(); await h.advance(4000, 0.1);
    assert.equal(h.requests.length, 0);
    h.hook.unmute(); await h.advance(8000, 0.1);
    assert.ok(h.requests.length > 0);
    h.cleanup(); await h.flush();
    h.requests.forEach(r => r.finish('늦은 결과')); await h.flush();
    assert.deepEqual(h.delivered, []);
}
// Ending a broadcast waits for the last spoken clip to publish, not vice versa.
{
    const h = harness(); await h.hook.toggle();
    await h.advance(600, 0.001); await h.advance(900, 0.1);
    let drained = false;
    const draining = h.hook.stopAndDrain().then(() => { drained = true; });
    await h.flush();
    assert.equal(h.requests.length, 1); assert.equal(drained, false);
    h.requests[0].finish('마지막 문장'); await draining;
    assert.deepEqual(h.delivered, ['마지막 문장']); assert.equal(drained, true);
    h.cleanup();
}
console.log('Live capture: silence, pause, continuous speech, response order, echo, unmount, final drain passed');
