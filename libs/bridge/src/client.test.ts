import { afterEach, describe, expect, it, vi } from "vitest";

import { BridgeClient } from "./client";
import { BRIDGE_CHANNEL } from "./protocol";

/** Delivers a message as the page itself would (jsdom leaves source and origin empty). */
function deliver(data: unknown) {
  window.dispatchEvent(
    new MessageEvent("message", { data, origin: window.location.origin, source: window }),
  );
}

/** Plays the extension: answers the requests the client posts. */
function fakeExtension(
  answer: (request: { id: string; command: string; params: unknown }) => unknown,
) {
  const spy = vi.spyOn(window, "postMessage").mockImplementation((message: unknown) => {
    const data = message as { direction?: string; id: string; command: string; params: unknown };
    if (data.direction !== "request") {
      return;
    }
    const reply = answer(data);
    if (reply !== undefined) {
      queueMicrotask(() =>
        deliver({
          channel: BRIDGE_CHANNEL,
          direction: "response",
          protocol: 1,
          id: data.id,
          ...(reply as object),
        }),
      );
    }
  });
  return () => spy.mockRestore();
}

describe("BridgeClient", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  it("resolves validated results and detects the extension", async () => {
    cleanup = fakeExtension(() => ({
      ok: true,
      result: { extensionVersion: "0.1.0", browser: "chrome", protocols: [1], capabilities: [] },
    }));
    const client = new BridgeClient(window, { timeoutMs: 500 });
    await expect(client.detect()).resolves.toMatchObject({ extensionVersion: "0.1.0" });
    client.dispose();
  });

  it("rejects with the extension's error code", async () => {
    cleanup = fakeExtension(() => ({
      ok: false,
      error: { code: "REVISION_MISMATCH", message: "x" },
    }));
    const client = new BridgeClient(window, { timeoutMs: 500 });
    await expect(client.request("clearCart", { expectedRevision: 1 })).rejects.toMatchObject({
      code: "REVISION_MISMATCH",
    });
    client.dispose();
  });

  it("rejects a result that breaks the schema", async () => {
    cleanup = fakeExtension(() => ({ ok: true, result: { revision: -1, items: "nope" } }));
    const client = new BridgeClient(window, { timeoutMs: 500 });
    await expect(client.request("getCart", {})).rejects.toMatchObject({ code: "INTERNAL" });
    client.dispose();
  });

  it("times out without an extension", async () => {
    const client = new BridgeClient(window, { timeoutMs: 50 });
    await expect(client.request("hello", {})).rejects.toMatchObject({ code: "TIMEOUT" });
    await expect(client.detect()).resolves.toBeNull();
    client.dispose();
  });

  it("delivers valid events only", async () => {
    const client = new BridgeClient(window, { timeoutMs: 500 });
    const listener = vi.fn();
    client.on("cart.changed", listener);
    deliver({
      channel: BRIDGE_CHANNEL,
      direction: "event",
      protocol: 1,
      event: "cart.changed",
      data: { revision: 2, count: 1 },
    });
    deliver({
      channel: BRIDGE_CHANNEL,
      direction: "event",
      protocol: 1,
      event: "cart.changed",
      data: { count: "x" },
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          channel: BRIDGE_CHANNEL,
          direction: "event",
          protocol: 1,
          event: "cart.changed",
          data: { revision: 9, count: 9 },
        },
        origin: "https://evil.example",
        source: window,
      }),
    );
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    expect(listener).toHaveBeenCalledWith({ revision: 2, count: 1 });
    client.dispose();
  });
});
