export type TbmHomeNotice = {
  id: string;
  trade_types?: unknown;
  published_at?: string | null;
  created_at?: string | null;
};

export function tbmNotificationColumns(count: number): number {
  return count === 4 ? 2 : Math.max(1, Math.min(count, 3));
}

/** Collect every page atomically: a failed page must not remove existing cards. */
export async function loadPendingTbms(siteId: string, signal: AbortSignal): Promise<TbmHomeNotice[]> {
  const notices = new Map<string, TbmHomeNotice>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ siteId, limit: "50" });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(`/api/tbm/pending?${query}`, { cache: "no-store", credentials: "include", signal });
    if (!response.ok) throw new Error("tbm_pending_unavailable");
    const page = await response.json();
    if (!Array.isArray(page.tbms) || typeof page.has_more !== "boolean") throw new Error("tbm_pending_invalid");
    for (const item of page.tbms) {
      if (item?.id == null) throw new Error("tbm_pending_invalid");
      const id = String(item.id);
      notices.set(id, { ...item, id });
    }
    cursor = page.has_more ? String(page.next_cursor ?? "") : null;
    if (cursor !== null) {
      if (!cursor || cursors.has(cursor)) throw new Error("tbm_pending_cursor_invalid");
      cursors.add(cursor);
    }
  } while (cursor !== null);
  return [...notices.values()];
}
