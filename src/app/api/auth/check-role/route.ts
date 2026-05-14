import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// 허용된 역할 타입 — 이메일 목록 자체는 절대 클라이언트에 반환하지 않음
type AllowedRole = "root" | "hq_officer" | null;

/**
 * GET /api/auth/check-role
 * 인증된 사용자의 email을 서버 환경변수와 비교하여 특수 역할 반환.
 * MASTER_EMAILS, HQ_OFFICER_EMAILS는 NEXT_PUBLIC_ 없이 서버에서만 접근.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const email = user.email ?? "";

    const masterEmails = (process.env.MASTER_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const hqOfficerEmails = (process.env.HQ_OFFICER_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    let role: AllowedRole = null;
    if (masterEmails.includes(email)) {
      role = "root";
    } else if (hqOfficerEmails.includes(email)) {
      role = "hq_officer";
    }

    // 역할만 반환 — 이메일 목록은 절대 포함하지 않음
    return NextResponse.json({ role });
  } catch (err) {
    console.error("[check-role] Unexpected error:", err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
