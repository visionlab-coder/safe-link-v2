"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    getDefaultRouteForProfileRole,
    hasAllowedRole,
    type AllowedRole,
    type ProfileRole,
} from "@/lib/roles";

// RoleGuard — 클라이언트 인증/권한 가드.
//
// /api/auth/me 단일 엔드포인트로 인증 상태와 역할 확인.
// createBrowserClient(@supabase/ssr) 의존 제거 → Workers / Vercel 어디서나 안정.
//
// 미들웨어가 이미 서버측에서 인증+역할 검증을 통과시킨 상태에서 실행되므로
// 이 가드는 사실상 2차 방어 + 클라이언트 라우팅용. /api/auth/me 가 401 이면
// 만료/세션 손상으로 보고 /auth 로 안내.

export default function RoleGuard({
    children,
    allowedRole,
}: {
    children: React.ReactNode;
    allowedRole: AllowedRole;
}) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const checkAuth = async () => {
            // rememberMe 처리: 브라우저 닫고 다시 열면 자동 로그인 안 함.
            const rememberMe = typeof localStorage !== "undefined"
                ? localStorage.getItem("safe-link-remember")
                : null;
            const sessionActive = typeof sessionStorage !== "undefined"
                ? sessionStorage.getItem("safe-link-session-active")
                : null;
            if (rememberMe === "false" && !sessionActive) {
                // signOut 호출은 cookie 클리어용 — /api/auth/signout 호출하면 좋지만
                // 지금은 단순히 /auth 로 보내고 거기서 클리어.
                router.replace("/auth");
                return;
            }

            try {
                const res = await fetch("/api/auth/me", {
                    cache: "no-store",
                    credentials: "include",
                });

                if (!res.ok) {
                    if (cancelled) return;
                    router.replace("/auth");
                    return;
                }

                const data = (await res.json()) as {
                    user?: { id: string; email: string | null };
                    profile?: {
                        role?: string;
                        preferred_lang?: string | null;
                        display_name?: string | null;
                    } | null;
                };

                if (cancelled) return;

                if (!data.user || !data.profile) {
                    router.replace("/auth/setup");
                    return;
                }

                if (typeof sessionStorage !== "undefined") {
                    sessionStorage.setItem("safe-link-session-active", "true");
                }

                const role = (String(data.profile.role || "")).toUpperCase() as ProfileRole;
                if (!role) {
                    router.replace("/auth/setup");
                    return;
                }

                if (!hasAllowedRole(role, allowedRole)) {
                    const fallbackRoute = getDefaultRouteForProfileRole(role) ?? "/auth/setup";
                    router.replace(fallbackRoute);
                    return;
                }

                setIsAuthorized(true);
            } catch {
                if (cancelled) return;
                router.replace("/auth");
            }
        };

        checkAuth();

        return () => {
            cancelled = true;
        };
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
