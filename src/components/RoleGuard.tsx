"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
    getDefaultRouteForProfileRole,
    hasAllowedRole,
    type AllowedRole,
    type ProfileRole,
} from "@/lib/roles";

export default function RoleGuard({
    children,
    allowedRole
}: {
    children: React.ReactNode,
    allowedRole: AllowedRole
}) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const supabase = createClient();

        const checkAuth = async () => {

            // 자동로그인 비활성화 체크:
            // rememberMe=false이고 브라우저를 닫았다 다시 열면 (sessionStorage 없음) → 로그아웃
            const rememberMe = localStorage.getItem("safe-link-remember");
            const sessionActive = sessionStorage.getItem("safe-link-session-active");
            if (rememberMe === "false" && !sessionActive) {
                await supabase.auth.signOut();
                router.replace("/auth");
                return;
            }

            // getUser()로 서버 검증 (getSession은 만료 토큰도 반환할 수 있음)
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                // 만료/무효 세션 → 정리 후 로그인으로
                await supabase.auth.signOut();
                router.replace("/auth");
                return;
            }

            // getSession으로 세션 객체도 확보 (하위 코드에서 session.user.id 사용)
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace("/auth");
                return;
            }

            // 현재 세션 활성 표시 (브라우저 닫으면 자동 삭제됨)
            sessionStorage.setItem("safe-link-session-active", "true");

            // 3. ✨ 드디어 진짜 '내 서랍(DB)'에서 역할을 확인합니다!
            const { data: profile, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .single();

            if (error) {
                console.warn("RoleGuard 에러:", error);
                // 프로필 없음 (PGRST116) → setup으로 이동
                if (error.code === "PGRST116") {
                    router.replace("/auth/setup");
                    return;
                }
                router.replace("/auth");
                return;
            }

            if (!profile) {
                router.replace("/auth/setup");
                return;
            }

            // 역할 vs allowedRole 비교 (DB에 소문자로 저장된 경우 대비 정규화)
            const role = (String(profile.role || "")).toUpperCase() as ProfileRole;
            const isAllowed = role ? hasAllowedRole(role, allowedRole) : false;

            if (!isAllowed) {
                if (!role) {
                    router.replace("/auth/setup");
                    return;
                }

                // 실제 역할에 맞는 경로로 안내 (매핑 없으면 /auth/setup)
                const fallbackRoute = getDefaultRouteForProfileRole(role) ?? "/auth/setup";
                router.replace(fallbackRoute);
                return;
            }

            setIsAuthorized(true);
        };

        checkAuth();

        // M-09: auth 상태 변경 감지 — SIGNED_OUT 시 즉시 리디렉션, 토큰 갱신 시 역할 재검증
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT") {
                setIsAuthorized(false);
                router.replace("/auth");
            } else if (event === "TOKEN_REFRESHED") {
                checkAuth();
            }
        });

        return () => { subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, allowedRole]);

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-blue-400">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
                <p className="animate-pulse tracking-widest font-bold">안전하게 로그인 확인 중입니다...</p>
            </div>
        );
    }

    return <>{children}</>;
}
