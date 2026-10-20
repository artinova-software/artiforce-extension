import { describe, expect, it } from "vitest";

import { Mutex } from "./mutex";

describe("Mutex", () => {
  it("runs sections one at a time, in order, even after a failure", async () => {
    const mutex = new Mutex();
    const events: string[] = [];
    const section = (name: string, fail = false) =>
      mutex.run(async () => {
        events.push(`start ${name}`);
        await new Promise((resolve) => setTimeout(resolve, 2));
        events.push(`end ${name}`);
        if (fail) {
          throw new Error(name);
        }
        return name;
      });
    const results = await Promise.allSettled([section("a"), section("b", true), section("c")]);
    expect(events).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });
});
