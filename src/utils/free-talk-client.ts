let session: Promise<void> | null = null;
export function ensureFreeTalkSession() {
  if (!session) session = fetch('/api/free-talk/session', { method: 'POST' }).then(async response => {
    if (!response.ok) throw new Error(`free_talk_${response.status}`);
  }).catch(error => { session = null; throw error; });
  return session;
}

export async function freeTalkRequest(action: string, body: unknown) {
  await ensureFreeTalkSession();
  const response = await fetch(`/api/free-talk/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    if (response.status === 401) session = null;
    throw new Error(`free_talk_${response.status}`);
  }
  return response.json();
}
