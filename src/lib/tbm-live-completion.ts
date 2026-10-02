export type TbmLiveSummary = { sessionId: string; tbmId: string; text: string };

/** Never hand off to an unrelated/latest notice just because it arrived recently. */
export function matchedTbmSummary(value: unknown, sessionId: string): TbmLiveSummary | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<TbmLiveSummary>;
  return row.sessionId === sessionId && /^\d+$/.test(String(row.tbmId ?? "")) &&
    typeof row.text === "string" && Boolean(row.text.trim())
    ? { sessionId, tbmId: String(row.tbmId), text: row.text } : null;
}

export function canSignTbm(input: {
  liveActive: boolean; pending: boolean; liveSummary: boolean;
  summaryReady: boolean; summaryReviewed: boolean; audioFinished: boolean;
}): boolean {
  if (input.liveActive || input.pending) return false;
  return input.liveSummary ? input.summaryReady && input.summaryReviewed : input.audioFinished;
}
