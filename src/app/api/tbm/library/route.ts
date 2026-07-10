import { NextRequest, NextResponse } from "next/server";
import { getV3SessionUser } from "@/utils/auth/v3-session-user";

export const runtime = "nodejs";

const SAFETY_LIBRARY = [
  {
    id: "fall-guard-001",
    category: "건축",
    subcategory: "고소작업",
    hazard_description: "작업발판 단부에서 추락 위험",
    accident_type: "추락",
    frequency: 4,
    severity: 5,
    risk_level: 5,
    preventive_measure: "안전난간, 추락방호망, 안전대 체결 상태를 작업 전 확인한다.",
    is_critical: true,
  },
  {
    id: "fire-hotwork-001",
    category: "설비",
    subcategory: "용접·절단",
    hazard_description: "불티 비산으로 인한 화재 위험",
    accident_type: "화재",
    frequency: 3,
    severity: 5,
    risk_level: 5,
    preventive_measure: "가연물 제거, 방화포 설치, 소화기 배치, 화기감시자를 지정한다.",
    is_critical: true,
  },
  {
    id: "electric-temp-001",
    category: "전기",
    subcategory: "임시전기",
    hazard_description: "젖은 손 또는 손상된 케이블 접촉에 따른 감전 위험",
    accident_type: "감전",
    frequency: 3,
    severity: 5,
    risk_level: 5,
    preventive_measure: "누전차단기, 접지, 케이블 피복 손상 여부를 확인하고 젖은 손 접촉을 금지한다.",
    is_critical: true,
  },
  {
    id: "lifting-crane-001",
    category: "양중",
    subcategory: "크레인",
    hazard_description: "인양물 하부 출입에 따른 협착·낙하물 위험",
    accident_type: "낙하·협착",
    frequency: 4,
    severity: 5,
    risk_level: 5,
    preventive_measure: "작업반경 출입통제, 신호수 배치, 줄걸이 상태 확인 후 인양한다.",
    is_critical: true,
  },
  {
    id: "housekeeping-001",
    category: "공통",
    subcategory: "정리정돈",
    hazard_description: "통로 자재 적치로 인한 넘어짐 및 대피로 차단",
    accident_type: "전도",
    frequency: 4,
    severity: 3,
    risk_level: 4,
    preventive_measure: "보행통로와 비상대피로를 확보하고 자재는 지정구역에 적치한다.",
    is_critical: false,
  },
];

export async function GET(request: NextRequest) {
  const user = await getV3SessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const subcategory = searchParams.get("subcategory");
  const accidentType = searchParams.get("accident_type");
  const criticalOnly = searchParams.get("critical_only") === "true";

  const data = SAFETY_LIBRARY.filter((item) => {
    if (category && item.category !== category) return false;
    if (subcategory && item.subcategory !== subcategory) return false;
    if (accidentType && item.accident_type !== accidentType) return false;
    if (criticalOnly && !item.is_critical) return false;
    return true;
  }).sort((a, b) =>
    a.category.localeCompare(b.category) ||
    a.subcategory.localeCompare(b.subcategory) ||
    b.risk_level - a.risk_level
  );

  return NextResponse.json({ data });
}
