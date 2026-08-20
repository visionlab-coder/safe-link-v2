"use client";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { ArrowLeft, Wifi, Award, BarChart3, ChevronRight } from "lucide-react";
import ResponsiveFeatureHero from "@/components/ResponsiveFeatureHero";
import { visualizationSpecs } from "@/lib/visualization-specs";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

type Guide = {
  href: string;
  icon: typeof Wifi;
  color: string;
  title: string;
  desc: string;
  steps: string[];
  badge: string;
};

type GuideCopy = {
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  contact: string;
  contactPerson: string;
  guides: Guide[];
};

const GUIDE_META = [
  {
    href: "/admin/guide/nfc",
    icon: Wifi,
    color: "cyan",
  },
  {
    href: "/admin/guide/incentive",
    icon: Award,
    color: "yellow",
  },
  {
    href: "/admin/guide/esg",
    icon: BarChart3,
    color: "emerald",
  },
];

const GUIDE_UI: Record<string, GuideCopy> = {
  ko: {
    heroEyebrow: "SQ-LINK GUIDE", heroTitle: "기능 사용 가이드", heroDescription: "처음 담당하는 직원을 위한 단계별 안내", contact: "문의", contactPerson: "미래전략TF 김무빈 차장",
    guides: [
      { ...GUIDE_META[0], title: "NFC 근로자 관리", desc: "근로자 등록 → NFC 스티커 발급 → TBM 참석 인증", steps: ["근로자 정보 등록", "NFC 스티커 기록·부착", "TBM 세션 개설 및 태그"], badge: "청구항 1-5" },
      { ...GUIDE_META[1], title: "안전장비 인센티브", desc: "퀴즈 80점↑ 근로자에게 안전장비 지급 및 이력 기록", steps: ["퀴즈 세션 선택", "점수별 대상자 확인", "장비 유형 선택 후 지급 확정"], badge: "청구항 12" },
      { ...GUIDE_META[2], title: "ESG 안전 리포트", desc: "기간별 안전 활동 집계 → ESG 점수 산출 → JSON 출력", steps: ["현장·기간 선택", "리포트 생성", "점수 해석 및 JSON 내보내기"], badge: "청구항 24" },
    ],
  },
  en: {
    heroEyebrow: "SQ-LINK GUIDE", heroTitle: "Feature Guide", heroDescription: "Step-by-step guidance for new operators", contact: "Contact", contactPerson: "Future Strategy TF · Deputy General Manager Kim Mu-bin",
    guides: [
      { ...GUIDE_META[0], title: "NFC Worker Management", desc: "Register worker → issue NFC tag → verify TBM attendance", steps: ["Register worker details", "Write and attach NFC tag", "Create a TBM session and tag in"], badge: "Claims 1–5" },
      { ...GUIDE_META[1], title: "Safety Equipment Incentives", desc: "Issue safety equipment to workers scoring 80+ on quizzes and keep records", steps: ["Select a quiz session", "Review eligible workers by score", "Choose equipment and confirm issue"], badge: "Claim 12" },
      { ...GUIDE_META[2], title: "ESG Safety Report", desc: "Aggregate safety activity → calculate ESG score → export JSON", steps: ["Select site and period", "Create report", "Review score and export JSON"], badge: "Claim 24" },
    ],
  },
  zh: {
    heroEyebrow: "SQ-LINK 指南", heroTitle: "功能使用指南", heroDescription: "为新负责人提供分步说明", contact: "咨询", contactPerson: "未来战略 TF · 金武彬副总经理",
    guides: [
      { ...GUIDE_META[0], title: "NFC 工人管理", desc: "登记工人 → 发放 NFC 标签 → 认证 TBM 出席", steps: ["登记工人信息", "写入并粘贴 NFC 标签", "创建 TBM 会话并刷卡"], badge: "权利要求 1–5" },
      { ...GUIDE_META[1], title: "安全设备激励", desc: "向测验得分 80 分以上的工人发放安全设备并记录历史", steps: ["选择测验会话", "按分数确认对象", "选择设备类型并确认发放"], badge: "权利要求 12" },
      { ...GUIDE_META[2], title: "ESG 安全报告", desc: "汇总安全活动 → 计算 ESG 分数 → 导出 JSON", steps: ["选择现场和期间", "生成报告", "解读分数并导出 JSON"], badge: "权利要求 24" },
    ],
  },
  vi: {
    heroEyebrow: "HƯỚNG DẪN SQ-LINK", heroTitle: "Hướng dẫn sử dụng", heroDescription: "Hướng dẫn từng bước cho người phụ trách mới", contact: "Liên hệ", contactPerson: "Nhóm chiến lược tương lai · Phó giám đốc Kim Mu-bin",
    guides: [
      { ...GUIDE_META[0], title: "Quản lý công nhân NFC", desc: "Đăng ký công nhân → cấp thẻ NFC → xác nhận tham gia TBM", steps: ["Đăng ký thông tin công nhân", "Ghi và dán thẻ NFC", "Tạo phiên TBM và quét thẻ"], badge: "Yêu cầu 1–5" },
      { ...GUIDE_META[1], title: "Khuyến khích thiết bị an toàn", desc: "Cấp thiết bị an toàn và lưu lịch sử cho người đạt từ 80 điểm", steps: ["Chọn phiên câu đố", "Kiểm tra đối tượng theo điểm", "Chọn thiết bị và xác nhận cấp"], badge: "Yêu cầu 12" },
      { ...GUIDE_META[2], title: "Báo cáo an toàn ESG", desc: "Tổng hợp hoạt động an toàn → tính điểm ESG → xuất JSON", steps: ["Chọn công trường và thời gian", "Tạo báo cáo", "Xem điểm và xuất JSON"], badge: "Yêu cầu 24" },
    ],
  },
  ru: {
    heroEyebrow: "РУКОВОДСТВО SQ-LINK", heroTitle: "Руководство по функциям", heroDescription: "Пошаговая инструкция для новых ответственных сотрудников", contact: "Контакты", contactPerson: "Группа стратегии будущего · заместитель генерального директора Ким Му-бин",
    guides: [
      { ...GUIDE_META[0], title: "Управление работниками NFC", desc: "Регистрация работника → выдача NFC-метки → подтверждение участия в TBM", steps: ["Зарегистрировать данные работника", "Записать и прикрепить NFC-метку", "Создать сессию TBM и отметить метку"], badge: "Пункты 1–5" },
      { ...GUIDE_META[1], title: "Поощрение средствами защиты", desc: "Выдавайте средства защиты работникам с результатом теста от 80 баллов", steps: ["Выбрать сессию теста", "Проверить получателей по баллам", "Выбрать оборудование и подтвердить выдачу"], badge: "Пункт 12" },
      { ...GUIDE_META[2], title: "Отчёт по безопасности ESG", desc: "Собрать данные по безопасности → рассчитать ESG-оценку → экспортировать JSON", steps: ["Выбрать объект и период", "Создать отчёт", "Проверить оценку и экспортировать JSON"], badge: "Пункт 24" },
    ],
  },
};

const colorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  cyan:    { bg: "bg-cyan-500/10",    text: "text-cyan-400",    border: "hover:border-cyan-500/30",    badge: "bg-cyan-900/50 text-cyan-400" },
  yellow:  { bg: "bg-yellow-500/10",  text: "text-yellow-400",  border: "hover:border-yellow-500/30",  badge: "bg-yellow-900/50 text-yellow-400" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "hover:border-emerald-500/30", badge: "bg-emerald-900/50 text-emerald-400" },
};

export default function AdminGuidePage() {
  const router = useRouter();
  const lang = useDisplayLanguage();
  const t = GUIDE_UI[lang] || GUIDE_UI.en;

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

          <div className="mb-6">
            <ResponsiveFeatureHero visual={{ ...visualizationSpecs.documents, eyebrow: t.heroEyebrow, title: t.heroTitle, description: t.heroDescription }} />
          </div>

          <div className="space-y-4">
            {t.guides.map((g) => {
              const Icon = g.icon;
              const c = colorMap[g.color];
              return (
                <button
                  key={g.href}
                  onClick={() => router.push(g.href)}
                  className={`w-full bg-gray-900 border border-gray-800 ${c.border} rounded-2xl p-5 text-left transition-all group`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-6 h-6 ${c.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-white">{g.title}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${c.badge}`}>{g.badge}</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-3">{g.desc}</p>
                        <div className="flex gap-1 flex-wrap">
                          {g.steps.map((s, i) => (
                            <span key={i} className="text-[11px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                              {i + 1}. {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">{t.contact}</p>
            <p className="text-sm text-gray-400">{t.contactPerson} · visionlab@seowonenc.co.kr</p>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
