import { sniffImageKind } from "./magic-bytes";

export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const IMAGE_TIMEOUT_MS = 10_000;

export const ImageFailure = {
  BAD_URL: "BAD_URL",
  HOST_NOT_ALLOWED: "HOST_NOT_ALLOWED",
  HTTP_ERROR: "HTTP_ERROR",
  NOT_AN_IMAGE: "NOT_AN_IMAGE",
  SVG: "SVG",
  TOO_LARGE: "TOO_LARGE",
  TIMEOUT: "TIMEOUT",
  NETWORK: "NETWORK",
  DECODE: "DECODE",
} as const;
export type ImageFailure = (typeof ImageFailure)[keyof typeof ImageFailure];

export class ImageError extends Error {
  constructor(readonly reason: ImageFailure) {
    super(reason);
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Downloads a product image: no cookies, 10 s at most, an image/* type that is
 * not SVG, 15 MB at most, and magic bytes that match a raster format.
 */
export async function fetchImage(url: string, fetchImpl: FetchLike = fetch): Promise<Blob> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      credentials: "omit",
      redirect: "follow",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    throw new ImageError(
      name === "TimeoutError" || name === "AbortError"
        ? ImageFailure.TIMEOUT
        : ImageFailure.NETWORK,
    );
  }
  if (!response.ok) {
    throw new ImageError(ImageFailure.HTTP_ERROR);
  }
  const type = (response.headers.get("content-type") ?? "").toLowerCase();
  if (type.includes("svg")) {
    throw new ImageError(ImageFailure.SVG);
  }
  if (!type.startsWith("image/") && !type.startsWith("application/octet-stream")) {
    throw new ImageError(ImageFailure.NOT_AN_IMAGE);
  }
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > IMAGE_MAX_BYTES) {
    throw new ImageError(ImageFailure.TOO_LARGE);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > IMAGE_MAX_BYTES) {
    throw new ImageError(ImageFailure.TOO_LARGE);
  }
  const kind = sniffImageKind(new Uint8Array(buffer, 0, Math.min(32, buffer.byteLength)));
  if (kind === null) {
    throw new ImageError(ImageFailure.NOT_AN_IMAGE);
  }
  return new Blob([buffer], { type: `image/${kind}` });
}
