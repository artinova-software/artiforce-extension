import { beforeEach } from "vitest";

import { type ChromeFake, createChromeFake } from "./chrome-fake";

declare global {
  var chromeFake: ChromeFake["controls"];
}

// A fresh in-memory `chrome` for every test.
beforeEach(() => {
  const { chrome, controls } = createChromeFake();
  Object.assign(globalThis, { chrome, chromeFake: controls });
});
