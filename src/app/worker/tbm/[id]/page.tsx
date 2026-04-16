"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import SwarmAgentHUD from "@/components/agents/SwarmAgentHUD";
import RoleGuard from "@/components/RoleGuard";
import { Suspense } from "react";
import SignatureCanvas from "react-signature-canvas";
import { hangulize } from "@/utils/hangulize";
import { playPremiumAudio } from "@/utils/tts";
import { playNotificationSound } from "@/utils/notifications";

// ── 언어 코드 매핑 ── (미사용 — 향후 TTS 연동 예정)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
interface TransResult { text: string; pron: string; rev: string; }

/** 단일 텍스트 번역 */
const translateKo = async (text: string, targetLang: string): Promise<TransResult> => {
    if (targetLang === "ko") return { text, pron: "", rev: "" };
    try {
        const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, sl: 'ko', tl: targetLang }),
        });
        if (!res.ok) return { text, pron: "", rev: "" };
        const data = await res.json() as { translated?: string; pronunciation?: string; reverse_translated?: string };
        return {
            text: data.translated || text,
            pron: data.pronunciation || "",
            rev: data.reverse_translated || "",
        };
    } catch {
        return { text, pron: "", rev: "" };
    }
};

/** 긴 텍스트를 문장 그룹으로 분할 (각 그룹 ~200자) */
const splitIntoChunks = (text: string): string[] => {
    const sentences = text.split(/(?<=[.!?。！？\n])\s*/);
    const chunks: string[] = [];
    let current = "";
    for (const s of sentences) {
        if ((current + s).length > 200 && current.trim()) {
            chunks.push(current.trim());
            current = s;
        } else {
            current += (current ? " " : "") + s;
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text];
};

/**
 * 문단별 병렬 번역 + 점진적 콜백
 * 각 문단이 번역될 때마다 onProgress를 호출하여 즉시 화면에 표시
 */
const translateChunked = async (
    text: string,
    targetLang: string,
    onProgress: (partial: TransResult) => void,
): Promise<TransResult> => {
    if (targetLang === "ko") return { text, pron: "", rev: "" };

    const chunks = splitIntoChunks(text);

    // 짧은 텍스트(1 청크)는 그냥 한 번에 번역
    if (chunks.length <= 1) return translateKo(text, targetLang);

    // 병렬 번역 시작 — 각 청크가 완료되면 즉시 콜백
    const results: (TransResult | null)[] = new Array(chunks.length).fill(null);

    const promises = chunks.map((chunk, idx) =>
        translateKo(chunk, targetLang).then((result) => {
            results[idx] = result;

            // 지금까지 번역 완료된 부분을 합쳐서 콜백
            const merged: TransResult = { text: "", pron: "", rev: "" };
            for (let i = 0; i < results.length; i++) {
                if (results[i]) {
                    merged.text += (merged.text ? " " : "") + results[i]!.text;
                    merged.pron += (merged.pron ? " " : "") + results[i]!.pron;
                    merged.rev += (merged.rev ? " " : "") + results[i]!.rev;
                }
            }
            onProgress(merged);
        })
    );

    await Promise.all(promises);

    // 최종 결과 합산
    const final: TransResult = { text: "", pron: "", rev: "" };
    for (const r of results) {
        if (r) {
            final.text += (final.text ? " " : "") + r.text;
            final.pron += (final.pron ? " " : "") + r.pron;
            final.rev += (final.rev ? " " : "") + r.rev;
        }
    }
    return final;
};

// ── UI 텍스트 (다국어) ──
const uiText: Record<string, any> = {
    ko: { title: "안전 브리핑", original: "원문 (한국어)", translated: "번역본", voice: "음성으로 듣기", signHere: "이곳에 서명하세요", clear: "다시 쓰기", confirm: "✍️ 서명 완료하기", signed: "✓ 오늘 서명 완료!", translating: "번역 중...", noTBM: "오늘 전파된 브리핑이 없습니다.", mustSign: "서명 없이 나가시겠습니까?", alreadySigned: "이미 오늘 서명하셨습니다.", back: "뒤로", pron: "발음", rev: "역번역", listenFirst: "먼저 브리핑 음성을 끝까지 들어주세요.", listenStatus: "브리핑 청취" },
    en: { title: "Safety Briefing", original: "Original (Korean)", translated: "Translation", voice: "Listen", signHere: "Please sign here", clear: "Clear", confirm: "✍️ Confirm & Sign", signed: "✓ Signed!", translating: "Translating...", noTBM: "No briefing today.", mustSign: "Leave without signing?", alreadySigned: "Already signed today.", back: "Back", pron: "Pronunciation", rev: "Reverse Trans", listenFirst: "Please listen to the full audio briefing first.", listenStatus: "Briefing Status" },
    vi: { title: "Thông báo an toàn", original: "Gốc (Tiếng Hàn)", translated: "Bản dịch", voice: "Nghe", signHere: "Ký tên ở đây", clear: "Xóa", confirm: "✍️ Xác nhận & Ký", signed: "✓ Đã ký!", translating: "Đang dịch...", noTBM: "Chưa có thông báo hôm nay.", mustSign: "Rời đi mà không ký?", alreadySigned: "Đã ký hôm nay rồi.", back: "Quay lại", pron: "Phát âm", rev: "Dịch ngược", listenFirst: "Vui lòng nghe hết bản tin an toàn trước.", listenStatus: "Trạng thái nghe" },
    th: { title: "สรุปความปลอดภัย", original: "ต้นฉบับ (เกาหลี)", translated: "คำแปล", voice: "ฟังเสียง", signHere: "ลงชื่อที่นี่", clear: "ล้าง", confirm: "✍️ ยืนยันและลงนาม", signed: "✓ ลงนามแล้ว!", translating: "กำลังแปล...", noTBM: "ยังไม่มีสรุปวันนี้", mustSign: "ออกโดยไม่ลงนาม?", alreadySigned: "ลงนามแล้ววันนี้", back: "กลับ", pron: "การออกเสียง", rev: "แปลย้อนกลับ" },
    uz: { title: "Xavfsizlik brifing", original: "Asl (Koreys)", translated: "Tarjima", voice: "Tinglash", signHere: "Bu yerga imzo chekish", clear: "Tozalash", confirm: "✍️ Tasdiqlash va imzo", signed: "✓ Imzolandi!", translating: "Tarjima qilinmoqda...", noTBM: "Bugungi brifing yo'q.", mustSign: "Imzosiz chiqilsinmi?", alreadySigned: "Bugun allaqachon imzolandi.", back: "Orqaga", pron: "Talaffuz", rev: "Teskari tarjima", listenFirst: "Iltimos, avval brifingni oxirigacha tinglang.", listenStatus: "Eshitish holati" },
    zh: { title: "安全简报", original: "原文（韩语）", translated: "翻译", voice: "语音播放", signHere: "请在此签名", clear: "清除", confirm: "✍️ 确认并签名", signed: "✓ 签名完成！", translating: "翻译中...", noTBM: "今天没有简报", mustSign: "不签名就离开？", alreadySigned: "今天已经签名了。", back: "返回", pron: "发音", rev: "回译", listenFirst: "请先完整听取简报语音。", listenStatus: "听取状态" },
};
// ── 텍스트 클리닝 (중법 괄호 및 반복 제거) ──
const cleanupText = (text: string): string => {
    if (!text) return "";
    let count = 0;
    // 괄호와 그 안의 내용을 과감하게 정리하되, 처음 한 번만 남기고 나머지는 제거합니다.
    let clean = text.replace(/[(\（][^)\）]+[)\）]/g, (match) => {
        count++;
        return count === 1 ? match : "";
    });
    // Remove emojis completely
    clean = clean.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
    return clean.split('\n').map(line => line.trim()).filter(Boolean).join('\n').replace(/\s{2,}/g, ' ').trim();
};

const getUI = (lang: string) => {
    const d = uiText[lang] || uiText["en"];
    if (!d.pron) d.pron = "발음";
    if (!d.rev) d.rev = "역번역";
    return d;
};

function WorkerTBMDetailContent() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const tbmId = params?.id as string | undefined;
    const urlLang = searchParams.get("lang");
    const signaturePadRef = useRef<SignatureCanvas | null>(null);

    const [tbm, setTbm] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [translating, setTranslating] = useState(false);
    const [preferredLang, setPreferredLang] = useState("ko");
    const [transData, setTransData] = useState<{ text: string, pron: string, rev: string }>({ text: "", pron: "", rev: "" });
    const [isSigned, setIsSigned] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAudioFinished, setIsAudioFinished] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showPron, setShowPron] = useState(false);
    const [showRev, setShowRev] = useState(false);
    const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
    const voiceGenderRef = useRef<'male' | 'female'>('female');
    const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        return localStorage.getItem('sl_voice_enabled') !== 'false';
    });

    const changeGender = (g: 'male' | 'female') => {
        voiceGenderRef.current = g;
        setVoiceGender(g);
    };

    const toggleVoice = () => {
        const next = !voiceEnabled;
        setVoiceEnabled(next);
        localStorage.setItem('sl_voice_enabled', String(next));
    };

    const loadTBM = useCallback(async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const { data: profile } = await supabase
            .from("profiles")
            .select("preferred_lang, site_id, display_name")
            .eq("id", session.user.id)
            .single();

        let lang = profile?.preferred_lang || "ko";

        if (urlLang && urlLang !== profile?.preferred_lang) {
            await supabase.from("profiles").update({ preferred_lang: urlLang }).eq("id", session.user.id);
            lang = urlLang;
        }

        setPreferredLang(lang);

        let tbmData: any = null;
        if (tbmId && tbmId !== "today") {
            const { data } = await supabase
                .from("tbm_notices")
                .select("*")
                .eq("id", tbmId)
                .single();
            tbmData = data;
        } else {
            // 현장별 TBM 필터링: site_id 있으면 해당 현장만, 없으면 전체
            const siteId = profile?.site_id;
            let query = supabase
                .from("tbm_notices")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(1);
            if (siteId) query = query.eq("site_id", siteId);
            const { data } = await query;
            tbmData = data?.[0] || null;
        }

        setTbm(tbmData);

        if (tbmData) {
            const { data: ackData } = await supabase
                .from("tbm_ack")
                .select("id")
                .eq("tbm_id", tbmData.id)
                .eq("worker_id", session.user.id)
                .single();
            if (ackData) setIsSigned(true);

            if (tbmData.content_ko && lang !== "ko") {
                setTranslating(true);

                const result = await translateChunked(
                    tbmData.content_ko,
                    lang,
                    // 점진적 콜백: 번역이 하나씩 완료될 때마다 화면 갱신
                    (partial) => {
                        const cleaned = {
                            ...partial,
                            text: cleanupText(partial.text),
                        };
                        if (!cleaned.pron || cleaned.pron.trim() === "") {
                            cleaned.pron = hangulize(cleaned.text, lang);
                        }
                        setTransData(cleaned);
                    }
                );

                // 최종 결과 반영
                if (!result.pron || result.pron.trim() === "") {
                    result.pron = hangulize(result.text, lang);
                }
                result.text = cleanupText(result.text);

                setTransData(result);
                setTranslating(false);
            } else {
                setTransData({ text: tbmData?.content_ko || "", pron: "", rev: "" });
            }
        }

        setLoading(false);
    }, [tbmId, urlLang]);

    useEffect(() => { loadTBM(); }, [loadTBM]);

    const [hasNewTBM, setHasNewTBM] = useState(false);

    // 새 TBM 발송 시 자동 갱신 및 소리 알림
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('tbm_detail_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tbm_notices' }, () => {
                console.log('[TBM] New TBM received, alerting and reloading...');
                setHasNewTBM(true);
                playNotificationSound();
                loadTBM();

                // 3초 후 플래시 배너 닫기
                setTimeout(() => setHasNewTBM(false), 3000);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [loadTBM]);


    const handlePlayAudio = () => {
        if (!transData.text) return;
        if (isPlaying) return; // 중복 클릭 방지 (startedAt 초기화 방지)

        // 청취 시간 검증 — 텍스트 길이 기반 예상 재생시간의 70% 이상 실제 재생돼야 완료 인정
        // (브라우저 음성 미지원 → 콜백 즉시 실행 → 게이트 우회 방지)
        const textLen = transData.text.length;
        // 한국어/중국어 등은 글자당 약 0.25초, 라틴/아랍 문자는 약 0.08초
        const perChar = /[\u3131-\uD79D\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(transData.text) ? 0.25 : 0.08;
        const estimatedMs = Math.max(3000, textLen * perChar * 1000);
        const minRequiredMs = estimatedMs * 0.7;
        const startedAt = Date.now();

        setIsPlaying(true);
        playPremiumAudio(transData.text, preferredLang, voiceGenderRef.current, () => {
            setIsPlaying(false);
            const elapsed = Date.now() - startedAt;
            if (elapsed >= minRequiredMs) {
                setIsAudioFinished(true);
            } else {
                // 콜백이 너무 빨리 왔음 — 브라우저 음성 미지원 또는 무음 fallthrough
                // 남은 시간만큼 기다려서 게이트 해제 (실제 청취 강제)
                const remaining = minRequiredMs - elapsed;
                console.warn(`[TBM Audio] Early callback detected (${elapsed}ms < ${minRequiredMs.toFixed(0)}ms). Forcing wait.`);
                setTimeout(() => setIsAudioFinished(true), remaining);
            }
        });
    };

    const handleSubmit = async () => {
        if (!tbm) return;
        if (isSigned) return;

        const t = getUI(preferredLang);

        if (!isAudioFinished) {
            alert(t.listenFirst);
            return;
        }

        if (signaturePadRef.current?.isEmpty()) {
            alert(t.signHere + " !");
            return;
        }

        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const signatureImage = signaturePadRef.current?.toDataURL("image/png");

            // 중복 서명 체크 (이미 서명한 경우 성공 처리)
            const { data: existingAck } = await supabase.from("tbm_ack")
                .select("id").eq("tbm_id", tbm.id).eq("worker_id", session.user.id).single();
            if (existingAck) {
                setIsSigned(true);
                setTimeout(() => router.replace("/worker"), 1200);
                return;
            }

            const { error: ackError } = await supabase.from("tbm_ack").insert({
                tbm_id: tbm.id,
                worker_id: session.user.id,
                signature_data: signatureImage,
                ack_at: new Date().toISOString(),
            });

            if (ackError) {
                // unique constraint 에러는 이미 서명된 것이므로 성공 처리
                if (ackError.message.includes('duplicate') || ackError.message.includes('unique')) {
                    setIsSigned(true);
                    setTimeout(() => router.replace("/worker"), 1200);
                    return;
                }
                console.error("서명 저장 실패:", ackError.message);
                alert("서명 저장에 실패했습니다: " + ackError.message);
                return;
            }

            setIsSigned(true);
            // 서명 완료 후 화면 클리어 → 근로자 메인으로 이동
            setTransData({ text: "", pron: "", rev: "" });
            signaturePadRef.current?.clear();
            playNotificationSound();
            setTimeout(() => router.replace("/worker"), 2000);
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
            <div className="min-h-screen bg-mesh text-slate-50 flex flex-col font-sans selection:bg-red-500/30">

                {/* 💎 Header */}
                <header className="sticky top-0 z-50 glass border-b border-white/5 px-4 md:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors tap-effect text-slate-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black tracking-tight text-white uppercase italic">Safe-Link</span>
                                <span className="px-2 py-0.5 bg-red-500 text-[10px] font-black rounded text-white animate-pulse">LIVE</span>
                            </div>
                            <span className="text-xs text-slate-500 font-bold tracking-widest uppercase truncate max-w-[150px]">
                                {tbm?.site_name || "Field Center"}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 🔊 Voice On/Off Toggle */}
                        <button onClick={toggleVoice} className="flex flex-col items-center gap-0.5">
                            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${voiceEnabled ? 'bg-blue-500' : 'bg-slate-600'}`}>
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${voiceEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                            </div>
                            <span className={`text-[8px] font-black tracking-widest uppercase transition-colors ${voiceEnabled ? 'text-blue-400' : 'text-slate-500'}`}>
                                {voiceEnabled ? 'VOC ON' : 'VOC OFF'}
                            </span>
                        </button>
                        {/* 🔊 Voice Gender Switch - High Visibility */}
                        <div className="flex items-center bg-white/15 backdrop-blur-md rounded-full p-1 border border-white/20 shadow-lg">
                            <button
                                onClick={() => changeGender('male')}
                                className={`px-2 py-1 md:px-3 rounded-full text-[9px] md:text-[10px] font-black transition-all ${voiceGender === 'male' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                            >
                                MALE
                            </button>
                            <button
                                onClick={() => changeGender('female')}
                                className={`px-3 py-1 md:px-3 rounded-full text-[9px] md:text-[10px] font-black transition-all ${voiceGender === 'female' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                            >
                                FEMALE
                            </button>
                        </div>

                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Voice Lang</span>
                            <span className="text-[10px] font-bold text-slate-300">{preferredLang.toUpperCase()}</span>
                        </div>
                        <Image
                            src={`https://flagcdn.com/w80/${iso}.png`}
                            alt={preferredLang}
                            width={80}
                            height={56}
                            className="w-8 h-6 md:w-10 md:h-7 object-cover rounded shadow border border-white/10"
                            unoptimized
                        />
                    </div>
                </header>

                <main className="flex-1 flex flex-col pt-8 pb-32 px-4 md:px-8 max-w-2xl mx-auto w-full gap-8">

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-12 h-12 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin" />
                        </div>
                    ) : !tbm ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 glass rounded-[40px] p-12 border-white/5">
                            <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center text-slate-600">
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-black text-slate-400">{t.noTBM}</h2>
                        </div>
                    ) : (
                        <>
                            {/* 🚨 NEW TBM ARRIVED ALERT */}
                            {hasNewTBM && (
                                <div className="animate-in slide-in-from-top-4 fade-in duration-500 w-full mb-6 relative overflow-hidden p-6 glass-red rounded-3xl border-red-500 border-2 shadow-[0_0_60px_-15px_rgba(239,68,68,0.6)] flex items-center justify-center gap-4 text-white z-50">
                                    <svg className="w-8 h-8 animate-pulse text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                    <span className="text-xl md:text-2xl font-black italic tracking-tight">{t.newTBM || "🚨 New Safety Alert!"}</span>
                                </div>
                            )}

                            {/* 🎯 Main TBM Card */}
                            <section className="glass rounded-[48px] p-8 border-white/10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-red-500/20 transition-all duration-1000" />


                                <div className="flex justify-between items-start mb-10">
                                    <div className="flex flex-col gap-1">
                                        <h2 className="text-4xl font-black text-white text-gradient tracking-tight">{t.title}</h2>
                                        <p className="text-slate-500 font-bold text-sm tracking-widest uppercase">
                                            {new Date(tbm.created_at).toLocaleDateString(preferredLang === "ko" ? "ko-KR" : "en-US", { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center text-red-500 shadow-lg border-red-500/20">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    {/* 번역본 (The King) */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-6 bg-red-500 rounded-full" />
                                            <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">{t.translated}</h3>
                                        </div>
                                        {translating ? (
                                            <div className="h-20 flex items-center gap-4 bg-white/5 rounded-3xl px-6 animate-pulse-soft">
                                                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                <span className="text-slate-400 font-bold">{t.translating}</span>
                                            </div>
                                        ) : (
                                            <div className="relative group/text space-y-6">
                                                <p className="text-3xl md:text-5xl font-black text-white leading-[1.15] drop-shadow-sm transition-transform group-hover/text:scale-[1.01] duration-500">
                                                    {transData.text || tbm.content_ko}
                                                </p>

                                                {preferredLang !== "ko" && (transData.pron || transData.rev) && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {transData.pron && (
                                                            <button
                                                                onClick={() => setShowPron(v => !v)}
                                                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${showPron ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}
                                                            >
                                                                {t.pron} {showPron ? '▲' : '▼'}
                                                            </button>
                                                        )}
                                                        {transData.rev && (
                                                            <button
                                                                onClick={() => setShowRev(v => !v)}
                                                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${showRev ? 'bg-purple-500 text-white' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}
                                                            >
                                                                {t.rev} {showRev ? '▲' : '▼'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {showPron && transData.pron && (
                                                    <div className="flex items-start gap-4 p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 animate-fadeIn">
                                                        <div className="px-2 py-1 bg-blue-500 text-[10px] font-black text-white rounded shrink-0 mt-1 uppercase">
                                                            {t.pron}
                                                        </div>
                                                        <p className="text-xl font-bold text-blue-300 italic">
                                                            {transData.pron}
                                                        </p>
                                                    </div>
                                                )}

                                                {showRev && transData.rev && (
                                                    <div className="flex items-start gap-4 p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10 animate-fadeIn">
                                                        <div className="px-2 py-1 bg-purple-500/50 text-[10px] font-black text-white rounded shrink-0 mt-1 uppercase">
                                                            {t.rev}
                                                        </div>
                                                        <p className="text-lg font-bold text-slate-400">
                                                            {transData.rev}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* 원문 (The Origin) */}
                                    <div className="p-6 bg-white/[0.03] rounded-[32px] border border-white/5 group/orig transition-colors hover:bg-white/[0.05]">
                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{t.original}</h3>
                                        <p className="text-lg text-slate-400 font-medium leading-relaxed group-hover/orig:text-slate-300 transition-colors">{tbm.content_ko}</p>
                                    </div>
                                </div>

                                {/* 🔊 TTS Button */}
                                <button
                                    onClick={handlePlayAudio}
                                    disabled={isPlaying || translating || !voiceEnabled}
                                    className={`mt-10 w-full py-6 glass rounded-block transition-all tap-effect flex flex-col items-center justify-center gap-2 group/btn ${voiceEnabled ? 'border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/5' : 'opacity-40 cursor-not-allowed border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className="px-2 py-0.5 bg-blue-500 rounded-md text-[9px] font-black text-white animate-pulse">PREMIUM VOICE ACTOR</span>
                                        <span className="text-[9px] font-bold text-slate-500 italic uppercase">Neural Engine 3.1</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {isPlaying ? (
                                            <>
                                                <div className="flex gap-1 items-end h-6">
                                                    <div className="w-1.5 h-2 bg-blue-500 rounded-full animate-[bounce_1s_infinite]" />
                                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full animate-[bounce_1.2s_infinite]" />
                                                    <div className="w-1.5 h-4 bg-blue-500 rounded-full animate-[bounce_0.8s_infinite]" />
                                                </div>
                                                <span className="text-xl font-black text-blue-400 uppercase italic">Playing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover/btn:scale-110 transition-transform">
                                                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                                    </svg>
                                                </div>
                                                <span className="text-2xl font-black text-blue-100">{t.voice}</span>
                                            </>
                                        )}
                                    </div>
                                </button>
                            </section>

                            {/* ✍️ Signature Section */}
                            {!isSigned && (
                                <section className={`flex flex-col gap-6 transition-all duration-700 ${isAudioFinished ? 'animate-float opacity-100' : 'opacity-60 grayscale'}`}>
                                    <div className="flex justify-between items-end px-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xl font-black text-white">{t.signHere}</h3>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isAudioFinished ? 'bg-green-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                                                    {isAudioFinished ? '✅ READY' : '⚠️ ' + t.listenStatus}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest tracking-tighter">Your signature will be stored legally</p>
                                        </div>
                                        <button
                                            onClick={() => signaturePadRef.current?.clear()}
                                            disabled={!isAudioFinished}
                                            className="px-5 py-2 glass rounded-xl text-xs font-black text-slate-400 hover:text-white transition-all tap-effect disabled:opacity-30"
                                        >
                                            {t.clear.toUpperCase()}
                                        </button>
                                    </div>
                                    <div className={`bg-white rounded-[40px] border-[6px] transition-all duration-500 overflow-hidden aspect-[2/1] relative ${isAudioFinished ? 'border-slate-900 shadow-2xl' : 'border-slate-800 opacity-50 pointer-events-none'}`}>
                                        <SignatureCanvas
                                            ref={signaturePadRef}
                                            penColor="#0f172a"
                                            canvasProps={{ className: "w-full h-full cursor-crosshair" }}
                                        />
                                        {!isAudioFinished && (
                                            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
                                                <p className="text-white text-sm font-black uppercase tracking-widiest leading-relaxed drop-shadow-lg">
                                                    🔒 {t.listenFirst}
                                                </p>
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-4 pointer-events-none flex justify-center">
                                            <div className="w-48 h-0.5 bg-slate-200 rounded-full opacity-50" />
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ✅ Status Result (If already signed) */}
                            {isSigned && (
                                <div className="glass rounded-[40px] p-12 border-green-500/20 flex flex-col items-center text-center gap-6 shadow-[0_0_50px_-20px_rgba(34,197,94,0.3)]">
                                    <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 animate-bounce">
                                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-black text-white">{t.signed}</h2>
                                        <p className="text-slate-500 font-medium">Safe operations today!</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </main>

                {/* 🚀 Sticky CTA Button */}
                {!loading && tbm && (
                    <div className="fixed bottom-0 inset-x-0 p-6 md:p-10 pointer-events-none">
                        <div className="max-w-2xl mx-auto pointer-events-auto">
                            <button
                                onClick={handleSubmit}
                                disabled={isSigned || isSubmitting || !isAudioFinished}
                                className={`w-full py-7 rounded-[32px] text-2xl font-black tracking-tight shadow-3xl transition-all tap-effect flex items-center justify-center gap-4 ${isSigned
                                    ? "bg-slate-900 text-slate-600 border border-white/5"
                                    : (!isAudioFinished ? "bg-slate-800 text-slate-500 border border-white/5 opacity-50" : "bg-gradient-to-br from-green-400 to-green-600 text-slate-950 shadow-green-500/20")
                                    }`}
                            >
                                {isSubmitting ? (
                                    <div className="w-8 h-8 border-4 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                ) : isSigned ? (
                                    <>
                                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                        </svg>
                                        <span>{t.signed}</span>
                                    </>
                                ) : !isAudioFinished ? (
                                    <span>🔒 {t.listenStatus}</span>
                                ) : (
                                    <>
                                        {t.confirm.split(' ')[0]}
                                        <span className="uppercase tracking-tighter">{t.confirm.split(' ').slice(1).join(' ')}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                <style jsx global>{`
                    .rounded-block { border-radius: 28px; }
                `}</style>

                {/* 🤖 Tier 3 Ambient Edge Agent */}
                <SwarmAgentHUD />
            </div>
        </RoleGuard>
    );
}

export default function WorkerTBMDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-mesh" />}>
            <WorkerTBMDetailContent />
        </Suspense>
    );
}
