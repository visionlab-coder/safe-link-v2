export type VerifiedAccessToken = {
    sub: string;
    email: string | null;
};

export type StoredAuthSession = {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
    user?: Record<string, unknown>;
};

export function extractBearerToken(authorization: string | null | undefined): string | null {
    if (!authorization) return null;
    const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
    return match?.[1] ?? null;
}

export function parseSessionCookie(rawCookie: string | null | undefined): StoredAuthSession | null {
    if (!rawCookie) return null;
    try {
        const inner = rawCookie.startsWith("base64-")
            ? Buffer.from(rawCookie.slice(7), "base64").toString("utf-8")
            : rawCookie;
        const session = JSON.parse(inner) as StoredAuthSession;
        return session && typeof session === "object" ? session : null;
    } catch {
        return null;
    }
}

export function resolveRequestAccessToken(input: {
    authorization?: string | null;
    rawCookie?: string | null;
}): {
    accessToken: string;
    source: "bearer" | "cookie";
    session: StoredAuthSession | null;
} | null {
    const bearer = extractBearerToken(input.authorization);
    if (bearer) return { accessToken: bearer, source: "bearer", session: null };

    const session = parseSessionCookie(input.rawCookie);
    if (!session?.access_token) return null;
    return { accessToken: session.access_token, source: "cookie", session };
}

export async function verifyAccessTokenWithAuthServer(
    token: string,
    options: {
        supabaseUrl: string;
        anonKey: string;
        fetchImpl?: typeof fetch;
    }
): Promise<VerifiedAccessToken | null> {
    if (!token || /\s/.test(token)) return null;

    try {
        const response = await (options.fetchImpl ?? fetch)(
            `${options.supabaseUrl.replace(/\/+$/, "")}/auth/v1/user?apikey=${encodeURIComponent(options.anonKey)}`,
            {
                method: "GET",
                headers: {
                    apikey: options.anonKey,
                    Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
            }
        );
        if (!response.ok) return null;

        const user = (await response.json()) as { id?: unknown; email?: unknown };
        if (typeof user.id !== "string" || !user.id) return null;
        return {
            sub: user.id,
            email: typeof user.email === "string" ? user.email : null,
        };
    } catch {
        return null;
    }
}

export type RequestTokenVerification =
    | {
          ok: true;
          accessToken: string;
          source: "bearer" | "cookie";
          session: StoredAuthSession | null;
          user: VerifiedAccessToken;
      }
    | {
          ok: false;
          status: 401;
          error: "missing_access_token" | "invalid_access_token";
      };

export async function verifyRequestAccessToken(
    input: {
        authorization?: string | null;
        rawCookie?: string | null;
    },
    verifier: (token: string) => Promise<VerifiedAccessToken | null>
): Promise<RequestTokenVerification> {
    const resolved = resolveRequestAccessToken(input);
    if (!resolved) {
        return { ok: false, status: 401, error: "missing_access_token" };
    }

    const user = await verifier(resolved.accessToken);
    if (!user) {
        return { ok: false, status: 401, error: "invalid_access_token" };
    }

    return { ok: true, ...resolved, user };
}
