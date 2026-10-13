import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { transformImage } from "../src/services/image-service.js";
import { imageQuerySchema } from "../src/services/image-schema.js";

const options = {
  url: "https://example.com/image.png",
  format: "webp" as const,
  quality: 80,
  fit: "cover" as const,
};

describe("image query validation", () => {
  it("applies transformation defaults", () => {
    const result = imageQuerySchema.parse({
      url: "https://example.com/image.png",
    });

    expect(result.format).toBe("webp");
    expect(result.quality).toBe(80);
    expect(result.fit).toBe("cover");
  });

  it("rejects oversized dimensions", () => {
    const result = imageQuerySchema.safeParse({
      url: "https://example.com/image.png",
      width: 100_000,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported formats", () => {
    const result = imageQuerySchema.safeParse({
      url: "https://example.com/image.png",
      format: "gif",
    });

    expect(result.success).toBe(false);
  });
});

describe("transformImage", () => {
  it("resizes and converts an image to WebP", async () => {
    const source = await sharp({
      create: {
        width: 100,
        height: 80,
        channels: 3,
        background: "#ff0000",
      },
    })
      .png()
      .toBuffer();

    const result = await transformImage(source, {
      ...options,
      width: 50,
      height: 40,
    });

    const metadata = await sharp(result.data).metadata();

    expect(result.contentType).toBe("image/webp");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(50);
    expect(metadata.height).toBe(40);
  });

  it("rejects source buffers larger than 10 MB", async () => {
    const source = Buffer.alloc(10 * 1024 * 1024 + 1);

    await expect(transformImage(source, options)).rejects.toThrow(
      "SOURCE_IMAGE_TOO_LARGE",
    );
  });

  it("rejects malformed image bytes", async () => {
    await expect(
      transformImage(Buffer.from("this is not an image"), options),
    ).rejects.toThrow();
  });
});
