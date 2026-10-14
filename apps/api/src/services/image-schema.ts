import { z } from "zod";

const positiveDimension = z.coerce.number().int().min(1).max(2048);

export const imageQuerySchema = z.object({
  url: z.string().url().max(2048),
  width: positiveDimension.optional(),
  height: positiveDimension.optional(),
  format: z.enum(["jpeg", "png", "webp", "avif"]).default("webp"),
  quality: z.coerce.number().int().min(1).max(100).default(80),
  fit: z
    .enum(["cover", "contain", "fill", "inside", "outside"])
    .default("cover"),
});

export type ImageQuery = z.infer<typeof imageQuerySchema>;
