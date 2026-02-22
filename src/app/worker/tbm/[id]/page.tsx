"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";
import SignatureCanvas from "react-signature-canvas";

// ── 언어 코드 매핑 ──
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

// ── 번역 함수 ──
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

// ── UI 텍스트 (다국어) ──
const uiText: Record<string, any> = {
    ko: { title: "안전 브리핑", original: "원문 (한국어)", translated: "번역본", voice: "음성으로 듣기", signHere: "이곳에 서명하세요", clear: "다시 쓰기", confirm: "✍️ 서명 완료하기", signed: "✓ 오늘 서명 완료!", translating: "번역 중...", noTBM: "오늘 전파된 브리핑이 없습니다.", mustSign: "서명 없이 나가시겠습니까?", alreadySigned: "이미 오늘 서명하셨습니다." },
    en: { title: "Safety Briefing", original: "Original (Korean)", translated: "Translation", voice: "Listen", signHere: "Please sign here", clear: "Clear", confirm: "✍️ Confirm & Sign", signed: "✓ Signed!", translating: "Translating...", noTBM: "No briefing today.", mustSign: "Leave without signing?", alreadySigned: "Already signed today." },
    vi: { title: "Thông báo an toàn", original: "Gốc (Tiếng Hàn)", translated: "Bản dịch", voice: "Nghe", signHere: "Ký tên ở đây", clear: "Xóa", confirm: "✍️ Xác nhận & Ký", signed: "✓ Đã ký!", translating: "Đang dịch...", noTBM: "Chưa có thông báo hôm nay.", mustSign: "Rời đi mà không ký?", alreadySigned: "Đã ký hôm nay rồi." },
    th: { title: "สรุปความปลอดภัย", original: "ต้นฉบับ (เกาหลี)", translated: "คำแปล", voice: "ฟังเสียง", signHere: "ลงชื่อที่นี่", clear: "ล้าง", confirm: "✍️ ยืนยันและลงนาม", signed: "✓ ลงนามแล้ว!", translating: "กำลังแปล...", noTBM: "ยังไม่มีสรุปวันนี้", mustSign: "ออกโดยไม่ลงนาม?", alreadySigned: "ลงนามแล้ววันนี้" },
    uz: { title: "Xavfsizlik brifing", original: "Asl (Koreys)", translated: "Tarjima", voice: "Tinglash", signHere: "Bu yerga imzo chekish", clear: "Tozalash", confirm: "✍️ Tasdiqlash va imzo", signed: "✓ Imzolandi!", translating: "Tarjima qilinmoqda...", noTBM: "Bugungi brifing yo'q.", mustSign: "Imzosiz chiqilsinmi?", alreadySigned: "Bugun allaqachon imzolandi." },
    ru: { title: "Инструктаж", original: "Оригинал (Корейский)", translated: "Перевод", voice: "Слушать", signHere: "Подпишите здесь", clear: "Очистить", confirm: "✍️ Подтвердить и подписать", signed: "✓ Подписано!", translating: "Перевод...", noTBM: "Нет инструктажа сегодня.", mustSign: "Выйти без подписи?", alreadySigned: "Уже подписано сегодня." },
    zh: { title: "安全简报", original: "原文（韩语）", translated: "翻译", voice: "语音播放", signHere: "请在此签名", clear: "清除", confirm: "✍️ 确认并签名", signed: "✓ 签名完成！", translating: "翻译中...", noTBM: "今天没有简报", mustSign: "不签名就离开？", alreadySigned: "今天已经签名了。" },
};
const getUI = (lang: string) => uiText[lang] || uiText["en"];

export default function WorkerTBMDetailPage() {
    const router = useRouter();
    const params = useParams();
    const tbmId = params?.id as string | undefined;
    const signaturePadRef = useRef<SignatureCanvas | null>(null);

    const [tbm, setTbm] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [translating, setTranslating] = useState(false);
    const [preferredLang, setPreferredLang] = useState("ko");
    const [translatedText, setTranslatedText] = useState("");
    const [isSigned, setIsSigned] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const loadTBM = useCallback(async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const { data: profile } = await supabase
            .from("profiles")
            .select("preferred_lang, site_id, display_name")
            .eq("id", session.user.id)
            .single();

        const lang = profile?.preferred_lang || "ko";
        setPreferredLang(lang);

        // tbmId가 있으면 해당 TBM, 없으면 최신 TBM
        let tbmData: any = null;
        if (tbmId && tbmId !== "today") {
            const { data } = await supabase
                .from("tbm_notices")
                .select("*")
                .eq("id", tbmId)
                .single();
            tbmData = data;
        } else {
            let query = supabase
                .from("tbm_notices")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(1);
            if (profile?.site_id) {
                query = (query as any).eq("site_id", profile.site_id);
            }
            const { data } = await (query as any);
            tbmData = data?.[0] || null;
        }

        setTbm(tbmData);

        // 이미 서명했는지 확인
        if (tbmData) {
            const { data: ackData } = await supabase
                .from("tbm_ack")
                .select("id")
                .eq("tbm_id", tbmData.id)
                .eq("worker_id", session.user.id)
                .single();
            if (ackData) setIsSigned(true);

            // 번역
            if (tbmData.content_ko && lang !== "ko") {
                setTranslating(true);
                const translated = await translateKo(tbmData.content_ko, lang);
                setTranslatedText(translated);
                setTranslating(false);
            } else {
                setTranslatedText(tbmData?.content_ko || "");
            }
        }

        setLoading(false);
    }, [tbmId]);

    useEffect(() => { loadTBM(); }, [loadTBM]);

    // TTS 음성 듣기
    const handlePlayAudio = () => {
        if (!translatedText) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(translatedText);
        utter.lang = googleLangCode[preferredLang] || preferredLang;
        utter.onstart = () => setIsPlaying(true);
        utter.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utter);
    };

    // 서명 제출
    const handleSubmit = async () => {
        if (!tbm) return;
        if (isSigned) return;
        if (signaturePadRef.current?.isEmpty()) {
            alert(getUI(preferredLang).signHere + " !");
            return;
        }

        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: profile } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("id", session.user.id)
                .single();

            // 서명 이미지 base64
            const signatureImage = signaturePadRef.current?.toDataURL("image/png");

            await supabase.from("tbm_ack").insert({
                tbm_id: tbm.id,
                worker_id: session.user.id,
                worker_name: profile?.display_name || session.user.email,
                signature_image: signatureImage,
                ack_at: new Date().toISOString(),
            });

            setIsSigned(true);
            setTimeout(() => router.replace("/worker"), 1200);
        } catch (e) {
            console.error("서명 저장 실패:", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBack = () => {
        if (!isSigned && tbm) {
            if (!window.confirm(getUI(preferredLang).mustSign)) return;
        }
        router.back();
    };

    const t = getUI(preferredLang);
    const iso = isoMap[preferredLang] || "un";

    return (
        <RoleGuard allowedRole="worker">
            <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">

                {/* 헤더 */}
                <header className="flex items-center gap-3 p-4 md:p-6 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md flex-shrink-0">
                    <button onClick={handleBack} className="p-2 text-slate-400 hover:text-white transition-colors flex-shrink-0">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-3 flex-1">
                        <h1 className="text-2xl font-black text-red-400">{t.title}</h1>
                        <img src={`https://flagcdn.com/w40/${iso}.png`} alt={preferredLang} className="w-7 h-5 object-cover rounded-sm" />
                    </div>
                    {/* 이미 서명 완료 뱃지 */}
                    {isSigned && (
                        <span className="px-3 py-1.5 bg-green-500/20 border border-green-500/40 text-green-300 rounded-full text-xs font-black flex-shrink-0">
                            ✓ {t.signed}
                        </span>
                    )}
                </header>

                {/* 스크롤 영역 */}
                <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-48">
                    <div className="max-w-2xl mx-auto flex flex-col gap-6 py-4">

                        {loading ? (
                            <div className="flex items-center justify-center py-32">
                                <div className="w-14 h-14 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : !tbm ? (
                            <div className="flex flex-col items-center justify-center py-32 gap-6 text-slate-500">
                                <svg className="w-24 h-24 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-2xl font-bold text-center">{t.noTBM}</p>
                            </div>
                        ) : (
                            <>
                                {/* TBM 내용 카드 */}
                                <div className="relative p-6 md:p-8 bg-slate-900/80 rounded-[32px] border-2 border-red-500 shadow-[0_0_60px_-20px_rgba(239,68,68,0.5)] backdrop-blur-md overflow-hidden">
                                    {/* 배경 글로우 */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-transparent to-transparent pointer-events-none" />

                                    {/* 날짜 + LIVE 뱃지 */}
                                    <div className="flex justify-between items-center mb-5 relative">
                                        <span className="text-sm text-slate-500">
                                            {new Date(tbm.created_at).toLocaleDateString(preferredLang === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                                        </span>
                                        <span className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 text-red-300 px-3 py-1 rounded-full text-xs font-black">
                                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                                            LIVE
                                        </span>
                                    </div>

                                    {/* 원문 (한국어, 작게) */}
                                    <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 mb-5 relative">
                                        <p className="text-xs text-slate-500 font-bold mb-1.5 uppercase tracking-wider">{t.original}</p>
                                        <p className="text-base text-slate-400 leading-relaxed">{tbm.content_ko}</p>
                                    </div>

                                    {/* 번역본 (크게, 메인) */}
                                    <div className="p-6 bg-red-500/10 rounded-3xl border-2 border-red-500/30 mb-6 relative">
                                        <p className="text-xs text-red-400 font-black mb-3 uppercase tracking-widest">{t.translated}</p>
                                        {translating ? (
                                            <div className="flex items-center gap-3 text-slate-400 py-4">
                                                <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                                <span className="text-xl">{t.translating}</span>
                                            </div>
                                        ) : (
                                            <p className="text-3xl md:text-4xl font-black text-white leading-snug drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                                                {translatedText || tbm.content_ko}
                                            </p>
                                        )}
                                    </div>

                                    {/* TTS 버튼 */}
                                    <button
                                        onClick={handlePlayAudio}
                                        disabled={isPlaying || translating}
                                        className="w-full py-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 relative"
                                    >
                                        {isPlaying ? (
                                            <>
                                                <span className="flex h-5 w-5 relative">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                                    <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-500" />
                                                </span>
                                                <span className="text-xl font-bold text-blue-300">재생 중...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                </svg>
                                                <span className="text-xl font-bold text-blue-300">{t.voice}</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* 서명 영역 */}
                                {!isSigned && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-black text-slate-300">{t.signHere}</h3>
                                            <button
                                                onClick={() => signaturePadRef.current?.clear()}
                                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-sm font-bold transition-colors"
                                            >
                                                {t.clear}
                                            </button>
                                        </div>
                                        <div className="bg-white rounded-3xl overflow-hidden border-4 border-slate-700 w-full shadow-inner" style={{ aspectRatio: "3/1", minHeight: "120px" }}>
                                            <SignatureCanvas
                                                ref={signaturePadRef}
                                                penColor="black"
                                                canvasProps={{ className: "w-full h-full cursor-crosshair" }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* 이미 서명 완료 상태 */}
                                {isSigned && (
                                    <div className="p-6 bg-green-500/10 border-2 border-green-500/30 rounded-3xl flex items-center gap-4">
                                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                                            <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xl font-black text-green-300">{t.signed}</p>
                                            <p className="text-sm text-green-500/70">{t.alreadySigned}</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </main>

                {/* 하단 고정 서명 버튼 */}
                {!loading && tbm && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
                        <div className="max-w-2xl mx-auto">
                            <button
                                onClick={handleSubmit}
                                disabled={isSigned || isSubmitting}
                                className={`w-full py-6 text-2xl font-black rounded-[28px] shadow-2xl transition-all active:scale-95 ${isSigned
                                        ? "bg-green-700/50 text-green-300 cursor-not-allowed"
                                        : "bg-green-500 hover:bg-green-400 text-slate-900 shadow-[0_0_40px_rgba(34,197,94,0.5)]"
                                    }`}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center gap-3">
                                        <svg className="w-7 h-7 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        저장 중...
                                    </span>
                                ) : isSigned ? t.signed : t.confirm}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </RoleGuard>
    );
}
