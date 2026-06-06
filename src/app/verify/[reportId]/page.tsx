import { notFound } from "next/navigation";
import { verifyReportIntegrity } from "@/utils/reports/verification-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  searchParams: Promise<{ h?: string }>;
}) {
  const { reportId } = await params;
  const { h } = await searchParams;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) {
    notFound();
  }

  const result = await verifyReportIntegrity(reportId, h ?? null);
  if (!result.ok) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-slate-900 border border-red-900 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-black mb-2">보고서를 찾을 수 없습니다</h1>
          <p className="text-sm text-slate-400">
            요청하신 보고서 ID가 존재하지 않거나 만료되었습니다.
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
            SAFE-LINK · 보고서 무결성 검증
          </p>
          <h1 className="text-3xl font-black mt-2">
            {allOk ? "✅ 검증 성공" : sha === false || perc === false ? "🚨 변조 감지" : "⚠️ 부분 검증"}
          </h1>
        </div>

        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="font-black mb-4 text-blue-300">보고서 정보</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">유형</dt>
              <dd className="font-bold">{envelope.report_type}</dd>
            </div>
            <div>
              <dt className="text-slate-500">사이트 ID</dt>
              <dd className="font-mono text-xs">{envelope.site_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">생성일</dt>
              <dd>{new Date(envelope.created_at).toLocaleString("ko-KR")}</dd>
            </div>
            <div>
              <dt className="text-slate-500">보존 만료</dt>
              <dd>
                {envelope.retention_until
                  ? new Date(envelope.retention_until).toLocaleDateString("ko-KR")
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="font-black mb-4 text-blue-300">무결성 검증 결과</h2>
          <div className="space-y-3">
            <Row
              label="SHA-256 해시 일치 (제공된 h 파라미터)"
              status={sha}
            />
            <Row
              label="인지 해시 일치 (페이로드 형식 변조 감지)"
              status={perc}
            />
          </div>
          <div className="mt-4 p-3 bg-slate-950 rounded-lg text-xs font-mono break-all">
            <div className="text-slate-500 mb-1">현재 인지 해시:</div>
            <div className="text-slate-300">{integrity.current_perceptual_hash}</div>
            {integrity.original_perceptual_hash && (
              <>
                <div className="text-slate-500 mt-2 mb-1">원본 인지 해시:</div>
                <div className="text-slate-300">{integrity.original_perceptual_hash}</div>
              </>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-500 text-center">
          본 검증은 SAFE-LINK V2 시스템이 자동 산출한 결과입니다.
          <br />
          특허 청구항 11 무결성 검증 메커니즘에 따라 보고서 변조 여부를 판단합니다.
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
