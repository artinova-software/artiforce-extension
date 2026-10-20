export type ImageKind = "jpeg" | "png" | "gif" | "webp" | "avif" | "bmp";

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/** The image format from its first bytes, whatever the Content-Type claims. SVG is never accepted. */
export function sniffImageKind(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return "gif";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "webp";
  }
  if (ascii(bytes, 4, 8) === "ftyp" && /^(avif|avis)$/.test(ascii(bytes, 8, 12))) {
    return "avif";
  }
  if (startsWith(bytes, [0x42, 0x4d])) {
    return "bmp";
  }
  return null;
}
