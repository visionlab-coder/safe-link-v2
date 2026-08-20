"use client";
import Link from "next/link";
import VisualizationScreenLayout from "@/components/VisualizationScreenLayout";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const HEALTH_UI: Record<string, Record<string, string | string[]>> = {
  ko: { title:"작업 전 건강 확인", desc:"작업 전 이상 징후를 짧고 명확하게 확인합니다.", metrics:["확인 완료", "상담 필요", "미확인"], steps:["자가 문진|건강 확인 문서 수령 후 항목을 적용합니다.", "이상 확인|판정·알림 기준을 문서에 맞춰 연결합니다.", "작업 판단|관리자 확인 흐름을 확정 후 제공합니다."], action:"작업 화면으로 돌아가기", note:"건강 확인 문서와 업무 기준을 전달받는 대로 문진 항목, 알림, 작업 배치 판단 기능을 연결합니다." },
  en: { title:"Pre-work Health Check", desc:"Check for warning signs before work, briefly and clearly.", metrics:["Checked", "Consultation needed", "Not checked"], steps:["Self-check|Items will be applied after receiving the health-check document.", "Review warning signs|Assessment and alert criteria will be connected to the document.", "Work decision|Available after the administrator review flow is finalized."], action:"Return to work screen", note:"Once the health-check document and work rules are received, questionnaire items, alerts, and work-assignment decisions will be connected." },
  zh: { title:"作业前健康确认", desc:"在作业前简明确认异常征兆。", metrics:["已确认", "需要咨询", "未确认"], steps:["自我问诊|收到健康确认文件后将应用相关项目。", "异常确认|将根据文件连接判定和提醒标准。", "作业判断|确认管理员审核流程后提供。"], action:"返回作业页面", note:"收到健康确认文件和业务标准后，将连接问诊项目、提醒和作业安排判断功能。" },
  vi: { title:"Kiểm tra sức khỏe trước khi làm việc", desc:"Kiểm tra ngắn gọn và rõ ràng các dấu hiệu bất thường trước khi làm việc.", metrics:["Đã kiểm tra", "Cần tư vấn", "Chưa kiểm tra"], steps:["Tự khai báo|Các mục sẽ được áp dụng sau khi nhận tài liệu kiểm tra sức khỏe.", "Kiểm tra bất thường|Tiêu chí đánh giá và cảnh báo sẽ được kết nối theo tài liệu.", "Quyết định làm việc|Cung cấp sau khi hoàn tất quy trình xác nhận của quản trị viên."], action:"Quay lại màn hình làm việc", note:"Khi nhận tài liệu kiểm tra sức khỏe và tiêu chuẩn công việc, hệ thống sẽ kết nối bảng hỏi, cảnh báo và quyết định phân công." },
  ru: { title:"Проверка здоровья перед работой", desc:"Кратко и ясно проверьте признаки недомогания перед началом работы.", metrics:["Проверено", "Нужна консультация", "Не проверено"], steps:["Самоопрос|Пункты будут применены после получения документа проверки здоровья.", "Проверка отклонений|Критерии оценки и оповещений будут связаны с документом.", "Решение о работе|Будет доступно после утверждения процесса проверки администратором."], action:"Вернуться к рабочему экрану", note:"После получения документа проверки здоровья и рабочих правил будут подключены пункты опроса, оповещения и решения по распределению работ." },
};

/**
 * 건강 확인 문서/업무 규칙 수령 전의 안내 화면.
 * 입력·판정 기능을 임의로 만들지 않으며, 문서 확정 후 이 화면에 연결한다.
 */
export default function HealthCheckPage() {
  const lang = useDisplayLanguage();
  const t = HEALTH_UI[lang] || HEALTH_UI.en;
  const steps = t.steps as string[];
  const metrics = t.metrics as string[];
  return (
    <main className="min-h-screen bg-[#eef3f8] p-4 text-[#172033] sm:p-8">
      <div className="mx-auto max-w-4xl">
        <VisualizationScreenLayout
          visual={{
            image: "health",
            eyebrow: "HEALTH CHECK",
            title: t.title as string, description: t.desc as string,
            metrics: metrics.map((label) => ({ label, value: "-" })),
            steps: steps.map((step) => { const [title, description] = step.split("|"); return { title, description }; }),
          }}
          action={<Link href="/worker">{t.action as string}</Link>}
        >
          <div className="rounded-xl border border-[#d9e1ea] bg-white p-5 text-sm leading-6 text-[#526076]">
            {t.note as string}
          </div>
        </VisualizationScreenLayout>
      </div>
    </main>
  );
}
