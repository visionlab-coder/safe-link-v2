import "server-only";
import { getV3SessionUser } from "@/utils/auth/v3-session-user";

export type CookieUser = {
    id: string;
    email: string | null;
    accessToken: string;
    source: "v3";
    roles?: string[];
    siteIds?: number[];
};

export async function getCookieUser(options: { allowV3?: boolean } = {}): Promise<CookieUser | null> {
    if (!options.allowV3) return null;
    const v3User = await getV3SessionUser();
    if (!v3User) return null;
    return {
        id: `v3:${v3User.id}`,
        email: v3User.email,
        accessToken: "",
        source: "v3",
        roles: v3User.roles,
        siteIds: v3User.siteIds,
    };
}
