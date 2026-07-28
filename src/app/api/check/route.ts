import { NextRequest, NextResponse } from "next/server";
import { SAFE_LINK_V3_API_BASE_URL } from "@/utils/auth/v3-proxy";

export const runtime = "nodejs";

type HealthItem = {
  status: "pending" | "ok" | "error";
  message: string;
};

type ActuatorHealth = {
  status?: string;
};

type AiStatus = {
  status?: string;
  vendorEnabled?: boolean;
  failOpenLocal?: boolean;
};

function ok(message: string): HealthItem {
  return { status: "ok", message };
}

function fail(message: string): HealthItem {
  return { status: "error", message };
}

async function getJson<T>(path: string, cookie?: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const response = await fetch(`${SAFE_LINK_V3_API_BASE_URL}${path}`, {
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });
    return {
      ok: response.ok,
      status: response.status,
      data: (await response.json().catch(() => null)) as T | null,
    };
  } catch {
    return { ok: false, status: 503, data: null };
  }
}

export async function GET(req: NextRequest) {
  const cookie = req.headers.get("cookie") ?? "";
  const results: Record<string, HealthItem> = {
    postgresql: { status: "pending", message: "" },
    google_translate: { status: "pending", message: "" },
    google_tts: { status: "pending", message: "" },
    google_stt: { status: "pending", message: "" },
    openai: { status: "pending", message: "" },
    naver_papago: { status: "pending", message: "" },
    realtime: { status: "pending", message: "" },
  };

  const readiness = await getJson<ActuatorHealth>("/actuator/health/readiness");
  if (readiness.ok && readiness.data?.status === "UP") {
    results.postgresql = ok("PostgreSQL/Redis readiness UP");
  } else {
    results.postgresql = fail(`Spring readiness ${readiness.status}`);
  }

  const ai = await getJson<AiStatus>("/api/v1/ai/status", cookie);
  if (ai.ok && ai.data) {
    const mode = ai.data.vendorEnabled ? "vendor configured" : "mock/fallback";
    const vendorStatus = ai.data.vendorEnabled
      ? ok(`AI gateway ${ai.data.status ?? "UP"} (${mode})`)
      : fail(`AI vendor disabled (${mode})`);
    results.google_translate = vendorStatus;
    results.google_tts = vendorStatus;
    results.google_stt = vendorStatus;
    results.openai = vendorStatus;
    results.naver_papago = vendorStatus;
  } else {
    const message = ai.status === 401 || ai.status === 403 ? "Spring session required" : `AI gateway ${ai.status}`;
    results.google_translate = fail(message);
    results.google_tts = fail(message);
    results.google_stt = fail(message);
    results.openai = fail(message);
    results.naver_papago = fail(message);
  }

  const realtime = await getJson<ActuatorHealth>("/actuator/health");
  results.realtime = realtime.ok && realtime.data?.status === "UP"
    ? ok("Spring realtime/notification backend reachable")
    : fail(`Spring backend ${realtime.status}`);

  return NextResponse.json(results);
}
