import "server-only";
import { getV3SessionUser } from "@/utils/auth/v3-session-user";

export async function requireRootAdmin(): Promise<{ id: string; email: string } | null> {
    const masters = (process.env.MASTER_EMAILS || "")
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    if (masters.length === 0) return null;

    const v3User = await getV3SessionUser();
    if (v3User?.email && v3User.roles.includes("ROOT") && masters.includes(v3User.email.toLowerCase())) {
        return { id: `v3:${v3User.id}`, email: v3User.email };
    }
    return null;
}
