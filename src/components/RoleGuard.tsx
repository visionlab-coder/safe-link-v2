"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function RoleGuard({
    children,
    allowedRole
}: {
    children: React.ReactNode,
    allowedRole: "admin" | "worker" | "hq" | "system"
}) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient();
            let session;
            try {
                const { data } = await supabase.auth.getSession();
                session = data.session;
            } catch {
                // Invalid/expired refresh token — clear and redirect
                await supabase.auth.signOut();
                router.replace("/auth");
                return;
            }

            // 2. 만약 로그인 세션이 없다면? -> 로그인 창으로 쫓아냅니다!
            if (!session) {
                router.replace("/auth");
                return;
            }

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

            // 역할 vs allowedRole 비교
            // ✨ ROOT와 HQ_OFFICER는 통합 관제(system) 권한을 가집니다.
            const isAllowed =
                profile.role === "ROOT" ||
                (allowedRole === "system" && (profile.role === "ROOT" || profile.role === "HQ_OFFICER")) ||
                (allowedRole === "admin" && (profile.role === "HQ_ADMIN" || profile.role === "SAFETY_OFFICER")) ||
                (allowedRole === "hq" && profile.role === "HQ_ADMIN") ||
                (allowedRole === "worker" && profile.role === "WORKER");

            if (!isAllowed) {
                // 실제 역할에 맞는 경로로 안내
                if (profile.role === "ROOT" || profile.role === "HQ_OFFICER") {
                    router.replace("/system");
                } else if (profile.role === "HQ_ADMIN") {
                    router.replace("/control"); // 현장소장 전용 페이지가 있다면 이동
                } else if (profile.role === "SAFETY_OFFICER") {
                    router.replace("/admin");
                } else if (profile.role === "WORKER") {
                    router.replace("/worker");
                } else {
                    router.replace("/auth/setup");
                }
                return;
            }

            setIsAuthorized(true);
        };

        checkAuth();
    }, [router, allowedRole]); // (allowedRole도 깐깐하게 추가했어요)

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
