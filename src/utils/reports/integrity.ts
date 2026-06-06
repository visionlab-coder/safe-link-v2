import { createHash, randomUUID } from "crypto";

type ReportScope = {
  siteId: string;
  from?: string;
  to?: string;
  workDate?: string;
  tbmSessionId?: string;
};

type BuildLegalReportArgs<T> = {
  reportType: string;
  generatedBy: string;
  scope: ReportScope;
  sourceTables: string[];
  payload: T;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function buildLegalReportEnvelope<T>(args: BuildLegalReportArgs<T>) {
  const generatedAt = new Date().toISOString();
  const reportId = `${args.reportType}-${randomUUID()}`;
  const integrityPayload = {
    report_id: reportId,
    report_type: args.reportType,
    generated_at: generatedAt,
    generated_by: args.generatedBy,
    data_scope: args.scope,
    source_tables: args.sourceTables,
    payload: args.payload,
  };

  return {
    report_id: reportId,
    report_type: args.reportType,
    generated_at: generatedAt,
    generated_by: args.generatedBy,
    data_scope: args.scope,
    source_tables: args.sourceTables,
    report_hash_alg: "SHA-256",
    report_hash: sha256Hex(integrityPayload),
    legal_notice: {
      document_effect:
        "본 보고서는 전자문서 형태의 안전관리 증빙자료이며, 전자문서라는 이유만으로 법적 효력이 부인되지 않도록 생성되었습니다.",
      purpose:
        "산업안전보건 관리, TBM 이행 증빙, 현장 출입 및 퇴근 관리, 사고와 작업중지 관련 기록 보존을 위한 내부 증빙자료입니다.",
      limitation:
        "본 보고서는 내부 안전관리 증빙자료이며, 산업재해 또는 중대재해 발생 시 관계 법령상 별도 신고나 제출 의무를 자동으로 대체하지 않습니다.",
    },
    retention_policy: {
      default_years: 3,
      incident_or_dispute_years: 5,
      deletion_rule:
        "원본 삭제 또는 무효 처리 이력은 별도 감사기록으로 남기고, 삭제 또는 정정 사유와 처리자를 추적할 수 있도록 관리합니다.",
    },
    privacy_notice: {
      included_data:
        "근로자 식별정보, 국적과 언어, TBM 참석 및 서명 시각, 출근 및 퇴근 시각, 현장 식별정보, 필요한 경우 현장 위치정보",
      lawful_purpose:
        "안전관리, 위험성평가와 TBM 이행 확인, 현장 출입 및 퇴근 관리, 사고 예방 및 사후 증빙",
      minimization:
        "보고서에는 목적 달성에 필요한 최소 항목만 포함하고, 전화번호 등 민감성이 높은 정보는 가능한 한 마스킹 또는 해시 처리합니다.",
    },
  };
}

export async function recordReportExport(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any;
  envelope: ReturnType<typeof buildLegalReportEnvelope>;
}) {
  try {
    await args.service.from("legal_report_exports").insert({
      report_id: args.envelope.report_id,
      report_type: args.envelope.report_type,
      site_id: args.envelope.data_scope.siteId,
      data_scope: args.envelope.data_scope,
      source_tables: args.envelope.source_tables,
      report_hash_alg: args.envelope.report_hash_alg,
      report_hash: args.envelope.report_hash,
      generated_by: args.envelope.generated_by,
      generated_at: args.envelope.generated_at,
    });
  } catch {
    // Report generation must not fail just because the optional audit table has
    // not been migrated yet.
  }
}
