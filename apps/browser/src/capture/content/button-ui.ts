import type { MessageKey } from "../../platform/i18n/t";

export const ButtonState = {
  IDLE: "idle",
  ADDING: "adding",
  ADDED: "added",
  UPDATED: "updated",
  FAILED: "failed",
  FULL: "full",
  RELOAD: "reload",
} as const;
export type ButtonState = (typeof ButtonState)[keyof typeof ButtonState];

type Tone = "success" | "error" | "warning" | "";

const STATUS: Record<ButtonState, { message: MessageKey | null; tone: Tone }> = {
  idle: { message: null, tone: "" },
  adding: { message: null, tone: "" },
  added: { message: "buttonAdded", tone: "success" },
  updated: { message: "buttonUpdated", tone: "success" },
  failed: { message: "buttonFailed", tone: "error" },
  full: { message: "buttonCartFull", tone: "warning" },
  reload: { message: "buttonReload", tone: "warning" },
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** Phosphor « ShoppingCartSimple » (bold, path copied from @phosphor-icons/react 2.1.10), built with DOM APIs. */
function cartIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 256 256");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "currentColor");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute(
    "d",
    "M241.55,64.74A12,12,0,0,0,232,60H60.23L51.56,28.79A12,12,0,0,0,40,20H20a12,12,0,0,0,0,24H30.88l34.3,123.49a28.09,28.09,0,0,0,27,20.51H191a28.09,28.09,0,0,0,27-20.51l25.63-92.28A12,12,0,0,0,241.55,64.74ZM194.8,161.07A4,4,0,0,1,191,164H92.16a4,4,0,0,1-3.85-2.93L66.9,84H216.21ZM108,220a20,20,0,1,1-20-20A20,20,0,0,1,108,220Zm104,0a20,20,0,1,1-20-20A20,20,0,0,1,212,220Z",
  );
  svg.append(path);
  return svg;
}

export type ButtonView = {
  setState(state: ButtonState): void;
  readonly button: HTMLButtonElement;
};

/** Builds the button and its live status line inside `root` (a shadow root). */
export function renderButton(
  root: ShadowRoot,
  translate: (key: MessageKey) => string,
  onClick: () => void,
): ButtonView {
  const document = root.ownerDocument;
  const wrapper = document.createElement("div");
  wrapper.className = "root";
  const button = document.createElement("button");
  button.type = "button";
  const label = document.createElement("span");
  button.append(cartIcon(document), label);
  const status = document.createElement("p");
  status.className = "status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  wrapper.append(button, status);
  root.append(wrapper);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  const view: ButtonView = {
    button,
    setState(state) {
      const busy = state === ButtonState.ADDING;
      label.textContent = translate(busy ? "buttonAdding" : "buttonAdd");
      button.setAttribute("aria-busy", String(busy));
      button.disabled = busy || state === ButtonState.RELOAD;
      const { message, tone } = STATUS[state];
      status.textContent = message === null ? "" : translate(message);
      status.dataset["tone"] = tone;
      (root.host as HTMLElement).dataset["state"] = state;
    },
  };
  view.setState(ButtonState.IDLE);
  return view;
}
