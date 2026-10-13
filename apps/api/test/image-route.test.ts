import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import * as remoteImage from "../src/services/remote-image.js";

describe("GET /api/image", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid query parameters", async () => {
    const response = await request(createApp())
      .get("/api/image")
      .query({ url: "not-a-url" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY");
  });

  it("returns a safe error when the host is unsafe", async () => {
    vi.spyOn(remoteImage, "fetchRemoteImage").mockRejectedValue(
      new remoteImage.RemoteImageError("UNSAFE_IMAGE_HOST"),
    );

    const response = await request(createApp())
      .get("/api/image")
      .query({ url: "https://example.com/image.png" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("UNSAFE_IMAGE_HOST");
    expect(response.text).not.toContain("127.0.0.1");
    expect(response.text).not.toContain("node_modules");
  });

  it("returns 504 for upstream timeouts", async () => {
    vi.spyOn(remoteImage, "fetchRemoteImage").mockRejectedValue(
      new remoteImage.RemoteImageError("IMAGE_FETCH_TIMEOUT"),
    );

    const response = await request(createApp())
      .get("/api/image")
      .query({ url: "https://example.com/image.png" });

    expect(response.status).toBe(504);
    expect(response.body.error.code).toBe("IMAGE_FETCH_TIMEOUT");
    expect(response.text).not.toContain("node_modules");
  });

  it("returns a safe 422 for malformed image data", async () => {
    vi.spyOn(remoteImage, "fetchRemoteImage").mockResolvedValue(
      Buffer.from("this is not an image"),
    );

    const response = await request(createApp())
      .get("/api/image")
      .query({ url: "https://example.com/image.png" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("IMAGE_PROCESSING_FAILED");
    expect(response.text).not.toContain("node_modules");
    expect(response.text).not.toContain(" at ");
  });

  it("returns the transformed image with security and cache headers", async () => {
    const sharp = (await import("sharp")).default;
    const imageBuffer = await sharp({
      create: {
        width: 20,
        height: 20,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    vi.spyOn(remoteImage, "fetchRemoteImage").mockResolvedValue(imageBuffer);

    const response = await request(createApp()).get("/api/image").query({
      url: "https://example.com/image.png",
      format: "webp",
      width: 10,
      height: 10,
    });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("image/webp");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["cache-control"]).toContain("max-age=300");
    expect(response.body.length).toBeGreaterThan(0);

    const metadata = await sharp(response.body).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(10);
    expect(metadata.height).toBe(10);
  });

  it("returns 413 when the source image exceeds the size limit", async () => {
    vi.spyOn(remoteImage, "fetchRemoteImage").mockRejectedValue(
      new remoteImage.RemoteImageError("IMAGE_TOO_LARGE"),
    );

    const response = await request(createApp())
      .get("/api/image")
      .query({ url: "https://example.com/image.png" });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("IMAGE_TOO_LARGE");
  });

  it("does not return an image content type for errors", async () => {
    vi.spyOn(remoteImage, "fetchRemoteImage").mockRejectedValue(
      new remoteImage.RemoteImageError("IMAGE_FETCH_FAILED"),
    );

    const response = await request(createApp())
      .get("/api/image")
      .query({ url: "https://example.com/image.png" });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("IMAGE_FETCH_FAILED");
    expect(response.headers["content-type"]).toContain("application/json");
  });
});
