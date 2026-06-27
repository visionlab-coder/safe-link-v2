export type RuntimeConfig = {
  appEnv: string;
  apiBaseUrl: string | null;
  supabaseUrl: string | null;
  supabasePublishableKeyConfigured: boolean;
};

function normalizedUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    appEnv: import.meta.env.VITE_APP_ENV || "development",
    apiBaseUrl: normalizedUrl(import.meta.env.VITE_SAFE_LINK_API_BASE_URL),
    supabaseUrl: normalizedUrl(import.meta.env.VITE_SUPABASE_URL),
    supabasePublishableKeyConfigured:
      Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  };
}
