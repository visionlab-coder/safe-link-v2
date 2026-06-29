import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // _로 시작하는 변수는 의도적 미사용으로 허용 (구조분해 제외 패턴 등)
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**/*.js",
    "verify_fix.js",
    // Local backups and generated vendor/reference artifacts are not product source.
    ".codex-backups/**",
    "docs/generated/**",
    // The mobile package has its own toolchain. Native/generated outputs must not
    // pollute the root Next.js lint gate.
    "apps/mobile/**",
  ]),
]);

export default eslintConfig;
