// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([...nextVitals, ...nextTypescript, {
  rules: {
    // These effects intentionally synchronize state with browser storage,
    // user-agent capabilities, or a small client cache.
    "react-hooks/set-state-in-effect": "off",
  },
}, globalIgnores([
  ".next/**",
  "node_modules/**",
  "sanity/**",
  "scripts/**",
  "types/**/*.d.ts",
  "airalo-debug.ts",
  "next-env.d.ts",
  "public/mockServiceWorker.js",
]), ...storybook.configs["flat/recommended"]]);
