// Content script on the Artiforce web app origins (document_start): relays the
// web app's bridge requests to the background and posts cart events back.
// Answers go to location.origin, never "*". No externally_connectable.
import "../../platform/config/zod-jitless";

import {
  BRIDGE_CHANNEL,
  BridgeErrorCode,
  SUPPORTED_PROTOCOLS,
} from "@artiforce-software/extension-bridge/wire";

import { CART_KEY } from "../../cart/cart.state";
import { BrowserApi } from "../../platform/browser/browser-api";
import { loadAppConfig } from "../../platform/config/app-config";
import { ConsoleLogService } from "../../platform/logging/console-log.service";
import { CommandError, MessagingErrorCode } from "../../platform/messaging/command";
import { sendCommand } from "../../platform/messaging/message-sender";
import { GlobalStateProvider } from "../../platform/state/global-state";
import { BRIDGE_RELAY } from "../bridge.commands";
import { createMessageGuard, type GuardedRequest } from "./message-guard";

const GUARD = "__artiforceBridge";

const KNOWN_CODES = new Set<string>(Object.values(BridgeErrorCode));

function toBridgeCode(error: unknown): string {
  if (error instanceof CommandError) {
    if (error.code === MessagingErrorCode.EXTENSION_RELOADED) {
      return BridgeErrorCode.EXTENSION_RELOADED;
    }
    return KNOWN_CODES.has(error.code) ? error.code : BridgeErrorCode.INTERNAL;
  }
  return BridgeErrorCode.INTERNAL;
}

function main(): void {
  const scope = window as unknown as Record<string, unknown>;
  if (scope[GUARD] === true || !BrowserApi.contextValid()) {
    return;
  }
  scope[GUARD] = true;
  const config = loadAppConfig();
  const guard = createMessageGuard({ window, allowedOrigins: config.artiforceOrigins });
  if (!guard.active) {
    return;
  }
  const origin = window.location.origin;
  const post = (message: Record<string, unknown>) =>
    window.postMessage({ channel: BRIDGE_CHANNEL, ...message }, origin);
  const respond = (
    id: string,
    protocol: number,
    body: { ok: true; result: unknown } | { ok: false; code: string },
  ) =>
    post({
      direction: "response",
      protocol,
      id,
      ...(body.ok
        ? { ok: true, result: body.result }
        : { ok: false, error: { code: body.code, message: body.code } }),
    });

  async function relay(request: GuardedRequest): Promise<void> {
    if (!BrowserApi.contextValid()) {
      respond(request.id, request.protocol, {
        ok: false,
        code: BridgeErrorCode.EXTENSION_RELOADED,
      });
      return;
    }
    try {
      // Commands typed per name; params were rebuilt by the guard's schema.
      const command = BRIDGE_RELAY[request.command] as (typeof BRIDGE_RELAY)["hello"];
      const result = await sendCommand(command, request.params as Record<string, never>);
      respond(request.id, request.protocol, { ok: true, result });
    } catch (error) {
      respond(request.id, request.protocol, { ok: false, code: toBridgeCode(error) });
    }
  }

  window.addEventListener("message", (event) => {
    const verdict = guard.check(event);
    if (verdict.kind === "reject") {
      respond(verdict.id, verdict.protocol, { ok: false, code: verdict.code });
    } else if (verdict.kind === "accept") {
      void relay(verdict.request);
    }
  });

  // cart.changed: counts only, so the web app shows or hides « Importer la sélection ».
  const cartState = new GlobalStateProvider({
    log: new ConsoleLogService(__DEV__),
    canWrite: false,
  }).get(CART_KEY);
  cartState.subscribe((cart) => {
    if (BrowserApi.contextValid()) {
      post({
        direction: "event",
        protocol: 1,
        event: "cart.changed",
        data: { revision: cart.revision, count: cart.items.length },
      });
    }
  });
  post({
    direction: "event",
    protocol: 1,
    event: "ready",
    data: { extensionVersion: BrowserApi.getVersion(), protocols: [...SUPPORTED_PROTOCOLS] },
  });
}

main();
