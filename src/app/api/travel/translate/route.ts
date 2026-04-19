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
  const { text, from, to, room } = body;

  if (!text || !from || !to || !room) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
    });
    const gData = await gRes.json();
    const translated: string = gData.data.translations[0].translatedText;

    const message = {
      id:         Date.now(),
      original:   text,
      translated,
      lang:       from,
      time:       new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };

    await pusherServer.trigger(`travel-${room}`, 'new-message', message);

    return NextResponse.json({ translated, message });
  } catch (err) {
    console.error('[travel/translate]', err);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
