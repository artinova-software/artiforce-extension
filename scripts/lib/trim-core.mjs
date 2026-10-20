// Trims a captured supplier product page down to what the extraction reads:
// meta tags, JSON-LD (reviews dropped, long strings cut), the product block and
// the button anchor, each with a bare skeleton of its ancestors so adapter
// selectors keep matching. Self-contained on purpose: the same function runs
// in jsdom (scripts/trim-fixture.mjs) and inside a live page, pasted into the
// devtools console, for sites that block non-browser clients.

export const TRIM_MARKER = "trimmed by scripts/trim-fixture.mjs";

export function trimDocument(doc, options) {
  const maxText = 160;
  const maxString = 300;
  const out = doc.implementation.createHTMLDocument("");
  out.documentElement.setAttribute("lang", doc.documentElement.getAttribute("lang") || "fr");
  out.head.textContent = "";

  const dropMetaName =
    /verification|viewport|theme-color|msapplication|apple-|format-detection|referrer|csrf|google|facebook|robots/i;
  const keepAttribute =
    /^(id|class|href|src|alt|content|name|value|type|rel|property|itemprop|itemscope|itemtype|itemid|role|lang|data-[\w-]+|aria-(label|hidden)|for|title|datetime)$/i;

  const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

  function cleanJson(value, key) {
    if (Array.isArray(value)) {
      return value.slice(0, 5).map((entry) => cleanJson(entry, key));
    }
    if (value !== null && typeof value === "object") {
      const result = {};
      for (const [childKey, child] of Object.entries(value)) {
        if (/^(review|reviews|comment|interactionStatistic)$/i.test(childKey)) {
          continue;
        }
        result[childKey] = cleanJson(child, childKey);
      }
      return result;
    }
    if (typeof value === "string") {
      return cut(value.replace(/\s+/g, " ").trim(), key === "description" ? maxText : maxString);
    }
    return value;
  }

  // ---- head ----
  const title = doc.querySelector("title");
  if (title) {
    const element = out.createElement("title");
    element.textContent = cut(title.textContent.trim(), maxText);
    out.head.append(element);
  }
  for (const meta of doc.querySelectorAll("meta[property], meta[name], meta[itemprop]")) {
    const name = meta.getAttribute("property") || meta.getAttribute("name") || "";
    if (dropMetaName.test(name) && !/^og:|^product:/.test(name)) {
      continue;
    }
    if (meta.closest("body") && !meta.hasAttribute("property")) {
      continue; // microdata metas inside the body stay with their block
    }
    const element = out.createElement("meta");
    for (const attribute of ["property", "name", "itemprop"]) {
      if (meta.hasAttribute(attribute)) {
        element.setAttribute(attribute, meta.getAttribute(attribute));
      }
    }
    element.setAttribute("content", cut(meta.getAttribute("content") || "", maxString));
    out.head.append(element);
  }
  const canonical = doc.querySelector('link[rel="canonical"]');
  if (canonical) {
    const element = out.createElement("link");
    element.setAttribute("rel", "canonical");
    element.setAttribute("href", canonical.getAttribute("href"));
    out.head.append(element);
  }
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data;
    try {
      data = JSON.parse(script.textContent);
    } catch {
      continue;
    }
    const element = out.createElement("script");
    element.setAttribute("type", "application/ld+json");
    element.textContent = `\n${JSON.stringify(cleanJson(data), null, 2)}\n`;
    out.head.append(element);
  }

  // ---- body: kept blocks with an ancestor skeleton ----
  const selectors = options.keep && options.keep.length > 0 ? options.keep : defaultKeep(doc);
  const kept = [];
  for (const selector of selectors) {
    for (const element of doc.querySelectorAll(selector)) {
      if (!kept.some((other) => other.contains(element))) {
        for (let index = kept.length - 1; index >= 0; index -= 1) {
          if (element.contains(kept[index])) {
            kept.splice(index, 1);
          }
        }
        kept.push(element);
      }
      if (options.firstOnly !== false) {
        break;
      }
    }
  }
  kept.sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1));

  const shells = new Map([[doc.body, out.body]]);
  function shellFor(element) {
    const existing = shells.get(element);
    if (existing) {
      return existing;
    }
    const parent = shellFor(element.parentElement);
    const shell = out.createElement(element.tagName.toLowerCase());
    for (const attribute of ["id", "class", "itemscope", "itemtype", "itemprop"]) {
      if (element.hasAttribute(attribute)) {
        shell.setAttribute(attribute, element.getAttribute(attribute));
      }
    }
    parent.append(shell);
    shells.set(element, shell);
    return shell;
  }
  for (const element of kept) {
    const parent = element.parentElement ? shellFor(element.parentElement) : out.body;
    parent.append(cleanElement(out.importNode(element, true)));
  }

  function cleanElement(root) {
    for (const node of [
      ...root.querySelectorAll(
        "script, style, svg, iframe, noscript, template, link, video, audio, canvas, object, embed, picture > source",
      ),
    ]) {
      if (node.matches('script[type="application/ld+json"]')) {
        node.remove(); // already hoisted into <head>
        continue;
      }
      node.remove();
    }
    const walker = out.createTreeWalker(root, 0x80 | 0x4); // comments + text
    const comments = [];
    for (let node = walker.currentNode; node; node = walker.nextNode()) {
      if (node.nodeType === 8) {
        comments.push(node);
      } else if (node.nodeType === 3) {
        const squeezed = node.textContent.replace(/\s+/g, " ");
        node.textContent = cut(squeezed, maxText);
      }
    }
    comments.forEach((node) => node.remove());
    for (const element of [root, ...root.querySelectorAll("*")]) {
      element.removeAttribute("data-artinova-trim-anchor");
      element.removeAttribute("data-artinova-trim-block");
      for (const attribute of [...element.attributes]) {
        if (!keepAttribute.test(attribute.name)) {
          element.removeAttribute(attribute.name);
        } else if (attribute.value.length > maxString) {
          element.setAttribute(attribute.name, cut(attribute.value, maxString));
        }
      }
      if (element.tagName === "IMG" && !element.getAttribute("src")) {
        const lazy = [...element.attributes].find((attribute) =>
          /^data-(src|lazy|original)/.test(attribute.name),
        );
        if (lazy) {
          element.setAttribute("src", lazy.value);
        }
      }
    }
    return root;
  }

  const date = options.capturedAt || new Date().toISOString().slice(0, 10);
  const provenance = ` source: ${options.sourceUrl} | captured: ${date} | ${TRIM_MARKER}: meta, JSON-LD, product block and anchor kept; reviews dropped, long text cut `;
  const html = out.documentElement.outerHTML.replace(/>\s*</g, ">\n<").replace(/\n{2,}/g, "\n");
  return `<!doctype html>\n<!--${provenance}-->\n${html}\n`;
}

function defaultKeep(doc) {
  const selectors = [
    "h1",
    '[itemtype*="schema.org/Product"]',
    '[itemprop="price"]',
    '[itemprop="offers"]',
  ];
  const button = [...doc.querySelectorAll("button, a, input[type=submit]")].find((element) =>
    /ajouter au panier|add to cart|ajouter/i.test(
      element.textContent || element.getAttribute("value") || "",
    ),
  );
  if (button) {
    button.setAttribute("data-artinova-trim-anchor", "");
    selectors.push("[data-artinova-trim-anchor]");
    // The product block: the smallest element holding both the title and the
    // button, unless it is most of the page.
    let block = doc.querySelector("h1");
    while (block && !block.contains(button)) {
      block = block.parentElement;
    }
    if (block && block !== doc.body && block.outerHTML.length < 80000) {
      block.setAttribute("data-artinova-trim-block", "");
      selectors.unshift("[data-artinova-trim-block]");
    }
  }
  return selectors;
}

/** Reads the provenance comment written by trimDocument. */
export function readProvenance(html) {
  const match = /<!-- source: (\S+) \| captured: (\d{4}-\d{2}-\d{2}) \|/.exec(html);
  return match ? { sourceUrl: match[1], capturedAt: match[2] } : null;
}
