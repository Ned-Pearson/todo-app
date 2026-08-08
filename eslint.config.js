import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// A deliberately minimal baseline — typescript-eslint's plain (non-type-
// checked) `recommended` preset, plus just the two classic hooks rules
// (rules-of-hooks, exhaustive-deps) rather than eslint-plugin-react-hooks'
// full "recommended" bundle, which as of v7 also pulls in a dozen React
// Compiler-oriented rules (purity, immutability, static-components, etc.)
// this codebase was never written against. Widening either of those is a
// reasonable future step, not something to take on as part of a first pass.
export default tseslint.config(
  { ignores: ["dist/**", "src-tauri/**", "node_modules/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // The codebase's established shorthand for a conditional call, e.g.
      // `cond ? doA() : doB()` as its own statement — used elsewhere already
      // (as an implicit arrow-function return, which this rule doesn't flag
      // either way) so allow it as a bare statement too instead of forcing
      // an if/else rewrite just to satisfy the linter.
      "@typescript-eslint/no-unused-expressions": ["error", { allowTernary: true, allowShortCircuit: true }],
    },
  },
  {
    // vite.config.ts runs under Node during the build, not in the browser.
    files: ["vite.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Every row coming back from the SQLite driver is untyped by nature —
    // db.ts's row-mapper functions exist specifically to turn that raw shape
    // into the app's real, typed domain objects, so `any` at that one
    // boundary is the standard, accepted pattern rather than something to
    // route around with speculative per-table row interfaces nothing else
    // would ever use.
    files: ["src/lib/db.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
