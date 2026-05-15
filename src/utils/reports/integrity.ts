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
        "전자문서 형태의 보고서이며, 전자문서라는 이유만으로 법적 효력이 부인되지 않는다는 전자문서법 취지에 맞춰 생성되었습니다.",
      purpose:
        "산업안전보건 관리, TBM 이행 증빙, 현장 출입/출결 관리, 사고·작업중지 대응 기록을 위한 내부 증빙자료입니다.",
      limitation:
        "본 보고서는 내부 안전관리 증빙자료이며, 산업재해·중대재해 발생 시 관계 법령상 별도 신고 또는 제출 의무를 자동 대체하지 않습니다.",
    },
    retention_policy: {
      default_years: 3,
      incident_or_dispute_years: 5,
      deletion_rule:
        "원본 삭제 대신 무효화/정정 이력으로 관리하고, 삭제 또는 정정 사유와 처리자를 별도 감사기록에 남기는 것을 원칙으로 합니다.",
    },
    privacy_notice: {
      included_data:
        "근로자 식별정보, 국적/언어, TBM 참석·서명시간, 출근·퇴근 태깅시간, 현장 식별정보, 필요한 경우 현장 내 위치정보",
      lawful_purpose:
        "안전관리, 위험성평가/TBM 이행 확인, 현장 출입·출결 관리, 사고 예방 및 사후 증빙",
      minimization:
        "보고서에는 목적 달성에 필요한 최소 항목만 포함하고, 휴대전화는 원칙적으로 뒷자리 등 최소 식별정보를 사용합니다.",
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
