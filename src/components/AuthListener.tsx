"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * 전역 V3 Auth 상태 리스너.
 * 클라이언트에서 읽는 토큰 이벤트 대신 Spring Boot `/api/auth/me`만 확인한다.
 */
export default function AuthListener() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const isProtected =
            pathname.startsWith("/admin") ||
            pathname.startsWith("/worker") ||
            pathname.startsWith("/system") ||
            pathname.startsWith("/control");
        if (!isProtected) return;

        let cancelled = false;
        const checkSession = async () => {
            const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" }).catch(() => null);
            if (!cancelled && (!res || !res.ok)) {
                router.replace("/auth");
            }
        };

        const onFocus = () => {
            void checkSession();
        };
        window.addEventListener("focus", onFocus);

        return () => {
            cancelled = true;
            window.removeEventListener("focus", onFocus);
        };
    }, [pathname, router]);

    return null;
}
