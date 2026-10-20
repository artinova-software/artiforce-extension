import { foldForSearch } from "../parsing/text";

/** Where the button goes, relative to `element` (`insertAdjacentElement` positions). */
export type AnchorPosition = "beforebegin" | "afterbegin" | "beforeend" | "afterend";
export type Anchor = { element: Element; position: AnchorPosition };

const ADD_TO_CART =
  /ajouter au panier|ajout au panier|add to cart|ajouter a mon panier|mettre au panier/;

function isVisible(element: Element): boolean {
  const html = element as HTMLElement;
  if (html.hidden || html.closest("[hidden], [aria-hidden='true']") !== null) {
    return false;
  }
  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  return style === undefined || (style.display !== "none" && style.visibility !== "hidden");
}

/**
 * Generic anchor: right after the first visible « Ajouter au panier » control.
 * Null when there is none; the button then floats at the bottom right.
 */
export function findGenericAnchor(document: Document): Anchor | null {
  const candidates = document.querySelectorAll(
    "button, input[type='submit'], input[type='button'], a[role='button'], [class*='add-to-cart' i], [id*='add-to-cart' i]",
  );
  for (const element of candidates) {
    const label = foldForSearch(
      `${element.textContent ?? ""} ${element.getAttribute("value") ?? ""} ${element.getAttribute("aria-label") ?? ""}`,
    );
    if (ADD_TO_CART.test(label) && isVisible(element)) {
      return { element, position: "afterend" };
    }
  }
  return null;
}
