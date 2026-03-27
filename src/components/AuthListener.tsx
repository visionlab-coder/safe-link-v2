"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

/**
 * 전역 Auth 상태 리스너
 * 세션 만료, 로그아웃, 토큰 갱신 실패를 감지하여 로그인 페이지로 리다이렉트
 */
export default function AuthListener() {
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event) => {
                if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
                    // TOKEN_REFRESHED는 정상 갱신 — 무시
                    if (event === "SIGNED_OUT") {
                        router.replace("/auth");
                    }
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

    return null;
}
