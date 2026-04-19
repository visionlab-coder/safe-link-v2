import Pusher from 'pusher';
import { NextRequest, NextResponse } from 'next/server';

const pusherServer = new Pusher({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.PUSHER_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS:  true,
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { room, lang } = body;

  if (!room || !lang) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    await pusherServer.trigger(`travel-${room}`, 'partner-joined', { lang });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[travel/join]', msg);
    return NextResponse.json({ error: 'Join failed', detail: msg }, { status: 500 });
  }
}
