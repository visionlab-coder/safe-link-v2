"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import RoleGuard from "@/components/RoleGuard";

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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const riskColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    safe: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", badge: "bg-green-500" },
    caution: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", badge: "bg-amber-500" },
    danger: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", badge: "bg-red-500" },
};

const i18n: Record<string, Record<string, string>> = {
    ko: { title: "AI 위험 감지", subtitle: "사진을 찍으면 AI가 위험을 분석합니다", capture: "사진 촬영", choose: "앨범에서 선택", analyzing: "분석 중...", noItems: "건설 관련 항목을 찾지 못했습니다", back: "돌아가기", retake: "다시 촬영", found: "개 감지됨" },
    en: { title: "AI HAZARD SCAN", subtitle: "Take a photo and AI analyzes hazards", capture: "TAKE PHOTO", choose: "CHOOSE PHOTO", analyzing: "Analyzing...", noItems: "No construction items detected", back: "Back", retake: "Retake", found: "detected" },
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
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lang, setLang] = useState("ko");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [items, setItems] = useState<VisionItem[]>([]);
    const [hasResult, setHasResult] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [analysisError, setAnalysisError] = useState("");

    useEffect(() => {
        const loadLang = async () => {
            const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
            if (!res.ok) return;
            const data = await res.json() as { profile?: { preferred_lang?: string | null } | null };
            if (data.profile?.preferred_lang) setLang(data.profile.preferred_lang);
        };
        loadLang();
    }, []);

    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach((track) => track.stop());
        };
    }, []);

    useEffect(() => {
        if (!isCameraOpen || !videoRef.current || !streamRef.current) return;
        videoRef.current.srcObject = streamRef.current;
        void videoRef.current.play();
    }, [isCameraOpen]);

    const t = getT(lang);

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsCameraOpen(false);
    };

    const openCamera = async () => {
        setCameraError("");
        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError(lang === "ko"
                ? "이 브라우저에서는 카메라 촬영을 지원하지 않습니다. 최신 Safari에서 다시 시도해 주세요."
                : "Camera capture is unavailable. Please try the latest Safari.");
            return;
        }

        try {
            stopCamera();
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
            });
            streamRef.current = stream;
            setIsCameraOpen(true);
        } catch (err) {
            const errorName = err instanceof DOMException ? err.name : "";
            setCameraError(errorName === "NotAllowedError"
                ? (lang === "ko"
                    ? "카메라 권한이 거부되었습니다. iPhone 설정 → Safari → 카메라에서 허용한 뒤 다시 시도해 주세요."
                    : "Camera permission was denied. Allow camera access in Safari settings and try again.")
                : (lang === "ko"
                    ? "카메라를 시작하지 못했습니다. 다른 앱에서 카메라를 사용 중인지 확인해 주세요."
                    : "Could not start the camera. Check whether another app is using it."));
        }
    };

    const analyzeImage = async (dataUrl: string, mimeType: string) => {
        setAnalysisError("");
        setImagePreview(dataUrl);
        setIsAnalyzing(true);
        setItems([]);
        setHasResult(false);

        try {
            const base64 = dataUrl.split(",")[1];
            const res = await fetch("/api/vision", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64, lang, mimeType }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(String(data.error || `HTTP ${res.status}`));
            }
            setItems(data.items || []);
        } catch (err) {
            const reason = err instanceof Error ? err.message : "";
            console.error("[Vision] Error:", err);
            setItems([]);
            const message = (() => {
                if (reason.includes("vision_image_too_large") || reason.includes("Image too large")) {
                    return lang === "ko"
                        ? "사진 용량이 5MB를 초과했습니다. 해상도를 낮추거나 다시 촬영해 주세요."
                        : "The photo exceeds 5MB. Reduce its size or take another photo.";
                }
                if (
                    reason.includes("vision_image_type_not_allowed") ||
                    reason.includes("vision_image_base64_invalid") ||
                    reason.includes("vision_image_empty") ||
                    reason.includes("vision_image_signature_mismatch")
                ) {
                    return lang === "ko"
                        ? "지원하지 않거나 손상된 이미지입니다. JPG, PNG 또는 WEBP 사진으로 다시 시도해 주세요."
                        : "This image is unsupported or corrupted. Try a JPG, PNG, or WEBP photo.";
                }
                if (reason.includes("ai_quota_exceeded")) {
                    return lang === "ko"
                        ? "AI 분석 사용 한도에 도달했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요."
                        : "The AI analysis quota has been reached. Try later or contact an administrator.";
                }
                if (
                    reason.includes("ai_vendor_not_configured") ||
                    reason.includes("google_vision_not_configured") ||
                    reason.includes("google_vision_failed") ||
                    reason.includes("vision_api_failed")
                ) {
                    return lang === "ko"
                        ? "AI 분석 서비스를 사용할 수 없습니다. 관리자에게 문의해 주세요."
                        : "The AI analysis service is unavailable. Contact an administrator.";
                }
                return lang === "ko"
                    ? "AI 분석 요청에 실패했습니다. 연결 상태를 확인한 뒤 다시 촬영해 주세요."
                    : "The AI analysis request failed. Check your connection and try again.";
            })();
            setAnalysisError(message);
        } finally {
            setIsAnalyzing(false);
            setHasResult(true);
        }
    };

    const capturePhoto = () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight) {
            setCameraError(lang === "ko"
                ? "카메라 준비 중입니다. 잠시 후 다시 촬영해 주세요."
                : "The camera is still starting. Please try again.");
            return;
        }

        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        stopCamera();
        void analyzeImage(dataUrl, "image/jpeg");
    };

    const selectPhoto = (file: File | undefined) => {
        if (!file) return;
        setCameraError("");
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            setCameraError(lang === "ko"
                ? "지원하지 않는 파일입니다. JPG, PNG 또는 WEBP 이미지를 선택해 주세요."
                : "Unsupported file. Choose a JPG, PNG, or WEBP image.");
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setCameraError(lang === "ko"
                ? "사진 용량이 5MB를 초과했습니다. 더 작은 이미지를 선택해 주세요."
                : "The photo exceeds 5MB. Choose a smaller image.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") void analyzeImage(reader.result, file.type);
        };
        reader.onerror = () => setCameraError(lang === "ko"
            ? "이미지 파일을 읽지 못했습니다. 다른 파일을 선택해 주세요."
            : "Could not read the image. Choose another file.");
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

                <div className="relative h-40 w-full overflow-hidden rounded-[32px] border border-white/10 shadow-2xl">
                    <Image src="/images/safelink-pages/live-field-monitoring.png" alt="AI safety vision check" fill className="object-cover" priority />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                </div>

                {!imagePreview && !isCameraOpen && (
                    <>
                        <button
                            onClick={openCamera}
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
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(event) => {
                                selectPhoto(event.target.files?.[0]);
                                event.currentTarget.value = "";
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-black text-slate-200 tap-effect"
                        >
                            {t.choose || i18n.en.choose}
                        </button>
                    </>
                )}
                {isCameraOpen && !imagePreview && (
                    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="aspect-[3/4] max-h-[65vh] w-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-5 bg-gradient-to-t from-black/80 to-transparent px-6 pb-6 pt-14">
                            <button
                                type="button"
                                onClick={stopCamera}
                                className="rounded-full bg-slate-800/90 px-5 py-3 text-sm font-black text-white"
                            >
                                {t.back}
                            </button>
                            <button
                                type="button"
                                onClick={capturePhoto}
                                aria-label={t.capture}
                                className="h-20 w-20 rounded-full border-[6px] border-white bg-blue-500 shadow-2xl tap-effect"
                            />
                        </div>
                    </div>
                )}
                {cameraError && (
                    <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
                        {cameraError}
                    </div>
                )}
                {/* Image Preview */}
                {imagePreview && (
                    <div className="relative rounded-[32px] overflow-hidden border border-white/10">
                        <Image src={imagePreview} alt="Captured" width={1200} height={800} unoptimized className="w-full max-h-[400px] object-cover" />
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
                        {analysisError ? (
                            <div role="alert" className="glass rounded-[32px] border border-red-500/30 bg-red-500/10 p-8 text-center">
                                <p className="font-bold text-red-200">{analysisError}</p>
                            </div>
                        ) : items.length === 0 ? (
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
                            onClick={() => {
                                setImagePreview(null);
                                setItems([]);
                                setHasResult(false);
                                setAnalysisError("");
                                void openCamera();
                            }}
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
