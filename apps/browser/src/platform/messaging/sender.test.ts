import { describe, expect, it } from "vitest";

import { SenderKind } from "./command";
import { classifySender, type SenderContext } from "./sender";

const ID = "abcdefghijklmnopabcdefghijklmnop";
const context: SenderContext = {
  extensionId: ID,
  extensionOrigin: `chrome-extension://${ID}`,
  artinovaOrigins: ["https://app.artinova.fr", "http://localhost:3000"],
  isSupplierUrl: (url) => url.startsWith("https://www.leroymerlin.fr/"),
};
const tab = { id: 1 } as chrome.tabs.Tab;

describe("classifySender", () => {
  it.each([
    [
      "popup",
      { id: ID, url: `chrome-extension://${ID}/popup/index.html` },
      SenderKind.EXTENSION_PAGE,
    ],
    [
      "supplier top frame",
      { id: ID, tab, frameId: 0, url: "https://www.leroymerlin.fr/produits/a-1.html" },
      SenderKind.SUPPLIER_CONTENT,
    ],
    [
      "bridge top frame",
      { id: ID, tab, frameId: 0, url: "https://app.artinova.fr/devis/1" },
      SenderKind.BRIDGE_CONTENT,
    ],
    [
      "bridge on localhost with port",
      { id: ID, tab, frameId: 0, url: "http://localhost:3000/" },
      SenderKind.BRIDGE_CONTENT,
    ],
    [
      "localhost on another port",
      { id: ID, tab, frameId: 0, url: "http://localhost:4000/" },
      SenderKind.UNKNOWN,
    ],
    [
      "supplier iframe",
      { id: ID, tab, frameId: 3, url: "https://www.leroymerlin.fr/produits/a-1.html" },
      SenderKind.UNKNOWN,
    ],
    [
      "another extension",
      { id: "other", url: `chrome-extension://other/x.html` },
      SenderKind.UNKNOWN,
    ],
    ["unknown site", { id: ID, tab, frameId: 0, url: "https://evil.example/" }, SenderKind.UNKNOWN],
    ["no url", { id: ID, tab, frameId: 0 }, SenderKind.UNKNOWN],
  ])("%s", (_name, sender, expected) => {
    expect(classifySender(sender, context)).toBe(expected);
  });
});
