import type { RuntimeSender } from "../browser/browser-api";
import { SenderKind } from "./command";

export type SenderContext = {
  extensionId: string;
  /** `chrome-extension://<id>` or `moz-extension://<uuid>`, without a trailing slash. */
  extensionOrigin: string;
  artinovaOrigins: readonly string[];
  isSupplierUrl(url: string): boolean;
};

/**
 * `scheme://host[:port]`. Built by hand: `URL.origin` is "null" for the
 * non-special `chrome-extension:` and `moz-extension:` schemes outside Chrome.
 */
export function originOf(url: string | undefined): string | null {
  if (url === undefined) {
    return null;
  }
  try {
    const parsed = new URL(url);
    return parsed.host === "" ? null : `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Classifies a message sender from what the browser reports (id, tab, frame,
 * URL), never from the message itself. Anything unexpected is `unknown`.
 */
export function classifySender(sender: RuntimeSender, context: SenderContext): SenderKind {
  if (sender.id !== context.extensionId) {
    return SenderKind.UNKNOWN;
  }
  const origin = originOf(sender.url);
  if (origin === context.extensionOrigin) {
    return sender.tab === undefined || sender.frameId === 0 || sender.frameId === undefined
      ? SenderKind.EXTENSION_PAGE
      : SenderKind.UNKNOWN;
  }
  if (
    sender.tab === undefined ||
    sender.frameId !== 0 ||
    origin === null ||
    sender.url === undefined
  ) {
    return SenderKind.UNKNOWN;
  }
  if (context.artinovaOrigins.includes(origin)) {
    return SenderKind.BRIDGE_CONTENT;
  }
  if (context.isSupplierUrl(sender.url)) {
    return SenderKind.SUPPLIER_CONTENT;
  }
  return SenderKind.UNKNOWN;
}
