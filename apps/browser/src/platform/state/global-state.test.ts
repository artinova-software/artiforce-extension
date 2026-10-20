import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { LogService } from "../logging/log.service";
import { GlobalStateProvider } from "./global-state";
import { KeyDefinition, StateDefinition } from "./state-definition";

const log: LogService = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const COUNTER = new KeyDefinition(new StateDefinition("test", "disk"), "counter", {
  schema: z.object({ value: z.number().int() }),
  defaultValue: { value: 0 },
});

describe("GlobalState", () => {
  it("stores under global_<state>_<key> in storage.local", async () => {
    const state = new GlobalStateProvider({ log, canWrite: true }).get(COUNTER);
    await state.update(() => ({ value: 2 }));
    expect(await chrome.storage.local.get("global_test_counter")).toEqual({
      global_test_counter: { value: 2 },
    });
  });

  it("falls back to the default (with a warning) on an invalid stored value", async () => {
    await chrome.storage.local.set({ global_test_counter: { value: "oops" } });
    const state = new GlobalStateProvider({ log, canWrite: true }).get(COUNTER);
    expect(await state.get()).toEqual({ value: 0 });
    expect(log.warn).toHaveBeenCalled();
  });

  it("serializes concurrent updates", async () => {
    const state = new GlobalStateProvider({ log, canWrite: true }).get(COUNTER);
    await Promise.all(
      Array.from({ length: 20 }, () =>
        state.update(async (current) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return { value: current.value + 1 };
        }),
      ),
    );
    expect(await state.get()).toEqual({ value: 20 });
  });

  it("notifies subscribers with validated values", async () => {
    const provider = new GlobalStateProvider({ log, canWrite: true });
    const listener = vi.fn();
    const unsubscribe = provider.get(COUNTER).subscribe(listener);
    await provider.get(COUNTER).update(() => ({ value: 5 }));
    unsubscribe();
    await provider.get(COUNTER).update(() => ({ value: 6 }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ value: 5 });
  });

  it("is read-only outside the background", async () => {
    const state = new GlobalStateProvider({ log, canWrite: false }).get(COUNTER);
    expect(() => state.update(() => ({ value: 1 }))).toThrow(/read-only/);
  });

  it("refuses to write a value that breaks the schema", async () => {
    const state = new GlobalStateProvider({ log, canWrite: true }).get(COUNTER);
    await expect(state.update(() => ({ value: 1.5 }))).rejects.toThrow();
    expect(await state.get()).toEqual({ value: 0 });
  });
});
