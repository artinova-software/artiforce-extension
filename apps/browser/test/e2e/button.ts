import type { Locator, Page } from "@playwright/test";

/** The injected host (`artinova-btn-<random>`); its closed shadow root is not reachable. */
export function buttonHost(page: Page): Locator {
  return page.locator("xpath=//*[starts-with(local-name(), 'artinova-btn-')]");
}

/** Clicks the button inside the closed shadow root by position. */
export async function clickButton(page: Page): Promise<void> {
  const host = buttonHost(page);
  await host.waitFor();
  await host.scrollIntoViewIfNeeded();
  const box = await host.boundingBox();
  if (box === null) {
    throw new Error("Button host has no box");
  }
  await page.mouse.click(box.x + 24, box.y + Math.min(22, box.height / 2));
}
