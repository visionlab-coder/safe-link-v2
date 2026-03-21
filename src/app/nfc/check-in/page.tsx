"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { languages } from "@/constants";
import { getDeviceId, getOrCreateDeviceId, getDeviceLang, setDeviceLang } from "@/utils/nfc/device-id";
import { playPremiumAudio } from "@/utils/tts";

// UI text per language
const uiText: Record<string, any> = {
  ko: { welcome: "안전 브리핑에 오신 것을 환영합니다", selectLang: "사용 언어를 선택하세요", checkingIn: "출석 체크 중...", checkedIn: "출석 완료!", todayBriefing: "오늘의 안전 브리핑", noBriefing: "오늘의 브리핑이 없습니다", listening: "음성 재생 중...", listen: "음성으로 듣기", confirmed: "청취 완료", confirmBtn: "청취 완료 확인", translating: "번역 중...", original: "원문", translated: "번역" },
  en: { welcome: "Welcome to Safety Briefing", selectLang: "Select your language", checkingIn: "Checking in...", checkedIn: "Checked in!", todayBriefing: "Today's Safety Briefing", noBriefing: "No briefing today", listening: "Playing audio...", listen: "Listen", confirmed: "Confirmed", confirmBtn: "Confirm Listened", translating: "Translating...", original: "Original", translated: "Translation" },
  vi: { welcome: "Chào mừng đến buổi họp an toàn", selectLang: "Chọn ngôn ngữ của bạn", checkingIn: "Đang điểm danh...", checkedIn: "Điểm danh xong!", todayBriefing: "Thông báo an toàn hôm nay", noBriefing: "Không có thông báo hôm nay", listening: "Đang phát...", listen: "Nghe", confirmed: "Đã xác nhận", confirmBtn: "Xác nhận đã nghe", translating: "Đang dịch...", original: "Gốc", translated: "Bản dịch" },
  zh: { welcome: "欢迎参加安全简报", selectLang: "选择您的语言", checkingIn: "签到中...", checkedIn: "签到完成!", todayBriefing: "今日安全简报", noBriefing: "今天没有简报", listening: "播放中...", listen: "语音播放", confirmed: "已确认", confirmBtn: "确认已听", translating: "翻译中...", original: "原文", translated: "翻译" },
  th: { welcome: "ยินดีต้อนรับสู่การบรรยายสรุปความปลอดภัย", selectLang: "เลือกภาษาของคุณ", checkingIn: "กำลังเช็คอิน...", checkedIn: "เช็คอินแล้ว!", todayBriefing: "สรุปความปลอดภัยวันนี้", noBriefing: "ไม่มีสรุปวันนี้", listening: "กำลังเล่น...", listen: "ฟังเสียง", confirmed: "ยืนยันแล้ว", confirmBtn: "ยืนยันฟังแล้ว", translating: "กำลังแปล...", original: "ต้นฉบับ", translated: "คำแปล" },
  uz: { welcome: "Xavfsizlik brifingiga xush kelibsiz", selectLang: "Tilingizni tanlang", checkingIn: "Ro'yxatdan o'tilmoqda...", checkedIn: "Ro'yxatdan o'tildi!", todayBriefing: "Bugungi xavfsizlik brifingi", noBriefing: "Bugun brifing yo'q", listening: "Tinglash...", listen: "Tinglash", confirmed: "Tasdiqlandi", confirmBtn: "Tinglaganini tasdiqlash", translating: "Tarjima qilinmoqda...", original: "Asl", translated: "Tarjima" },
};
const getUI = (lang: string) => uiText[lang] || uiText["en"];

// Worker-relevant languages (excluding ko which is admin language)
const workerLanguages = languages.filter(l => l.code !== "ko");

interface TbmNotice {
  id: string;
  title: string;
  content: string;
  created_at: string;
  confirmed: boolean;
}

interface TranslatedTbm extends TbmNotice {
  translatedTitle: string;
  translatedContent: string;
  pronunciation: string;
}

function NfcCheckInContent() {
  const searchParams = useSearchParams();
  const tagCode = searchParams.get("tag") || "";

  const [phase, setPhase] = useState<"loading" | "select-lang" | "checking-in" | "briefing">("loading");
  const [selectedLang, setSelectedLang] = useState<string>("");
  const [notices, setNotices] = useState<TranslatedTbm[]>([]);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Initialize: check if device already registered
  useEffect(() => {
    const deviceId = getDeviceId();
    const savedLang = getDeviceLang();

    if (deviceId && savedLang) {
      setSelectedLang(savedLang);
      setPhase("checking-in");
    } else {
      setPhase("select-lang");
    }
  }, []);

  // Auto check-in when language selected
  useEffect(() => {
    if (phase !== "checking-in" || !selectedLang) return;

    const doCheckIn = async () => {
      const deviceId = getOrCreateDeviceId();
      setDeviceLang(selectedLang);

      try {
        // Register/update worker
        await fetch("/api/nfc/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: deviceId, preferred_lang: selectedLang, tag_code: tagCode }),
        });

        // Check in
        await fetch("/api/nfc/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: deviceId, tag_code: tagCode }),
        });

        // Fetch today's TBM
        const tbmRes = await fetch(`/api/nfc/today-tbm?device_id=${deviceId}`);
        const tbmData = await tbmRes.json();

        if (tbmData.notices && tbmData.notices.length > 0) {
          // Translate each notice
          const translated = await Promise.all(
            tbmData.notices.map(async (n: TbmNotice) => {
              if (selectedLang === "ko") {
                return { ...n, translatedTitle: n.title, translatedContent: n.content, pronunciation: "" };
              }
              try {
                const [titleRes, contentRes] = await Promise.all([
                  fetch("/api/translate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: n.title, sl: "ko", tl: selectedLang }),
                  }),
                  fetch("/api/translate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: n.content, sl: "ko", tl: selectedLang }),
                  }),
                ]);
                const titleData = await titleRes.json();
                const contentData = await contentRes.json();
                return {
                  ...n,
                  translatedTitle: titleData.translated || n.title,
                  translatedContent: contentData.translated || n.content,
                  pronunciation: contentData.pronunciation || "",
                };
              } catch {
                return { ...n, translatedTitle: n.title, translatedContent: n.content, pronunciation: "" };
              }
            })
          );
          setNotices(translated);
        } else {
          setNotices([]);
        }

        setPhase("briefing");
      } catch (error) {
        console.error("Check-in error:", error);
        setPhase("briefing");
      }
    };

    doCheckIn();
  }, [phase, selectedLang, tagCode]);

  const handleLangSelect = (langCode: string) => {
    setSelectedLang(langCode);
    setPhase("checking-in");
  };

  const handlePlayAudio = useCallback(async (text: string, noticeId: string) => {
    if (isPlaying) return;
    setIsPlaying(noticeId);
    try {
      await playPremiumAudio(text, selectedLang);
    } catch (error) {
      console.error("TTS error:", error);
    } finally {
      setIsPlaying(null);
    }
  }, [isPlaying, selectedLang]);

  const handleConfirm = async (noticeId: string) => {
    setConfirmingId(noticeId);
    const deviceId = getDeviceId();
    if (!deviceId) return;

    try {
      await fetch("/api/nfc/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, tbm_notice_id: noticeId, tag_code: tagCode }),
      });

      setNotices(prev => prev.map(n =>
        n.id === noticeId ? { ...n, confirmed: true } : n
      ));
    } catch (error) {
      console.error("Confirm error:", error);
    } finally {
      setConfirmingId(null);
    }
  };

  const t = getUI(selectedLang || "en");
  const langInfo = languages.find(l => l.code === selectedLang);

  // ── Phase: Loading ──
  if (phase === "loading") {
    return (
      <main className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // ── Phase: Language Selection ──
  if (phase === "select-lang") {
    return (
      <main className="min-h-screen bg-mesh flex flex-col items-center justify-center p-4 selection:bg-blue-500/30">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/10 blur-[160px] rounded-full pointer-events-none" />

        <div className="z-10 w-full max-w-lg flex flex-col items-center">
          {/* Brand */}
          <div className="mb-12 flex flex-col items-center">
            <h1 className="text-6xl md:text-7xl font-black tracking-tighter italic">
              <span className="text-white">SAFE</span>
              <span className="text-blue-500">-</span>
              <span className="text-blue-500">LINK</span>
            </h1>
            <div className="mt-4 px-4 py-1.5 glass-card rounded-full flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-400 font-black tracking-[0.4em] uppercase">NFC CHECK-IN</span>
            </div>
          </div>

          {/* Language Grid */}
          <div className="w-full glass-card rounded-[32px] p-6 mb-6">
            <p className="text-center text-sm font-black text-blue-400/80 tracking-wider mb-8 uppercase">
              Select Your Language
            </p>

            <div className="grid grid-cols-4 gap-y-8 gap-x-3">
              {workerLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLangSelect(lang.code)}
                  className="flex flex-col items-center gap-2 group tap-effect"
                >
                  <div className="p-[2px] rounded-2xl bg-white/10 hover:bg-blue-500/40 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_10px_20px_-5px_rgba(59,130,246,0.4)]">
                    <div className="w-14 h-10 rounded-[14px] overflow-hidden bg-slate-900">
                      <Image
                        src={`https://flagcdn.com/w160/${lang.iso}.png`}
                        alt={lang.name}
                        width={160}
                        height={120}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-slate-500 group-hover:text-blue-400 transition-colors text-center leading-tight">
                    {lang.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-600 text-center font-bold">
            Powered by SAFE-LINK v2.5
          </p>
        </div>
      </main>
    );
  }

  // ── Phase: Checking In ──
  if (phase === "checking-in") {
    return (
      <main className="min-h-screen bg-mesh flex flex-col items-center justify-center p-4 gap-6">
        <div className="w-24 h-24 glass rounded-3xl flex items-center justify-center mb-4 animate-pulse">
          <svg className="w-14 h-14 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        {langInfo && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-7 rounded-lg overflow-hidden">
              <Image
                src={`https://flagcdn.com/w160/${langInfo.iso}.png`}
                alt={langInfo.name}
                width={160}
                height={120}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
            <span className="text-white font-black text-xl">{langInfo.name}</span>
          </div>
        )}
        <p className="text-blue-400 font-black text-lg tracking-wider animate-pulse">{t.checkingIn}</p>
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // ── Phase: Briefing ──
  return (
    <main className="min-h-screen bg-mesh p-4 pb-20 selection:bg-blue-500/30">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 pt-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black italic tracking-tighter">
              <span className="text-white">SAFE</span>
              <span className="text-blue-500">-LINK</span>
            </h1>
            <div className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
              <span className="text-[9px] text-green-400 font-black tracking-widest">{t.checkedIn}</span>
            </div>
          </div>
          {langInfo && (
            <div className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full">
              <div className="w-6 h-4 rounded overflow-hidden">
                <Image
                  src={`https://flagcdn.com/w80/${langInfo.iso}.png`}
                  alt={langInfo.name}
                  width={80}
                  height={60}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <span className="text-[10px] font-black text-slate-400">{langInfo.name}</span>
            </div>
          )}
        </header>

        {/* TBM Notices */}
        <h2 className="text-xl font-black text-white mb-4 tracking-tight">{t.todayBriefing}</h2>

        {notices.length === 0 ? (
          <div className="glass-card rounded-3xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 glass rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-slate-500 font-bold">{t.noBriefing}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {notices.map((notice) => (
              <div key={notice.id} className="glass-card rounded-3xl p-6 flex flex-col gap-4">
                {/* Title */}
                <h3 className="text-lg font-black text-white">{notice.translatedTitle}</h3>

                {/* Original (Korean) */}
                {selectedLang !== "ko" && (
                  <details className="group">
                    <summary className="text-[10px] font-black text-slate-600 tracking-wider cursor-pointer uppercase">
                      {t.original} (한국어) ▸
                    </summary>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">{notice.content}</p>
                  </details>
                )}

                {/* Translated Content */}
                <div className="bg-white/5 rounded-2xl p-4">
                  <p className="text-base text-white leading-relaxed whitespace-pre-wrap font-medium">
                    {notice.translatedContent}
                  </p>
                  {notice.pronunciation && (
                    <p className="mt-2 text-sm text-blue-400/70 leading-relaxed whitespace-pre-wrap">
                      {notice.pronunciation}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {/* Listen Button */}
                  <button
                    onClick={() => handlePlayAudio(notice.translatedContent, notice.id)}
                    disabled={isPlaying !== null}
                    className={`flex-1 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all tap-effect ${
                      isPlaying === notice.id
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                    }`}
                  >
                    {isPlaying === notice.id ? (
                      <>
                        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        {t.listening}
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                        {t.listen}
                      </>
                    )}
                  </button>

                  {/* Confirm Button */}
                  <button
                    onClick={() => handleConfirm(notice.id)}
                    disabled={notice.confirmed || confirmingId === notice.id}
                    className={`flex-1 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all tap-effect ${
                      notice.confirmed
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-gradient-to-br from-green-400 to-green-600 text-slate-950"
                    }`}
                  >
                    {notice.confirmed ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                        {t.confirmed}
                      </>
                    ) : confirmingId === notice.id ? (
                      <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t.confirmBtn}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-700 font-bold tracking-widest uppercase">
            SAFE-LINK v2.5 NFC Mode
          </p>
        </div>
      </div>
    </main>
  );
}

export default function NfcCheckInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-mesh flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <NfcCheckInContent />
    </Suspense>
  );
}
