import { describe, expect, it } from "vitest";

import { createMessageGuard } from "./message-guard";

const ORIGIN = window.location.origin;

function event(
  data: unknown,
  overrides: Partial<{ source: unknown; origin: string; isTrusted: boolean }> = {},
) {
  return {
    data,
    source: "source" in overrides ? overrides.source : window,
    origin: overrides.origin ?? ORIGIN,
    isTrusted: overrides.isTrusted ?? true,
  } as unknown as MessageEvent;
}

const request = (extra: Record<string, unknown> = {}) => ({
  channel: "artiforce-bridge",
  direction: "request",
  protocol: 1,
  id: "r1",
  command: "getCart",
  params: {},
  ...extra,
});

describe("message guard", () => {
  const guard = () => createMessageGuard({ window, allowedOrigins: [ORIGIN] });

  it("accepts a well-formed request and rebuilds its params", () => {
    expect(
      guard().check(
        event(request({ command: "getImages", params: { itemIds: [crypto.randomUUID()] } })),
      ),
    ).toMatchObject({
      kind: "accept",
      request: { id: "r1", command: "getImages" },
    });
  });

  it("is inactive on an origin outside the allow-list", () => {
    const outside = createMessageGuard({ window, allowedOrigins: ["https://app.artiforce.fr"] });
    expect(outside.active).toBe(false);
    expect(outside.check(event(request()))).toEqual({ kind: "ignore" });
  });

  it.each([
    ["untrusted events", { isTrusted: false }],
    ["another source", { source: null }],
    ["another origin", { origin: "https://evil.example" }],
  ])("ignores %s", (_name, overrides) => {
    expect(guard().check(event(request(), overrides))).toEqual({ kind: "ignore" });
  });

  it("ignores other channels, responses and requests without an id", () => {
    expect(guard().check(event({ ...request(), channel: "other" }))).toEqual({ kind: "ignore" });
    expect(guard().check(event({ ...request(), direction: "response" }))).toEqual({
      kind: "ignore",
    });
    expect(guard().check(event({ ...request(), id: "<script>" }))).toEqual({ kind: "ignore" });
    expect(guard().check(event("string"))).toEqual({ kind: "ignore" });
  });

  it("rejects unknown commands, extra keys, bad params and other protocols", () => {
    const check = guard();
    expect(check.check(event(request({ command: "eval" })))).toMatchObject({
      kind: "reject",
      code: "UNKNOWN_COMMAND",
    });
    expect(check.check(event(request({ extra: 1 })))).toMatchObject({
      kind: "reject",
      code: "INVALID_REQUEST",
    });
    expect(check.check(event(request({ command: "clearCart", params: {} })))).toMatchObject({
      kind: "reject",
      code: "INVALID_REQUEST",
    });
    expect(check.check(event(request({ params: { injected: true } })))).toMatchObject({
      kind: "reject",
      code: "INVALID_REQUEST",
    });
    expect(check.check(event(request({ protocol: 2 })))).toMatchObject({
      kind: "reject",
      code: "UNSUPPORTED_PROTOCOL",
    });
  });

  it("limits a page to 20 requests per second", () => {
    let now = 0;
    const limited = createMessageGuard({ window, allowedOrigins: [ORIGIN], now: () => now });
    const verdicts = Array.from({ length: 25 }, () => limited.check(event(request())).kind);
    expect(verdicts.filter((kind) => kind === "accept")).toHaveLength(20);
    now = 1000;
    expect(limited.check(event(request())).kind).toBe("accept");
  });
});
