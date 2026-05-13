"use client";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { ArrowLeft, Award, ChevronRight } from "lucide-react";

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

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <div className="max-w-2xl mx-auto">

          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Award className="w-6 h-6 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold">안전장비 인센티브</h1>
              <p className="text-xs text-gray-500 mt-0.5">사용 가이드 · 청구항 12</p>
            </div>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4 mb-6 mt-4">
            <p className="text-sm text-yellow-300 leading-relaxed">
              TBM 안전 퀴즈에서 <strong className="text-white">80점 이상</strong> 득점한 근로자에게
              안전장비를 인센티브로 지급하고 이력을 자동 기록합니다.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">사전 준비</p>
            {[
              ["계정 권한", "관리자(admin) 이상"],
              ["선행 작업", "TBM 세션 실시 + 퀴즈 발송 완료"],
              ["준비물", "지급할 안전장비 실물"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-1.5 border-b border-gray-800 last:border-0">
                <span className="text-gray-400">{k}</span>
                <span className="text-white">{v}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">

            <StepCard num={1} title="인센티브 메뉴 진입 및 세션 선택">
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

            <StepCard num={2} title="점수 확인 및 대상자 선정">
              <div className="flex gap-3 mb-4">
                {[
                  { color: "text-green-400", bg: "bg-green-900/20 border-green-800/40", label: "80점↑", desc: "지급 가능" },
                  { color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-800/40", label: "60~79", desc: "지급 불가" },
                  { color: "text-red-400", bg: "bg-red-900/20 border-red-800/40", label: "60점↓", desc: "지급 불가" },
                ].map(({ color, bg, label, desc }) => (
                  <div key={label} className={`flex-1 border rounded-xl p-2.5 text-center ${bg}`}>
                    <p className={`text-sm font-black ${color}`}>{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">응답 예시 화면</p>
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
                          {answered ? `${r.score}%` : "미응답"}
                        </span>
                        {eligible && answered && (
                          <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-1 rounded-lg font-bold">장비 지급 →</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </StepCard>

            <StepCard num={3} title="장비 유형 선택 후 지급 확정">
              <p className="text-sm text-gray-300 mb-3">
                [장비 지급] 버튼 클릭 → 팝업에서 장비 유형 선택 → <strong className="text-white">지급 확정</strong>
              </p>
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">장비 유형 선택</p>
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
                  ✅ 지급 확정 시 버튼이 "지급완료"로 변경되고 이력 자동 저장
                </p>
              </div>
            </StepCard>

            <StepCard num={4} title="실물 장비 지급 (오프라인)">
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
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">자주 묻는 질문</p>
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
              안전장비 인센티브 바로가기
              <ChevronRight className="w-4 h-4" />
            </button>

          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
