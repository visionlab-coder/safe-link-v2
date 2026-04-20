import { NextRequest, NextResponse } from 'next/server';
import { verifyTravelToken } from '@/lib/travel-auth';
import { formalizeKo } from '@/utils/politeness';

// 파파고 지원 언어 (Travel Talk 5개 언어 모두 포함)
const PAPAGO_LANG_MAP: Record<string, string> = {
  ko: 'ko', ja: 'ja', en: 'en', zh: 'zh-CN', vi: 'vi',
};

export async function POST(request: NextRequest) {
  if (!verifyTravelToken(request.headers.get('x-travel-token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  const { text, from, to } = await request.json();
  if (!text || !from || !to) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const naverIdKey  = process.env.NAVER_CLIENT_ID?.trim();
  const naverSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  const googleKey   = process.env.GOOGLE_CLOUD_API_KEY?.trim();

  const papagoFrom = PAPAGO_LANG_MAP[from];
  const papagoTo   = PAPAGO_LANG_MAP[to];
  const canUsePapago = naverIdKey && naverSecret && papagoFrom && papagoTo;

  // 1순위: 파파고 (한-일 포함 Travel 5개 언어 전체 지원, 여행 회화체 품질 우수)
  if (canUsePapago) {
    try {
      const res = await fetch('https://papago.apigw.ntruss.com/nmt/v1/translation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-NCP-APIGW-API-KEY-ID': naverIdKey!,
          'X-NCP-APIGW-API-KEY': naverSecret!,
        },
        body: new URLSearchParams({ source: papagoFrom, target: papagoTo, text }),
      });
      if (res.ok) {
        const data = await res.json();
        const translated: string = data.message?.result?.translatedText || '';
        if (translated) {
          const final = to === 'ko' ? formalizeKo(translated) : translated;
          console.log(`[translate] papago ${from}→${to} ${Date.now()-t0}ms`);
          return NextResponse.json({ translated: final, engine: 'papago' });
        }
      }
    } catch (err) {
      console.error('[travel/translate] papago error:', err);
    }
  }

  // 2순위: Google Translate 폴백
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${googleKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
      }
    );
    const data = await res.json();
    const translated: string = data?.data?.translations?.[0]?.translatedText || '';
    if (!translated) throw new Error('Empty translation response');
    const final = to === 'ko' ? formalizeKo(translated) : translated;
    console.log(`[translate] google ${from}→${to} ${Date.now()-t0}ms`);
    return NextResponse.json({ translated: final, engine: 'google' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[travel/translate] google error:', msg);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
