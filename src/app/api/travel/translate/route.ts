import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";
import { verifyTravelToken } from '@/lib/travel-auth';
import { formalizeKo, formalizeJa } from '@/utils/politeness';
import { callInternalAiTranslate } from '@/utils/ai/v3-ai-gateway';

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
  if (typeof text !== 'string' || text.length > 2000) {
    return NextResponse.json({ error: 'text_too_long' }, { status: 400 });
  }

  try {
    const result = await callInternalAiTranslate({
      provider: 'auto',
      sourceLanguage: PAPAGO_LANG_MAP[from] || from,
      targetLanguage: PAPAGO_LANG_MAP[to] || to,
      text,
    });
    if (!result?.text) throw new Error('Empty translation response');
    const final = to === 'ko' ? formalizeKo(result.text)
                : to === 'ja' ? formalizeJa(result.text)
                : result.text;
    console.log(`[travel/translate] ${result.vendor} ${from}→${to} ${Date.now()-t0}ms`);
    return NextResponse.json({ translated: final, engine: result.vendor });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[travel/translate] gateway error:', msg);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
