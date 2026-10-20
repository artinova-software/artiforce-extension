import { z } from "zod";

import { KeyDefinition, StateDefinition } from "../platform/state/state-definition";

export const IMAGE_STATE = new StateDefinition("image", "disk");

export const storedImageSchema = z
  .object({
    dataUrl: z.string().startsWith("data:image/jpeg;base64,").max(4_000_000),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    bytes: z.number().int().positive(),
  })
  .nullable();
export type StoredImage = z.infer<typeof storedImageSchema>;

/** One key per cart item: `global_image_<item id>`. */
export function imageKey(itemId: string): KeyDefinition<StoredImage> {
  return new KeyDefinition(IMAGE_STATE, itemId, { schema: storedImageSchema, defaultValue: null });
}

export const IMAGE_KEY_PREFIX = `global_${IMAGE_STATE.name}_`;
