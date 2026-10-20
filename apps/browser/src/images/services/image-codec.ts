export const FULL_MAX_SIDE = 1024;
export const THUMBNAIL_SIDE = 128;
export const JPEG_QUALITY = 0.85;

export type EncodedImage = { dataUrl: string; width: number; height: number; bytes: number };

export type ImageCodec = {
  /** The full image (≤ 1024 px) and its 128 px thumbnail, both JPEG data URLs. */
  encode(blob: Blob): Promise<{ full: EncodedImage; thumbnail: EncodedImage }>;
};

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * createImageBitmap, then OffscreenCanvas: white background (transparent PNGs
 * would turn black in JPEG), JPEG at 0.85. Works in the service worker.
 */
export class OffscreenImageCodec implements ImageCodec {
  async encode(blob: Blob) {
    const bitmap = await createImageBitmap(blob);
    try {
      const render = async (maxSide: number): Promise<EncodedImage> => {
        const size = fitWithin(bitmap.width, bitmap.height, maxSide);
        const canvas = new OffscreenCanvas(size.width, size.height);
        const context = canvas.getContext("2d");
        if (context === null) {
          throw new Error("No 2D context");
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size.width, size.height);
        context.imageSmoothingQuality = "high";
        context.drawImage(bitmap, 0, 0, size.width, size.height);
        const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
        return { dataUrl: await blobToDataUrl(jpeg), ...size, bytes: jpeg.size };
      };
      return { full: await render(FULL_MAX_SIDE), thumbnail: await render(THUMBNAIL_SIDE) };
    } finally {
      bitmap.close();
    }
  }
}
