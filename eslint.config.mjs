import checkFile from "eslint-plugin-check-file";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

const UI_FRAMEWORK = ["react", "react/*", "react-dom", "react-dom/*", "@phosphor-icons/*"];

const iconRule = {
  name: "lucide-react",
  message: "Icons come from @phosphor-icons/react.",
};

/** One no-restricted-imports rule per layer: ESLint keeps only the last match. */
function restrictImports(patterns) {
  return ["error", { paths: [iconRule], patterns }];
}

const noApps = {
  group: ["apps/*", "**/apps/*", "@artinova-software/browser-extension"],
  message: "Libraries must not import application code.",
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/coverage/**",
      "**/test-results/**",
      "**/playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "check-file": checkFile,
      import: importPlugin,
      "unused-imports": unusedImports,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: ["apps/*/tsconfig.json", "libs/*/tsconfig.json"],
        },
        node: true,
      },
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      curly: ["error", "all"],
      "no-console": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/no-unresolved": ["error", { ignore: ["\\?raw$", "\\.css$"] }],
      "sort-imports": [
        "error",
        {
          allowSeparatedGroups: true,
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: true,
        },
      ],
      "no-restricted-imports": restrictImports([]),
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "Use a const object and a union type instead of an enum.",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "unused-imports/no-unused-imports": "error",
      "check-file/filename-naming-convention": [
        "error",
        { "**/*.{ts,tsx,mjs}": "KEBAB_CASE" },
        { ignoreMiddleExtensions: true },
      ],
    },
  },
  {
    // Type-aware rules on TypeScript sources only (the projects own them).
    files: ["**/*.{ts,tsx}"],
    ignores: ["**/*.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  {
    files: ["**/*.{mjs,js}", "**/*.config.ts"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },
  {
    // The only place that may write to the console.
    files: ["apps/browser/src/platform/logging/console-log.service.ts"],
    rules: { "no-console": "off" },
  },

  // ---- Libraries -------------------------------------------------------
  {
    files: ["libs/**/*.ts"],
    rules: { "no-restricted-imports": restrictImports([noApps]) },
  },
  {
    // The bridge library is copied into the web app: zod is its only dependency.
    files: ["libs/bridge/src/**/*.ts"],
    ignores: ["libs/bridge/src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": restrictImports([
        noApps,
        {
          regex: "^(?!zod$|\\.{1,2}/)",
          message: "libs/bridge may only import zod and its own files.",
        },
      ]),
    },
  },

  // ---- Browser extension layers ----------------------------------------
  {
    // `chrome` and `browser` go through platform/browser/BrowserApi.
    files: ["apps/browser/src/**/*.{ts,tsx}"],
    ignores: [
      "apps/browser/src/platform/browser/**",
      "apps/browser/src/**/content/**",
      "apps/browser/src/**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "chrome", message: "Use BrowserApi (platform/browser/browser-api.ts)." },
        { name: "browser", message: "Use BrowserApi (platform/browser/browser-api.ts)." },
      ],
    },
  },
  {
    files: [
      "apps/browser/src/background.ts",
      "apps/browser/src/background/**/*.ts",
      "apps/browser/src/platform/**/*.ts",
      "apps/browser/src/**/background/**/*.ts",
      "apps/browser/src/**/services/**/*.ts",
      "apps/browser/src/**/models/**/*.ts",
      "apps/browser/src/*/*.commands.ts",
      "apps/browser/src/*/*.state.ts",
    ],
    rules: {
      "no-restricted-imports": restrictImports([
        { group: UI_FRAMEWORK, message: "No UI framework outside the popup." },
        {
          group: ["**/popup/**", "**/content/**"],
          message: "Background, platform and services do not import popup or content code.",
        },
      ]),
    },
  },
  {
    files: ["apps/browser/src/**/content/**/*.ts"],
    rules: {
      "no-restricted-imports": restrictImports([
        { group: UI_FRAMEWORK, message: "Content scripts are framework-free." },
        {
          group: ["**/popup/**", "**/background/**", "**/services/**"],
          message: "Content scripts talk to the background through messages only.",
        },
      ]),
    },
  },
  {
    files: ["apps/browser/src/**/popup/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictImports([
        {
          group: ["**/content/**", "**/background/**", "**/services/**"],
          message: "The popup talks to the background through messages only.",
        },
      ]),
    },
  },
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ["apps/browser/src/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
  },
  {
    files: ["apps/browser/src/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
