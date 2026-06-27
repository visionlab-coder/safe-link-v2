"use client";

// 🔊 TTS 테스트 전용 페이지 — 기존 /api/tts(Google Neural2 + OpenAI tts-1-hd) 사용.
// 라이브 무영향. 로그인 상태로 /tts-test 접속.

import { useRef, useState } from "react";

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
    const [lang, setLang] = useState("ko");
    const [gender, setGender] = useState<"female" | "male">("female");
    const [text, setText] = useState(SAMPLE.ko);
    const [status, setStatus] = useState("");
    const [ms, setMs] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const onLang = (c: string) => { setLang(c); if (SAMPLE[c]) setText(SAMPLE[c]); };

    const play = async () => {
        if (!text.trim()) return;
        setStatus("합성 중…"); setMs(null);
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
            setStatus("▶ 재생 중");
        } catch (e) {
            setStatus(`❌ ${e instanceof Error ? e.message : "재생 실패"}`);
        }
    };

    return (
        <main style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>🔊 TTS 테스트</h1>
            <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                Google Neural2 / OpenAI tts-1-hd · 22개 언어. 라이브 무영향, 테스트 전용.
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ fontSize: 13 }}>
                    언어
                    <select value={lang} onChange={e => onLang(e.target.value)}
                        style={{ display: "block", marginTop: 4, padding: 8, width: 160 }}>
                        {LANGS.map(l => <option key={l.c} value={l.c}>{l.n} ({l.c})</option>)}
                    </select>
                </label>
                <label style={{ fontSize: 13 }}>
                    성별(음성)
                    <select value={gender} onChange={e => setGender(e.target.value as "female" | "male")}
                        style={{ display: "block", marginTop: 4, padding: 8, width: 120 }}>
                        <option value="female">여성</option>
                        <option value="male">남성</option>
                    </select>
                </label>
            </div>

            <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
                maxLength={1000}
                style={{ display: "block", width: "100%", marginTop: 16, padding: 10, fontSize: 15, fontFamily: "inherit" }} />
            <div style={{ fontSize: 11, color: "#999", textAlign: "right" }}>{text.length}/1000</div>

            <button onClick={play}
                style={{ marginTop: 8, padding: "12px 28px", fontSize: 15, fontWeight: 600, color: "#fff", border: "none", borderRadius: 8, background: "#2e86de", cursor: "pointer" }}>
                ▶ 재생
            </button>

            <div style={{ marginTop: 12, fontSize: 13 }}>
                {status}{ms !== null && <span style={{ color: "#27ae60", marginLeft: 10 }}>({ms}ms)</span>}
            </div>

            <audio ref={audioRef} controls style={{ marginTop: 16, width: "100%" }} />
        </main>
    );
}
