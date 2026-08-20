"use client";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { ArrowLeft, BarChart3, Shield, Users, PenLine, AlertTriangle, Link, Mic, ChevronRight } from "lucide-react";
import ResponsiveFeatureHero from "@/components/ResponsiveFeatureHero";
import { visualizationSpecs } from "@/lib/visualization-specs";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const GUIDE_ESG_UI: Record<string, { title: string; description: string; intro: string; open: string }> = {
  ko: { title: "ESG 안전 리포트", description: "안전 활동 집계부터 ESG 지표 확인과 보고서 출력까지 안내합니다.", intro: "현장의 TBM 참석·서약·작업중지·장비 지급 실적을 ESG 지표로 자동 집계합니다. 발주처·본사 보고용 JSON 파일로 내보내기 가능합니다.", open: "ESG 안전 리포트 바로가기" },
  en: { title: "ESG Safety Report", description: "Learn how to aggregate safety activity, review ESG indicators, and export reports.", intro: "TBM attendance, pledges, stop-work requests, and equipment issuance are automatically aggregated as ESG indicators. Export a JSON file for clients and headquarters.", open: "Open ESG Safety Report" },
  zh: { title: "ESG 安全报告", description: "了解如何汇总安全活动、查看 ESG 指标并导出报告。", intro: "现场 TBM 参与、承诺、停工请求和设备发放会自动汇总为 ESG 指标，可导出供发包方和总部使用的 JSON 文件。", open: "打开 ESG 安全报告" },
  vi: { title: "Báo cáo an toàn ESG", description: "Hướng dẫn tổng hợp hoạt động an toàn, kiểm tra chỉ số ESG và xuất báo cáo.", intro: "Tham dự TBM, cam kết, yêu cầu dừng việc và cấp thiết bị được tổng hợp tự động thành chỉ số ESG. Có thể xuất tệp JSON cho chủ đầu tư và trụ sở.", open: "Mở báo cáo an toàn ESG" },
  ru: { title: "Отчёт ESG по безопасности", description: "Узнайте, как собрать данные по безопасности, проверить показатели ESG и выгрузить отчёт.", intro: "Участие в TBM, обязательства, запросы на остановку работ и выдача оборудования автоматически собираются в показатели ESG. Можно выгрузить JSON для заказчика и головного офиса.", open: "Открыть отчёт ESG" },
};

const ESG_GUIDE_LABELS: Record<string, Record<string, string>> = {
  ko: { cycle:"권장 운영 주기", sitePeriod:"현장 및 기간 선택", report:"리포트 생성", score:"ESG 점수 해석", export:"JSON 내보내기 (발주처·본사 보고)", faq:"자주 묻는 질문", site:"현장 선택", period:"기간 설정 예시", result:"결과 예시", file:"파일명 형식" },
  en: { cycle:"Recommended operating cycle", sitePeriod:"Select site and period", report:"Generate report", score:"Interpret ESG score", export:"Export JSON (client and HQ report)", faq:"Frequently asked questions", site:"Select worksite", period:"Period examples", result:"Sample result", file:"File name format" },
  zh: { cycle:"建议运营周期", sitePeriod:"选择现场和期间", report:"生成报告", score:"解读 ESG 分数", export:"导出 JSON（发包方和总部报告）", faq:"常见问题", site:"选择现场", period:"期间设置示例", result:"结果示例", file:"文件名格式" },
  vi: { cycle:"Chu kỳ vận hành khuyến nghị", sitePeriod:"Chọn công trường và thời gian", report:"Tạo báo cáo", score:"Diễn giải điểm ESG", export:"Xuất JSON (báo cáo chủ đầu tư và trụ sở)", faq:"Câu hỏi thường gặp", site:"Chọn công trường", period:"Ví dụ thiết lập thời gian", result:"Ví dụ kết quả", file:"Định dạng tên tệp" },
  ru: { cycle:"Рекомендуемый цикл работы", sitePeriod:"Выбор объекта и периода", report:"Создание отчёта", score:"Интерпретация оценки ESG", export:"Экспорт JSON (отчёт для заказчика и HQ)", faq:"Частые вопросы", site:"Выбор объекта", period:"Примеры периода", result:"Пример результата", file:"Формат имени файла" },
};

function StepCard({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white font-black text-sm shrink-0">
          {num}
        </div>
        <h2 className="font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const EXAMPLE_STATS = [
  { icon: Shield,        label: "TBM 세션",      value: "22",    sub: "참석 346명",        rate: 0.87, color: "blue"   },
  { icon: Users,         label: "이수 인증율",    value: "87%",   sub: "302 / 346명",       rate: 0.87, color: "green"  },
  { icon: PenLine,       label: "안전 서약",      value: "89",    sub: "서명완료 82건",     rate: 0.92, color: "purple" },
  { icon: AlertTriangle, label: "작업중지 요청",  value: "3",     sub: "해결 3 / 3",        rate: 1.0,  color: "red"    },
  { icon: Link,          label: "감사 체인",      value: "1,247", sub: "SHA-256 해시",      rate: undefined, color: "yellow" },
  { icon: Mic,           label: "실시간 통역",    value: "18",    sub: "다국어 세션",       rate: undefined, color: "cyan"   },
];

const colorTextMap: Record<string, string> = {
  blue: "text-blue-400", green: "text-green-400", purple: "text-purple-400",
  red: "text-red-400", yellow: "text-yellow-400", cyan: "text-cyan-400",
};
const colorBgMap: Record<string, string> = {
  blue: "bg-blue-500/10", green: "bg-green-500/10", purple: "bg-purple-500/10",
  red: "bg-red-500/10", yellow: "bg-yellow-500/10", cyan: "bg-cyan-500/10",
};
const colorBarMap: Record<string, string> = {
  blue: "bg-blue-500", green: "bg-green-500", purple: "bg-purple-500",
  red: "bg-red-500", yellow: "bg-yellow-500", cyan: "bg-cyan-500",
};

export default function GuideEsgPage() {
  const router = useRouter();
  const lang = useDisplayLanguage();
  const t = GUIDE_ESG_UI[lang] || GUIDE_ESG_UI.en;
  const labels = ESG_GUIDE_LABELS[lang] || ESG_GUIDE_LABELS.en;

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <div className="max-w-2xl mx-auto">

          <div className="concept-page-header">
            <button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-black tracking-tight text-[#063789]">SQ-LINK</span>
          </div>

          <ResponsiveFeatureHero visual={{ ...visualizationSpecs.esg, eyebrow: "SQ-LINK GUIDE · CLAIM 24", title: t.title, description: t.description }} />

          <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-4 mb-6 mt-4">
            <p className="text-sm text-emerald-300 leading-relaxed">
              {t.intro}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">{labels.cycle}</p>
            <div className="space-y-1.5">
              {[
                ["매월 1일",  "공무/안전관리자", "전월 리포트 생성 → JSON 저장"],
                ["매월 5일",  "현장소장",        "ESG 점수 확인 → 개선 지시"],
                ["매월 10일", "공무",            "본사 보고 (JSON 파일 전송)"],
              ].map(([date, who, task]) => (
                <div key={date} className="grid grid-cols-3 gap-2 text-xs py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-emerald-400 font-bold">{date}</span>
                  <span className="text-gray-400">{who}</span>
                  <span className="text-gray-300">{task}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">

            <StepCard num={1} title={labels.sitePeriod}>
              <p className="text-xs text-gray-500 mb-3">
                경로: <span className="text-emerald-400 font-mono">관리자 → ESG 안전 리포트</span>
              </p>
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{labels.site}</p>
                  <div className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                    SW-001 서원 인천계양 현장
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[["From", "2026-04-01"], ["To", "2026-04-30"]].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <div className="bg-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-white">{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">{labels.period}</p>
                <div className="space-y-1.5">
                  {[
                    ["전월 월간", "2026-04-01", "2026-04-30"],
                    ["당월 중간", "2026-05-01", "2026-05-13"],
                    ["분기",      "2026-04-01", "2026-06-30"],
                  ].map(([label, from, to]) => (
                    <div key={label} className="grid grid-cols-3 gap-2 text-xs bg-gray-800 rounded-lg px-3 py-2">
                      <span className="text-gray-400">{label}</span>
                      <span className="font-mono text-white">{from}</span>
                      <span className="font-mono text-white">{to}</span>
                    </div>
                  ))}
                </div>
              </div>
            </StepCard>

            <StepCard num={2} title={labels.report}>
              <p className="text-sm text-gray-300 mb-4">
                현장과 기간 선택 후 <strong className="text-white">[리포트 생성]</strong> 버튼 클릭 (약 2~3초 소요)
              </p>

              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">
                {labels.result} — 2026-04
              </p>
              <div className="grid grid-cols-2 gap-2">
                {EXAMPLE_STATS.map(({ icon: Icon, label, value, sub, rate, color }) => (
                  <div key={label} className="bg-gray-800 rounded-xl p-3.5 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-lg ${colorBgMap[color]} flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${colorTextMap[color]}`} />
                      </div>
                      {rate !== undefined && (
                        <span className={`text-sm font-black ${rate >= 0.8 ? "text-green-400" : rate >= 0.5 ? "text-yellow-400" : "text-red-400"}`}>
                          {(rate * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{label}</p>
                    <p className="text-2xl font-black text-white">{value}</p>
                    <p className="text-[11px] text-gray-500">{sub}</p>
                    {rate !== undefined && (
                      <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                        <div
                          className={`h-1 rounded-full ${rate >= 0.8 ? colorBarMap["green"] : rate >= 0.5 ? colorBarMap["yellow"] : colorBarMap["red"]}`}
                          style={{ width: `${Math.min(rate * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </StepCard>

            <StepCard num={3} title={labels.score}>
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">ESG 점수 계산</p>
                <div className="space-y-2">
                  {[
                    ["TBM 이수 인증율", "× 40점", "0.87 × 40 = 34.8"],
                    ["안전서약 서명율", "× 30점", "0.92 × 30 = 27.6"],
                    ["작업중지 해결율", "× 20점", "1.00 × 20 = 20.0"],
                    ["세션 실시 여부",  "× 10점", "1 × 10 = 10.0"],
                  ].map(([label, weight, calc]) => (
                    <div key={label} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-700 last:border-0">
                      <div>
                        <span className="text-gray-300">{label}</span>
                        <span className="text-gray-500 ml-1">{weight}</span>
                      </div>
                      <span className="font-mono text-emerald-400">{calc}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-end justify-between mt-3 pt-3 border-t border-gray-700">
                  <span className="text-sm font-bold text-gray-400">ESG 종합 점수</span>
                  <span className="text-3xl font-black text-emerald-400">92 <span className="text-lg text-gray-500">/ 100</span></span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { range: "90~100", grade: "우수", color: "text-green-400", bg: "bg-green-900/20 border-green-800/40", desc: "발주처 제출 가능" },
                  { range: "70~89", grade: "보통", color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-800/40", desc: "개선 항목 확인" },
                  { range: "70 미만", grade: "미흡", color: "text-red-400", bg: "bg-red-900/20 border-red-800/40", desc: "TBM 관리 점검" },
                ].map(({ range, grade, color, bg, desc }) => (
                  <div key={grade} className={`border rounded-xl p-3 text-center ${bg}`}>
                    <p className={`text-sm font-black ${color}`}>{grade}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{range}점</p>
                    <p className="text-[10px] text-gray-500 mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </StepCard>

            <StepCard num={4} title={labels.export}>
              <p className="text-sm text-gray-300 mb-3">
                리포트 생성 후 <strong className="text-white">[📥 JSON]</strong> 버튼 클릭 → 파일 자동 다운로드
              </p>
              <div className="bg-gray-800 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-500 mb-1">{labels.file}</p>
                <p className="text-xs font-mono text-white">esg_report_[현장ID]_2026-04-01_2026-04-30.json</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3 font-mono text-xs text-gray-300 overflow-x-auto">
                <pre>{`{
  "siteId": "a1b2c3...",
  "period": { "from": "2026-04-01", "to": "2026-04-30" },
  "tbm": {
    "totalSessions": 22,
    "totalAttendance": 346,
    "certificationRate": 0.873
  },
  "pledges": {
    "totalPledges": 89,
    "signedCount": 82,
    "signatureRate": 0.921
  },
  "stopWork": { "totalIncidents": 3, "resolvedCount": 3 },
  "safetyEquipment": { "totalGrants": 17 },
  "generatedAt": "2026-05-13T09:00:00.000Z"
}`}</pre>
              </div>
            </StepCard>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">{labels.faq}</p>
              <div className="space-y-4">
                {[
                  { q: "리포트가 비어 있어요.", a: "현장과 기간 선택 후 [리포트 생성] 버튼을 눌러야 집계됩니다." },
                  { q: "ESG 점수를 높이려면?", a: "① TBM 이수 인증율 관리 (40점) → ② 안전서약 서명 독려 (30점) → ③ 작업중지 즉시 해결 (20점) → ④ TBM 세션 빠짐없이 실시 (10점)" },
                  { q: "작업중지 요청이 0건이면?", a: "해결율을 100%로 자동 처리합니다 (분모 0 예외 처리). 정상입니다." },
                ].map(({ q, a }) => (
                  <div key={q}>
                    <p className="text-sm font-bold text-white mb-1">Q. {q}</p>
                    <p className="text-sm text-gray-400">A. {a}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => router.push("/admin/esg")}
              className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              {t.open}
              <ChevronRight className="w-4 h-4" />
            </button>

          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
