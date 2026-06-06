import { NextRequest, NextResponse } from "next/server";
import { verifyReportIntegrity } from "@/utils/reports/verification-code";

export const runtime = "nodejs";

/**
 * 특허 청구항 11 — 보고서 무결성 검증 공개 엔드포인트.
 *
 * GET /api/verify/{reportId}?h={report_hash}
 *
 * 누구나 (anon 포함) 조회 가능. 보고서의 SHA-256 무결성, 인지 해시 일치 여부,
 * 보고서 메타데이터(유형, 사이트, 생성일, 보존기한) 를 반환.
 *
 * 실제 페이로드는 노출하지 않음. payload 의 무결성만 검증.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  const providedHash = req.nextUrl.searchParams.get("h");

  // UUID 검증 (오용 방지)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) {
    return NextResponse.json({ ok: false, error: "invalid_report_id" }, { status: 400 });
  }

  try {
    const result = await verifyReportIntegrity(reportId, providedHash);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      {
        ok: true,
        report: result.envelope,
        integrity: result.integrity,
        // 사용자가 직접 비교할 수 있도록 안내
        notice:
          "이 보고서는 SAFE-LINK 시스템에서 발급되었습니다. " +
          "SHA-256 해시와 인지 해시가 모두 일치하면 보고서가 변조되지 않은 것입니다.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 500 });
  }
}
