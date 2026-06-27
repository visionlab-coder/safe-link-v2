import fs from "node:fs";
import path from "node:path";

const DEFAULT_TOKEN_FILE = String.raw`C:\Users\seowo\Downloads\Telegram Desktop\테스트 API.txt`;
const DEFAULT_URL = "wss://ai-realtime-dev.flit.to/v1/realtime/speech-session";

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const next = process.argv[i + 1];
    if (!next || next.startsWith("--")) args.set(a, true);
    else {
      args.set(a, next);
      i++;
    }
  }
}

const hintLangs = String(args.get("--hint") || "ko")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const targetLangs = String(args.get("--target") || "en,ja,vi")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const baseUrl = String(process.env.FLITTO_RTT_URL || args.get("--url") || DEFAULT_URL);
const pcmPath = args.get("--pcm") ? path.resolve(String(args.get("--pcm"))) : "";
const wavPath = args.get("--wav") ? path.resolve(String(args.get("--wav"))) : "";
const silenceMs = Number(args.get("--silence-ms") || 0);
const handshakeOnly = Boolean(args.get("--handshake-only")) || (!pcmPath && !wavPath && silenceMs <= 0);
const timeoutMs = Number(args.get("--timeout-ms") || 15000);

function readToken() {
  if (process.env.FLITTO_RTT_TOKEN?.trim()) return process.env.FLITTO_RTT_TOKEN.trim();
  const tokenFile = String(args.get("--token-file") || DEFAULT_TOKEN_FILE);
  const raw = fs.readFileSync(tokenFile, "utf8");
  const match = raw.match(/Token\s*:\s*([^\s]+)/i);
  if (!match) throw new Error(`Flitto token not found in ${tokenFile}`);
  return match[1].trim();
}

function silencePcm(ms) {
  const sampleRate = 16000;
  const bytesPerSample = 2;
  const samples = Math.max(0, Math.floor((sampleRate * ms) / 1000));
  return Buffer.alloc(samples * bytesPerSample);
}

function wavToRawPcm(wavFile) {
  const buf = fs.readFileSync(wavFile);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("WAV file must be RIFF/WAVE");
  }

  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    if (id === "fmt ") {
      fmt = {
        audioFormat: buf.readUInt16LE(start),
        channels: buf.readUInt16LE(start + 2),
        sampleRate: buf.readUInt32LE(start + 4),
        bitsPerSample: buf.readUInt16LE(start + 14),
      };
    } else if (id === "data") {
      data = buf.subarray(start, end);
    }
    offset = end + (size % 2);
  }

  if (!fmt || !data) throw new Error("WAV file missing fmt or data chunk");
  if (fmt.audioFormat !== 1 || fmt.channels !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error(
      `WAV must be PCM mono 16-bit. got format=${fmt.audioFormat} channels=${fmt.channels} sampleRate=${fmt.sampleRate} bits=${fmt.bitsPerSample}`,
    );
  }
  if (fmt.sampleRate === 16000) return data;

  const sourceSamples = new Int16Array(
    data.buffer,
    data.byteOffset,
    Math.floor(data.byteLength / Int16Array.BYTES_PER_ELEMENT),
  );
  const ratio = fmt.sampleRate / 16000;
  const output = Buffer.alloc(Math.round(sourceSamples.length / ratio) * 2);
  for (let index = 0; index < output.length / 2; index += 1) {
    const position = index * ratio;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, sourceSamples.length - 1);
    const weight = position - lower;
    const sample = Math.round(
      sourceSamples[lower] * (1 - weight) + sourceSamples[upper] * weight,
    );
    output.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), index * 2);
  }
  console.log(`[flitto-rtt] resampled ${fmt.sampleRate}Hz -> 16000Hz`);
  return output;
}

function chunkBuffer(buf, chunkBytes = 3200) {
  const chunks = [];
  for (let i = 0; i < buf.length; i += chunkBytes) {
    chunks.push(buf.subarray(i, Math.min(i + chunkBytes, buf.length)));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactUrl(url) {
  return url.replace(/token=[^&]+/i, "token=***");
}

async function main() {
  if (typeof WebSocket !== "function") {
    throw new Error("This Node runtime has no global WebSocket. Use Node 22+ or add a ws dependency.");
  }

  const token = readToken();
  const wsUrl = `${baseUrl}?token=${encodeURIComponent(token)}`;
  const startedAt = Date.now();
  const events = [];
  let readySeen = false;
  let serverStartSeen = false;
  let transcriptEndCount = 0;
  let finishCount = 0;
  let audioStartedAt = 0;
  let audioFinishedAt = 0;
  let firstTranscriptAt = 0;
  let transcriptEndAt = 0;
  let finishAt = 0;

  console.log("[flitto-rtt] connect", redactUrl(wsUrl));
  console.log("[flitto-rtt] hint", hintLangs.join(","), "target", targetLangs.join(","));
  console.log(
    "[flitto-rtt] mode",
    handshakeOnly ? "handshake-only" : pcmPath ? `pcm:${pcmPath}` : wavPath ? `wav:${wavPath}` : `silence:${silenceMs}ms`,
  );

  const ws = new WebSocket(wsUrl);

  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error(`Timed out after ${timeoutMs}ms. events=${events.join(",")}`));
    }, timeoutMs);

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          event: "connect",
          data: {
            hint_lang_code_list: hintLangs,
            tgt_lang_code_list: targetLangs,
          },
        }),
      );
    });

    ws.addEventListener("message", async (message) => {
      let payload;
      try {
        payload = JSON.parse(String(message.data));
      } catch {
        console.log("[flitto-rtt] non-json message", String(message.data).slice(0, 120));
        return;
      }

      const event = payload.event || "unknown";
      events.push(event);

      if (event === "ready_for_transcript") {
        readySeen = true;
        console.log("[flitto-rtt] <= ready_for_transcript");
        ws.send(JSON.stringify({ event: "start" }));
        return;
      }

      if (event === "start") {
        serverStartSeen = true;
        console.log("[flitto-rtt] <= start");

        if (handshakeOnly) {
          ws.send(JSON.stringify({ event: "stop" }));
          setTimeout(() => ws.close(1000, "handshake complete"), 500);
          return;
        }

        const audio = pcmPath ? fs.readFileSync(pcmPath) : wavPath ? wavToRawPcm(wavPath) : silencePcm(silenceMs);
        const chunks = chunkBuffer(audio);
        console.log("[flitto-rtt] => audio chunks", chunks.length, "bytes", audio.length);
        audioStartedAt = Date.now();
        for (const chunk of chunks) {
          ws.send(chunk);
          // 16kHz 16-bit mono: 3200 bytes ~= 100ms audio. Keep stream-like pacing.
          await sleep(90);
        }
        audioFinishedAt = Date.now();
        ws.send(JSON.stringify({ event: "stop" }));
        setTimeout(() => ws.close(1000, "audio test complete"), 3000);
        return;
      }

      if (event === "transcript") {
        if (!firstTranscriptAt) firstTranscriptAt = Date.now();
        const data = payload.data || {};
        console.log("[flitto-rtt] <= transcript", {
          id: data.transcript_id,
          lang: data.language_code,
          text: data.text,
          final_text: data.final_text,
          non_final_text: data.non_final_text,
        });
        return;
      }

      if (event === "transcript_end") {
        transcriptEndCount++;
        transcriptEndAt = Date.now();
        const data = payload.data || {};
        console.log("[flitto-rtt] <= transcript_end", {
          id: data.transcript_id,
          lang: data.language_code,
          text: data.text,
          duration: data.duration,
        });
        return;
      }

      if (event === "finish") {
        finishCount++;
        finishAt = Date.now();
        const data = payload.data || {};
        console.log("[flitto-rtt] <= finish", {
          id: data.transcript_id,
          src_lang: data.src_lang_code,
          src_text: data.src_text,
          translations: data.translation_list,
        });
        return;
      }

      console.log("[flitto-rtt] <=", payload);
    });

    ws.addEventListener("close", (event) => {
      clearTimeout(timer);
      const elapsed = Date.now() - startedAt;
      resolve({
        ok: readySeen && serverStartSeen,
        elapsed,
        closeCode: event.code,
        closeReason: event.reason,
        events,
        transcriptEndCount,
        finishCount,
        latency: {
          sessionReadyMs: audioStartedAt ? audioStartedAt - startedAt : null,
          firstPartialFromAudioStartMs: firstTranscriptAt ? firstTranscriptAt - audioStartedAt : null,
          finalSttFromAudioEndMs: transcriptEndAt ? transcriptEndAt - audioFinishedAt : null,
          translationFromFinalSttMs: finishAt ? finishAt - transcriptEndAt : null,
          translationFromAudioEndMs: finishAt ? finishAt - audioFinishedAt : null,
        },
      });
    });

    ws.addEventListener("error", (err) => {
      clearTimeout(timer);
      reject(err.error || err);
    });
  });

  const result = await done;
  console.log("[flitto-rtt] result", result);
  if (!result.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[flitto-rtt] failed", err);
  process.exitCode = 1;
});
