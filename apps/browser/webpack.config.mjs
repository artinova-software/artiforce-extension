import { readFileSync } from "node:fs";
import { join } from "node:path";

import CopyWebpackPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import TerserPlugin from "terser-webpack-plugin";
import webpack from "webpack";

import { APP_DIR, resolveBuild } from "./webpack/build-config.mjs";
import { ForbiddenModulesPlugin } from "./webpack/forbidden-modules-plugin.mjs";
import { buildManifest } from "./webpack/manifest.mjs";
import { loadAppConfig } from "./webpack/app-config.mjs";

const UI_MODULES = [
  /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:react|react-dom|scheduler)\//,
  /@phosphor-icons/,
  /\/src\/(?:[^/]+\/)*popup\//,
];

export default (env = {}) => {
  const build = resolveBuild(env);
  const appConfig = loadAppConfig(build.target);

  const swc = (tsx) => ({
    loader: "swc-loader",
    options: {
      jsc: {
        parser: { syntax: "typescript", tsx },
        transform: tsx ? { react: { runtime: "automatic", development: build.isDev } } : undefined,
        target: "es2022",
      },
    },
  });

  const shared = {
    mode: build.isDev ? "development" : "production",
    // Never eval-* source maps: MV3 CSP forbids eval in extension pages.
    devtool: build.target === "production" ? false : "source-map",
    context: APP_DIR,
    resolve: { extensions: [".ts", ".tsx", ".js", ".mjs", ".json"] },
    module: {
      rules: [
        { test: /\.css$/i, resourceQuery: /raw/, type: "asset/source" },
        { test: /\.tsx$/, exclude: /node_modules/, use: swc(true) },
        { test: /\.ts$/, exclude: /node_modules/, use: swc(false) },
      ],
    },
    performance: { hints: false },
    stats: "errors-warnings",
  };

  const define = new webpack.DefinePlugin({
    __DEV__: JSON.stringify(build.isDev),
    __BROWSER__: JSON.stringify(build.browser),
    __TARGET__: JSON.stringify(build.target),
    __VERSION__: JSON.stringify(build.version),
    __APP_CONFIG__: JSON.stringify(appConfig),
  });

  const forbidden = new ForbiddenModulesPlugin({
    asyncChunksAllowed: /^popup\//,
    rules: [
      {
        chunks: /^(background|content\/)/,
        forbid: UI_MODULES,
        reason: "the service worker and content scripts stay framework-free",
      },
    ],
  });

  const entry = {
    "popup/main": "./src/popup/main.tsx",
    "content/supplier-button": "./src/capture/content/supplier-button.ts",
    "content/artiforce-bridge": "./src/bridge/content/artiforce-bridge.ts",
  };
  if (build.target === "e2e") {
    entry["e2e/bridge-client"] = "./test/e2e/app/bridge-client.ts";
  }

  const main = {
    ...shared,
    name: "main",
    target: "web",
    entry,
    output: {
      path: build.outDir,
      filename: "[name].js",
      clean: true,
    },
    module: {
      rules: [
        ...shared.module.rules,
        {
          test: /\.css$/i,
          resourceQuery: { not: [/raw/] },
          use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
        },
      ],
    },
    optimization: {
      // Each entry is a self-contained IIFE: MV3 content scripts are classic scripts.
      splitChunks: false,
      runtimeChunk: false,
      minimize: !build.isDev,
      minimizer: [new TerserPlugin({ exclude: /^content\//, extractComments: false })],
    },
    plugins: [
      define,
      forbidden,
      new MiniCssExtractPlugin({ filename: "[name].css" }),
      new HtmlWebpackPlugin({
        template: "./src/popup/index.html",
        filename: "popup/index.html",
        chunks: ["popup/main"],
        publicPath: "/",
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "src/_locales", to: "_locales" },
          { from: "src/images", to: "images" },
          {
            from: "src/manifest.json",
            to: "manifest.json",
            transform: (content) =>
              `${JSON.stringify(
                buildManifest(JSON.parse(content.toString()), {
                  ...build,
                  appConfig,
                  devKey: readFileSync(
                    join(APP_DIR, "config", "dev-manifest-key.txt"),
                    "utf8",
                  ).trim(),
                }),
                null,
                2,
              )}\n`,
          },
        ],
      }),
    ],
  };

  const background = {
    ...shared,
    name: "background",
    dependencies: ["main"],
    // Chrome and Edge run a service worker; Firefox MV3 runs an event page.
    target: build.browser === "firefox" ? "web" : "webworker",
    entry: { background: "./src/background.ts" },
    output: { path: build.outDir, filename: "[name].js" },
    optimization: {
      splitChunks: false,
      runtimeChunk: false,
      minimize: !build.isDev,
      minimizer: [new TerserPlugin({ extractComments: false })],
    },
    plugins: [define, forbidden],
  };

  return [main, background];
};
