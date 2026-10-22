import { BRIDGE_COMMANDS } from "@artiforce-software/extension-bridge/wire";

import { defineCommand, SenderKind } from "../platform/messaging/command";

// The bridge content script relays web app requests as these commands. Their
// schemas are libs/bridge's, so the background revalidates exactly what the
// web app may send; only a bridge content script may call them.
const bridgeOnly = [SenderKind.BRIDGE_CONTENT] as const;

export const bridgeHello = defineCommand({
  name: "bridge/hello",
  request: BRIDGE_COMMANDS.hello.params,
  response: BRIDGE_COMMANDS.hello.result,
  senders: bridgeOnly,
});

export const bridgeGetCart = defineCommand({
  name: "bridge/getCart",
  request: BRIDGE_COMMANDS.getCart.params,
  response: BRIDGE_COMMANDS.getCart.result,
  senders: bridgeOnly,
});

export const bridgeGetImages = defineCommand({
  name: "bridge/getImages",
  request: BRIDGE_COMMANDS.getImages.params,
  response: BRIDGE_COMMANDS.getImages.result,
  senders: bridgeOnly,
});

export const bridgeRemoveItems = defineCommand({
  name: "bridge/removeItems",
  request: BRIDGE_COMMANDS.removeItems.params,
  response: BRIDGE_COMMANDS.removeItems.result,
  senders: bridgeOnly,
});

export const bridgeClearCart = defineCommand({
  name: "bridge/clearCart",
  request: BRIDGE_COMMANDS.clearCart.params,
  response: BRIDGE_COMMANDS.clearCart.result,
  senders: bridgeOnly,
});

export const BRIDGE_RELAY = {
  hello: bridgeHello,
  getCart: bridgeGetCart,
  getImages: bridgeGetImages,
  removeItems: bridgeRemoveItems,
  clearCart: bridgeClearCart,
} as const;
