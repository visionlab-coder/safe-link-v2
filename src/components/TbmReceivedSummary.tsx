"use client";
import { useEffect, useState } from "react";
const labels: Record<string, string[]> = {"ko":["요약본","요약 번역 실패 — 다시 시도"],"en":["Summary","Summary translation failed — retry"],"zh":["摘要","摘要翻译失败 — 重试"],"vi":["Tóm tắt","Dịch tóm tắt thất bại — thử lại"],"km":["សេចក្តីសង្ខេប","ការបកប្រែបរាជ័យ — ព្យាយាមម្តងទៀត"],"th":["สรุป","แปลสรุปไม่สำเร็จ — ลองอีกครั้ง"],"id":["Ringkasan","Terjemahan gagal — coba lagi"],"uz":["Xulosa","Tarjima bajarilmadi — qayta urinish"],"ph":["Buod","Nabigo ang pagsasalin — subukang muli"],"mn":["Хураангуй","Орчуулга амжилтгүй — дахин оролдох"],"my":["အကျဉ်းချုပ်","ဘာသာပြန်မရပါ — ထပ်ကြိုးစားရန်"],"ne":["सारांश","अनुवाद असफल — फेरि प्रयास"],"bn":["সারসংক্ষেপ","অনুবাদ ব্যর্থ — আবার চেষ্টা"],"kk":["Қорытынды","Аударма сәтсіз — қайта көру"],"ru":["Итог","Ошибка перевода — повторить"],"jp":["要約","翻訳失敗 — 再試行"],"fr":["Résumé","Échec de traduction — réessayer"],"es":["Resumen","Error de traducción — reintentar"],"ar":["الملخص","فشلت الترجمة — إعادة المحاولة"],"hi":["सारांश","अनुवाद विफल — फिर कोशिश करें"]};

export default function TbmReceivedSummary({ text, lang, loadingLabel, onReady }: { text?: string; lang: string; loadingLabel: string; onReady?: (ready: boolean) => void }) {
    const [result, setResult] = useState<{ source: string; lang: string; text: string } | null>(null);
    const [failed, setFailed] = useState(false);
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        setResult(null);
        setFailed(false);
        if (!text || lang === "ko") return;
        let cancelled = false;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        void (async () => {
            try {
                const res = await fetch("/api/translate", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text, sl: "ko", tl: lang, useGlossary: true, fast: true, pronunciation: false }),
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error("translation_failed");
                const data = await res.json() as { translated?: string };
                if (!data.translated?.trim() || data.translated.trim() === text.trim()) throw new Error("translation_missing");
                if (!cancelled) setResult({ source: text, lang, text: data.translated });
            } catch { if (!cancelled) setFailed(true); }
            finally { clearTimeout(timeout); }
        })();
        return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
    }, [text, lang, retry]);
    const translated = lang === "ko" ? text : result && result.source === text && result.lang === lang ? result.text : "";
    useEffect(() => { onReady?.(Boolean(translated)); }, [translated, onReady]);
    if (!text) return null;
    const [title, error] = labels[lang] || labels.en;
    return <section className="mb-6 rounded-3xl border border-blue-200 bg-blue-50 p-6 text-slate-900" aria-live="polite">
        <h3 className="mb-3 text-lg font-bold">{title}</h3>
        {translated ? <p className="whitespace-pre-wrap break-words text-xl font-bold leading-relaxed">{translated}</p>
            : failed ? <button type="button" onClick={() => setRetry(v => v + 1)} className="text-red-800 underline">{error}</button>
            : <p role="status">{loadingLabel}</p>}
    </section>;
}
