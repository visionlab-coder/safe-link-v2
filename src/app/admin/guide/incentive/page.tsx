"use client";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { ArrowLeft, Award, ChevronRight } from "lucide-react";
import ResponsiveFeatureHero from "@/components/ResponsiveFeatureHero";
import { visualizationSpecs } from "@/lib/visualization-specs";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const INCENTIVE_UI: Record<string, Record<string, string>> = {
  ko: { heroTitle:"안전장비 인센티브", heroDesc:"안전 퀴즈 성과에 따른 지급 대상 선정과 이력 관리를 안내합니다.", notice:"TBM 안전 퀴즈에서", score:"80점 이상", noticeEnd:"득점한 근로자에게 안전장비를 인센티브로 지급하고 이력을 자동 기록합니다.", preparation:"사전 준비", account:"계정 권한", accountValue:"관리자(admin) 이상", prerequisite:"선행 작업", prerequisiteValue:"TBM 세션 실시 + 퀴즈 발송 완료", supplies:"준비물", suppliesValue:"지급할 안전장비 실물", step1:"인센티브 메뉴 진입 및 세션 선택", step2:"점수 확인 및 대상자 선정", step3:"장비 유형 선택 후 지급 확정", step4:"실물 장비 지급 (오프라인)", responses:"응답 예시 화면", unanswered:"미응답", eligible:"지급 가능", ineligible:"지급 불가", equipment:"장비 지급 →", equipmentType:"장비 유형 선택", confirmation:"✅ 지급 확정 시 버튼이 ‘지급완료’로 변경되고 이력이 자동 저장됩니다.", faq:"자주 묻는 질문", open:"안전장비 인센티브 바로가기" },
  en: { heroTitle:"Safety equipment incentives", heroDesc:"Guidance for choosing recipients by safety quiz results and managing the history.", notice:"Workers who score", score:"80 points or more", noticeEnd:"in a TBM safety quiz receive safety equipment as an incentive, and the history is recorded automatically.", preparation:"Preparation", account:"Account permission", accountValue:"Administrator (admin) or above", prerequisite:"Prerequisite", prerequisiteValue:"Complete TBM session and send quiz", supplies:"Required item", suppliesValue:"Safety equipment to distribute", step1:"Open the incentive menu and choose a session", step2:"Review scores and select recipients", step3:"Choose equipment and confirm distribution", step4:"Distribute physical equipment (offline)", responses:"Sample response screen", unanswered:"No response", eligible:"Eligible", ineligible:"Not eligible", equipment:"Distribute equipment →", equipmentType:"Select equipment type", confirmation:"✅ Once confirmed, the button changes to ‘Distributed’ and the history is saved automatically.", faq:"Frequently asked questions", open:"Open safety equipment incentives" },
  zh: { heroTitle:"安全装备激励", heroDesc:"说明如何根据安全测验成绩选择发放对象并管理记录。", notice:"在 TBM 安全测验中获得", score:"80 分以上", noticeEnd:"的工人将获得安全装备激励，记录会自动保存。", preparation:"准备事项", account:"账户权限", accountValue:"管理员（admin）及以上", prerequisite:"前置工作", prerequisiteValue:"完成 TBM 会议并发送测验", supplies:"所需物品", suppliesValue:"待发放的安全装备", step1:"进入激励菜单并选择会话", step2:"确认成绩并选择对象", step3:"选择装备并确认发放", step4:"发放实体装备（线下）", responses:"响应示例", unanswered:"未答", eligible:"可发放", ineligible:"不可发放", equipment:"发放装备 →", equipmentType:"选择装备类型", confirmation:"✅ 确认后按钮会变为“已发放”，并自动保存记录。", faq:"常见问题", open:"打开安全装备激励" },
  vi: { heroTitle:"Khuyến khích trang bị an toàn", heroDesc:"Hướng dẫn chọn người nhận theo kết quả bài kiểm tra an toàn và quản lý lịch sử.", notice:"Công nhân đạt", score:"từ 80 điểm", noticeEnd:"trong bài kiểm tra an toàn TBM sẽ nhận trang bị an toàn và lịch sử được lưu tự động.", preparation:"Chuẩn bị", account:"Quyền tài khoản", accountValue:"Quản trị viên (admin) trở lên", prerequisite:"Công việc trước", prerequisiteValue:"Hoàn tất phiên TBM và gửi bài kiểm tra", supplies:"Vật dụng cần có", suppliesValue:"Trang bị an toàn cần phát", step1:"Mở menu khuyến khích và chọn phiên", step2:"Kiểm tra điểm và chọn người nhận", step3:"Chọn trang bị và xác nhận phát", step4:"Phát trang bị thực tế (ngoại tuyến)", responses:"Màn hình phản hồi mẫu", unanswered:"Chưa trả lời", eligible:"Đủ điều kiện", ineligible:"Không đủ điều kiện", equipment:"Phát trang bị →", equipmentType:"Chọn loại trang bị", confirmation:"✅ Sau khi xác nhận, nút đổi thành “Đã phát” và lịch sử được lưu tự động.", faq:"Câu hỏi thường gặp", open:"Mở khuyến khích trang bị an toàn" },
  ru: { heroTitle:"Стимулирование средствами защиты", heroDesc:"Руководство по выбору получателей по результатам теста безопасности и ведению истории.", notice:"Работники, набравшие", score:"80 баллов и более", noticeEnd:"в тесте безопасности TBM получают средства защиты, а история сохраняется автоматически.", preparation:"Подготовка", account:"Права учётной записи", accountValue:"Администратор (admin) или выше", prerequisite:"Предварительное действие", prerequisiteValue:"Провести TBM и отправить тест", supplies:"Необходимое", suppliesValue:"Средства защиты для выдачи", step1:"Откройте меню поощрений и выберите сессию", step2:"Проверьте баллы и выберите получателей", step3:"Выберите оборудование и подтвердите выдачу", step4:"Выдайте фактическое оборудование (офлайн)", responses:"Пример экрана ответов", unanswered:"Нет ответа", eligible:"Можно выдать", ineligible:"Нельзя выдать", equipment:"Выдать оборудование →", equipmentType:"Выберите тип оборудования", confirmation:"✅ После подтверждения кнопка изменится на «Выдано», а история сохранится автоматически.", faq:"Частые вопросы", open:"Открыть поощрения средствами защиты" },
};

function StepCard({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-yellow-600 flex items-center justify-center text-white font-black text-sm shrink-0">
          {num}
        </div>
        <h2 className="font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const EXAMPLE_RESPONSES = [
  { name: "Nguyen Van An", code: "WRK-260513-0001", score: 95, status: "answered" },
  { name: "Sugrarov Ali",  code: "WRK-260513-0002", score: 88, status: "answered" },
  { name: "Thida Myint",   code: "WRK-260513-0003", score: 75, status: "answered" },
  { name: "Kim Dae Ho",    code: "WRK-260513-0004", score: 65, status: "answered" },
  { name: "Sugruar Rahman",code: "WRK-260513-0005", score: 0,  status: "pending"  },
];

export default function GuideIncentivePage() {
  const router = useRouter();
  const language = useDisplayLanguage();
  const t = INCENTIVE_UI[language] ?? INCENTIVE_UI.en;

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <div className="max-w-2xl mx-auto">

          <div className="concept-page-header">
            <button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-black tracking-tight text-[#063789]">SQ LINK</span>
          </div>

          <ResponsiveFeatureHero visual={{ ...visualizationSpecs.education, eyebrow: "SQ LINK GUIDE · CLAIM 12", title: t.heroTitle, description: t.heroDesc }} />

          <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4 mb-6 mt-4">
            <p className="text-sm text-yellow-300 leading-relaxed">
              {t.notice} <strong className="text-white">{t.score}</strong> {t.noticeEnd}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">{t.preparation}</p>
            {[
              [t.account, t.accountValue],
              [t.prerequisite, t.prerequisiteValue],
              [t.supplies, t.suppliesValue],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-1.5 border-b border-gray-800 last:border-0">
                <span className="text-gray-400">{k}</span>
                <span className="text-white">{v}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">

            <StepCard num={1} title={t.step1}>
              <p className="text-xs text-gray-500 mb-3">
                경로: <span className="text-yellow-400 font-mono">관리자 → 안전장비 인센티브</span>
              </p>
              <p className="text-sm text-gray-300 mb-3">퀴즈 세션 목록에서 당일 세션을 클릭합니다.</p>
              <div className="bg-gray-800 rounded-xl p-3 space-y-2">
                {[
                  { id: "ab3f1e2c", status: "sent", time: "2026-05-13 09:15" },
                  { id: "7c8d9a0b", status: "sent", time: "2026-05-12 08:50" },
                ].map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-xs font-mono text-gray-300">{s.id}…</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.time}</p>
                    </div>
                    <span className="text-xs bg-green-900 text-green-400 px-2 py-0.5 rounded font-bold">{s.status}</span>
                  </div>
                ))}
              </div>
            </StepCard>

            <StepCard num={2} title={t.step2}>
              <div className="flex gap-3 mb-4">
                {[
                  { color: "text-green-400", bg: "bg-green-900/20 border-green-800/40", label: "80+", desc: t.eligible },
                  { color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-800/40", label: "60–79", desc: t.ineligible },
                  { color: "text-red-400", bg: "bg-red-900/20 border-red-800/40", label: "<60", desc: t.ineligible },
                ].map(({ color, bg, label, desc }) => (
                  <div key={label} className={`flex-1 border rounded-xl p-2.5 text-center ${bg}`}>
                    <p className={`text-sm font-black ${color}`}>{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">{t.responses}</p>
              <div className="space-y-2">
                {EXAMPLE_RESPONSES.map((r) => {
                  const eligible = r.score >= 80;
                  const answered = r.status === "answered";
                  const scoreColor = r.score >= 80 ? "text-green-400" : r.score >= 60 ? "text-yellow-400" : "text-red-400";
                  return (
                    <div key={r.code} className={`bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between border ${eligible ? "border-yellow-500/20" : "border-gray-700"}`}>
                      <div>
                        <p className="text-sm font-medium text-white">{r.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{r.code}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-black ${answered ? scoreColor : "text-gray-500"}`}>
                          {answered ? `${r.score}%` : t.unanswered}
                        </span>
                        {eligible && answered && (
                          <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-1 rounded-lg font-bold">{t.equipment}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </StepCard>

            <StepCard num={3} title={t.step3}>
              <p className="text-sm text-gray-300 mb-3">
                [장비 지급] 버튼 클릭 → 팝업에서 장비 유형 선택 → <strong className="text-white">지급 확정</strong>
              </p>
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">{t.equipmentType}</p>
                <div className="grid grid-cols-3 gap-2">
                  {["안전모", "안전화", "안전조끼", "안전장갑", "안전안경", "방진마스크", "방음귀마개", "안전벨트", "안전고리"].map((t) => (
                    <div key={t} className={`py-2 px-2 rounded-lg text-xs font-bold text-center ${t === "안전장갑" ? "bg-yellow-600 text-white" : "bg-gray-700 text-gray-400"}`}>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3">
                <p className="text-xs text-green-400">
                  {t.confirmation}
                </p>
              </div>
            </StepCard>

            <StepCard num={4} title={t.step4}>
              <p className="text-sm text-gray-300 mb-3">시스템 기록 완료 후 근로자에게 장비 실물을 직접 지급합니다.</p>
              <div className="bg-gray-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-4 gap-px bg-gray-700 text-xs font-bold text-gray-500 uppercase tracking-widest">
                  {["근로자", "코드", "점수", "지급 장비"].map((h) => (
                    <div key={h} className="bg-gray-800 px-3 py-2">{h}</div>
                  ))}
                </div>
                {[
                  ["Nguyen Van An", "WRK-260513-0001", "95%", "안전장갑"],
                  ["Sugrarov Ali",  "WRK-260513-0002", "88%", "방진마스크"],
                ].map(([name, code, score, equip]) => (
                  <div key={code} className="grid grid-cols-4 gap-px bg-gray-700">
                    {[name, code, score, equip].map((v, i) => (
                      <div key={i} className={`bg-gray-800 px-3 py-2.5 text-xs ${i === 0 ? "text-white" : "text-gray-400 font-mono"}`}>{v}</div>
                    ))}
                  </div>
                ))}
              </div>
            </StepCard>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">{t.faq}</p>
              <div className="space-y-4">
                {[
                  { q: "퀴즈 세션 목록이 비어 있어요.", a: "TBM 세션 실시 후 퀴즈 발송 단계를 먼저 완료해야 합니다. 관리자 → 퀴즈 관리에서 확인하세요." },
                  { q: "같은 근로자에게 다른 장비를 추가 지급하고 싶어요.", a: "현재 세션당 1회 지급이 원칙입니다. 별도 세션에서 재지급 가능합니다." },
                  { q: "지급 이력은 어디서 확인하나요?", a: "세션 화면 하단 '지급 이력' 섹션에 자동 기록됩니다. ESG 리포트의 '안전장비 지급' 항목에도 집계됩니다." },
                ].map(({ q, a }) => (
                  <div key={q}>
                    <p className="text-sm font-bold text-white mb-1">Q. {q}</p>
                    <p className="text-sm text-gray-400">A. {a}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => router.push("/admin/incentive")}
              className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-gray-950 font-bold py-4 rounded-2xl transition-colors"
            >
              <Award className="w-4 h-4" />
              {t.open}
              <ChevronRight className="w-4 h-4" />
            </button>

          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
