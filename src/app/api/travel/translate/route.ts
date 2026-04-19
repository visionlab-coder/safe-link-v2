import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { text, from, to } = await request.json();
  if (!text || !from || !to) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
      }
    );
    const data = await res.json();
    const translated: string = data.data.translations[0].translatedText;
    return NextResponse.json({ translated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[travel/translate]', msg);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
