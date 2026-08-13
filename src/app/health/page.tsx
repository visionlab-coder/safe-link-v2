import Link from "next/link";
import VisualizationScreenLayout from "@/components/VisualizationScreenLayout";

/**
 * 건강 확인 문서/업무 규칙 수령 전의 안내 화면.
 * 입력·판정 기능을 임의로 만들지 않으며, 문서 확정 후 이 화면에 연결한다.
 */
export default function HealthCheckPage() {
  return (
    <main className="min-h-screen bg-[#eef3f8] p-4 text-[#172033] sm:p-8">
      <div className="mx-auto max-w-4xl">
        <VisualizationScreenLayout
          visual={{
            image: "health",
            eyebrow: "HEALTH CHECK",
            title: "작업 전 건강 확인",
            description: "작업 전 이상 징후를 짧고 명확하게 확인합니다.",
            metrics: [{ label: "확인 완료", value: "-" }, { label: "상담 필요", value: "-" }, { label: "미확인", value: "-" }],
            steps: [{ title: "자가 문진", description: "건강 확인 문서 수령 후 항목을 적용합니다." }, { title: "이상 확인", description: "판정·알림 기준을 문서에 맞춰 연결합니다." }, { title: "작업 판단", description: "관리자 확인 흐름을 확정 후 제공합니다." }],
          }}
          action={<Link href="/worker">작업 화면으로 돌아가기</Link>}
        >
          <div className="rounded-xl border border-[#d9e1ea] bg-white p-5 text-sm leading-6 text-[#526076]">
            건강 확인 문서와 업무 기준을 전달받는 대로 문진 항목, 알림, 작업 배치 판단 기능을 연결합니다.
          </div>
        </VisualizationScreenLayout>
      </div>
    </main>
  );
}
