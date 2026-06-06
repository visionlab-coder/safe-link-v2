import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { appendClaim13HashChainEvent } from "@/utils/audit/sha256-hash-chain";

/**
 * 특허 청구항 15 — 1:1 안전대화 위험 신호 자동 라우터.
 *
 * watchdog.ts 의 fire-and-forget 분석을 대체. 메시지 텍스트에서 위험 키워드를
 * 감지하면:
 *   1) chat_safety_signals row 생성
 *   2) claim13_audit_events 해시체인에 append (사후 변조 방지)
 *   3) stop_work / incident 카테고리면 claim17_stop_work_interventions 자동 트리거
 *   4) 라우팅 대상 관리자 결정 + routed_to_admin_id 기록
 *
 * 동기 호출. 메시지 INSERT 트랜잭션 직후 호출되어 검증 가능한 chain 유지.
 */

type KeywordCategory = "danger" | "stop_work" | "incident" | "ppe_missing";

type SafetyKeyword = {
  id: string;
  keyword: string;
  lang: string;
  category: KeywordCategory;
  severity: number;
};

type DetectionResult = {
  matched: SafetyKeyword[];
  category: KeywordCategory;
  severityMax: number;
};

function getServiceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED");
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 텍스트에 매칭되는 키워드 추출. 카테고리 우선순위: incident > stop_work > danger > ppe_missing.
 * 같은 카테고리 내에서는 severity 내림차순.
 */
async function detectKeywords(
  sourceText: string,
  sourceLang: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any
): Promise<DetectionResult | null> {
  const normalized = sourceText.toLowerCase();
  const { data: rows } = await service
    .from("safety_dialog_keywords")
    .select("id, keyword, lang, category, severity")
    .eq("lang", sourceLang);

  const all = (rows ?? []) as SafetyKeyword[];
  const matched = all.filter((k) => normalized.includes(k.keyword.toLowerCase()));
  if (matched.length === 0) return null;

  const priority: Record<KeywordCategory, number> = {
    incident: 4,
    stop_work: 3,
    danger: 2,
    ppe_missing: 1,
  };

  // 가장 높은 카테고리 선택
  let topCat: KeywordCategory = "ppe_missing";
  let topPri = -1;
  for (const m of matched) {
    if (priority[m.category] > topPri) {
      topPri = priority[m.category];
      topCat = m.category;
    }
  }

  const inCat = matched.filter((m) => m.category === topCat);
  const severityMax = inCat.reduce((mx, m) => Math.max(mx, m.severity), 0);

  return { matched: inCat, category: topCat, severityMax };
}

/**
 * incident / stop_work 카테고리면 stop_work intervention 자동 생성.
 * (claim17_stop_work_interventions 테이블이 존재한다고 가정)
 */
async function autoTriggerStopWork(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any;
  messageId: string;
  workerId: string | null;
  siteId: string;
  category: KeywordCategory;
  matchedKeywords: string[];
  sourceText: string;
  sourceLang: string;
}): Promise<string | null> {
  if (args.category !== "incident" && args.category !== "stop_work") return null;
  if (!args.workerId) return null;

  const { data: row } = await args.service
    .from("claim17_stop_work_interventions")
    .insert({
      site_id: args.siteId,
      worker_id: args.workerId,
      reason: args.sourceText.slice(0, 500),
      reason_lang: args.sourceLang,
      hazard_category: args.category === "incident" ? "incident" : "general_stop",
      status: "requested",
      trigger_source: "chat_safety_signal",
      trigger_message_id: args.messageId,
    })
    .select("id")
    .maybeSingle();

  return (row as { id: string } | null)?.id ?? null;
}

/**
 * 라우팅 대상 관리자 결정.
 * - incident / severity≥4: SAFETY_OFFICER, 없으면 SITE_ADMIN
 * - stop_work: SAFETY_OFFICER 또는 SITE_ADMIN
 * - danger / ppe_missing: SITE_ADMIN
 */
async function pickRoutedAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  siteId: string,
  category: KeywordCategory,
  severityMax: number
): Promise<string | null> {
  const preferRoles =
    category === "incident" || (category === "stop_work" && severityMax >= 4)
      ? ["SAFETY_OFFICER", "SITE_ADMIN"]
      : ["SITE_ADMIN", "SAFETY_OFFICER"];

  for (const role of preferRoles) {
    const { data: rows } = await service
      .from("profiles")
      .select("id")
      .eq("role", role)
      .eq("site_id", siteId)
      .limit(1);
    const first = (rows ?? [])[0] as { id: string } | undefined;
    if (first?.id) return first.id;
  }
  return null;
}

export type SafetyDialogRouteResult = {
  signalId: string;
  category: KeywordCategory;
  severityMax: number;
  matchedKeywords: string[];
  hashChainEventId: number | null;
  stopWorkAlertId: string | null;
  routedToAdminId: string | null;
};

/**
 * 메인 진입점. 메시지 저장 직후 호출.
 *
 * @returns 위험 신호가 없으면 null, 있으면 signal 정보.
 */
export async function detectAndRouteSafetySignals(args: {
  messageId: string;
  sourceText: string;
  sourceLang: string;
  siteId: string;
  workerId: string | null;
}): Promise<SafetyDialogRouteResult | null> {
  const service = getServiceClient();

  // 1) 키워드 감지
  const detection = await detectKeywords(args.sourceText, args.sourceLang, service);
  if (!detection) return null;

  // 2) messages.detected_keywords 업데이트
  const keywordList = detection.matched.map((m) => m.keyword);
  await service
    .from("messages")
    .update({ detected_keywords: keywordList })
    .eq("id", args.messageId);

  // 3) stop_work 자동 트리거 (해당 시)
  const stopWorkAlertId = await autoTriggerStopWork({
    service,
    messageId: args.messageId,
    workerId: args.workerId,
    siteId: args.siteId,
    category: detection.category,
    matchedKeywords: keywordList,
    sourceText: args.sourceText,
    sourceLang: args.sourceLang,
  });

  // 4) 라우팅 대상 관리자 결정
  const routedToAdminId = await pickRoutedAdmin(
    service,
    args.siteId,
    detection.category,
    detection.severityMax
  );

  // 5) chat_safety_signals INSERT
  const { data: signalRow } = await service
    .from("chat_safety_signals")
    .insert({
      message_id: args.messageId,
      keyword_type: detection.category,
      matched_keywords: keywordList,
      severity_max: detection.severityMax,
      stop_work_alert_id: stopWorkAlertId,
      routed_to_admin_id: routedToAdminId,
      routed_at: routedToAdminId ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  const signalId = (signalRow as { id: string }).id;

  // 6) 해시체인 append (사후 변조 방지)
  let hashChainEventId: number | null = null;
  try {
    const ev = await appendClaim13HashChainEvent(service, {
      siteId: args.siteId,
      entityType: "chat_safety_signal",
      entityId: signalId,
      eventType: `safety_signal_${detection.category}`,
      payload: {
        message_id: args.messageId,
        keywords: keywordList,
        severity_max: detection.severityMax,
        worker_id: args.workerId,
        source_lang: args.sourceLang,
        stop_work_alert_id: stopWorkAlertId,
      },
    });
    hashChainEventId = ev?.id ?? null;

    if (hashChainEventId) {
      await service
        .from("chat_safety_signals")
        .update({ hash_chain_event_id: hashChainEventId })
        .eq("id", signalId);
    }
  } catch {
    /* 해시체인 append 실패해도 signal 자체는 유지 */
  }

  return {
    signalId,
    category: detection.category,
    severityMax: detection.severityMax,
    matchedKeywords: keywordList,
    hashChainEventId,
    stopWorkAlertId,
    routedToAdminId,
  };
}
