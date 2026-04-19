import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const { text, from, to, room } = await request.json();
  if (!text || !from || !to || !room) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    const gRes = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
      }
    );
    const gData = await gRes.json();
    const translated: string = gData.data.translations[0].translatedText;

    const message = {
      id:         Date.now(),
      original:   text,
      translated,
      lang:       from,
      time:       new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };

    // Supabase Realtime broadcast로 상대방에게 전송
    await supabaseAdmin.channel(`travel-${room}`).send({
      type:    'broadcast',
      event:   'new-message',
      payload: message,
    });

    return NextResponse.json({ translated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[travel/translate]', msg);
    return NextResponse.json({ error: 'Translation failed', detail: msg }, { status: 500 });
  }
}
