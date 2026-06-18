import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // App Router only: the FSD `src/pages` layer is NOT the Pages Router.
      // eslint-config-next's no-html-link-for-pages scans `src/pages` and misdetects
      // each slice (e.g. src/pages/login) as a page route, then flags internal <a>
      // links elsewhere. Same root cause as the Next 16 `src/pages` collision
      // documented in docs/superpowers/HANDOFF.md.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
