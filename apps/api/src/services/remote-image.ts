import { lookup } from "node:dns/promises";
import https from "node:https";
import ipaddr from "ipaddr.js";

export type RemoteImageErrorCode =
  | "INVALID_IMAGE_URL"
  | "UNSAFE_IMAGE_HOST"
  | "IMAGE_FETCH_FAILED"
  | "IMAGE_TOO_LARGE"
  | "IMAGE_FETCH_TIMEOUT";

export class RemoteImageError extends Error {
  constructor(public readonly code: RemoteImageErrorCode) {
    super(code);
    this.name = "RemoteImageError";
  }
}

const MAX_BYTES = 10 * 1024 * 1024;
const DNS_TIMEOUT_MS = 3_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

type PinnedAddress = {
  address: string;
  family: 4 | 6;
};

type FetchResponse = {
  status: number;
  location?: string;
  data?: Buffer;
};

type FetchDependencies = {
  resolve: (hostname: string) => Promise<PinnedAddress>;
  request: (url: URL, pinned: PinnedAddress) => Promise<FetchResponse>;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new RemoteImageError("IMAGE_FETCH_TIMEOUT"));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function normalizeIp(address: string): string {
  return address.replace(/^\[|\]$/g, "");
}

export function isPublicIp(input: string): boolean {
  try {
    const address = ipaddr.parse(input.replace(/^\[|\]$/g, ""));

    // Normalize IPv4-mapped IPv6 addresses, e.g. ::ffff:127.0.0.1.
    const normalized =
      address.kind() === "ipv6"
        ? (address as ipaddr.IPv6).isIPv4MappedAddress()
          ? (address as ipaddr.IPv6).toIPv4Address()
          : address
        : address;

    // ipaddr.js classifies special-purpose ranges separately from
    // globally routable unicast addresses.
    return normalized.range() === "unicast";
  } catch {
    return false;
  }
}

async function resolvePublicAddress(hostname: string): Promise<PinnedAddress> {
  const normalizedHostname = normalizeIp(hostname);

  if (ipaddr.isValid(normalizedHostname)) {
    if (!isPublicIp(normalizedHostname)) {
      throw new RemoteImageError("UNSAFE_IMAGE_HOST");
    }

    const address = ipaddr.parse(normalizedHostname);

    return {
      address: address.toString(),
      family: address.kind() === "ipv4" ? 4 : 6,
    };
  }

  type LookupAnswer = {
    address: string;
    family: number;
  };

  let answers: LookupAnswer[];

  try {
    answers = await withTimeout(
      lookup(normalizedHostname, {
        all: true,
        verbatim: true,
      }),
      DNS_TIMEOUT_MS,
    );
  } catch (error) {
    if (
      error instanceof RemoteImageError &&
      error.code === "IMAGE_FETCH_TIMEOUT"
    ) {
      throw error;
    }

    throw new RemoteImageError("IMAGE_FETCH_FAILED");
  }

  if (
    answers.length === 0 ||
    answers.some(({ address }) => !isPublicIp(address))
  ) {
    throw new RemoteImageError("UNSAFE_IMAGE_HOST");
  }

  const selected = answers[0];

  if (!selected || (selected.family !== 4 && selected.family !== 6)) {
    throw new RemoteImageError("IMAGE_FETCH_FAILED");
  }

  return {
    address: selected.address,
    family: selected.family,
  };
}

function requestOnce(url: URL, pinned: PinnedAddress): Promise<FetchResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finishError = (error: RemoteImageError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    // Pin the connection to the IP address that passed validation.
    const pinnedLookup: NonNullable<https.RequestOptions["lookup"]> = (
      _hostname,
      options,
      callback,
    ) => {
      if (
        options &&
        typeof options === "object" &&
        "all" in options &&
        options.all
      ) {
        callback(null, [{ address: pinned.address, family: pinned.family }]);
      } else {
        callback(null, pinned.address, pinned.family);
      }
    };

    const req = https.request(
      url,
      {
        method: "GET",
        lookup: pinnedLookup,
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg",
          "User-Agent": "ours-image-service/1.0",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;

        if ([301, 302, 303, 307, 308].includes(status)) {
          const location = res.headers.location;
          res.resume();

          if (settled) return;
          settled = true;
          resolve({ status, location });
          return;
        }

        if (status !== 200) {
          res.resume();
          finishError(new RemoteImageError("IMAGE_FETCH_FAILED"));
          return;
        }

        const contentLength = res.headers["content-length"];

        if (contentLength !== undefined) {
          if (!/^\d+$/.test(contentLength)) {
            res.destroy();
            finishError(new RemoteImageError("IMAGE_FETCH_FAILED"));
            return;
          }

          const length = Number(contentLength);

          if (!Number.isSafeInteger(length)) {
            res.destroy();
            finishError(new RemoteImageError("IMAGE_FETCH_FAILED"));
            return;
          }

          if (length > MAX_BYTES) {
            res.destroy();
            finishError(new RemoteImageError("IMAGE_TOO_LARGE"));
            return;
          }
        }

        const chunks: Buffer[] = [];
        let total = 0;

        res.on("data", (chunk: Buffer | string) => {
          if (settled) return;

          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buffer.length;

          if (total > MAX_BYTES) {
            finishError(new RemoteImageError("IMAGE_TOO_LARGE"));
            res.destroy();
            req.destroy();
            return;
          }

          chunks.push(buffer);
        });

        res.on("end", () => {
          if (settled) return;
          settled = true;
          resolve({ status: 200, data: Buffer.concat(chunks) });
        });

        res.on("error", () => {
          finishError(new RemoteImageError("IMAGE_FETCH_FAILED"));
        });

        res.on("aborted", () => {
          finishError(new RemoteImageError("IMAGE_FETCH_FAILED"));
        });
      },
    );

    const timer = setTimeout(() => {
      finishError(new RemoteImageError("IMAGE_FETCH_TIMEOUT"));
      req.destroy();
    }, REQUEST_TIMEOUT_MS);

    req.on("close", () => clearTimeout(timer));

    req.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;

      if (error.message === "IMAGE_FETCH_TIMEOUT") {
        finishError(new RemoteImageError("IMAGE_FETCH_TIMEOUT"));
      } else {
        finishError(new RemoteImageError("IMAGE_FETCH_FAILED"));
      }
    });

    req.end();
  });
}

const defaultDependencies: FetchDependencies = {
  resolve: resolvePublicAddress,
  request: requestOnce,
};

export async function fetchRemoteImage(
  input: string,
  dependencies: FetchDependencies = defaultDependencies,
): Promise<Buffer> {
  let current: URL;

  try {
    current = new URL(input);
  } catch {
    throw new RemoteImageError("INVALID_IMAGE_URL");
  }

  for (let redirects = 0; ; redirects++) {
    if (
      current.protocol !== "https:" ||
      current.username ||
      current.password ||
      !current.hostname ||
      (current.port !== "" && current.port !== "443")
    ) {
      throw new RemoteImageError("INVALID_IMAGE_URL");
    }

    const pinned = await withTimeout(
      dependencies.resolve(current.hostname),
      DNS_TIMEOUT_MS,
    );
    const response = await dependencies.request(current, pinned);

    if (response.status === 200 && response.data) {
      return response.data;
    }

    if (
      ![301, 302, 303, 307, 308].includes(response.status) ||
      !response.location ||
      redirects >= MAX_REDIRECTS
    ) {
      throw new RemoteImageError("IMAGE_FETCH_FAILED");
    }

    try {
      current = new URL(response.location, current);
    } catch {
      throw new RemoteImageError("INVALID_IMAGE_URL");
    }

    // The next iteration validates the new URL and resolves its host again.
  }
}
