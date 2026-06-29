import assert from "node:assert/strict";
import { createReleaseInfo } from "../src/utils/release-info-core.ts";

const fullSha = "e5b8efdacfbe2dd1e8a43daff151463cc7b3729f";
const result = createReleaseInfo({
  NEXT_PUBLIC_SAFE_LINK_RELEASE_SHA: fullSha.toUpperCase(),
  NEXT_PUBLIC_SAFE_LINK_BUILD_TIME: "2026-06-29T01:48:08.000Z",
});

assert.deepEqual(result, {
  application: "safe-link-v2",
  version: "0.1.0",
  releaseSha: fullSha,
  buildTime: "2026-06-29T01:48:08.000Z",
});
assert.equal(createReleaseInfo({}).releaseSha, "unknown");
assert.equal(
  createReleaseInfo({ NEXT_PUBLIC_SAFE_LINK_RELEASE_SHA: "not-a-sha" }).releaseSha,
  "unknown",
);

console.log("[release-info-contract] green: valid, missing, and invalid SHA cases");
