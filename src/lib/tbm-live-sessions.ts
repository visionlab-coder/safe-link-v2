export type LiveTbmSession = { session_id: string; started_by?: string; trade_types?: unknown; started_at?: string };
/** Compatibility only for a sole session; never choose the latest from a list. */
export function liveTbmSessions(data: { active?: boolean; sessions?: LiveTbmSession[]; session?: LiveTbmSession }): LiveTbmSession[] {
  if (data.active !== true) return [];
  const rows = Array.isArray(data.sessions) ? data.sessions : data.session ? [data.session] : [];
  return rows.filter(row => typeof row?.session_id === "string" && row.session_id.startsWith("tbm_"));
}
