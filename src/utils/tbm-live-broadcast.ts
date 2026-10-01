/** Preserve STT callback order, and drain before announcing the end of a broadcast. */
export class TbmLiveBroadcast {
  private session: { sessionId: string; siteId: string } | null = null;
  private queue: Promise<void> = Promise.resolve();
  constructor(private request: typeof fetch = fetch) {}

  private async requestWithTimeout(input: RequestInfo | URL, init: RequestInit) {
    // AbortSignal.timeout()은 일부 iOS/Android WebView에 없어 fetch 이전에 예외가 난다.
    // AbortController까지 없는 구형 WebView에서는 요청 자체를 우선 보장한다.
    if (typeof AbortController === "undefined") return this.request.call(globalThis, input, init);
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 10_000);
    try {
      // window.fetch는 반드시 window를 this로 유지해 호출해야 한다.
      return await this.request.call(globalThis, input, { ...init, signal: controller.signal });
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error(`[TBM live] ${init.method ?? "GET"} ${String(input)} request failed: ${message}`);
      throw error;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  async start(siteId: string) {
    if (this.session) throw new Error("broadcast_already_started");
    // 일부 Android WebView에서는 crypto.randomUUID()가 없어, API 요청 전에 방송 시작이
    // 중단될 수 있다. 기존 라이브와 동일하게 브라우저 호환 식별자를 사용한다.
    const session = {
      sessionId: `tbm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      siteId,
    };
    const response = await this.requestWithTimeout("/api/live/sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[TBM live] session start rejected", { status: response.status, detail, session });
      throw new Error(`broadcast_start_failed_${response.status}`);
    }
    this.session = session;
  }
  async announceSpeaking() {
    const session = this.session;
    if (!session) return;
    const response = await this.requestWithTimeout("/api/live/sessions/speaking", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(session),
    });
    if (!response.ok) {
      console.error(`[TBM live] speech-start rejected: ${response.status}`);
    }
  }
  publish(text: string) {
    const session = this.session;
    if (!session || !text.trim()) return Promise.resolve();
    const task = this.queue.then(async () => {
      const response = await this.requestWithTimeout("/api/live/translations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...session, text_ko: text.trim(), translations: {} }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error("[TBM live] text delivery rejected", { status: response.status, detail, session });
        throw new Error(`broadcast_send_failed_${response.status}`);
      }
    });
    this.queue = task.catch(() => {});
    return task;
  }
  async stop() {
    await this.queue;
    const session = this.session;
    if (!session) return;
    const response = await this.requestWithTimeout("/api/live/sessions?" + new URLSearchParams(session), {
      method: "DELETE", keepalive: true,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[TBM live] session stop rejected", { status: response.status, detail, session });
      throw new Error(`broadcast_stop_failed_${response.status}`);
    }
    this.session = null;
  }
}
