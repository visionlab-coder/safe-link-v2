import { notFound } from "next/navigation";
import { verifyReportIntegrity } from "@/utils/reports/verification-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_UI: Record<string, Record<string, string>> = {
  ko: { notFound:"보고서를 찾을 수 없습니다", notFoundDesc:"요청하신 보고서 ID가 존재하지 않거나 만료되었습니다.", eyebrow:"SQ Link · 보고서 무결성 검증", success:"✅ 검증 성공", tampered:"🚨 변조 감지", partial:"⚠️ 부분 검증", info:"보고서 정보", type:"유형", created:"생성일", retention:"보존 만료", integrity:"무결성 검증 결과", sha:"SHA-256 해시 일치 (제공된 h 파라미터)", perceptual:"인지 해시 일치 (페이로드 형식 변조 감지)", privacy:"공개 검증 화면에는 보고서 내용, 현장 식별자, 근로자 정보 및 원본 해시를 표시하지 않습니다.", footer:"본 검증은 SQ Link V2 시스템이 자동 산출한 결과입니다.", patent:"특허 청구항 11 무결성 검증 메커니즘에 따라 보고서 변조 여부를 판단합니다." },
  en: { notFound:"Report not found", notFoundDesc:"The requested report ID does not exist or has expired.", eyebrow:"SQ Link · Report integrity verification", success:"✅ Verification successful", tampered:"🚨 Tampering detected", partial:"⚠️ Partial verification", info:"Report information", type:"Type", created:"Created at", retention:"Retention expiry", integrity:"Integrity verification result", sha:"SHA-256 hash match (provided h parameter)", perceptual:"Perceptual hash match (payload format tampering detection)", privacy:"The public verification screen does not display report contents, site identifiers, worker information, or the original hash.", footer:"This verification result is generated automatically by the SQ Link V2 system.", patent:"It determines whether the report was altered under the integrity verification mechanism of Patent Claim 11." },
  zh: { notFound:"找不到报告", notFoundDesc:"请求的报告 ID 不存在或已过期。", eyebrow:"SQ Link · 报告完整性验证", success:"✅ 验证成功", tampered:"🚨 检测到篡改", partial:"⚠️ 部分验证", info:"报告信息", type:"类型", created:"创建日期", retention:"保留到期日", integrity:"完整性验证结果", sha:"SHA-256 哈希匹配（提供的 h 参数）", perceptual:"感知哈希匹配（检测载荷格式篡改）", privacy:"公开验证页面不会显示报告内容、现场标识、工人信息或原始哈希。", footer:"本验证结果由 SQ Link V2 系统自动生成。", patent:"根据专利权利要求 11 的完整性验证机制判断报告是否被篡改。" },
  vi: { notFound:"Không tìm thấy báo cáo", notFoundDesc:"ID báo cáo được yêu cầu không tồn tại hoặc đã hết hạn.", eyebrow:"SQ Link · Xác minh tính toàn vẹn báo cáo", success:"✅ Xác minh thành công", tampered:"🚨 Phát hiện can thiệp", partial:"⚠️ Xác minh một phần", info:"Thông tin báo cáo", type:"Loại", created:"Ngày tạo", retention:"Hết hạn lưu trữ", integrity:"Kết quả xác minh toàn vẹn", sha:"Khớp băm SHA-256 (tham số h được cung cấp)", perceptual:"Khớp băm cảm nhận (phát hiện thay đổi định dạng tải trọng)", privacy:"Màn hình xác minh công khai không hiển thị nội dung báo cáo, định danh công trường, thông tin công nhân hoặc băm gốc.", footer:"Kết quả này được hệ thống SQ Link V2 tự động tạo. ", patent:"Cơ chế xác minh toàn vẹn của Yêu cầu sáng chế 11 xác định báo cáo có bị thay đổi hay không." },
  ru: { notFound:"Отчёт не найден", notFoundDesc:"Запрошенный ID отчёта не существует или срок его действия истёк.", eyebrow:"SQ Link · Проверка целостности отчёта", success:"✅ Проверка успешна", tampered:"🚨 Обнаружено изменение", partial:"⚠️ Частичная проверка", info:"Сведения об отчёте", type:"Тип", created:"Дата создания", retention:"Окончание хранения", integrity:"Результат проверки целостности", sha:"Совпадение хеша SHA-256 (переданный параметр h)", perceptual:"Совпадение перцептивного хеша (обнаружение изменения формата данных)", privacy:"На публичном экране проверки не отображаются содержание отчёта, идентификатор объекта, сведения о работниках и исходный хеш.", footer:"Этот результат автоматически сформирован системой SQ Link V2.", patent:"Механизм проверки целостности по пункту 11 патента определяет, был ли отчёт изменён." },
};
const VERIFY_LOCALES: Record<string, string> = { ko:"ko-KR", en:"en-US", zh:"zh-CN", vi:"vi-VN", ru:"ru-RU" };

/**
 * 특허 청구항 11 — 보고서 검증 공개 페이지.
 *
 * 누구나 QR 스캔으로 진입해 SHA-256 + 인지해시 일치 여부를 한눈에 확인.
 * /verify/{reportId}?h={report_hash}
 */
export default async function VerifyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ h?: string; lang?: string }>;
}) {
  const { reportId } = await params;
  const { h, lang: requestedLang } = await searchParams;
  const t = VERIFY_UI[requestedLang || "ko"] || VERIFY_UI.en;
  const locale = VERIFY_LOCALES[requestedLang || "ko"] || VERIFY_LOCALES.en;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) {
    notFound();
  }

  const result = await verifyReportIntegrity(reportId, h ?? null);
  if (!result.ok) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-slate-900 border border-red-900 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-black mb-2">{t.notFound}</h1>
          <p className="text-sm text-slate-400">
            {t.notFoundDesc}
          </p>
          <p className="text-xs text-slate-600 mt-4">report_id: {reportId}</p>
        </div>
      </main>
    );
  }

  const { envelope, integrity } = result;
  const sha = integrity.sha256_hash_match;
  const perc = integrity.perceptual_hash_match;
  const allOk = sha === true && perc === true;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-black tracking-widest text-blue-400 uppercase">
            {t.eyebrow}
          </p>
          <h1 className="text-3xl font-black mt-2">
            {allOk ? t.success : sha === false || perc === false ? t.tampered : t.partial}
          </h1>
        </div>

        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="font-black mb-4 text-blue-300">{t.info}</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">{t.type}</dt>
              <dd className="font-bold">{envelope.report_type}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.created}</dt>
              <dd>{new Date(envelope.created_at).toLocaleString(locale)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.retention}</dt>
              <dd>
                {envelope.retention_until
                  ? new Date(envelope.retention_until).toLocaleDateString(locale)
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="font-black mb-4 text-blue-300">{t.integrity}</h2>
          <div className="space-y-3">
            <Row
              label={t.sha}
              status={sha}
            />
            <Row
              label={t.perceptual}
              status={perc}
            />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            {t.privacy}
          </p>
        </div>

        <div className="text-xs text-slate-500 text-center">
          {t.footer}
          <br />
          {t.patent}
        </div>
      </div>
    </main>
  );
}

function Row({ label, status }: { label: string; status: boolean | null }) {
  const icon = status === true ? "✅" : status === false ? "❌" : "—";
  const cls = status === true ? "text-emerald-400" : status === false ? "text-red-400" : "text-slate-500";
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <span className={`text-lg font-black ${cls}`}>{icon}</span>
    </div>
  );
}
