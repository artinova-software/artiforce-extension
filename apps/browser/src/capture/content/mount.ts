import type { Anchor } from "@artinova-software/extension-suppliers";

import buttonCss from "./button.css?raw";

export type MountedHost = {
  host: HTMLElement;
  shadow: ShadowRoot;
  floating: boolean;
  remove(): void;
};

let sheet: CSSStyleSheet | undefined;

function styleSheet(): CSSStyleSheet {
  if (sheet === undefined) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(buttonCss);
  }
  return sheet;
}

/** A random, never-registered custom tag: pages cannot target it by name. */
function hostTagName(): string {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `artinova-btn-${random[0]?.toString(36)}${random[1]?.toString(36)}`;
}

/**
 * Creates the host element with `all: initial !important` set through the
 * CSSOM (page stylesheets cannot override it), a closed shadow root and the
 * adopted stylesheet, and inserts it at the anchor or as a floating button.
 */
export function mountHost(document: Document, anchor: Anchor | null): MountedHost {
  const host = document.createElement(hostTagName());
  host.style.setProperty("all", "initial", "important");
  host.style.setProperty("display", "block", "important");
  const shadow = host.attachShadow({ mode: "closed" });
  try {
    shadow.adoptedStyleSheets = [styleSheet()];
  } catch {
    // No constructable stylesheets (old engines, jsdom): a <style> works too.
    const style = document.createElement("style");
    style.textContent = buttonCss;
    shadow.append(style);
  }
  const floating = anchor === null || !anchor.element.isConnected;
  if (floating) {
    host.dataset["floating"] = "";
    host.style.setProperty("position", "fixed", "important");
    host.style.setProperty("right", "20px", "important");
    host.style.setProperty("bottom", "20px", "important");
    host.style.setProperty("z-index", "2147483646", "important");
    (document.body ?? document.documentElement).append(host);
  } else {
    anchor.element.insertAdjacentElement(anchor.position, host);
  }
  return { host, shadow, floating, remove: () => host.remove() };
}
