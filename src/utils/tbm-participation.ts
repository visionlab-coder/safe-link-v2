/** The server, not browser storage or a caller-supplied worker ID, decides participation. */
export async function joinTbmLive(sessionId: string, siteId: string): Promise<boolean> {
  if (!sessionId.startsWith("tbm_")) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch("/api/live/tbm-participation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, siteId }), signal: controller.signal,
    });
    return response.ok;
  } catch { return false; }
  finally { clearTimeout(timeout); }
}
