"use client";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { ArrowLeft, Wifi, CheckCircle, AlertCircle, ChevronRight } from "lucide-react";

function StepCard({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white font-black text-sm shrink-0">
          {num}
        </div>
        <h2 className="font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, required }: { label: string; value: string; required?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-gray-400">{label}</span>
        {required && <span className="text-[10px] text-red-400 font-bold">필수</span>}
      </div>
      <span className="text-sm text-white font-mono">{value}</span>
    </div>
  );
}

function TapResult({ icon, label, desc, color }: { icon: "ok" | "warn" | "err"; label: string; desc: string; color: string }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${color}`}>
      {icon === "ok"   && <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />}
      {icon === "warn" && <CheckCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />}
      {icon === "err"  && <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function GuideNfcPage() {
  const router = useRouter();

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <div className="max-w-2xl mx-auto">

          {/* 헤더 */}
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Wifi className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-xl font-bold">NFC 근로자 관리</h1>
              <p className="text-xs text-gray-500 mt-0.5">사용 가이드 · 청구항 1-5</p>
            </div>
          </div>

          {/* 개요 */}
          <div className="bg-cyan-900/20 border border-cyan-800/40 rounded-xl p-4 mb-6 mt-4">
            <p className="text-sm text-cyan-300 leading-relaxed">
              근로자에게 NFC 스티커 한 장을 발급하면, 이후 모든 TBM 참석이
              <strong className="text-white"> 태그 1회</strong>로 자동 기록됩니다.
              회원가입·QR 스캔 없이 운영 가능합니다.
            </p>
          </div>

          {/* 사전 준비 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">사전 준비</p>
            <div className="space-y-2">
              {[
                ["계정 권한", "관리자(admin) 이상"],
                ["NFC 스티커", "NTAG213 규격 (시중 1,000~2,000원)"],
                ["NFC 쓰기 기기", "Android 스마트폰 (iOS는 읽기만 가능)"],
                ["근로자 정보", "이름, 국적, 공종, 동의서 서명 여부"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-gray-400">{k}</span>
                  <span className="text-white">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">

            {/* Step 1 */}
            <StepCard num={1} title="근로자 신규 등록">
              <p className="text-xs text-gray-500 mb-3">
                경로: <span className="text-cyan-400 font-mono">관리자 → 근로자 등록</span>
              </p>
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">입력 예시</p>
                <Field label="성명" value="Nguyen Van An" required />
                <Field label="국적" value="VN (베트남)" required />
                <Field label="공종" value="rebar (철근)" required />
                <Field label="선호 언어" value="vi (베트남어)" required />
                <Field label="이름 이니셜" value="NVA" />
                <Field label="휴대폰 끝 4자리" value="5678" />
                <Field label="PIPA 동의 일시" value="2026-05-13 09:00" />
              </div>
              <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3">
                <p className="text-xs text-green-400">
                  ✅ 등록 완료 시 자동 부여: <span className="font-mono font-bold">WRK-260513-0001</span>
                </p>
              </div>

              <div className="mt-4">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">공종 코드 참고</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    ["rebar", "철근"], ["formwork", "거푸집"],
                    ["concrete", "콘크리트"], ["scaffold", "비계"],
                    ["welder", "용접"], ["signalman", "신호수"],
                    ["equipment", "장비"], ["general", "일반"],
                    ["foreman", "반장"], ["safety", "안전"],
                  ].map(([code, label]) => (
                    <div key={code} className="flex justify-between bg-gray-800 rounded-lg px-3 py-1.5 text-xs">
                      <span className="font-mono text-cyan-400">{code}</span>
                      <span className="text-gray-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </StepCard>

            {/* Step 2 */}
            <StepCard num={2} title="NFC 스티커 발급">
              <p className="text-xs text-gray-500 mb-3">등록 완료 후 바로 이어서 진행</p>
              <ol className="space-y-3">
                {[
                  { n: "①", text: "화면 하단 \"NFC 스티커 발급\" 버튼 클릭" },
                  { n: "②", text: "Android 스마트폰을 NFC 스티커에 밀착 (뒷면 중앙)" },
                  { n: "③", text: "\"기록 완료\" 메시지 확인" },
                  { n: "④", text: "스티커를 근로자 안전모 또는 신분증 케이스에 부착" },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="text-cyan-400 font-black text-sm w-5 shrink-0">{n}</span>
                    <p className="text-sm text-gray-300">{text}</p>
                  </div>
                ))}
              </ol>
              <div className="mt-4 bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-3">
                <p className="text-xs text-yellow-300">
                  ⚠️ NFC 기록 중 핸드폰을 떼지 마세요. 기록 실패 시 재발급 가능합니다.
                </p>
              </div>
            </StepCard>

            {/* Step 3 */}
            <StepCard num={3} title="TBM NFC 세션 운영">
              <p className="text-xs text-gray-500 mb-3">
                경로: <span className="text-cyan-400 font-mono">관리자 → NFC 허브</span>
              </p>

              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">3-1. 세션 개설</p>
              <div className="bg-gray-800 rounded-xl p-3 mb-4 text-sm text-gray-300 space-y-1">
                <p>1. &quot;새 TBM 세션 시작&quot; 클릭</p>
                <p>2. 세션 제목 입력: <span className="font-mono text-white">2026-05-13 오전 TBM</span></p>
                <p>3. 시작 → 상태: <span className="text-green-400 font-bold">running</span></p>
              </div>

              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">3-2. 근로자 태그 결과</p>
              <div className="space-y-2 mb-4">
                <TapResult icon="ok"   label="checked_in"       desc="정상 참석 기록" color="border-green-800/40 bg-green-900/10" />
                <TapResult icon="warn" label="already_certified" desc="중복 태그 — 이미 기록됨 (무시)" color="border-yellow-800/40 bg-yellow-900/10" />
                <TapResult icon="err"  label="sticker_revoked"   desc="폐기된 스티커 → 재발급 필요" color="border-red-800/40 bg-red-900/10" />
              </div>

              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">3-3. 세션 종료</p>
              <p className="text-sm text-gray-300">모든 근로자 태그 완료 후 &quot;세션 종료&quot; 클릭 → 상태: <span className="text-gray-400">closed</span></p>
            </StepCard>

            {/* Step 4 */}
            <StepCard num={4} title="스티커 재발급 (분실·훼손)">
              <p className="text-xs text-gray-500 mb-3">
                경로: <span className="text-cyan-400 font-mono">관리자 → 근로자 목록 → 해당 근로자 → 재발급</span>
              </p>
              <ol className="space-y-2 text-sm text-gray-300">
                <li>1. 이름 또는 코드로 근로자 검색</li>
                <li>2. <strong className="text-white">&quot;재발급&quot;</strong> 클릭 → 이전 스티커 자동 폐기</li>
                <li>3. 새 NFC 스티커에 기록</li>
                <li>4. 기존 스티커 회수 후 파기</li>
              </ol>
            </StepCard>

            {/* 주의사항 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">주의사항</p>
              <div className="space-y-2">
                {[
                  "스티커 1장 = 근로자 1명. 공유 사용 금지",
                  "퇴사 근로자는 반드시 비활성화 처리 (목록 → 비활성화)",
                  "PIPA 준수: 근로자 동의서 징구 후 등록",
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">자주 묻는 질문</p>
              <div className="space-y-4">
                {[
                  {
                    q: "아이폰 근로자는 NFC 태그가 안 되나요?",
                    a: "아이폰도 읽기 지원. 근로자가 스티커를 아이폰으로 태그하면 Safari가 열리며 언어 선택 후 자동 입장됩니다.",
                  },
                  {
                    q: "NFC 안 되는 구형 폰은요?",
                    a: "스티커 발급 시 QR코드도 동시 생성됩니다. 현장 게시판 부착 후 카메라로 스캔 가능.",
                  },
                  {
                    q: "신규 근로자가 갑자기 투입됐을 때는?",
                    a: "그 자리에서 등록 → 스티커 발급. 5분 이내 완료 가능합니다.",
                  },
                ].map(({ q, a }) => (
                  <div key={q}>
                    <p className="text-sm font-bold text-white mb-1">Q. {q}</p>
                    <p className="text-sm text-gray-400">A. {a}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => router.push("/admin/nfc")}
              className="w-full flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-4 rounded-2xl transition-colors"
            >
              <Wifi className="w-4 h-4" />
              NFC 근로자 관리 바로가기
              <ChevronRight className="w-4 h-4" />
            </button>

          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
