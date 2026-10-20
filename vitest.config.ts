import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "suppliers",
          root: "libs/suppliers",
          environment: "jsdom",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "bridge",
          root: "libs/bridge",
          environment: "jsdom",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "browser",
          root: "apps/browser",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}", "webpack/**/*.test.mjs", "test/**/*.test.ts"],
          setupFiles: ["test/setup.ts"],
        },
        define: {
          __DEV__: "false",
          __BROWSER__: JSON.stringify("chrome"),
          __TARGET__: JSON.stringify("e2e"),
          __VERSION__: JSON.stringify("0.1.0"),
          __APP_CONFIG__: JSON.stringify({
            artinovaOrigins: ["https://app.artinova.test", "http://localhost:3000"],
            artinovaAppUrl: "https://app.artinova.test",
            selectionPath: "/stock?selection=extension",
            helpUrl: "https://artinova.fr/aide",
          }),
        },
      },
      {
        test: {
          name: "scripts",
          root: "scripts",
          environment: "node",
          include: ["**/*.test.mjs"],
        },
      },
    ],
  },
});
