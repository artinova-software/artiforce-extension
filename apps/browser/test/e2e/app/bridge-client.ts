// The fake Artiforce web app used by bridge.spec.ts: the real libs/bridge client,
// exposed on window for the test, with every event recorded.
import { BridgeClient, type BridgeEventData } from "@artiforce-software/extension-bridge";

type Recorded = { event: string; data: unknown };

const client = new BridgeClient(window, { timeoutMs: 1500 });
const events: Recorded[] = [];
client.on("ready", (data: BridgeEventData<"ready">) => events.push({ event: "ready", data }));
client.on("cart.changed", (data: BridgeEventData<"cart.changed">) =>
  events.push({ event: "cart.changed", data }),
);

Object.assign(window, { artiforceBridge: { client, events } });
