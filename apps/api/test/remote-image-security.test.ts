import { describe, expect, it, vi } from "vitest";
import {
  fetchRemoteImage,
  isPublicIp,
  RemoteImageError,
} from "../src/services/remote-image.js";

describe("IP address security", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
    "0.0.0.0",
    "255.255.255.255",
  ])("rejects non-public IP %s", (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });

  it.each([
    "100.64.0.1", // Shared address space
    "192.0.2.1", // Documentation
    "198.51.100.1", // Documentation
    "203.0.113.1", // Documentation
    "224.0.0.1", // Multicast
    "240.0.0.1", // Reserved
    "::",
    "2001:db8::1", // IPv6 documentation
    "::ffff:127.0.0.1", // IPv4-mapped loopback
  ])("rejects special-purpose address %s", (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "accepts public IP %s",
    (ip) => {
      expect(isPublicIp(ip)).toBe(true);
    },
  );
});

describe("remote image fetch security", () => {
  it("rejects non-HTTPS URLs", async () => {
    await expect(
      fetchRemoteImage("http://example.com/image.png"),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE_URL" });
  });

  it("rejects credentials in URLs", async () => {
    await expect(
      fetchRemoteImage("https://user:pass@example.com/image.png"),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE_URL" });
  });

  it("rejects private IP literals before making a request", async () => {
    const request = vi.fn();

    await expect(
      fetchRemoteImage("https://127.0.0.1/image.png", {
        resolve: async () => {
          throw new RemoteImageError("UNSAFE_IMAGE_HOST");
        },
        request,
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_IMAGE_HOST" });

    expect(request).not.toHaveBeenCalled();
  });

  it("rejects redirects to private destinations", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 302,
      location: "https://127.0.0.1/internal",
    });

    await expect(
      fetchRemoteImage("https://images.example/image.png", {
        resolve: async (hostname) => {
          if (hostname === "127.0.0.1") {
            throw new RemoteImageError("UNSAFE_IMAGE_HOST");
          }

          return { address: "93.184.216.34", family: 4 };
        },
        request,
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_IMAGE_HOST" });

    // Only the original public host was requested.
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("resolves and validates every redirect destination", async () => {
    const resolve = vi.fn(async (hostname: string) => {
      if (hostname === "private.example") {
        throw new RemoteImageError("UNSAFE_IMAGE_HOST");
      }

      return { address: "93.184.216.34", family: 4 as const };
    });

    const request = vi.fn().mockResolvedValue({
      status: 302,
      location: "https://private.example/image.png",
    });

    await expect(
      fetchRemoteImage("https://images.example/image.png", {
        resolve,
        request,
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_IMAGE_HOST" });

    expect(resolve).toHaveBeenCalledWith("images.example");
    expect(resolve).toHaveBeenCalledWith("private.example");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects DNS resolution timeouts without making a request", async () => {
    const request = vi.fn();
    const resolve = vi.fn(() => new Promise<never>(() => {}));

    await expect(
      fetchRemoteImage("https://images.example/image.png", {
        resolve,
        request,
      }),
    ).rejects.toMatchObject({ code: "IMAGE_FETCH_TIMEOUT" });

    expect(request).not.toHaveBeenCalled();
  });

  it("rejects redirect loops after the configured limit", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 302,
      location: "/redirect-again",
    });

    await expect(
      fetchRemoteImage("https://images.example/image.png", {
        resolve: async () => ({
          address: "93.184.216.34",
          family: 4,
        }),
        request,
      }),
    ).rejects.toMatchObject({ code: "IMAGE_FETCH_FAILED" });

    expect(request).toHaveBeenCalledTimes(4);
  });

  it("rejects oversized responses", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new RemoteImageError("IMAGE_TOO_LARGE"));

    await expect(
      fetchRemoteImage("https://images.example/image.png", {
        resolve: async () => ({
          address: "93.184.216.34",
          family: 4,
        }),
        request,
      }),
    ).rejects.toMatchObject({ code: "IMAGE_TOO_LARGE" });
  });
});
