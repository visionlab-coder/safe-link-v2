"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";
import SignatureCanvas from "react-signature-canvas";
import { PenLine, CheckCircle, RotateCcw, ArrowLeft, Loader } from "lucide-react";

const PLEDGE_KO = "본인은 오늘 TBM 안전 교육 내용을 충분히 이해하였으며, 작업 중 안전 수칙을 반드시 준수할 것을 서약합니다.";

const i18n: Record<string, { title: string; pledge: string; sign: string; clear: string; submit: string; success: string; back: string; loading: string; already: string }> = {
  ko: { title: "TBM 안전 서약", pledge: PLEDGE_KO, sign: "아래에 서명해주세요", clear: "지우기", submit: "서명 제출", success: "서약 완료", back: "돌아가기", loading: "처리 중...", already: "이미 서약하셨습니다" },
  en: { title: "TBM SAFETY PLEDGE", pledge: "I fully understand today's TBM safety briefing and pledge to comply with all safety regulations during work.", sign: "Please sign below", clear: "Clear", submit: "Submit Signature", success: "Pledge Complete", back: "Back", loading: "Processing...", already: "Already pledged" },
  zh: { title: "TBM 安全承诺", pledge: "本人已充分理解今日TBM安全教育内容，承诺在工作中严格遵守安全规定。", sign: "请在下方签名", clear: "清除", submit: "提交签名", success: "承诺完成", back: "返回", loading: "处理中...", already: "已完成承诺" },
  vi: { title: "CAM KẾT AN TOÀN TBM", pledge: "Tôi đã hiểu đầy đủ nội dung an toàn TBM hôm nay và cam kết tuân thủ các quy định an toàn trong khi làm việc.", sign: "Vui lòng ký bên dưới", clear: "Xóa", submit: "Gửi chữ ký", success: "Hoàn thành cam kết", back: "Quay lại", loading: "Đang xử lý...", already: "Đã cam kết" },
  th: { title: "คำมั่นสัญญา TBM", pledge: "ฉันเข้าใจเนื้อหาการอบรม TBM วันนี้อย่างครบถ้วนและสัญญาว่าจะปฏิบัติตามกฎความปลอดภัย", sign: "กรุณาเซ็นชื่อด้านล่าง", clear: "ลบ", submit: "ส่งลายเซ็น", success: "ลงนามเรียบร้อย", back: "กลับ", loading: "กำลังดำเนินการ...", already: "ลงนามแล้ว" },
  id: { title: "JANJI KESELAMATAN TBM", pledge: "Saya telah memahami sepenuhnya materi TBM hari ini dan berjanji untuk mematuhi semua peraturan keselamatan.", sign: "Tanda tangan di bawah", clear: "Hapus", submit: "Kirim Tanda Tangan", success: "Janji Selesai", back: "Kembali", loading: "Memproses...", already: "Sudah berjanji" },
};
const getT = (lang: string) => i18n[lang] ?? i18n["en"];

export default function WorkerPledgePage() {
  const router = useRouter();
  const sigRef = useRef<SignatureCanvas>(null);
  const [lang, setLang] = useState("ko");
  const [siteId, setSiteId] = useState("");
  const [tbmContent, setTbmContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/auth/login"); return; }

      const { data: prof } = await supabase
        .from("profiles")
        .select("preferred_lang, site_id")
        .eq("id", session.user.id)
        .maybeSingle();

      const workerLang = (prof as { preferred_lang?: string; site_id?: string } | null)?.preferred_lang ?? "ko";
      const wSiteId = (prof as { preferred_lang?: string; site_id?: string } | null)?.site_id ?? "";
      setLang(workerLang);
      setSiteId(wSiteId);

      const { data: notice } = await supabase
        .from("tbm_notices")
        .select("content_ko")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setTbmContent((notice as { content_ko?: string } | null)?.content_ko ?? "");
      setLoading(false);
    });
  }, [router]);

  const t = getT(lang);

  const handleClear = () => {
    sigRef.current?.clear();
    setEmpty(true);
  };

  const handleSubmit = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    if (!siteId) { alert("현장 정보가 없습니다. 관리자에게 문의하세요."); return; }
    setSubmitting(true);
    try {
      const signatureData = sigRef.current.toDataURL("image/png");
      const pledgeContent = tbmContent
        ? `${PLEDGE_KO}\n\n[TBM 내용]\n${tbmContent}`
        : PLEDGE_KO;

      const res = await fetch("/api/pledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          pledgeContent,
          signatureData,
        }),
      });

      if (res.ok) {
        setDone(true);
      } else {
        const data = await res.json() as { error?: string };
        alert(`제출 실패: ${data.error ?? "unknown"}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <RoleGuard allowedRole="worker">
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-6">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-14 h-14 text-green-400" />
          </div>
          <p className="text-white text-2xl font-black text-center">{t.success}</p>
          <p className="text-gray-500 text-sm text-center">
            서명이 블록체인 감사 체인에 기록되었습니다
          </p>
          <button
            onClick={() => router.push("/worker")}
            className="mt-4 px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-black rounded-2xl transition-colors"
          >
            {t.back}
          </button>
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRole="worker">
      <div className="min-h-screen bg-mesh text-white font-sans flex flex-col">
        <header className="flex items-center gap-4 p-4 border-b border-white/5">
          <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-black italic uppercase text-gradient">{t.title}</h1>
          </div>
        </header>

        <main className="flex-1 flex flex-col gap-6 p-4 pb-24 max-w-lg mx-auto w-full">
          <div className="relative h-40 w-full overflow-hidden rounded-[32px] border border-white/10 shadow-2xl">
            <Image src="/images/safelink-pages/tbm-briefing-field.png" alt="TBM safety pledge" fill className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          </div>

          <section className="glass rounded-[32px] p-6 border-white/10 flex flex-col gap-3">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">서약 내용</p>
            <p className="text-base font-bold text-white leading-relaxed">{t.pledge}</p>
            {tbmContent && (
              <div className="mt-2 p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">오늘의 TBM 내용</p>
                <p className="text-sm text-slate-400 leading-relaxed">{tbmContent}</p>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-slate-400">{t.sign}</p>
              <button onClick={handleClear} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
                {t.clear}
              </button>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden border-2 border-white/20">
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{ className: "w-full", height: 200, style: { width: "100%", display: "block" } }}
                penColor="#1a1a2e"
                onBegin={() => setEmpty(false)}
              />
            </div>
            {empty && (
              <p className="text-center text-slate-600 text-xs">손가락 또는 펜으로 서명하세요</p>
            )}
          </section>

          <button
            onClick={handleSubmit}
            disabled={submitting || empty}
            className="w-full py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-2
              bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600
              text-white transition-all tap-effect"
          >
            {submitting ? <><Loader className="w-5 h-5 animate-spin" />{t.loading}</> : <><PenLine className="w-5 h-5" />{t.submit}</>}
          </button>
        </main>
      </div>
    </RoleGuard>
  );
}
