"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200";

type ImageFormat = "webp" | "jpeg" | "png" | "avif";
type ImageFit = "cover" | "contain" | "fill" | "inside" | "outside";

export default function HomePage() {
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMAGE);
  const [width, setWidth] = useState("800");
  const [height, setHeight] = useState("500");
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [quality, setQuality] = useState(80);
  const [fit, setFit] = useState<ImageFit>("cover");
  const [submittedUrl, setSubmittedUrl] = useState(DEFAULT_IMAGE);
  const [submittedWidth, setSubmittedWidth] = useState("800");
  const [submittedHeight, setSubmittedHeight] = useState("500");
  const [submittedFormat, setSubmittedFormat] = useState<ImageFormat>("webp");
  const [submittedQuality, setSubmittedQuality] = useState(80);
  const [submittedFit, setSubmittedFit] = useState<ImageFit>("cover");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [requestId, setRequestId] = useState(0);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({
      url: submittedUrl,
      format: submittedFormat,
      quality: String(submittedQuality),
      fit: submittedFit,
    });

    if (submittedWidth) params.set("width", submittedWidth);
    if (submittedHeight) params.set("height", submittedHeight);

    return `${API_URL}/api/image?${params.toString()}`;
  }, [
    submittedUrl,
    submittedWidth,
    submittedHeight,
    submittedFormat,
    submittedQuality,
    submittedFit,
  ]);

  useEffect(() => {
    if (!loading) return;

    const timeout = window.setTimeout(() => {
      setLoading(false);
      setError(
        "The transformation request timed out. Check that the API is running and try again.",
      );
    }, 15000);

    return () => window.clearTimeout(timeout);
  }, [loading, requestId]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    setPreviewSrc(null);
    setLoading(true);
    setError(null);

    async function loadPreview() {
      try {
        const response = await fetch(requestUrl, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Image request failed (${response.status})`);
        }

        const blob = await response.blob();

        if (!blob.type.startsWith("image/")) {
          throw new Error("The API did not return an image.");
        }

        const createdUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(createdUrl);
          return;
        }

        objectUrl = createdUrl;
        setPreviewSrc(createdUrl);
      } catch (err) {
        if (cancelled) return;

        setLoading(false);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the transformed image.",
        );
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [requestUrl, requestId]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCopied(false);

    const trimmedUrl = imageUrl.trim();
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      setError("Enter a valid image URL.");
      return;
    }

    if (parsedUrl.protocol !== "https:") {
      setError("Please use an HTTPS image URL.");
      return;
    }

    if (
      (width &&
        (!Number.isInteger(Number(width)) ||
          Number(width) < 1 ||
          Number(width) > 2048)) ||
      (height &&
        (!Number.isInteger(Number(height)) ||
          Number(height) < 1 ||
          Number(height) > 2048))
    ) {
      setError("Width and height must be between 1 and 2048 pixels.");
      return;
    }

    setSubmittedUrl(trimmedUrl);
    setSubmittedWidth(width);
    setSubmittedHeight(height);
    setSubmittedFormat(format);
    setSubmittedQuality(quality);
    setSubmittedFit(fit);
    setRequestId((id) => id + 1);
    setLoading(true);
  }

  async function copyApiUrl() {
    try {
      await navigator.clipboard.writeText(requestUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the URL. You can select and copy it manually.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f5] text-[#18211f]">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <header className="flex min-h-[76px] items-center justify-between border-b border-[#e1e8e4]">
          <a
            href="/"
            className="flex items-center gap-2.5 font-bold tracking-tight"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[#176b53] text-lg text-white">
              O
            </span>
            <span>ours privacy</span>
          </a>
          <span className="text-right text-[10px] font-bold tracking-[0.13em] text-[#697671] sm:text-xs">
            ENGINEERING TAKE-HOME
          </span>
        </header>

        <section className="py-12 sm:py-16">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-[#176b53]">
            <span className="size-2 rounded-full bg-emerald-500" />
            IMAGE PROCESSING PLAYGROUND
          </p>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.06em] sm:text-6xl">
            Images, transformed.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#697671] sm:text-base">
            Resize, convert, and optimize images through a secure image
            transformation API. Adjust your settings and preview the result.
          </p>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
          <section className="rounded-2xl border border-[#e1e8e4] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-bold tracking-[0.14em] text-[#176b53]">
              01 / CONFIGURE
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight">
              Transformation settings
            </h2>

            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="image-url"
                  className="mb-2 block text-xs font-bold"
                >
                  Source image URL
                </label>
                <input
                  id="image-url"
                  type="url"
                  required
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-lg border border-[#dbe4df] bg-white px-3 py-3 text-sm outline-none transition focus:border-[#176b53] focus:ring-2 focus:ring-[#176b53]/10"
                />
                <p className="mt-2 text-[11px] leading-5 text-[#84908a]">
                  Enter a publicly accessible HTTPS image URL.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="width"
                    className="mb-2 block text-xs font-bold"
                  >
                    Width (px)
                  </label>
                  <input
                    id="width"
                    type="number"
                    min="1"
                    max="2048"
                    value={width}
                    onChange={(event) => setWidth(event.target.value)}
                    placeholder="Auto"
                    className="w-full rounded-lg border border-[#dbe4df] px-3 py-3 text-sm outline-none focus:border-[#176b53] focus:ring-2 focus:ring-[#176b53]/10"
                  />
                </div>
                <div>
                  <label
                    htmlFor="height"
                    className="mb-2 block text-xs font-bold"
                  >
                    Height (px)
                  </label>
                  <input
                    id="height"
                    type="number"
                    min="1"
                    max="2048"
                    value={height}
                    onChange={(event) => setHeight(event.target.value)}
                    placeholder="Auto"
                    className="w-full rounded-lg border border-[#dbe4df] px-3 py-3 text-sm outline-none focus:border-[#176b53] focus:ring-2 focus:ring-[#176b53]/10"
                  />
                </div>
              </div>
              <p className="-mt-3 text-[11px] text-[#84908a]">
                Leave a dimension empty to omit it.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="format"
                    className="mb-2 block text-xs font-bold"
                  >
                    Output format
                  </label>
                  <select
                    id="format"
                    value={format}
                    onChange={(event) =>
                      setFormat(event.target.value as ImageFormat)
                    }
                    className="w-full rounded-lg border border-[#dbe4df] bg-white px-2 py-3 text-sm outline-none focus:border-[#176b53]"
                  >
                    <option value="webp">WebP</option>
                    <option value="jpeg">JPEG</option>
                    <option value="png">PNG</option>
                    <option value="avif">AVIF</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="fit" className="mb-2 block text-xs font-bold">
                    Resize behavior
                  </label>
                  <select
                    id="fit"
                    value={fit}
                    onChange={(event) => setFit(event.target.value as ImageFit)}
                    className="w-full rounded-lg border border-[#dbe4df] bg-white px-2 py-3 text-sm outline-none focus:border-[#176b53]"
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="fill">Fill</option>
                    <option value="inside">Inside</option>
                    <option value="outside">Outside</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="quality" className="text-xs font-bold">
                    Quality
                  </label>
                  <output
                    htmlFor="quality"
                    className="text-sm font-bold text-[#176b53]"
                  >
                    {quality}%
                  </output>
                </div>
                <input
                  id="quality"
                  type="range"
                  min="1"
                  max="100"
                  value={quality}
                  onChange={(event) => setQuality(Number(event.target.value))}
                  className="mt-4 w-full accent-[#176b53]"
                />
                <div className="flex justify-between text-[10px] text-[#84908a]">
                  <span>Smaller file</span>
                  <span>Higher quality</span>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#176b53] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#10533f] disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? "Processing image…" : "Apply transformations"}
                {!loading && <span aria-hidden="true">↗</span>}
              </button>
            </form>

            <div className="mt-6 flex items-start gap-3 border-t border-[#e1e8e4] pt-5">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" />
              <div className="min-w-0">
                <p className="text-xs font-bold">API endpoint</p>
                <code className="mt-2 block break-all text-[11px] text-[#697671]">
                  {API_URL}/api/image
                </code>
              </div>
            </div>
          </section>

          <div className="grid min-w-0 gap-5">
            <section className="rounded-2xl border border-[#e1e8e4] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.14em] text-[#176b53]">
                    02 / PREVIEW
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight">
                    Before &amp; after
                  </h2>
                </div>
                <span className="rounded-md border border-[#d8e9df] bg-[#e8f3ed] px-2.5 py-1.5 text-[10px] font-extrabold tracking-wider text-[#176b53]">
                  {submittedFormat.toUpperCase()}
                </span>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="min-w-0">
                  <div className="mb-3 flex items-center justify-between gap-2 text-xs font-bold">
                    <span>Original</span>
                    <span className="rounded bg-[#f0f2f0] px-2 py-1 text-[9px] tracking-wider text-[#737f79]">
                      SOURCE
                    </span>
                  </div>
                  <div className="relative grid aspect-[4/3] min-h-48 place-items-center overflow-hidden rounded-xl border border-[#e1e8e4] bg-[#f5f7f5]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={submittedUrl}
                      alt="Original source"
                      className="absolute inset-0 h-full w-full object-contain"
                      onError={() => {
                        setError(
                          "The original image could not be loaded. Check the URL and try again.",
                        );
                      }}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-3 flex items-center justify-between gap-2 text-xs font-bold">
                    <span>Transformed</span>
                    <span className="rounded bg-[#e8f3ed] px-2 py-1 text-[9px] tracking-wider text-[#176b53]">
                      OUTPUT
                    </span>
                  </div>
                  <div className="relative grid aspect-[4/3] min-h-48 place-items-center overflow-hidden rounded-xl border border-[#e1e8e4] bg-[#f5f7f5]">
                    {loading && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#f5f7f5]/95 text-xs text-[#697671]">
                        <span className="size-6 animate-spin rounded-full border-2 border-[#d8e6de] border-t-[#176b53]" />
                        Processing image…
                      </div>
                    )}
                    {!error && previewSrc && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={previewSrc}
                        src={previewSrc}
                        alt="Transformed image preview"
                        className="max-h-[520px] w-full object-contain"
                        onLoad={() => {
                          setLoading(false);
                          setError(null);
                        }}
                        onError={() => {
                          setLoading(false);
                          setError(
                            "The transformed image preview could not be displayed.",
                          );
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-[#e1e8e4] pt-5">
                <div>
                  <p className="text-[9px] font-bold tracking-wider text-[#84908a]">
                    WIDTH
                  </p>
                  <p className="mt-2 text-sm font-bold tabular-nums">
                    {submittedWidth || "Auto"}
                    {submittedWidth ? " px" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold tracking-wider text-[#84908a]">
                    HEIGHT
                  </p>
                  <p className="mt-2 text-sm font-bold tabular-nums">
                    {submittedHeight || "Auto"}
                    {submittedHeight ? " px" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold tracking-wider text-[#84908a]">
                    QUALITY
                  </p>
                  <p className="mt-2 text-sm font-bold tabular-nums">
                    {submittedQuality}%
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#e1e8e4] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.14em] text-[#176b53]">
                    03 / INTEGRATE
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight">
                    Use the API directly
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={copyApiUrl}
                  className="shrink-0 rounded-lg border border-[#dbe4df] px-3 py-2 text-xs font-bold transition hover:border-[#176b53] hover:text-[#176b53]"
                >
                  {copied ? "Copied ✓" : "Copy URL"}
                </button>
              </div>
              <p className="mt-3 text-xs leading-6 text-[#697671]">
                Use the same settings through a simple HTTP GET request.
              </p>
              <div className="mt-4 flex min-w-0 items-start gap-3 rounded-lg border border-[#e1e8e4] bg-[#f8faf8] p-3">
                <span className="shrink-0 rounded bg-[#e8f3ed] px-2 py-1 text-[9px] font-extrabold text-[#176b53]">
                  GET
                </span>
                <code className="min-w-0 break-all text-[11px] leading-5 text-[#52625a]">
                  {requestUrl}
                </code>
              </div>
            </section>
          </div>
        </div>

        <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-[#e1e8e4] py-6 text-[10px] text-[#89948e] sm:flex-row">
          <span className="font-extrabold tracking-widest">OURS PRIVACY</span>
          <span>Secure by design. Optimized by default.</span>
        </footer>
      </div>
    </main>
  );
}
