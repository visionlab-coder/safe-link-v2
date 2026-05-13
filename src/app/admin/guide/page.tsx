"use client";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { ArrowLeft, BookOpen, Wifi, Award, BarChart3, ChevronRight } from "lucide-react";

const GUIDES = [
  {
    href: "/admin/guide/nfc",
    icon: Wifi,
    color: "cyan",
    title: "NFC 근로자 관리",
    desc: "근로자 등록 → NFC 스티커 발급 → TBM 참석 인증",
    steps: ["근로자 정보 등록", "NFC 스티커 기록·부착", "TBM 세션 개설 및 태그"],
    badge: "청구항 1-5",
  },
  {
    href: "/admin/guide/incentive",
    icon: Award,
    color: "yellow",
    title: "안전장비 인센티브",
    desc: "퀴즈 80점↑ 근로자에게 안전장비 지급 및 이력 기록",
    steps: ["퀴즈 세션 선택", "점수별 대상자 확인", "장비 유형 선택 후 지급 확정"],
    badge: "청구항 12",
  },
  {
    href: "/admin/guide/esg",
    icon: BarChart3,
    color: "emerald",
    title: "ESG 안전 리포트",
    desc: "기간별 안전 활동 집계 → ESG 점수 산출 → JSON 출력",
    steps: ["현장·기간 선택", "리포트 생성", "점수 해석 및 JSON 내보내기"],
    badge: "청구항 24",
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  cyan:    { bg: "bg-cyan-500/10",    text: "text-cyan-400",    border: "hover:border-cyan-500/30",    badge: "bg-cyan-900/50 text-cyan-400" },
  yellow:  { bg: "bg-yellow-500/10",  text: "text-yellow-400",  border: "hover:border-yellow-500/30",  badge: "bg-yellow-900/50 text-yellow-400" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "hover:border-emerald-500/30", badge: "bg-emerald-900/50 text-emerald-400" },
};

export default function AdminGuidePage() {
  const router = useRouter();

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <BookOpen className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold">기능 사용 가이드</h1>
              <p className="text-xs text-gray-500 mt-0.5">처음 담당하는 직원을 위한 단계별 안내</p>
            </div>
          </div>

          <div className="space-y-4">
            {GUIDES.map((g) => {
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
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">문의</p>
            <p className="text-sm text-gray-400">미래전략TF 김무빈 차장 · visionlab@seowonenc.co.kr</p>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
