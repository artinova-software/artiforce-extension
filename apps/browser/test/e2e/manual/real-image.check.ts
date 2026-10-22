// Manual check (not part of the suite): a real Leroy Merlin image through the
// extension's own fetch + codec in the service worker. Run with
// `pnpm exec playwright test --config test/e2e/manual/playwright.manual.config.ts`.
import { expect, test } from "../fixtures";

test("real Leroy Merlin image is under 300 KB after resizing", async ({ serviceWorker }) => {
  const result = await serviceWorker.evaluate(async () => {
    const main = (
      globalThis as unknown as {
        __artiforceMain: {
          images: {
            deps: {
              codec: {
                encode(blob: Blob): Promise<{
                  full: { bytes: number; width: number; height: number };
                  thumbnail: { bytes: number };
                }>;
              };
            };
          };
        };
      }
    ).__artiforceMain;
    const response = await fetch("https://media.adeo.com/media/3267982/media.jpg", {
      credentials: "omit",
    });
    const blob = await response.blob();
    const encoded = await main.images.deps.codec.encode(blob);
    const { width, height, bytes } = encoded.full;
    return {
      status: response.status,
      sourceBytes: blob.size,
      full: { width, height, bytes },
      thumbnail: encoded.thumbnail.bytes,
    };
  });
  test.info().annotations.push({ type: "image", description: JSON.stringify(result) });
  expect(result.status).toBe(200);
  expect(result.full.bytes).toBeLessThan(300 * 1024);
});
