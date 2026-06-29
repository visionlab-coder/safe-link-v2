export type ReleaseInfo = {
  application: "safe-link-v2";
  version: string;
  releaseSha: string;
  buildTime: string;
};

const SHA_PATTERN = /^[0-9a-f]{7,64}$/i;

export function createReleaseInfo(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ReleaseInfo {
  const releaseSha = environment.NEXT_PUBLIC_SAFE_LINK_RELEASE_SHA?.trim() || "unknown";
  const buildTime = environment.NEXT_PUBLIC_SAFE_LINK_BUILD_TIME?.trim() || "unknown";

  return {
    application: "safe-link-v2",
    version: "0.1.0",
    releaseSha: SHA_PATTERN.test(releaseSha) ? releaseSha.toLowerCase() : "unknown",
    buildTime,
  };
}
