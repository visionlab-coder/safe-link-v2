import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";

function resolveReleaseSha(): string {
  const environmentSha = [
    process.env.SAFE_LINK_RELEASE_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
    process.env.GITHUB_SHA,
  ].find((value) => value?.trim());

  if (environmentSha) return environmentSha.trim();

  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

const releaseSha = resolveReleaseSha();
const buildTime = process.env.SAFE_LINK_BUILD_TIME?.trim() || new Date().toISOString();

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // Public, non-secret build identity. Both deployment adapters expose this
  // through /api/version so parity is checked by source SHA, not bundle hash.
  env: {
    NEXT_PUBLIC_SAFE_LINK_RELEASE_SHA: releaseSha,
    NEXT_PUBLIC_SAFE_LINK_BUILD_TIME: buildTime,
  },
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    // ⚠️ dev 모드는 Next HMR이 eval을 사용 → 'unsafe-eval' 없으면 클라이언트 JS 차단(하이드레이션 실패=클릭 전멸).
    //    프로덕션은 eval 미사용 → 엄격 CSP 유지(보안). dev에서만 unsafe-eval + localhost/Flitto WS 허용.
    const isDev = process.env.NODE_ENV !== "production";
    const scriptSrc = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;
    const connectSrc = [
      "connect-src 'self'",
      "https://*.supabase.co wss://*.supabase.co",
      "https://generativelanguage.googleapis.com https://sheets.googleapis.com https://www.googleapis.com",
      "https://huggingface.co https://*.huggingface.co https://*.hf.co https://*.xethub.hf.co",
      "wss://ai-realtime-dev.flit.to",  // Flitto RTT (실시간 STT/번역) — 플래그 ON 시 브라우저가 직접 연결
      isDev ? "ws://localhost:* http://localhost:*" : "",
    ].filter(Boolean).join(" ");
    return [
      {
        source: "/_next/static/chunks/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/_next/static/media/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/lab/on-device-speech",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              connectSrc,
              "worker-src 'self' blob:",
              "media-src 'self' blob:",
              "font-src 'self' data:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
