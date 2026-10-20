// Build-time constants injected by webpack's DefinePlugin (webpack.config.mjs).
declare const __DEV__: boolean;
declare const __BROWSER__: "chrome" | "edge" | "firefox";
declare const __TARGET__: "development" | "staging" | "production" | "e2e";
declare const __VERSION__: string;
declare const __APP_CONFIG__: unknown;

declare module "*.css?raw" {
  const css: string;
  export default css;
}

declare module "*.css";
