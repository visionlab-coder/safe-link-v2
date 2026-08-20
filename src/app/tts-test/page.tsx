"use client";

// 🔊 TTS 테스트 전용 페이지 — 기존 /api/tts(Google Neural2 + OpenAI tts-1-hd) 사용.
// 라이브 무영향. 로그인 상태로 /tts-test 접속.

import { useRef, useState } from "react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const TTS_UI: Record<string, Record<string, string>> = {
    ko: { title:"TTS 테스트", desc:"Google Neural2 / OpenAI tts-1-hd · 22개 언어. 운영 화면에는 영향을 주지 않는 테스트 전용입니다.", language:"언어", gender:"성별(음성)", female:"여성", male:"남성", play:"재생", synthesizing:"합성 중…", playing:"▶ 재생 중", playFailed:"재생 실패" },
    en: { title:"TTS Test", desc:"Google Neural2 / OpenAI tts-1-hd · 22 languages. Test-only and does not affect the production screen.", language:"Language", gender:"Voice gender", female:"Female", male:"Male", play:"Play", synthesizing:"Synthesizing…", playing:"▶ Playing", playFailed:"Playback failed" },
    zh: { title:"TTS 测试", desc:"Google Neural2 / OpenAI tts-1-hd · 支持 22 种语言。仅用于测试，不影响运营画面。", language:"语言", gender:"声音性别", female:"女声", male:"男声", play:"播放", synthesizing:"正在合成…", playing:"▶ 正在播放", playFailed:"播放失败" },
    vi: { title:"Kiểm tra TTS", desc:"Google Neural2 / OpenAI tts-1-hd · 22 ngôn ngữ. Chỉ dùng để kiểm tra và không ảnh hưởng màn hình vận hành.", language:"Ngôn ngữ", gender:"Giới tính giọng nói", female:"Nữ", male:"Nam", play:"Phát", synthesizing:"Đang tổng hợp…", playing:"▶ Đang phát", playFailed:"Không thể phát" },
    ru: { title:"Проверка TTS", desc:"Google Neural2 / OpenAI tts-1-hd · 22 языка. Только для тестирования, не влияет на рабочий экран.", language:"Язык", gender:"Голос", female:"Женский", male:"Мужской", play:"Воспроизвести", synthesizing:"Синтез…", playing:"▶ Воспроизведение", playFailed:"Не удалось воспроизвести" },
};

const LANGS = [
    { c: "ko", n: "한국어" }, { c: "en", n: "English" }, { c: "zh", n: "中文" },
    { c: "vi", n: "Tiếng Việt" }, { c: "ja", n: "日本語" }, { c: "th", n: "ไทย" },
    { c: "id", n: "Indonesia" }, { c: "ph", n: "Filipino" }, { c: "ru", n: "Русский" },
    { c: "uz", n: "Oʻzbek" }, { c: "ne", n: "नेपाली" }, { c: "km", n: "ខ្មែរ" },
    { c: "my", n: "မြန်မာ" }, { c: "hi", n: "हिन्दी" }, { c: "bn", n: "বাংলা" },
    { c: "ar", n: "العربية" }, { c: "fr", n: "Français" }, { c: "es", n: "Español" },
    { c: "mn", n: "Монгол" }, { c: "kk", n: "Қазақ" },
];

const SAMPLE: Record<string, string> = {
    ko: "안전모를 반드시 착용하시고 고소작업 시 추락에 주의하세요.",
    en: "Always wear your safety helmet and watch for falls during high-altitude work.",
    vi: "Luôn đội mũ bảo hộ và cẩn thận khi làm việc trên cao.",
    zh: "请务必佩戴安全帽，高空作业时小心坠落。",
};

export default function TtsTestPage() {
    const displayLanguage = useDisplayLanguage();
    const t = TTS_UI[displayLanguage] ?? TTS_UI.en;
    const [lang, setLang] = useState("ko");
    const [gender, setGender] = useState<"female" | "male">("female");
    const [text, setText] = useState(SAMPLE.ko);
    const [status, setStatus] = useState("");
    const [ms, setMs] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const onLang = (c: string) => { setLang(c); if (SAMPLE[c]) setText(SAMPLE[c]); };

    const play = async () => {
        if (!text.trim()) return;
        setStatus(t.synthesizing); setMs(null);
        const t0 = performance.now();
        try {
            const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&gender=${gender}`;
            const res = await fetch(url);
            if (!res.ok) { setStatus(`❌ ${res.status} ${await res.text()}`); return; }
            const blob = await res.blob();
            setMs(Math.round(performance.now() - t0));
            const audio = audioRef.current!;
            audio.src = URL.createObjectURL(blob);
            await audio.play();
            setStatus(t.playing);
        } catch (e) {
            setStatus(`❌ ${e instanceof Error ? e.message : t.playFailed}`);
        }
    };

    return (
        <main style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>🔊 {t.title}</h1>
            <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                {t.desc}
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ fontSize: 13 }}>
                    {t.language}
                    <select value={lang} onChange={e => onLang(e.target.value)}
                        style={{ display: "block", marginTop: 4, padding: 8, width: 160 }}>
                        {LANGS.map(l => <option key={l.c} value={l.c}>{l.n} ({l.c})</option>)}
                    </select>
                </label>
                <label style={{ fontSize: 13 }}>
                    {t.gender}
                    <select value={gender} onChange={e => setGender(e.target.value as "female" | "male")}
                        style={{ display: "block", marginTop: 4, padding: 8, width: 120 }}>
                        <option value="female">{t.female}</option>
                        <option value="male">{t.male}</option>
                    </select>
                </label>
            </div>

            <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
                maxLength={1000}
                style={{ display: "block", width: "100%", marginTop: 16, padding: 10, fontSize: 15, fontFamily: "inherit" }} />
            <div style={{ fontSize: 11, color: "#999", textAlign: "right" }}>{text.length}/1000</div>

            <button onClick={play}
                style={{ marginTop: 8, padding: "12px 28px", fontSize: 15, fontWeight: 600, color: "#fff", border: "none", borderRadius: 8, background: "#2e86de", cursor: "pointer" }}>
                ▶ {t.play}
            </button>

            <div style={{ marginTop: 12, fontSize: 13 }}>
                {status}{ms !== null && <span style={{ color: "#27ae60", marginLeft: 10 }}>({ms}ms)</span>}
            </div>

            <audio ref={audioRef} controls style={{ marginTop: 16, width: "100%" }} />
        </main>
    );
}
