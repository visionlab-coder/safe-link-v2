import { ensureFreeTalkSession } from './free-talk-client';
import type { VoiceGender } from './tts';

/** One reusable audio element for mobile playback. POST keeps spoken text out of URL logs. */
export class FreeTalkAudio {
  private audio: HTMLAudioElement | null = null;
  private queue: { text: string; lang: string; gender: VoiceGender }[] = [];
  private running = false;
  private controller: AbortController | null = null;
  private onIdle = () => {};
  private onFailure = () => {};

  unlock() {
    if (this.audio) return;
    this.audio = new Audio();
    const bytes = Uint8Array.from(atob('UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    this.audio.src = url;
    void this.audio.play().catch(() => {}).finally(() => URL.revokeObjectURL(url));
  }

  speak(text: string, lang: string, gender: VoiceGender, onIdle: () => void, onFailure: () => void) {
    this.onIdle = onIdle; this.onFailure = onFailure;
    for (let i=0; i<text.length; i+=800) this.queue.push({ text:text.slice(i,i+800),lang,gender });
    if (!this.running) void this.run();
  }

  private async run() {
    this.running = true;
    const controller = new AbortController(); this.controller = controller;
    try {
      this.unlock();
      await ensureFreeTalkSession();
      while (this.queue.length && !controller.signal.aborted) {
        const item = this.queue.shift()!;
        let url: string | undefined;
        try {
          const response = await fetch('/api/free-talk/tts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(item), signal:AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) });
          if (!response.ok) throw new Error('free_talk_tts_failed');
          url = URL.createObjectURL(await response.blob());
          const audio = this.audio!; audio.src = url;
          await new Promise<void>((resolve,reject) => {
            const finish = (error?: Error) => {
              clearTimeout(timer); controller.signal.removeEventListener('abort', abort);
              audio.onended=null; audio.onerror=null;
              if (error) reject(error); else resolve();
            };
            const abort=()=>finish(new Error('cancelled'));
            const timer=setTimeout(()=>finish(new Error('playback_timeout')),90_000);
            controller.signal.addEventListener('abort',abort,{once:true});
            audio.onended=()=>finish(); audio.onerror=()=>finish(new Error('playback_failed'));
            void audio.play().catch(()=>finish(new Error('playback_blocked')));
          });
        } finally { if (url) URL.revokeObjectURL(url); }
      }
    } catch {
      this.queue=[];
      this.audio?.pause();
      if (!controller.signal.aborted) this.onFailure();
    } finally {
      this.running=false;
      if (!controller.signal.aborted) this.onIdle();
      else if (this.queue.length) void this.run();
    }
  }

  cancel() {
    this.queue=[]; this.controller?.abort(); this.audio?.pause();
  }
}
