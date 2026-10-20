/** Error codes on the wire. Stable: the web app switches on them. */
export const BridgeErrorCode = {
  INVALID_REQUEST: "INVALID_REQUEST",
  UNSUPPORTED_PROTOCOL: "UNSUPPORTED_PROTOCOL",
  UNKNOWN_COMMAND: "UNKNOWN_COMMAND",
  FORBIDDEN: "FORBIDDEN",
  REVISION_MISMATCH: "REVISION_MISMATCH",
  EXTENSION_RELOADED: "EXTENSION_RELOADED",
  INTERNAL: "INTERNAL",
} as const;
export type BridgeErrorCode = (typeof BridgeErrorCode)[keyof typeof BridgeErrorCode];

/** Client-side only: no answer (extension absent, origin not allowed, page in an iframe). */
export const BRIDGE_TIMEOUT = "TIMEOUT";

export class BridgeError extends Error {
  constructor(
    readonly code: BridgeErrorCode | typeof BRIDGE_TIMEOUT,
    message: string = code,
  ) {
    super(message);
    this.name = "BridgeError";
  }
}
