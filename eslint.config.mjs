// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["src/test.ts"],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        ...globals.browser,
        ...globals.node,
        createFragment: "readonly",
      },
    },
    rules: {
      // Relax strict type safety rules for existing codebase
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      // Relax floating promises rule - many intentional fire-and-forget async calls
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      // Relax sentence case rule - product names and proper nouns should be capitalized
      "obsidianmd/ui/sentence-case": "warn",
      // Relax fetch restriction - refactoring to requestUrl would require extensive changes
      "no-restricted-globals": "warn",
    },
  },
]);
