import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { LogService } from "../logging/log.service";
import { CHANNEL, CommandError, defineCommand, SenderKind } from "./command";
import { MessageRouter } from "./message-router";
import { sendCommand } from "./message-sender";

const silent: LogService = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const echo = defineCommand({
  name: "test/echo",
  request: z.object({ value: z.string() }),
  response: z.object({ value: z.string() }),
  senders: [SenderKind.EXTENSION_PAGE],
});

function routerFor(kind: SenderKind, ready: Promise<void> = Promise.resolve()) {
  const router = new MessageRouter({ classify: () => kind, ready, log: silent });
  router.register(echo, async ({ value }) => ({ value: value.toUpperCase() }));
  return router;
}

const envelope = (payload: unknown, command: string = echo.name) => ({
  channel: CHANNEL,
  command,
  payload,
});

describe("MessageRouter", () => {
  it("runs the handler for an allowed sender", async () => {
    await expect(
      routerFor(SenderKind.EXTENSION_PAGE).handle(envelope({ value: "a" }), {}),
    ).resolves.toEqual({
      ok: true,
      result: { value: "A" },
    });
  });

  it("refuses a sender kind the command does not list", async () => {
    const response = await routerFor(SenderKind.SUPPLIER_CONTENT).handle(
      envelope({ value: "a" }),
      {},
    );
    expect(response).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("validates the envelope, the command name and the request", async () => {
    const router = routerFor(SenderKind.EXTENSION_PAGE);
    expect(await router.handle({ channel: "x" }, {})).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    expect(await router.handle(envelope({}, "test/nope"), {})).toMatchObject({
      error: { code: "UNKNOWN_COMMAND" },
    });
    expect(await router.handle(envelope({ value: 1 }), {})).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("waits for ready before running the handler", async () => {
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = routerFor(SenderKind.EXTENSION_PAGE, ready).handle(
      envelope({ value: "a" }),
      {},
    );
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await expect(pending).resolves.toMatchObject({ ok: true });
  });

  it("maps CommandError codes and hides other errors", async () => {
    const router = new MessageRouter({
      classify: () => SenderKind.EXTENSION_PAGE,
      ready: Promise.resolve(),
      log: silent,
    });
    const failing = defineCommand({ ...echo, name: "test/fail" });
    router.register(failing, async ({ value }) => {
      if (value === "full") {
        throw new CommandError("CART_FULL", "full");
      }
      throw new Error("secret detail");
    });
    expect(await router.handle(envelope({ value: "full" }, "test/fail"), {})).toMatchObject({
      error: { code: "CART_FULL" },
    });
    expect(await router.handle(envelope({ value: "x" }, "test/fail"), {})).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "Internal error" },
    });
  });

  it("round-trips through sendCommand and the runtime listener", async () => {
    const router = routerFor(SenderKind.EXTENSION_PAGE);
    chrome.runtime.onMessage.addListener(router.listener);
    await expect(sendCommand(echo, { value: "abc" })).resolves.toEqual({ value: "ABC" });
  });

  it("reports EXTENSION_RELOADED from an orphaned context", async () => {
    chromeFake.invalidate();
    await expect(sendCommand(echo, { value: "abc" })).rejects.toMatchObject({
      code: "EXTENSION_RELOADED",
    });
  });
});
