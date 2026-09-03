"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getV3CurrentUser } from "@/lib/v3-auth";
import type { V3Role } from "@/lib/v3-role-contract";
import {
    getDefaultRouteForProfileRole,
    hasAllowedRole,
    type AllowedRole,
    type ProfileRole,
} from "@/lib/roles";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";
import { getT as getAuthT } from "@/app/auth/translations";

const ROLE_GUARD_MESSAGE: Record<string, string> = {
    ko: "안전하게 로그인 확인 중입니다...",
    en: "Verifying your secure sign-in...",
    zh: "正在安全验证登录...",
    vi: "Đang xác minh đăng nhập an toàn...",
    ru: "Безопасная проверка входа...",
};

// RoleGuard — 클라이언트 인증/권한 가드.
//
// Spring Boot V3 세션을 우선 확인하고 /api/auth/me 호환 응답을 fallback으로 사용한다.
//
// 미들웨어가 이미 서버측에서 인증+역할 검증을 통과시킨 상태에서 실행되므로
const V3_ROLE_PRIORITY: V3Role[] = ["ROOT", "HQ_ADMIN", "SITE_ADMIN", "SAFETY_MANAGER", "WORKER", "VIEWER"];

function pickV3RouteRole(roles: V3Role[], allowedRole: AllowedRole): V3Role | null {
    return roles.find((role) => hasAllowedRole(role, allowedRole)) ??
        V3_ROLE_PRIORITY.find((role) => roles.includes(role)) ??
        null;
}

export default function RoleGuard({
    children,
    allowedRole,
}: {
    children: React.ReactNode;
    allowedRole: AllowedRole;
}) {
    const router = useRouter();
    const language = useDisplayLanguage();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const checkAuth = async () => {
            // V3에서는 서버의 HttpOnly 세션 쿠키가 인증의 기준이다.
            // sessionStorage는 UI 보조값이므로, 새 탭·새로고침·직접 URL 진입에서
            // 값이 없다는 이유만으로 유효한 서버 세션을 로그인 화면으로 보내지 않는다.

            try {
                const v3User = await getV3CurrentUser().catch(() => null);
                if (v3User) {
                    if (typeof sessionStorage !== "undefined") {
                        sessionStorage.setItem("safe-link-session-active", "true");
                    }

                    const routeRole = pickV3RouteRole(v3User.roles, allowedRole);
                    if (!routeRole || !hasAllowedRole(routeRole, allowedRole)) {
                        router.replace(routeRole ? getDefaultRouteForProfileRole(routeRole) : "/auth/setup");
                        return;
                    }

                    setIsAuthorized(true);
                    return;
                }

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
    }, [router, allowedRole]);

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f6fa] px-6 text-blue-700">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] border border-blue-100 bg-white shadow-[0_16px_40px_rgba(37,99,235,.12)]">
                    <div className="h-10 w-10 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                </div>
                <p className="font-black tracking-tight text-[#172033]">{ROLE_GUARD_MESSAGE[language] ?? getAuthT(language).adminDesc}</p>
                <p className="mt-2 text-xs font-bold tracking-widest text-slate-500">SQ LINK</p>
            </div>
        );
    }

    return <>{children}</>;
}
