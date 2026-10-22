import "./platform/config/zod-jitless";

import { MainBackground } from "./background/main.background";

// Top level, synchronous: construct, register listeners, then bootstrap.
const main = new MainBackground();
main.listen();
void main.bootstrap();

if (__TARGET__ === "e2e" || __DEV__) {
  // Diagnostics handle for the e2e suite and local debugging; never in production builds.
  (globalThis as { __artiforceMain?: MainBackground }).__artiforceMain = main;
}
