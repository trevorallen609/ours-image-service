import sharp from "sharp";
import type { ImageQuery } from "./image-schema.js";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const mimeTypes = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
} as const;

export async function transformImage(
  source: Buffer,
  options: ImageQuery,
): Promise<{ data: Buffer; contentType: string }> {
  if (source.length > MAX_SOURCE_BYTES) {
    throw new Error("SOURCE_IMAGE_TOO_LARGE");
  }

  let pipeline = sharp(source, {
    limitInputPixels: 40_000_000,
    failOn: "error",
  }).rotate();

  if (options.width || options.height) {
    pipeline = pipeline.resize({
      width: options.width,
      height: options.height,
      fit: options.fit,
      withoutEnlargement: true,
    });
  }

  const data = await pipeline
    .toFormat(options.format, { quality: options.quality })
    .toBuffer();

  return {
    data,
    contentType: mimeTypes[options.format],
  };
}
