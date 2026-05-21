"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";
import { Award, CheckCircle, ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";
import ExportMenu from "@/components/ExportMenu";
import { exportData, type ExportFormat } from "@/utils/export-files";

const EQUIPMENT_TYPES = [
  "안전모", "안전화", "안전조끼", "안전장갑", "안전안경",
  "방진마스크", "방음귀마개", "안전벨트", "안전고리",
];

type QuizSession = {
  id: string;
  tbm_session_id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

type QuizResponse = {
  id: string;
  worker_id: string;
  lang: string;
  score_pct: number | null;
  status: string;
  answered_at: string | null;
  nfc_workers: { full_name: string; worker_code: string } | null;
};

type Grant = {
  worker_id: string;
  equipment_type: string;
  granted_at: string;
};

export default function AdminIncentivePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<QuizSession | null>(null);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResps, setLoadingResps] = useState(false);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [grantForm, setGrantForm] = useState<{ workerId: string; type: string } | null>(null);
  const [adminSiteId, setAdminSiteId] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase.from("profiles").select("site_id").eq("id", session.user.id).maybeSingle().then(({ data }) => {
        if ((data as { site_id?: string } | null)?.site_id) setAdminSiteId((data as { site_id: string }).site_id);
      });
    });
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/quiz/generate?tbmSessionId=__all__");
    if (!res.ok) {
      const supabase = createClient();
      const { data } = await supabase
        .from("tbm_quiz_sessions")
        .select("id, tbm_session_id, status, sent_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setSessions((data ?? []) as QuizSession[]);
    } else {
      const data = await res.json() as { quizSessions?: QuizSession[] };
      setSessions(data.quizSessions ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tbm_quiz_sessions")
      .select("id, tbm_session_id, status, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => { setSessions((data ?? []) as QuizSession[]); setLoading(false); });
  }, []);

  const loadResponses = useCallback(async (session: QuizSession) => {
    setLoadingResps(true);
    setSelectedSession(session);
    setResponses([]);
    setGrants([]);

    const supabase = createClient();
    const { data } = await supabase
      .from("tbm_quiz_responses")
      .select("id, worker_id, lang, score_pct, status, answered_at, nfc_workers(full_name, worker_code)")
      .eq("quiz_session_id", session.id)
      .order("score_pct", { ascending: false });

    setResponses((data ?? []) as unknown as QuizResponse[]);

    const grantRes = await fetch(`/api/incentive/grant?quizSessionId=${session.id}`);
    if (grantRes.ok) {
      const grantData = await grantRes.json() as { grants?: Grant[] };
      setGrants(grantData.grants ?? []);
    }
    setLoadingResps(false);
  }, []);

  const handleGrant = async () => {
    if (!grantForm || !selectedSession) return;
    setGrantingId(grantForm.workerId);
    try {
      const resp = responses.find((r) => r.worker_id === grantForm.workerId);
      await fetch("/api/incentive/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: grantForm.workerId,
          quizSessionId: selectedSession.id,
          scorePct: resp?.score_pct,
          equipmentType: grantForm.type,
          siteId: adminSiteId || null,
        }),
      });
      setGrantForm(null);
      loadResponses(selectedSession);
    } finally {
      setGrantingId(null);
    }
  };

  const alreadyGranted = (workerId: string) => grants.some((g) => g.worker_id === workerId);

  const handleExport = async (format: ExportFormat) => {
    const rows = responses.map((response) => ({
      worker_code: response.nfc_workers?.worker_code ?? response.worker_id,
      full_name: response.nfc_workers?.full_name ?? "",
      lang: response.lang,
      score_pct: response.score_pct ?? "",
      status: response.status,
      answered_at: response.answered_at ?? "",
      granted: alreadyGranted(response.worker_id) ? "지급" : "미지급",
    }));

    await exportData(format, {
      title: "안전장비 인센티브 지급 리포트",
      subtitle: `${selectedSession?.id ?? "전체"} / 현장 ${adminSiteId || "-"}`,
      filename: `safety_incentive_${selectedSession?.id ?? "all"}_${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: "응답", value: responses.length },
        { label: "80점 이상", value: responses.filter((response) => (response.score_pct ?? 0) >= 80).length },
        { label: "지급", value: grants.length },
      ],
      columns: [
        { key: "worker_code", label: "근로자 코드" },
        { key: "full_name", label: "이름" },
        { key: "lang", label: "언어" },
        { key: "score_pct", label: "점수" },
        { key: "status", label: "상태" },
        { key: "answered_at", label: "응답시각" },
        { key: "granted", label: "장비 지급" },
      ],
      rows,
      raw: { selectedSession, responses, grants },
    });
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="p-2 text-gray-500 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Award className="w-6 h-6 text-yellow-400" />
            <h1 className="text-xl font-bold">안전장비 인센티브 지급</h1>
            <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded font-bold">청구항 12</span>
          </div>

          <div className="mb-4 flex justify-end">
            <ExportMenu disabled={responses.length === 0} onExport={handleExport} />
          </div>

          <div className="relative rounded-2xl overflow-hidden h-40 w-full mb-4 border border-gray-800">
            <Image
              src="/images/safelink-pages/quiz-worker-training.png"
              alt="Safety incentive training"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>

          {!selectedSession ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-400 text-sm">퀴즈 세션을 선택하세요</p>
                <button onClick={loadSessions} className="p-2 text-gray-500 hover:text-white">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {loading ? (
                <p className="text-gray-500 text-sm">로딩 중...</p>
              ) : sessions.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>퀴즈 세션이 없습니다.</p>
                  <p className="text-xs mt-1">TBM 세션 종료 후 퀴즈를 먼저 발송하세요.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadResponses(s)}
                      className="w-full bg-gray-800 hover:bg-gray-700 rounded-xl p-4 flex items-center justify-between text-left border border-gray-700 hover:border-yellow-500/30 transition-all"
                    >
                      <div>
                        <p className="font-medium text-white text-sm">퀴즈 세션</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{s.id.slice(0, 8)}…</p>
                        <p className="text-xs text-gray-600 mt-0.5">{new Date(s.created_at).toLocaleString("ko-KR")}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${s.status === "sent" ? "bg-green-900 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                          {s.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setSelectedSession(null)} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4">
                <ArrowLeft className="w-4 h-4" />
                세션 목록으로
              </button>

              <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700">
                <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-1">선택된 퀴즈 세션</p>
                <p className="font-mono text-sm text-gray-300">{selectedSession.id.slice(0, 16)}…</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(selectedSession.created_at).toLocaleString("ko-KR")}</p>
              </div>

              {loadingResps ? (
                <p className="text-gray-500 text-sm">응답 로딩 중...</p>
              ) : (
                <div className="space-y-3">
                  {responses.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-8">아직 응답이 없습니다.</p>
                  )}
                  {responses.map((r) => {
                    const score = r.score_pct ?? 0;
                    const eligible = score >= 80;
                    const granted = alreadyGranted(r.worker_id);
                    return (
                      <div key={r.id} className={`bg-gray-800 rounded-xl p-4 border ${eligible ? "border-yellow-500/20" : "border-gray-700"}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{r.nfc_workers?.full_name ?? "—"}</p>
                            <p className="text-xs text-gray-500 font-mono">{r.nfc_workers?.worker_code}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-lg font-black ${score >= 80 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                              {r.status === "answered" ? `${score}%` : "미응답"}
                            </span>
                            {granted ? (
                              <span className="flex items-center gap-1 text-xs text-green-400 font-bold">
                                <CheckCircle className="w-4 h-4" />
                                지급완료
                              </span>
                            ) : eligible && r.status === "answered" ? (
                              <button
                                onClick={() => setGrantForm({ workerId: r.worker_id, type: EQUIPMENT_TYPES[0] })}
                                disabled={grantingId === r.worker_id}
                                className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <Award className="w-3.5 h-3.5" />
                                장비 지급
                              </button>
                            ) : (
                              <span className="text-xs text-gray-600">
                                {r.status !== "answered" ? "미응답" : "점수 미달"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {grants.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">지급 이력</p>
                  <div className="space-y-2">
                    {grants.map((g, i) => (
                      <div key={i} className="bg-gray-900 rounded-lg p-3 flex items-center justify-between border border-gray-800">
                        <span className="text-sm text-gray-300 font-bold">{g.equipment_type}</span>
                        <span className="text-xs text-gray-600">{new Date(g.granted_at).toLocaleString("ko-KR")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {grantForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setGrantForm(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-white mb-4">장비 유형 선택</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {EQUIPMENT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setGrantForm((prev) => prev ? { ...prev, type: t } : null)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors ${grantForm.type === t ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setGrantForm(null)} className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl text-sm font-bold">취소</button>
              <button
                onClick={handleGrant}
                disabled={grantingId !== null}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                지급 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
