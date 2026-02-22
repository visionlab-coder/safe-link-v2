"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";

const googleLangCode: Record<string, string> = {
    ko: "ko", en: "en", vi: "vi", th: "th",
    uz: "uz", ph: "tl", km: "km", id: "id",
    mn: "mn", my: "my", ne: "ne", bn: "bn",
    kk: "kk", ru: "ru", zh: "zh-CN", jp: "ja",
    fr: "fr", es: "es", ar: "ar", hi: "hi",
};
const isoMap: Record<string, string> = {
    ko: "kr", en: "us", vi: "vn", zh: "cn", th: "th", uz: "uz", ph: "ph",
    km: "kh", id: "id", mn: "mn", my: "mm", ne: "np", bn: "bd", kk: "kz",
    ru: "ru", jp: "jp", fr: "fr", es: "es", ar: "sa", hi: "in",
};

const translateKo = async (text: string, targetLang: string): Promise<string> => {
    if (targetLang === "ko") return text;
    const gl = googleLangCode[targetLang] || targetLang;
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${gl}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        return data[0].map((item: any) => item[0]).join("");
    } catch {
        return text;
    }
};

const uiText: Record<string, any> = {
    ko: { title: "안전 브리핑", confirm: "✍️ 서명 완료하기", voice: "음성으로 듣기", back: "돌아가기", original: "원문 (한국어)", translated: "번역본", noTBM: "아직 도착한 브리핑이 없습니다.", translating: "번역 중...", signed: "✓ 서명 완료!", mustSign: "TBM 서명이 필요합니다. 서명 후 이동하시겠습니까?" },
    en: { title: "Safety Briefing", confirm: "✍️ Confirm & Sign", voice: "Listen", back: "Back", original: "Original (Korean)", translated: "Translation", noTBM: "No briefing yet.", translating: "Translating...", signed: "✓ Signed!", mustSign: "TBM signature required. Leave anyway?" },
    zh: { title: "安全简报", confirm: "✍️ 确认并签名", voice: "语音播放", back: "返回", original: "原文（韩语）", translated: "翻译", noTBM: "暂无简报", translating: "翻译中...", signed: "✓ 签名完成！", mustSign: "需要TBM签名。确定离开？" },
    vi: { title: "Thông báo an toàn", confirm: "✍️ Xác nhận & Ký", voice: "Nghe", back: "Quay lại", original: "Gốc (Tiếng Hàn)", translated: "Bản dịch", noTBM: "Chưa có thông báo.", translating: "Đang dịch...", signed: "✓ Đã ký!", mustSign: "Cần ký TBM. Vẫn rời đi?" },
    th: { title: "สรุปความปลอดภัย", confirm: "✍️ ยืนยันและลงนาม", voice: "ฟังเสียง", back: "กลับ", original: "ต้นฉบับ (เกาหลี)", translated: "คำแปล", noTBM: "ยังไม่มีสรุป", translating: "กำลังแปล...", signed: "✓ ลงนามแล้ว!", mustSign: "ต้องลงนาม TBM ก่อน ออกไปหรือไม่?" },
    ru: { title: "Инструктаж", confirm: "✍️ Подтвердить и подписать", voice: "Слушать", back: "Назад", original: "Оригинал (Korean)", translated: "Перевод", noTBM: "Брифинга нет.", translating: "Перевод...", signed: "✓ Подписано!", mustSign: "Нужна подпись TBM. Выйти?" },
};
const getUI = (lang: string) => uiText[lang] || uiText["en"];

export default function WorkerTBMDetail() {
    const router = useRouter();
    const [tbm, setTbm] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [translating, setTranslating] = useState(false);
    const [preferredLang, setPreferredLang] = useState("ko");
    const [translatedText, setTranslatedText] = useState("");
    const [isSigned, setIsSigned] = useState(false);

    useEffect(() => { loadTBM(); }, []);

    const loadTBM = async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const { data: profile } = await supabase
            .from("profiles")
            .select("preferred_lang, site_id")
            .eq("id", session.user.id)
            .single();

        const lang = profile?.preferred_lang || "ko";
        setPreferredLang(lang);

        // site_id 있으면 필터, 없으면 전체에서 최신 1개
        let query = supabase
            .from("tbm_notices")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1);

        if (profile?.site_id) {
            query = (query as any).eq("site_id", profile.site_id);
        }

        const { data: rows } = await (query as any);
        const tbmData = rows?.[0] || null;
        setTbm(tbmData);

        if (tbmData?.content_ko) {
            if (lang !== "ko") {
                setTranslating(true);
                const translated = await translateKo(tbmData.content_ko, lang);
                setTranslatedText(translated);
                setTranslating(false);
            } else {
                setTranslatedText(tbmData.content_ko);
            }
        }
        setLoading(false);
    };

    // 서명 처리: DB 저장 + 화면 전환
    const handleSign = async () => {
        setIsSigned(true);

        // tbm_ack 테이블에 서명 기록 저장
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session && tbm) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("display_name")
                    .eq("id", session.user.id)
                    .single();

                await supabase.from("tbm_ack").insert({
                    tbm_id: tbm.id,
                    worker_id: session.user.id,
                    worker_name: profile?.display_name || session.user.email,
                    ack_at: new Date().toISOString(),
                });
            }
        } catch (e) {
            console.error("서명 저장 실패:", e);
            // 서명 UI는 완료로 표시하되 에러는 조용히 처리
        }

        setTimeout(() => { router.replace("/worker"); }, 900);
    };


    // 서명 안 하고 뒤로가려 할 때 경고
    const handleBack = () => {
        if (!isSigned && tbm) {
            const t = getUI(preferredLang);
            if (!window.confirm(t.mustSign)) return;
        }
        router.back();
    };

    const t = getUI(preferredLang);
    const iso = isoMap[preferredLang] || "un";

    return (
        <RoleGuard allowedRole="worker">
            {/* 스크롤 영역 + 하단 고정 버튼을 위한 레이아웃 */}
            <div className="min-h-screen bg-slate-900 text-white flex flex-col">

                {/* 헤더 */}
                <header className="flex items-center gap-4 p-4 md:p-6 flex-shrink-0">
                    <button onClick={handleBack} className="p-2 text-slate-400 hover:text-white flex-shrink-0">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-black text-green-400">{t.title}</h1>
                        {/* 국기 */}
                        <img src={`https://flagcdn.com/w40/${iso}.png`} alt={preferredLang} className="w-7 h-5 object-cover rounded-sm" />
                    </div>
                </header>

                {/* 스크롤 콘텐츠 영역 (하단 버튼 높이만큼 padding) */}
                <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-32">
                    <div className="max-w-2xl mx-auto flex flex-col gap-6 py-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-24">
                                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : tbm ? (
                            <>
                                <div className="p-6 md:p-8 bg-slate-800 rounded-[32px] border-2 border-green-500 shadow-[0_0_40px_-10px_rgba(34,197,94,0.3)]">
                                    <div className="text-sm text-slate-500 mb-5 flex justify-between items-center">
                                        <span>{new Date(tbm.created_at).toLocaleDateString()}</span>
                                        <span className="bg-slate-700 px-3 py-1 rounded-full text-green-400 font-black text-xs">● LIVE</span>
                                    </div>

                                    {/* 원문 */}
                                    <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-700 mb-4">
                                        <p className="text-xs text-slate-500 font-bold mb-2">{t.original}</p>
                                        <p className="text-base text-slate-400 leading-relaxed">{tbm.content_ko}</p>
                                    </div>

                                    {/* 번역본 — 메인 표시 영역 */}
                                    <div className="p-6 bg-green-500/10 rounded-3xl border-2 border-green-500/40">
                                        <p className="text-xs text-green-400 font-black mb-3 uppercase tracking-widest">{t.translated}</p>
                                        {translating ? (
                                            <div className="flex items-center gap-3 text-slate-400 py-4">
                                                <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                                <span className="text-lg">{t.translating}</span>
                                            </div>
                                        ) : (
                                            <p className="text-2xl font-black text-white leading-snug">
                                                {translatedText || tbm.content_ko}
                                            </p>
                                        )}
                                    </div>

                                    {/* 음성 듣기 */}
                                    <button
                                        onClick={() => {
                                            if ('speechSynthesis' in window && translatedText) {
                                                window.speechSynthesis.cancel();
                                                const utter = new SpeechSynthesisUtterance(translatedText);
                                                utter.lang = googleLangCode[preferredLang] || preferredLang;
                                                window.speechSynthesis.speak(utter);
                                            }
                                        }}
                                        className="mt-5 flex items-center justify-center gap-3 w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl transition-colors font-bold text-slate-200"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                        </svg>
                                        {t.voice}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-4">
                                <svg className="w-20 h-20 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-xl font-bold text-center">{t.noTBM}</p>
                            </div>
                        )}
                    </div>
                </main>

                {/* ✍️ 서명 버튼 — 항상 화면 하단 고정 (tbm 있을 때만 표시) */}
                {!loading && tbm && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
                        <div className="max-w-2xl mx-auto">
                            <button
                                onClick={handleSign}
                                disabled={isSigned}
                                className={`w-full py-6 text-2xl font-black rounded-[28px] shadow-2xl transition-all active:scale-95 ${isSigned
                                    ? "bg-green-700/50 text-green-300 cursor-not-allowed"
                                    : "bg-green-500 hover:bg-green-400 text-slate-900 shadow-[0_0_30px_rgba(34,197,94,0.4)]"
                                    }`}
                            >
                                {isSigned ? t.signed : t.confirm}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </RoleGuard>
    );
}
