"use client";

import { useCallback, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardList, KeyRound, LocateFixed, Nfc, RefreshCw, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const MENU = [
  {
    title: "근로자 NFC 관리",
    desc: "근로자 등록, NFC 카드 발급, 재발급, 지우기를 관리합니다.",
    icon: Users,
    href: "/admin/workers",
    color: "from-blue-500 to-blue-700",
  },
  {
    title: "TBM NFC 참석 확인",
    desc: "TBM 세션을 열고 근로자 NFC 태깅으로 참석과 서명을 확인합니다.",
    icon: Nfc,
    href: "/admin/tbm/live",
    color: "from-green-500 to-green-700",
  },
  {
    title: "NFC 일일 안전일지",
    desc: "퇴근 태깅으로 자동 업로드된 출근, 퇴근, TBM 서명 기록을 확인합니다.",
    icon: ClipboardList,
    href: "/admin/nfc/daily-logs",
    color: "from-amber-500 to-orange-700",
  },
];

type Challenge = {
  challenge_code: string;
  work_date: string;
  expires_at: string;
};

export default function AdminNfcHubPage() {
  const router = useRouter();
  const [siteName, setSiteName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [mySiteId, setMySiteId] = useState<string | null>(null);
  const [siteList, setSiteList] = useState<{ id: string; name: string }[]>([]);
  const [locationStatus, setLocationStatus] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeStatus, setChallengeStatus] = useState("");
  const [challengeLoading, setChallengeLoading] = useState(false);

  const fetchChallenge = useCallback(async (siteId?: string | null) => {
    const qs = siteId ? `?site_id=${encodeURIComponent(siteId)}` : "";
    const res = await fetch(`/api/nfc/site-challenge${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    setChallenge(data.challenge ?? null);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("site_id, site_code")
        .eq("id", session.user.id)
        .maybeSingle();
      const siteId = (profile as { site_id?: string | null; site_code?: string | null } | null)?.site_id;
      setSiteName((profile as { site_code?: string | null } | null)?.site_code ?? "");
      if (siteId) {
        setMySiteId(siteId);
        const { data: site } = await supabase
          .from("sites")
          .select("name, site_code")
          .eq("id", siteId)
          .maybeSingle();
        if ((site as { name?: string } | null)?.name) setSiteName((site as { name: string }).name);
        if ((site as { site_code?: string } | null)?.site_code) {
          setSiteCode((site as { site_code: string }).site_code);
        }
        fetchChallenge(siteId);
      } else {
        // No site_id in profile — load available sites so admin can pick one
        const { data: sites } = await supabase
          .from("sites")
          .select("id, name")
          .order("name");
        if (sites) setSiteList(sites as { id: string; name: string }[]);
        fetchChallenge(undefined);
      }
    });
  }, [fetchChallenge]);

  const saveCurrentSiteLocation = async () => {
    setLocationStatus("");
    if (!navigator.geolocation) {
      setLocationStatus("이 기기에서는 위치 정보를 사용할 수 없습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch("/api/sites/current-location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            geofence_radius_m: 300,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setLocationStatus(data.error || "현장 위치 저장에 실패했습니다.");
          return;
        }
        setLocationStatus("현재 스마트폰 위치가 현장 위치로 저장되었습니다.");
        if (data.site?.name) setSiteName(data.site.name);
        if (data.site?.site_code) setSiteCode(data.site.site_code);
      },
      () => setLocationStatus("위치 권한을 허용한 뒤 다시 시도하세요."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const selectSite = (id: string) => {
    const site = siteList.find((s) => s.id === id);
    if (site) {
      setMySiteId(id);
      setSiteName(site.name);
      fetchChallenge(id);
    }
  };

  const createChallenge = async (rotate = false) => {
    setChallengeLoading(true);
    setChallengeStatus("");
    try {
      const res = await fetch("/api/nfc/site-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate, ...(mySiteId ? { site_id: mySiteId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "확인코드 생성 실패");
      setChallenge(data.challenge);
      setChallengeStatus(rotate ? "오늘 확인코드를 새로 발급했습니다." : "오늘 확인코드를 준비했습니다.");
    } catch (err) {
      setChallengeStatus(err instanceof Error ? err.message : "확인코드 생성 실패");
    } finally {
      setChallengeLoading(false);
    }
  };

  return (
    <RoleGuard allowedRole="admin">
      <main className="min-h-screen bg-gray-950 text-white p-6">
        <section className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Nfc className="w-7 h-7 text-green-400" />
              <h1 className="text-2xl font-bold">NFC 관리</h1>
            </div>
            <p className="text-gray-400 text-sm">
              NFC 카드 발급, TBM 참석 확인, 일일 안전일지, 현장 확인코드를 관리합니다.
            </p>
          </div>

          <div className="mb-5 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500">내 현장</p>
                {!mySiteId && siteList.length > 0 ? (
                  <select
                    className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    value=""
                    onChange={(e) => selectSite(e.target.value)}
                  >
                    <option value="" disabled>현장 선택...</option>
                    {siteList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-white truncate">{siteName || "프로필 현장명 필요"}</p>
                )}
                {siteCode && <p className="text-xs font-mono text-green-300 mt-1">현장코드 {siteCode}</p>}
              </div>
              {mySiteId && (
                <button
                  type="button"
                  onClick={saveCurrentSiteLocation}
                  className="shrink-0 bg-green-700 hover:bg-green-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <LocateFixed className="w-4 h-4" />
                  현장 위치 저장
                </button>
              )}
            </div>
            {locationStatus && <p className="text-xs text-gray-400 mt-3">{locationStatus}</p>}
          </div>

          <div className="mb-5 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <p className="text-sm font-semibold">오늘 현장 확인코드</p>
                </div>
                <p className="text-xs text-gray-500">
                  근로자는 NFC 태깅 후 이 6자리 코드를 입력해야 출근/퇴근이 확정됩니다.
                </p>
              </div>
              <button
                type="button"
                disabled={challengeLoading}
                onClick={() => createChallenge(Boolean(challenge))}
                className="shrink-0 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {challenge ? "재발급" : "생성"}
              </button>
            </div>
            <div className="mt-4 rounded-lg bg-gray-950 border border-gray-800 px-4 py-5 text-center">
              <p className="font-mono text-4xl font-black tracking-[0.35em] text-white">
                {challenge?.challenge_code ?? "------"}
              </p>
              {challenge?.expires_at && (
                <p className="text-xs text-gray-500 mt-2">
                  만료: {new Date(challenge.expires_at).toLocaleString("ko-KR")}
                </p>
              )}
            </div>
            {challengeStatus && <p className="text-xs text-gray-400 mt-3">{challengeStatus}</p>}
          </div>

          <div className="space-y-4">
            {MENU.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="w-full bg-gray-800 hover:bg-gray-700 rounded-xl p-5 flex items-center gap-4 transition-all text-left border border-gray-700 hover:border-gray-500"
                >
                  <div className={`bg-gradient-to-br ${item.color} p-3 rounded-lg shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="text-gray-400 text-sm mt-0.5">{item.desc}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            뒤로 가기
          </button>
        </section>
      </main>
    </RoleGuard>
  );
}
