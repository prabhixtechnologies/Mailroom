import { z } from "zod";

/** Keyset page envelope shared with the oneOps backend {@code CursorPage}. */
export function cursorPageSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z
      .string()
      .nullish()
      .transform((value) => value ?? null),
    hasMore: z.boolean().default(false),
  });
}
