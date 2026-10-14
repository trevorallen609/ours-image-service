import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

function createImageResponse() {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob(["fake-image"], { type: "image/webp" }),
  };
}

function submitForm() {
  const input = screen.getByLabelText("Source image URL");
  fireEvent.submit(input.closest("form")!);
}

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:test-image"),
  });

  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createImageResponse()));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HomePage", () => {
  it("renders the main heading and transformation controls", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "Images, transformed." }),
    ).toBeTruthy();

    expect(screen.getByLabelText("Source image URL")).toBeTruthy();
    expect(screen.getByLabelText("Width (px)")).toBeTruthy();
    expect(screen.getByLabelText("Height (px)")).toBeTruthy();
    expect(screen.getByLabelText("Output format")).toBeTruthy();
    expect(screen.getByLabelText("Resize behavior")).toBeTruthy();
    expect(screen.getByLabelText("Quality")).toBeTruthy();
  });

  it("requests the transformed image and displays the preview", async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const preview = await screen.findByAltText("Transformed image preview");

    expect(preview.getAttribute("src")).toBe("blob:test-image");

    const [requestUrl, requestOptions] = vi.mocked(fetch).mock.calls[0];

    expect(String(requestUrl)).toContain("/api/image?");
    expect(String(requestUrl)).toContain("format=webp");
    expect(String(requestUrl)).toContain("quality=80");
    expect(String(requestUrl)).toContain("fit=cover");
    expect(String(requestUrl)).toContain("width=800");
    expect(String(requestUrl)).toContain("height=500");

    expect(requestOptions?.signal).toBeInstanceOf(AbortSignal);
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it("displays an error when the API returns a failure status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    render(<HomePage />);

    expect(await screen.findByRole("alert")).toBeTruthy();

    expect(screen.getByRole("alert").textContent).toContain(
      "Image request failed (500)",
    );

    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("displays an error when the API request rejects", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network unavailable"));

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Network unavailable",
      );
    });

    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects an invalid source URL", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("Source image URL"), {
      target: { value: "not-a-valid-url" },
    });

    submitForm();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Enter a valid image URL.",
    );
  });

  it("rejects a non-HTTPS source URL", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("Source image URL"), {
      target: { value: "http://example.com/image.jpg" },
    });

    submitForm();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Please use an HTTPS image URL.",
    );
  });

  it("rejects a width greater than 2048 pixels", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("Width (px)"), {
      target: { value: "3000" },
    });

    submitForm();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Width and height must be between 1 and 2048 pixels.",
    );
  });

  it("rejects a height of zero", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("Height (px)"), {
      target: { value: "0" },
    });

    submitForm();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Width and height must be between 1 and 2048 pixels.",
    );
  });

  it("aborts the request when the component unmounts", async () => {
    const pending = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(pending.promise);

    const { unmount } = render(<HomePage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });

    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;

    unmount();

    expect(signal?.aborted).toBe(true);

    pending.resolve(createImageResponse() as Response);
  });

  it("revokes the Blob URL when the component unmounts", async () => {
    const { unmount } = render(<HomePage />);

    await screen.findByAltText("Transformed image preview");

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-image");
  });

  it("aborts the previous request when a new URL is submitted", async () => {
    const firstRequest = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(firstRequest.promise);

    render(<HomePage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });

    const firstSignal = vi.mocked(fetch).mock.calls[0][1]?.signal;

    fireEvent.change(screen.getByLabelText("Source image URL"), {
      target: { value: "https://example.com/another-image.jpg" },
    });

    fireEvent.submit(
      screen.getByLabelText("Source image URL").closest("form")!,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    expect(firstSignal?.aborted).toBe(true);

    firstRequest.resolve(createImageResponse() as Response);
  });

  it("does not create a Blob URL when an API response is not an image", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: async () => new Blob(["not-an-image"], { type: "text/plain" }),
    } as Response);

    render(<HomePage />);

    expect(await screen.findByRole("alert")).toBeTruthy();

    expect(screen.getByRole("alert").textContent).toContain(
      "The API did not return an image.",
    );

    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("revokes a Blob URL created after the request is cancelled", async () => {
    const pendingBlob = deferred<Blob>();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: () => pendingBlob.promise,
    } as Response);

    const { unmount } = render(<HomePage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });

    // Wait until the response body is being read.
    await waitFor(() => {
      expect(pendingBlob.promise).toBeDefined();
    });

    unmount();

    pendingBlob.resolve(new Blob(["late-image"], { type: "image/webp" }));

    await waitFor(() => {
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-image");
    });
  });
});
