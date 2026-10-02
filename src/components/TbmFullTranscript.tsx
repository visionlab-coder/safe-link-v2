"use client";

import { useEffect, useRef, useState } from "react";

const retryLabels: Record<string, string> = {
  ko: "번역 다시 시도", en: "Retry translation", zh: "重试翻译", vi: "Thử dịch lại",
  km: "ព្យាយាមបកប្រែម្តងទៀត", th: "ลองแปลอีกครั้ง", id: "Coba terjemahkan lagi",
  uz: "Tarjimani qayta urinish", ph: "Subukang isalin muli", mn: "Дахин орчуулах",
  my: "ဘာသာပြန်ရန် ထပ်ကြိုးစားပါ", ne: "अनुवाद फेरि प्रयास गर्नुहोस्", bn: "আবার অনুবাদ করুন",
  kk: "Қайта аудару", ru: "Повторить перевод", jp: "翻訳を再試行", fr: "Réessayer la traduction",
  es: "Reintentar traducción", ar: "إعادة محاولة الترجمة", hi: "अनुवाद फिर से करें",
};

/** Supplementary full text: never blocks summary review/signing or starts audio. */
export default function TbmFullTranscript({ text, lang, enabled, translatedLabel, originalLabel, loadingLabel }: {
  text: string; lang: string; enabled: boolean;
  translatedLabel: string; originalLabel: string; loadingLabel: string;
}) {
  const [result, setResult] = useState<{ source: string; lang: string; text: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const chunkCache = useRef(new Map<string, string>());
  useEffect(() => {
    setResult(null);
    setFailed(false);
    if (!enabled || !text || lang === "ko") return;
    const controller = new AbortController();
    // Bound individual requests and concurrency for long briefings.
    const chunks: string[] = [];
    let rest = text;
    while (rest.length > 1500) {
      const window = rest.slice(0, 1500);
      const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"));
      const boundary = sentenceEnd > 0 ? sentenceEnd + 1 : window.lastIndexOf(" ");
      const cut = boundary > 0 ? boundary : 1500;
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    if (rest.trim()) chunks.push(rest);
    void (async () => {
      try {
        const translated: string[] = [];
        for (const chunk of chunks) {
          const key = `${lang}:${chunk}`;
          const cached = chunkCache.current.get(key);
          if (cached) { translated.push(cached); continue; }
          const response = await fetch("/api/translate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunk, sl: "ko", tl: lang, useGlossary: true, fast: true, pronunciation: false }),
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]),
          });
          if (!response.ok) throw new Error("translation_failed");
          const data = await response.json() as { translated?: string };
          if (!data.translated?.trim() || data.translated.trim() === chunk.trim()) throw new Error("translation_missing");
          if (chunkCache.current.size >= 64) chunkCache.current.delete(chunkCache.current.keys().next().value!);
          chunkCache.current.set(key, data.translated);
          translated.push(data.translated);
        }
        if (!controller.signal.aborted) setResult({ source: text, lang, text: translated.join("\n\n") });
      } catch { if (!controller.signal.aborted) setFailed(true); }
    })();
    return () => controller.abort();
  }, [text, lang, enabled, retry]);
  const translated = result?.source === text && result.lang === lang ? result.text : "";
  return <div className="space-y-5" data-testid="tbm-full-transcript">
    {lang !== "ko" && text.trim() && <section aria-label={translatedLabel} className="border-t border-slate-200 pt-5">
      <h3 className="mb-3 text-base font-bold text-slate-900">{translatedLabel}</h3>
      {translated ? <p lang={lang} dir="auto" className="whitespace-pre-wrap break-words text-lg leading-relaxed text-slate-900">{translated}</p>
        : failed ? <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-bold text-amber-900">⚠ {retryLabels[lang] || retryLabels.en}</button>
        : <p role="status" className="text-sm text-slate-600">{loadingLabel}</p>}
    </section>}
    <section aria-label={originalLabel} className="border-t border-slate-200 pt-5">
      <h3 className="mb-3 text-base font-bold text-slate-900">{originalLabel}</h3>
      <p lang="ko" className="whitespace-pre-wrap break-words text-base leading-relaxed text-slate-700">{text}</p>
    </section>
  </div>;
}
