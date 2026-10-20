import { describe, expect, it } from "vitest";

import { sniffImageKind } from "./magic-bytes";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === "string" ? [...value].map((c) => c.charCodeAt(0)) : [value],
    ),
  );

describe("sniffImageKind", () => {
  it.each([
    [bytes(0xff, 0xd8, 0xff, 0xe0), "jpeg"],
    [bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a), "png"],
    [bytes("GIF89a"), "gif"],
    [bytes("RIFF", 0, 0, 0, 0, "WEBP"), "webp"],
    [bytes(0, 0, 0, 0x1c, "ftypavif"), "avif"],
    [bytes("BM"), "bmp"],
    [bytes("<svg xmlns"), null],
    [bytes("<html>"), null],
  ])("%#", (input, kind) => {
    expect(sniffImageKind(input)).toBe(kind);
  });
});
