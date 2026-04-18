"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";

interface VisionItem {
    name_ko: string;
    name_local: string;
    category: string;
    risk_level: "safe" | "caution" | "danger";
    safety_note_ko: string;
    safety_note_local: string;
}

const categoryIcons: Record<string, string> = {
    equipment: "⚙️", material: "🧱", hazard: "⚠️",
    ppe: "🦺", structure: "🏗️", tool: "🔧",
};

const riskColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    safe: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", badge: "bg-green-500" },
    caution: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", badge: "bg-amber-500" },
    danger: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", badge: "bg-red-500" },
};

const i18n: Record<string, Record<string, string>> = {
    ko: { title: "AI 위험 감지", subtitle: "사진을 찍으면 AI가 위험을 분석합니다", capture: "사진 촬영", analyzing: "분석 중...", noItems: "건설 관련 항목을 찾지 못했습니다", back: "돌아가기", retake: "다시 촬영", found: "개 감지됨" },
    en: { title: "AI HAZARD SCAN", subtitle: "Take a photo and AI analyzes hazards", capture: "TAKE PHOTO", analyzing: "Analyzing...", noItems: "No construction items detected", back: "Back", retake: "Retake", found: "detected" },
    zh: { title: "AI危险检测", subtitle: "拍照后AI自动分析危险", capture: "拍照", analyzing: "分析中...", noItems: "未检测到建筑相关项目", back: "返回", retake: "重新拍照", found: "项检测到" },
    vi: { title: "AI PHÁT HIỆN NGUY HIỂM", subtitle: "Chụp ảnh để AI phân tích nguy hiểm", capture: "CHỤP ẢNH", analyzing: "Đang phân tích...", noItems: "Không phát hiện mục liên quan", back: "Quay lại", retake: "Chụp lại", found: "đã phát hiện" },
    th: { title: "AI ตรวจจับอันตราย", subtitle: "ถ่ายรูปแล้ว AI จะวิเคราะห์อันตราย", capture: "ถ่ายรูป", analyzing: "กำลังวิเคราะห์...", noItems: "ไม่พบรายการที่เกี่ยวข้อง", back: "กลับ", retake: "ถ่ายใหม่", found: "ตรวจพบ" },
    uz: { title: "AI XAVF", subtitle: "Rasm oling, AI tahlil qiladi", capture: "RASM OLISH", analyzing: "Tahlil qilinmoqda...", noItems: "Qurilish ob'ektlari topilmadi", back: "Orqaga", retake: "Qayta olish", found: "topildi" },
    ph: { title: "AI HAZARD SCAN", subtitle: "Kumuha ng larawan para suriin ng AI", capture: "KUMUHA NG LARAWAN", analyzing: "Sinusuri...", noItems: "Walang naitalang konstruksyon", back: "Bumalik", retake: "Kumuha Ulit", found: "natukoy" },
    ru: { title: "AI АНАЛИЗ", subtitle: "Сфотографируйте для анализа AI", capture: "СФОТОГРАФИРОВАТЬ", analyzing: "Анализ...", noItems: "Строительные объекты не обнаружены", back: "Назад", retake: "Переснять", found: "обнаружено" },
    km: { title: "AI រកគ្រោះថ្នាក់", subtitle: "ថតរូបដើម្បី AI វិភាគ", capture: "ថតរូប", analyzing: "កំពុងវិភាគ...", noItems: "រកមិនឃើញធាតុសំណង់", back: "ត្រឡប់", retake: "ថតម្តងទៀត", found: "ត្រូវបានរកឃើញ" },
    mn: { title: "AI АЮУЛ", subtitle: "Зураг авахад AI шинжилнэ", capture: "ЗУРАГ АВАХ", analyzing: "Шинжилж байна...", noItems: "Барилгын объект олдсонгүй", back: "Буцах", retake: "Дахин авах", found: "илрүүлсэн" },
    my: { title: "AI အန္တရာယ် ရှာဖွေ", subtitle: "ဓာတ်ပုံ ရိုက်ပါ AI စစ်ဆေးမည်", capture: "ဓာတ်ပုံ ရိုက်ပါ", analyzing: "စစ်ဆေးနေသည်...", noItems: "ဆောက်လုပ်ရေး ပစ္စည်းများ မတွေ့ပါ", back: "ပြန်သွားပါ", retake: "ပြန်ရိုက်ပါ", found: "တွေ့ရှိသည်" },
    ne: { title: "AI खतरा पहिचान", subtitle: "फोटो खिचे AI ले विश्लेषण गर्छ", capture: "फोटो खिच्नुहोस्", analyzing: "विश्लेषण गर्दै...", noItems: "निर्माण सम्बन्धित वस्तु फेला परेन", back: "फिर्ता", retake: "पुनः खिच्नुहोस्", found: "पहिचान भयो" },
    bn: { title: "AI বিপদ শনাক্তকরণ", subtitle: "ছবি তুলুন AI বিশ্লেষণ করবে", capture: "ছবি তুলুন", analyzing: "বিশ্লেষণ হচ্ছে...", noItems: "নির্মাণ সম্পর্কিত কিছু পাওয়া যায়নি", back: "ফিরে যান", retake: "পুনরায় তুলুন", found: "শনাক্ত করা হয়েছে" },
    kk: { title: "AI ҚАУІП", subtitle: "Сурет түсіріңіз, AI талдайды", capture: "СУРЕТ ТҮСІРУ", analyzing: "Талдануда...", noItems: "Құрылыс объектілері табылмады", back: "Артқа", retake: "Қайта түсіру", found: "анықталды" },
    ar: { title: "فحص المخاطر AI", subtitle: "التقط صورة وسيحلل الذكاء الاصطناعي المخاطر", capture: "التقاط صورة", analyzing: "جارٍ التحليل...", noItems: "لم يتم اكتشاف عناصر بناء", back: "رجوع", retake: "إعادة الالتقاط", found: "تم اكتشافه" },
    hi: { title: "AI खतरा पहचान", subtitle: "फोटो लें और AI खतरे का विश्लेषण करेगा", capture: "फोटो लें", analyzing: "विश्लेषण हो रहा है...", noItems: "निर्माण संबंधी कोई वस्तु नहीं मिली", back: "वापस जाएं", retake: "पुनः लें", found: "पाया गया" },
    id: { title: "AI DETEKSI BAHAYA", subtitle: "Ambil foto dan AI akan menganalisis bahaya", capture: "AMBIL FOTO", analyzing: "Menganalisis...", noItems: "Tidak ada item konstruksi yang terdeteksi", back: "Kembali", retake: "Ambil Ulang", found: "terdeteksi" },
};
const getT = (lang: string) => i18n[lang] || i18n["en"];

export default function WorkerVisionPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lang, setLang] = useState("ko");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [items, setItems] = useState<VisionItem[]>([]);
    const [hasResult, setHasResult] = useState(false);

    useEffect(() => {
        const loadLang = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase.from("profiles").select("preferred_lang").eq("id", session.user.id).single();
                if (data?.preferred_lang) setLang(data.preferred_lang);
            }
        };
        loadLang();
    }, []);

    const t = getT(lang);

    const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Preview
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const dataUrl = ev.target?.result as string;
            setImagePreview(dataUrl);
            setIsAnalyzing(true);
            setItems([]);
            setHasResult(false);

            try {
                // Extract base64 data (remove data:image/...;base64, prefix)
                const base64 = dataUrl.split(",")[1];
                const res = await fetch("/api/vision", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: base64, lang }),
                });
                const data = await res.json();
                setItems(data.items || []);
            } catch (err) {
                console.error("[Vision] Error:", err);
                setItems([]);
            } finally {
                setIsAnalyzing(false);
                setHasResult(true);
            }
        };
        reader.readAsDataURL(file);
    };

    const dangerCount = items.filter(i => i.risk_level === "danger").length;
    const cautionCount = items.filter(i => i.risk_level === "caution").length;

    return (
        <RoleGuard allowedRole="worker">
            <div className="min-h-screen bg-mesh text-white p-4 md:p-8 flex flex-col gap-6 pb-12 font-sans">
                {/* Header */}
                <header className="flex items-center gap-4">
                    <button onClick={() => router.push("/worker")} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors tap-effect text-slate-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight uppercase italic text-gradient">{t.title}</h1>
                        <p className="text-slate-500 text-xs font-bold">{t.subtitle}</p>
                    </div>
                </header>

                {/* Camera Capture */}
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />

                {!imagePreview && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 min-h-[300px] glass rounded-[48px] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-6 tap-effect hover:border-blue-500/30 transition-all group"
                    >
                        <div className="w-24 h-24 glass rounded-[32px] flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                            <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                            </svg>
                        </div>
                        <span className="text-xl font-black text-slate-400 uppercase tracking-widest">{t.capture}</span>
                    </button>
                )}

                {/* Image Preview */}
                {imagePreview && (
                    <div className="relative rounded-[32px] overflow-hidden border border-white/10">
                        <img src={imagePreview} alt="Captured" className="w-full max-h-[400px] object-cover" />
                        {isAnalyzing && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-lg font-black text-white uppercase tracking-widest">{t.analyzing}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Summary Bar */}
                {hasResult && items.length > 0 && (
                    <div className="flex gap-3">
                        <div className="flex-1 glass rounded-2xl p-4 text-center border-white/5">
                            <span className="text-3xl font-black text-white">{items.length}</span>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.found}</p>
                        </div>
                        {dangerCount > 0 && (
                            <div className="flex-1 glass rounded-2xl p-4 text-center border-red-500/20 bg-red-500/5">
                                <span className="text-3xl font-black text-red-400">{dangerCount}</span>
                                <p className="text-[10px] font-black text-red-500/60 uppercase tracking-widest">DANGER</p>
                            </div>
                        )}
                        {cautionCount > 0 && (
                            <div className="flex-1 glass rounded-2xl p-4 text-center border-amber-500/20 bg-amber-500/5">
                                <span className="text-3xl font-black text-amber-400">{cautionCount}</span>
                                <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest">CAUTION</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Results */}
                {hasResult && (
                    <div className="flex flex-col gap-4">
                        {items.length === 0 ? (
                            <div className="glass rounded-[32px] p-12 text-center border-white/5">
                                <p className="text-slate-500 font-bold">{t.noItems}</p>
                            </div>
                        ) : (
                            items
                                .sort((a, b) => {
                                    const order = { danger: 0, caution: 1, safe: 2 };
                                    return (order[a.risk_level] ?? 2) - (order[b.risk_level] ?? 2);
                                })
                                .map((item, idx) => {
                                    const rc = riskColors[item.risk_level] || riskColors.safe;
                                    return (
                                        <div key={idx} className={`glass rounded-[28px] p-6 ${rc.bg} ${rc.border} border flex flex-col gap-3`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{categoryIcons[item.category] || "📋"}</span>
                                                    <div>
                                                        <p className="text-lg font-black text-white">{item.name_ko}</p>
                                                        <p className={`text-sm font-bold ${rc.text}`}>{item.name_local}</p>
                                                    </div>
                                                </div>
                                                <span className={`${rc.badge} text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest`}>
                                                    {item.risk_level}
                                                </span>
                                            </div>
                                            <div className="bg-black/20 rounded-2xl p-4">
                                                <p className="text-sm text-slate-300 font-bold">{item.safety_note_ko}</p>
                                                <p className={`text-sm font-bold mt-1 ${rc.text}`}>{item.safety_note_local}</p>
                                            </div>
                                        </div>
                                    );
                                })
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                {hasResult && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setImagePreview(null); setItems([]); setHasResult(false); fileInputRef.current?.click(); }}
                            className="flex-1 py-5 glass rounded-[24px] border-white/10 text-white font-black tap-effect"
                        >
                            {t.retake}
                        </button>
                        <button
                            onClick={() => router.push("/worker")}
                            className="flex-1 py-5 bg-blue-600 rounded-[24px] text-white font-black tap-effect"
                        >
                            {t.back}
                        </button>
                    </div>
                )}
            </div>
        </RoleGuard>
    );
}
