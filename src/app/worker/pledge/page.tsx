"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import RoleGuard from "@/components/RoleGuard";
import SignatureCanvas from "react-signature-canvas";
import { PenLine, CheckCircle, RotateCcw, ArrowLeft, Loader } from "lucide-react";
import { persistDisplayLanguage, useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const PLEDGE_KO = "본인은 오늘 TBM 안전 교육 내용을 충분히 이해하였으며, 작업 중 안전 수칙을 반드시 준수할 것을 서약합니다.";

const i18n: Record<string, { title: string; pledge: string; sign: string; clear: string; submit: string; success: string; back: string; loading: string; already: string; description: string; content: string; todayContent: string; hint: string; missingSite: string; submitFailed: string; recorded: string }> = {
  ko: { title: "TBM 안전 서약", pledge: PLEDGE_KO, sign: "아래에 서명해주세요", clear: "지우기", submit: "서명 제출", success: "서약 완료", back: "돌아가기", loading: "처리 중...", already: "이미 서약하셨습니다", description:"안전 서약 내용을 확인하고 서명합니다.", content:"서약 내용", todayContent:"오늘의 TBM 내용", hint:"손가락 또는 펜으로 서명하세요", missingSite:"현장 정보가 없습니다. 관리자에게 문의하세요.", submitFailed:"제출 실패", recorded:"서명이 블록체인 감사 체인에 기록되었습니다" },
  en: { title: "TBM SAFETY PLEDGE", pledge: "I fully understand today's TBM safety briefing and pledge to comply with all safety regulations during work.", sign: "Please sign below", clear: "Clear", submit: "Submit Signature", success: "Pledge Complete", back: "Back", loading: "Processing...", already: "Already pledged", description:"Review the safety pledge and sign it.", content:"Pledge", todayContent:"Today’s TBM content", hint:"Sign with your finger or a pen", missingSite:"Site information is unavailable. Please contact an administrator.", submitFailed:"Submission failed", recorded:"Your signature has been recorded in the blockchain audit chain" },
  zh: { title: "TBM 安全承诺", pledge: "本人已充分理解今日TBM安全教育内容，承诺在工作中严格遵守安全规定。", sign: "请在下方签名", clear: "清除", submit: "提交签名", success: "承诺完成", back: "返回", loading: "处理中...", already: "已完成承诺", description:"请确认安全承诺内容并签名。", content:"承诺内容", todayContent:"今日 TBM 内容", hint:"请用手指或笔签名", missingSite:"没有现场信息。请联系管理员。", submitFailed:"提交失败", recorded:"签名已记录到区块链审计链中" },
  vi: { title: "CAM KẾT AN TOÀN TBM", pledge: "Tôi đã hiểu đầy đủ nội dung an toàn TBM hôm nay và cam kết tuân thủ các quy định an toàn trong khi làm việc.", sign: "Vui lòng ký bên dưới", clear: "Xóa", submit: "Gửi chữ ký", success: "Hoàn thành cam kết", back: "Quay lại", loading: "Đang xử lý...", already: "Đã cam kết", description:"Xem nội dung cam kết an toàn và ký tên.", content:"Nội dung cam kết", todayContent:"Nội dung TBM hôm nay", hint:"Ký bằng ngón tay hoặc bút", missingSite:"Không có thông tin công trường. Hãy liên hệ quản trị viên.", submitFailed:"Gửi thất bại", recorded:"Chữ ký đã được ghi vào chuỗi kiểm toán blockchain" },
  ru: { title: "ОБЯЗАТЕЛЬСТВО ПО БЕЗОПАСНОСТИ TBM", pledge: "Я полностью понял содержание сегодняшнего инструктажа TBM и обязуюсь соблюдать все правила безопасности во время работы.", sign: "Поставьте подпись ниже", clear: "Очистить", submit: "Отправить подпись", success: "Обязательство подтверждено", back: "Назад", loading: "Обработка...", already: "Обязательство уже подтверждено", description:"Ознакомьтесь с обязательством по безопасности и поставьте подпись.", content:"Содержание обязательства", todayContent:"Содержание TBM на сегодня", hint:"Поставьте подпись пальцем или стилусом", missingSite:"Нет информации об объекте. Обратитесь к администратору.", submitFailed:"Ошибка отправки", recorded:"Подпись записана в цепочку аудита блокчейна" },
  th: { title: "คำมั่นสัญญา TBM", pledge: "ฉันเข้าใจเนื้อหาการอบรม TBM วันนี้อย่างครบถ้วนและสัญญาว่าจะปฏิบัติตามกฎความปลอดภัย", sign: "กรุณาเซ็นชื่อด้านล่าง", clear: "ลบ", submit: "ส่งลายเซ็น", success: "ลงนามเรียบร้อย", back: "กลับ", loading: "กำลังดำเนินการ...", already: "ลงนามแล้ว", description:"ตรวจสอบคำมั่นสัญญาด้านความปลอดภัยและลงนาม", content:"เนื้อหาคำมั่นสัญญา", todayContent:"เนื้อหา TBM วันนี้", hint:"ลงนามด้วยนิ้วหรือปากกา", missingSite:"ไม่มีข้อมูลหน้างาน โปรดติดต่อผู้ดูแล", submitFailed:"ส่งไม่สำเร็จ", recorded:"ลายเซ็นถูกบันทึกในห่วงโซ่การตรวจสอบบล็อกเชน" },
  id: { title: "JANJI KESELAMATAN TBM", pledge: "Saya telah memahami sepenuhnya materi TBM hari ini dan berjanji untuk mematuhi semua peraturan keselamatan.", sign: "Tanda tangan di bawah", clear: "Hapus", submit: "Kirim Tanda Tangan", success: "Janji Selesai", back: "Kembali", loading: "Memproses...", already: "Sudah berjanji", description:"Tinjau janji keselamatan dan tanda tangani.", content:"Isi janji", todayContent:"Materi TBM hari ini", hint:"Tanda tangani dengan jari atau pena", missingSite:"Informasi lokasi tidak tersedia. Hubungi administrator.", submitFailed:"Pengiriman gagal", recorded:"Tanda tangan dicatat di rantai audit blockchain" },
};
const getT = (lang: string) => i18n[lang] ?? i18n["en"];

export default function WorkerPledgePage() {
  const router = useRouter();
  const sigRef = useRef<SignatureCanvas>(null);
  const lang = useDisplayLanguage();
  const [siteId, setSiteId] = useState("");
  const [tbmContent, setTbmContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      if (!meRes.ok) {
        router.push("/auth/login");
        return;
      }
      const me = await meRes.json() as {
        profile?: { preferred_lang?: string | null; site_id?: string | null };
      };
      if (cancelled) return;
      persistDisplayLanguage(me.profile?.preferred_lang ?? "ko");
      setSiteId(me.profile?.site_id ?? "");

      const tbmRes = await fetch("/api/tbm/today?limit=1", { cache: "no-store" });
      const tbmPayload = tbmRes.ok
        ? await tbmRes.json() as { tbms?: Array<{ content_ko?: string | null; source_text?: string | null; normalized_text?: string | null }> }
        : null;
      if (!cancelled) {
        const notice = tbmPayload?.tbms?.[0];
        setTbmContent(notice?.content_ko ?? notice?.normalized_text ?? notice?.source_text ?? "");
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const t = getT(lang);

  const handleClear = () => {
    sigRef.current?.clear();
    setEmpty(true);
  };

  const handleSubmit = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    if (!siteId) { alert(t.missingSite); return; }
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
        alert(`${t.submitFailed}: ${data.error ?? "unknown"}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="visualization-light min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <RoleGuard allowedRole="worker">
        <div className="visualization-light min-h-screen flex flex-col items-center justify-center gap-6 px-6">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-14 h-14 text-green-400" />
          </div>
          <p className="text-white text-2xl font-black text-center">{t.success}</p>
          <p className="text-gray-500 text-sm text-center">
            {t.recorded}
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
      <div className="visualization-light min-h-screen font-sans flex flex-col">
        <header className="concept-page-header">
          <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-base font-black tracking-tight text-[#063789]">SQ-LINK</span>
          <div className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-blue-400" />
          </div>
        </header>

        <main className="flex-1 flex flex-col gap-6 p-4 pb-24 max-w-lg mx-auto w-full">
          <div className="admin-concept-hero relative h-40 w-full overflow-hidden rounded-[32px] border border-white/10 shadow-2xl">
            <picture>
              <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/documents.webp" />
              <Image src="/images/mobile-v3/website/documents.webp" alt="TBM safety pledge" fill className="object-cover" priority />
            </picture>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
            <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
              <p className="text-[10px] font-black tracking-[.18em] text-blue-200">SQ-LINK PLEDGE</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h1>
              <p className="mt-2 text-sm font-bold text-slate-100">{t.description}</p>
            </div>
          </div>

          <section className="glass rounded-[32px] p-6 border-white/10 flex flex-col gap-3">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.content}</p>
            <p className="text-base font-bold text-white leading-relaxed">{t.pledge}</p>
            {tbmContent && (
              <div className="mt-2 p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{t.todayContent}</p>
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
              <p className="text-center text-slate-600 text-xs">{t.hint}</p>
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
